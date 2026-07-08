/* eslint-disable @typescript-eslint/no-non-null-assertion */
import express from 'express';

import { logAuditTrail } from '../../middleware/auditLogger';
import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import { AppointmentStatus, AppointmentType } from '../../models/Appointment';
import { UserRole } from '../../models/UserRole';
import logger from '../../utils/logger';
import { ok, sendError } from '../response';
import { store, type StoredAppointment } from '../store';

const router = express.Router();
const NEAR_CONFLICT_GAP_MS = 30 * 60_000;

// ─── Per-vet booking lock (prevents double-booking under concurrent requests) ──
const vetLocks = new Map<string, Promise<void>>();

async function withVetLock<T>(vetId: string, fn: () => Promise<T>): Promise<T> {
  const prev = vetLocks.get(vetId) ?? Promise.resolve();
  let resolve!: () => void;
  const next = new Promise<void>((r) => {
    resolve = r;
  });
  vetLocks.set(vetId, next);
  try {
    await prev;
    return await fn();
  } finally {
    resolve();
    if (vetLocks.get(vetId) === next) vetLocks.delete(vetId);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toResponse(a: StoredAppointment) {
  return { success: true as const, data: a, timestamp: new Date().toISOString() };
}

/** Returns true if two appointments overlap (considering durationMinutes). */
function overlaps(a: StoredAppointment, startMs: number, endMs: number): boolean {
  if (
    a.status === AppointmentStatus.CANCELLED ||
    a.status === AppointmentStatus.COMPLETED ||
    a.status === AppointmentStatus.NO_SHOW
  )
    return false;

  const aStart = parseAppointmentStartMs(a.date, a.time);
  const aEnd = aStart + (a.durationMinutes ?? 30) * 60_000;
  return aStart < endMs && aEnd > startMs;
}

/** Generate 30-minute availability slots for a vet on a given date (UTC). */
function buildSlots(vetId: string, dateStr: string): string[] {
  const slots: string[] = [];
  const base = new Date(`${dateStr}T08:00:00Z`);
  const end = new Date(`${dateStr}T18:00:00Z`);

  const booked = [...store.appointments.values()].filter(
    (a) =>
      a.vetId === vetId &&
      a.date === dateStr &&
      a.status !== AppointmentStatus.CANCELLED &&
      a.status !== AppointmentStatus.COMPLETED &&
      a.status !== AppointmentStatus.NO_SHOW,
  );

  for (let t = base.getTime(); t < end.getTime(); t += 30 * 60_000) {
    const slotEnd = t + 30 * 60_000;
    const isTaken = booked.some((a) => {
      const aStart = parseAppointmentStartMs(a.date, a.time);
      const aEnd = aStart + (a.durationMinutes ?? 30) * 60_000;
      return aStart < slotEnd && aEnd > t;
    });
    if (!isTaken) {
      slots.push(new Date(t).toISOString().slice(11, 16)); // "HH:MM"
    }
  }
  return slots;
}

// ─── Auth middleware ───────────────────────────────────────────────────────────

router.use(authenticateJWT);

// ─── GET /appointments/availability?vetId=&date= ──────────────────────────────

router.get('/availability', (req: AuthenticatedRequest, res) => {
  const { vetId, date } = req.query as Record<string, string | undefined>;
  if (!vetId?.trim() || !date?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'vetId and date are required');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'date must be YYYY-MM-DD');
  }
  const slots = buildSlots(vetId.trim(), date.trim());
  logger.info('availability_queried', { vetId, date, slotsCount: slots.length });
  return res.json({ success: true, data: { vetId, date, availableSlots: slots } });
});

// ─── GET /appointments ────────────────────────────────────────────────────────

router.get('/', (req: AuthenticatedRequest, res) => {
  const { petId, vetId } = req.query as Record<string, string | undefined>;

  if (req.user!.role === UserRole.OWNER && !petId) {
    return sendError(res, 403, 'FORBIDDEN', 'petId parameter is required for pet owners');
  }

  if (petId) {
    const pet = store.pets.get(petId);
    if (pet && req.user!.role === UserRole.OWNER && req.user!.id !== pet.ownerId) {
      return sendError(
        res,
        403,
        'FORBIDDEN',
        'You do not have permission to view these appointments',
      );
    }
  }

  let list = [...store.appointments.values()];
  if (petId) list = list.filter((a) => a.petId === petId);
  if (vetId) list = list.filter((a) => a.vetId === vetId);
  if (req.user!.role === UserRole.VET && !petId && !vetId) {
    list = list.filter((a) => a.vetId === req.user!.id);
  }

  list.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  return res.json({
    success: true,
    data: list,
    total: list.length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /appointments/:id ────────────────────────────────────────────────────

router.get('/:id', (req: AuthenticatedRequest, res) => {
  const row = store.appointments.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  const pet = store.pets.get(row.petId);
  if (req.user!.role === UserRole.OWNER && pet?.ownerId !== req.user!.id) {
    return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to view this appointment');
  }
  if (req.user!.role === UserRole.VET && row.vetId !== req.user!.id) {
    return sendError(res, 403, 'FORBIDDEN', 'You do not have permission to view this appointment');
  }

  return res.json(toResponse(row));
});

// ─── POST /appointments ───────────────────────────────────────────────────────

router.post('/', async (req: AuthenticatedRequest, res) => {
  const body = req.body as Partial<StoredAppointment>;

  if (!body.petId?.trim() || !body.vetId?.trim() || !body.date?.trim() || !body.time?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId, vetId, date, and time are required');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date.trim())) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'date must be YYYY-MM-DD');
  }
  if (!/^\d{2}:\d{2}$/.test(body.time.trim())) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'time must be HH:MM');
  }

  const pet = store.pets.get(body.petId.trim());
  if (!pet) return sendError(res, 400, 'VALIDATION_ERROR', 'petId must reference an existing pet');

  if (req.user!.role === UserRole.OWNER && pet.ownerId !== req.user!.id) {
    return sendError(res, 403, 'FORBIDDEN', 'You can only create appointments for your own pets');
  }

  const duration = body.durationMinutes ?? 30;
  const vetId = body.vetId.trim();
  const date = body.date.trim();
  const time = body.time.trim();

  try {
    const row = await withVetLock(vetId, async () => {
      // Atomic conflict check inside the lock
      const startMs = parseAppointmentStartMs(date, time);
      const endMs = startMs + duration * 60_000;

      const conflict = [...store.appointments.values()].find(
        (a) => a.vetId === vetId && overlaps(a, startMs, endMs),
      );

      if (conflict) {
        return null; // signal conflict
      }

      const t = new Date().toISOString();
      const id = store.newId();
      const newRow: StoredAppointment = {
        id,
        petId: body.petId!.trim(),
        vetId,
        date,
        time,
        durationMinutes: duration,
        type: (body.type as AppointmentType) ?? AppointmentType.ROUTINE_CHECKUP,
        status: (body.status as AppointmentStatus) ?? AppointmentStatus.PENDING,
        notes: body.notes?.trim(),
        timeZone: body.timeZone ?? 'UTC',
        createdAt: t,
        updatedAt: t,
      };
      store.appointments.set(id, newRow);
      return newRow;
    });

    if (!row) {
      return sendError(res, 409, 'CONFLICT', 'The requested time slot is not available');
    }

    void logAuditTrail({
      req,
      entityType: 'appointment',
      entityId: row.id,
      action: 'CREATE',
      before: null,
      after: row,
    });
    logger.info('appointment_created', {
      appointmentId: row.id,
      vetId: row.vetId,
      petId: row.petId,
    });
    return res.status(201).json(toResponse(row));
  } catch (err) {
    logger.error('appointment_create_error', { error: (err as Error).message });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to create appointment');
  }
});

// ─── PUT /appointments/:id ────────────────────────────────────────────────────

router.put('/:id', async (req: AuthenticatedRequest, res) => {
  const row = store.appointments.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  const pet = store.pets.get(row.petId);
  const isOwner = req.user!.role === UserRole.OWNER && pet?.ownerId === req.user!.id;
  const isAssignedVet = req.user!.role === UserRole.VET && row.vetId === req.user!.id;
  const isAdmin = req.user!.role === UserRole.ADMIN;

  if (!isOwner && !isAssignedVet && !isAdmin) {
    return sendError(
      res,
      403,
      'FORBIDDEN',
      'You do not have permission to update this appointment',
    );
  }

  const b = req.body as Partial<StoredAppointment>;
  const t = new Date().toISOString();

  // Detect reschedule (date or time changing)
  const isReschedule =
    (b.date !== undefined && b.date !== row.date) || (b.time !== undefined && b.time !== row.time);

  const newDate = b.date !== undefined ? String(b.date) : row.date;
  const newTime = b.time !== undefined ? String(b.time) : row.time;
  const newDuration =
    b.durationMinutes !== undefined ? b.durationMinutes : (row.durationMinutes ?? 30);
  const vetId = row.vetId;

  try {
    const next = await withVetLock(vetId, async () => {
      if (isReschedule) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return null; // invalid
        if (!/^\d{2}:\d{2}$/.test(newTime)) return null;

        const startMs = parseAppointmentStartMs(newDate, newTime);
        const endMs = startMs + newDuration * 60_000;

        const conflict = [...store.appointments.values()].find(
          (a) => a.id !== row.id && a.vetId === vetId && overlaps(a, startMs, endMs),
        );
        if (conflict) return 'conflict';
      }

      const updated: StoredAppointment = {
        ...row,
        ...(b.date !== undefined ? { date: newDate } : {}),
        ...(b.time !== undefined ? { time: newTime } : {}),
        ...(b.durationMinutes !== undefined ? { durationMinutes: b.durationMinutes } : {}),
        ...(b.type !== undefined ? { type: b.type as AppointmentType } : {}),
        ...(b.status !== undefined ? { status: b.status as AppointmentStatus } : {}),
        ...(b.notes !== undefined ? { notes: b.notes } : {}),
        ...(b.vetId !== undefined && (isAdmin || isAssignedVet) ? { vetId: String(b.vetId) } : {}),
        ...(b.petId !== undefined && (isAdmin || isOwner) ? { petId: String(b.petId) } : {}),
        ...(b.timeZone !== undefined ? { timeZone: b.timeZone } : {}),
        updatedAt: t,
        ...(b.status === AppointmentStatus.CANCELLED
          ? { cancelledAt: t, cancellationReason: b.cancellationReason ?? row.cancellationReason }
          : {}),
        ...(isReschedule && b.status !== AppointmentStatus.CANCELLED
          ? { rescheduledFrom: `${row.date}T${row.time}`, status: AppointmentStatus.RESCHEDULED }
          : {}),
      };
      store.appointments.set(row.id, updated);
      return updated;
    });

    if (next === null) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid date or time format');
    }
    if (next === 'conflict') {
      return sendError(res, 409, 'CONFLICT', 'The requested time slot is not available');
    }

    void logAuditTrail({
      req,
      entityType: 'appointment',
      entityId: row.id,
      action: 'UPDATE',
      before: row,
      after: next,
    });
    logger.info('appointment_updated', { appointmentId: row.id, isReschedule });
    return res.json(toResponse(next as StoredAppointment));
  } catch (err) {
    logger.error('appointment_update_error', { error: (err as Error).message });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to update appointment');
  }
});

// ─── POST /appointments/:id/cancel ────────────────────────────────────────────

router.post('/:id/cancel', async (req: AuthenticatedRequest, res) => {
  const row = store.appointments.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  if (row.status === AppointmentStatus.CANCELLED) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Appointment is already cancelled');
  }

  const pet = store.pets.get(row.petId);
  const isOwner = req.user!.role === UserRole.OWNER && pet?.ownerId === req.user!.id;
  const isAssignedVet = req.user!.role === UserRole.VET && row.vetId === req.user!.id;
  const isAdmin = req.user!.role === UserRole.ADMIN;

  if (!isOwner && !isAssignedVet && !isAdmin) {
    return sendError(
      res,
      403,
      'FORBIDDEN',
      'You do not have permission to cancel this appointment',
    );
  }

  const t = new Date().toISOString();
  const { reason } = (req.body ?? {}) as { reason?: string };
  const cancelled: StoredAppointment = {
    ...row,
    status: AppointmentStatus.CANCELLED,
    cancelledAt: t,
    cancellationReason: reason?.trim(),
    updatedAt: t,
  };
  store.appointments.set(row.id, cancelled);

  void logAuditTrail({
    req,
    entityType: 'appointment',
    entityId: row.id,
    action: 'UPDATE',
    before: row,
    after: cancelled,
  });
  logger.info('appointment_cancelled', { appointmentId: row.id });
  return res.json(toResponse(cancelled));
});

// ─── POST /appointments/:id/reschedule ────────────────────────────────────────

router.post('/:id/reschedule', async (req: AuthenticatedRequest, res) => {
  const row = store.appointments.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  if (row.status === AppointmentStatus.CANCELLED || row.status === AppointmentStatus.COMPLETED) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Cannot reschedule a cancelled or completed appointment',
    );
  }

  const pet = store.pets.get(row.petId);
  const isOwner = req.user!.role === UserRole.OWNER && pet?.ownerId === req.user!.id;
  const isAssignedVet = req.user!.role === UserRole.VET && row.vetId === req.user!.id;
  const isAdmin = req.user!.role === UserRole.ADMIN;

  if (!isOwner && !isAssignedVet && !isAdmin) {
    return sendError(
      res,
      403,
      'FORBIDDEN',
      'You do not have permission to reschedule this appointment',
    );
  }

  const { date, time, durationMinutes } = req.body as {
    date?: string;
    time?: string;
    durationMinutes?: number;
  };
  if (!date?.trim() || !time?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'date and time are required');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'date must be YYYY-MM-DD');
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'time must be HH:MM');
  }

  const duration = durationMinutes ?? row.durationMinutes ?? 30;
  const vetId = row.vetId;

  try {
    const result = await withVetLock(vetId, async () => {
      const startMs = parseAppointmentStartMs(date, time);
      const endMs = startMs + duration * 60_000;

      const conflict = [...store.appointments.values()].find(
        (a) => a.id !== row.id && a.vetId === vetId && overlaps(a, startMs, endMs),
      );
      if (conflict) return 'conflict';

      const t = new Date().toISOString();
      const rescheduled: StoredAppointment = {
        ...row,
        date: date.trim(),
        time: time.trim(),
        durationMinutes: duration,
        status: AppointmentStatus.RESCHEDULED,
        rescheduledFrom: `${row.date}T${row.time}`,
        updatedAt: t,
      };
      store.appointments.set(row.id, rescheduled);
      return rescheduled;
    });

    if (result === 'conflict') {
      return sendError(res, 409, 'CONFLICT', 'The requested time slot is not available');
    }

    void logAuditTrail({
      req,
      entityType: 'appointment',
      entityId: row.id,
      action: 'UPDATE',
      before: row,
      after: result,
    });
    logger.info('appointment_rescheduled', { appointmentId: row.id, newDate: date, newTime: time });
    return res.json(toResponse(result as StoredAppointment));
  } catch (err) {
    logger.error('appointment_reschedule_error', { error: (err as Error).message });
    return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to reschedule appointment');
  }
});

// ─── DELETE /appointments/:id ─────────────────────────────────────────────────

router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const row = store.appointments.get(req.params.id);
  if (!row) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  const pet = store.pets.get(row.petId);
  const isOwner = req.user!.role === UserRole.OWNER && pet?.ownerId === req.user!.id;
  const isAdmin = req.user!.role === UserRole.ADMIN;

  if (!isOwner && !isAdmin) {
    return sendError(
      res,
      403,
      'FORBIDDEN',
      'You do not have permission to delete this appointment',
    );
  }

  store.appointments.delete(req.params.id);
  void logAuditTrail({
    req,
    entityType: 'appointment',
    entityId: row.id,
    action: 'DELETE',
    before: row,
    after: null,
  });
  logger.info('appointment_deleted', { appointmentId: row.id });
  return res.json(ok(null, 'Appointment deleted'));
});

/**
 * POST /appointments/check-conflicts
 * Check for conflicting appointments for a pet and vet at a given time.
 * Body: { petId, vetId, date, time, durationMinutes?, excludeId? }
 * Returns: { conflicts: Array<{type, appointment}>, canSave: boolean, reason?: string }
 */
router.post('/check-conflicts', (req: AuthenticatedRequest, res) => {
  const body = req.body as {
    petId?: string;
    vetId?: string;
    date?: string;
    time?: string;
    durationMinutes?: number;
    excludeId?: string;
  };

  if (!body.petId?.trim() || !body.vetId?.trim() || !body.date?.trim() || !body.time?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId, vetId, date, and time are required');
  }

  const petId = body.petId.trim();
  const vetId = body.vetId.trim();
  const date = body.date.trim();
  const time = body.time.trim();
  const duration = body.durationMinutes ?? 30;
  const excludeId = body.excludeId?.trim();

  // Parse the requested appointment times
  const requestedStart = new Date(parseAppointmentStartMs(date, time));
  const requestedEnd = new Date(requestedStart.getTime() + duration * 60_000);

  if (isNaN(requestedStart.getTime())) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid date/time format');
  }

  const conflicts: Array<{ type: 'exact' | 'near'; appointment: StoredAppointment }> = [];

  // Check all non-cancelled appointments
  for (const appt of store.appointments.values()) {
    if (appt.id === excludeId) continue;
    if (appt.status === AppointmentStatus.CANCELLED) continue;

    const apptStart = new Date(parseAppointmentStartMs(appt.date, appt.time));
    const apptEnd = new Date(apptStart.getTime() + (appt.durationMinutes ?? 30) * 60_000);

    // Check pet conflicts (same pet, overlapping times)
    if (appt.petId === petId) {
      const overlap = timeRangesOverlap(requestedStart, requestedEnd, apptStart, apptEnd);
      const gap = minGapBetweenRanges(requestedStart, requestedEnd, apptStart, apptEnd);

      if (overlap) {
        conflicts.push({ type: 'exact', appointment: appt });
      } else if (gap <= NEAR_CONFLICT_GAP_MS) {
        conflicts.push({ type: 'near', appointment: appt });
      }
    }

    // Check vet conflicts (same vet, overlapping times)
    if (appt.vetId === vetId) {
      const overlap = timeRangesOverlap(requestedStart, requestedEnd, apptStart, apptEnd);

      if (overlap) {
        conflicts.push({ type: 'exact', appointment: appt });
      }
    }
  }

  // Determine if we can save
  const hasExactConflict = conflicts.some((c) => c.type === 'exact');
  const hasNearConflict = conflicts.some((c) => c.type === 'near');

  return res.json({
    success: true,
    data: {
      conflicts,
      canSave: !hasExactConflict,
      hasWarning: hasNearConflict,
      reason: hasExactConflict
        ? 'Exact time conflict found. Cannot save.'
        : hasNearConflict
          ? 'Near-time conflict found (<= 30 min gap). Proceed with caution.'
          : null,
    },
    timestamp: new Date().toISOString(),
  });
});

function parseAppointmentStartMs(date: string, time: string): number {
  return new Date(`${date}T${time}:00Z`).getTime();
}

function timeRangesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
  return start1 < end2 && end1 > start2;
}

function minGapBetweenRanges(start1: Date, end1: Date, start2: Date, end2: Date): number {
  if (end1 <= start2) return Math.max(0, start2.getTime() - end1.getTime());
  if (end2 <= start1) return Math.max(0, start1.getTime() - end2.getTime());
  return 0; // Ranges overlap
}

export default router;
