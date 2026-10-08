import { type AxiosResponse } from 'axios';

import apiClient from './apiClient';
import {
  getAllLocalAppointments,
  getAllAppointmentsByPetId,
  getAppointmentSnapshotByPetId,
  isReadableAppointmentForConflicts,
  getAppointmentsInWindow,
  upsertAppointment,
  deleteAppointmentById,
} from './localDB';
import { getScheduleForRange } from './medicationService';
import { AppointmentStatus } from '../models/Appointment';
import type { Appointment, AppointmentRecurrence } from '../models/Appointment';
import type { Medication } from '../models/Medication';

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type { Appointment } from '../models/Appointment';
export { AppointmentStatus } from '../models/Appointment';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = '/appointments';

/** Existing medication proximity window and suggested-slot step (ms). */
export const CONFLICT_BUFFER_MS = 60 * 60 * 1000; // 1 hour

/** Default free gap between appointment intervals, as requested in issue #49. */
export const DEFAULT_APPOINTMENT_BUFFER_MINUTES = 30;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppointmentConflict {
  type: 'appointment' | 'medication';
  description: string;
  conflictingAppointment?: Appointment;
  medicationName?: string;
  medicationTime?: Date;
}

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: AppointmentConflict[];
  /** Whether the local appointment reads needed for this result completed without skipped rows. */
  appointmentReadComplete: boolean;
  checkWarning?: string;
  suggestedTime?: Date;
}

export interface AvailabilityResult {
  vetId: string;
  date: string;
  availableSlots: string[];
}

interface AppointmentInterval {
  startMs: number;
  endMs: number;
}

// ─── Availability ─────────────────────────────────────────────────────────────

export async function getAvailability(vetId: string, date: string): Promise<AvailabilityResult> {
  const response: AxiosResponse<{ data: AvailabilityResult }> = await apiClient.get(
    `${BASE_URL}/availability`,
    { params: { vetId, date } },
  );
  return response.data.data;
}

// ─── Conflict Detection ───────────────────────────────────────────────────────

export async function detectConflicts(
  petId: string,
  proposedTime: Date,
  medications: Medication[] = [],
  excludeId?: string,
  includeSuggestedTime = true,
  appointmentBufferMinutes = DEFAULT_APPOINTMENT_BUFFER_MINUTES,
  proposedDurationMinutes = 30,
): Promise<ConflictDetectionResult> {
  const appointmentBufferMs = getAppointmentBufferMs(appointmentBufferMinutes);
  const lookupBufferMs = Math.max(CONFLICT_BUFFER_MS, appointmentBufferMs);
  const windowStart = new Date(proposedTime.getTime() - lookupBufferMs).toISOString();
  const windowEnd = new Date(proposedTime.getTime() + lookupBufferMs).toISOString();

  const nearby = await getAppointmentsInWindow<Appointment>(petId, windowStart, windowEnd).catch(
    () => undefined,
  );
  const snapshot = await getAppointmentSnapshotByPetId<Appointment>(petId).catch(() => undefined);
  const appointmentCandidates = mergeAppointmentsById(
    nearby?.filter(isReadableAppointmentForConflicts) ?? [],
    snapshot?.appointments ?? [],
  );
  const result = detectConflictsInAppointments(
    proposedTime,
    medications,
    appointmentCandidates,
    excludeId,
    appointmentBufferMs,
    proposedDurationMinutes,
  );
  if (!snapshot || snapshot.unreadableRows > 0) {
    return {
      ...result,
      appointmentReadComplete: false,
      checkWarning:
        'Some saved appointments could not be read. Conflicts may be missing, and no suggested time is available.',
      suggestedTime: undefined,
    };
  }

  let suggestedTime: Date | undefined;
  if (result.hasConflicts && includeSuggestedTime) {
    try {
      suggestedTime = await findNextAvailableSlot(
        petId,
        proposedTime,
        medications,
        excludeId,
        appointmentBufferMinutes,
        proposedDurationMinutes,
      );
    } catch {
      return {
        ...result,
        appointmentReadComplete: false,
        checkWarning:
          'The suggested-time search could not finish. Known conflicts are shown, but no alternative time has been confirmed.',
        suggestedTime: undefined,
      };
    }
  }
  return { ...result, appointmentReadComplete: true, suggestedTime };
}

function detectConflictsInAppointments(
  proposedTime: Date,
  medications: Medication[],
  appointmentCandidates: Appointment[],
  excludeId: string | undefined,
  appointmentBufferMs: number,
  proposedDurationMinutes: number,
): Pick<ConflictDetectionResult, 'hasConflicts' | 'conflicts'> {
  const conflicts: AppointmentConflict[] = [];
  const proposedInterval = {
    startMs: proposedTime.getTime(),
    endMs: proposedTime.getTime() + proposedDurationMinutes * 60_000,
  };

  for (const appt of appointmentCandidates) {
    if (excludeId && appt.id === excludeId) continue;
    if (String(appt.status).toLowerCase() === AppointmentStatus.CANCELLED.toLowerCase()) continue;

    const baseStartMs = getAppointmentInterval(appt).startMs;
    for (const apptInterval of getAppointmentIntervalsNear(
      appt,
      proposedInterval,
      appointmentBufferMs,
    )) {
      const overlaps =
        apptInterval.startMs < proposedInterval.endMs &&
        proposedInterval.startMs < apptInterval.endMs;
      const gapMs = getIntervalGapMs(apptInterval, proposedInterval);
      if (!overlaps && (appointmentBufferMs === 0 || gapMs > appointmentBufferMs)) continue;

      const recurringOccurrence =
        appt.recurrence !== undefined && apptInterval.startMs !== baseStartMs;
      conflicts.push({
        type: 'appointment',
        description: recurringOccurrence
          ? `Recurring "${appt.title ?? 'Appointment'}" is scheduled ${_formatTimeDiff(gapMs)} from the proposed time.`
          : `"${appt.title ?? 'Appointment'}" is scheduled ${_formatTimeDiff(gapMs)} from the proposed time.`,
        conflictingAppointment: appt,
      });
      break;
    }
  }

  // A vet-supervised dose conflicts when it falls anywhere inside the
  // appointment, not just within one hour of the appointment's start.
  // Retain the existing one-hour proximity warning on BOTH sides.
  const windowStartDate = new Date(proposedInterval.startMs - CONFLICT_BUFFER_MS);
  const windowEndDate = new Date(proposedInterval.endMs + CONFLICT_BUFFER_MS);

  for (const med of medications) {
    if (!isVetSupervised(med)) continue;
    const doseTimes = getScheduleForRange(med, windowStartDate, windowEndDate);
    for (const doseTime of doseTimes) {
      const doseMs = doseTime.getTime();
      const diffMs =
        doseMs < proposedInterval.startMs
          ? proposedInterval.startMs - doseMs
          : doseMs > proposedInterval.endMs
            ? doseMs - proposedInterval.endMs
            : 0;
      if (diffMs <= CONFLICT_BUFFER_MS) {
        conflicts.push({
          type: 'medication',
          description: `"${med.name}" requires vet supervision at ${_formatTime(doseTime)} (within ${_formatTimeDiff(diffMs)} of the proposed appointment).`,
          medicationName: med.name,
          medicationTime: doseTime,
        });
      }
    }
  }

  return { hasConflicts: conflicts.length > 0, conflicts };
}

export function isVetSupervised(med: Medication): boolean {
  const haystack = [med.instructions ?? '', med.notes ?? ''].join(' ').toLowerCase();
  return (
    haystack.includes('vet') ||
    haystack.includes('supervis') ||
    haystack.includes('injection') ||
    haystack.includes('infusion') ||
    haystack.includes('administered by')
  );
}

export async function findNextAvailableSlot(
  petId: string,
  from: Date,
  medications: Medication[] = [],
  excludeId?: string,
  appointmentBufferMinutes = DEFAULT_APPOINTMENT_BUFFER_MINUTES,
  proposedDurationMinutes = 30,
): Promise<Date | undefined> {
  const appointmentBufferMs = getAppointmentBufferMs(appointmentBufferMinutes);
  const lookupBufferMs = Math.max(CONFLICT_BUFFER_MS, appointmentBufferMs);
  const MAX_ITERATIONS = 14 * 24;
  let candidate = new Date(from.getTime() + CONFLICT_BUFFER_MS);
  let appointmentCandidates: Appointment[] | undefined;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    // Keep the detector's invalid/out-of-range time rejection before any database read.
    new Date(candidate.getTime() - lookupBufferMs).toISOString();
    new Date(candidate.getTime() + lookupBufferMs).toISOString();
    if (!appointmentCandidates) {
      // One complete local snapshot belongs only to this search; later calls read again.
      const snapshot = await getAppointmentSnapshotByPetId<Appointment>(petId).catch(
        () => undefined,
      );
      if (!snapshot || snapshot.unreadableRows > 0) {
        throw new Error('The local appointment check is incomplete; no suggested time is available.');
      }
      appointmentCandidates = mergeAppointmentsById([], snapshot.appointments);
    }
    const result = detectConflictsInAppointments(
      candidate,
      medications,
      appointmentCandidates,
      excludeId,
      appointmentBufferMs,
      proposedDurationMinutes,
    );
    if (!result.hasConflicts) return candidate;
    candidate = new Date(candidate.getTime() + CONFLICT_BUFFER_MS);
  }
  return undefined;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getAppointments(petId?: string): Promise<Appointment[]> {
  if (petId) return getUpcomingAppointments(petId);

  try {
    const response: AxiosResponse<{ data: Appointment[] }> = await apiClient.get(BASE_URL);
    const remoteAppts = response.data.data;
    await Promise.all(remoteAppts.map((a) => upsertAppointment(a)));
    return remoteAppts;
  } catch {
    return getAllLocalAppointments<Appointment>();
  }
}

export async function getUpcomingAppointments(petId: string): Promise<Appointment[]> {
  try {
    const response: AxiosResponse<{ data: Appointment[] }> = await apiClient.get(
      `${BASE_URL}?petId=${petId}`,
    );
    const now = new Date();
    const upcoming = response.data.data
      .filter((a) => {
        const startMs = getAppointmentInterval(a).startMs;
        return (
          Number.isFinite(startMs) &&
          startMs >= now.getTime() &&
          String(a.status).toLowerCase() !== AppointmentStatus.CANCELLED.toLowerCase()
        );
      })
      .sort((a, b) => getAppointmentInterval(a).startMs - getAppointmentInterval(b).startMs);
    await Promise.all(upcoming.map((a) => upsertAppointment(a)));
    return upcoming;
  } catch {
    const local = await getAllAppointmentsByPetId<Appointment>(petId);
    const now = new Date();
    return local
      .filter((a) => {
        const startMs = getAppointmentInterval(a).startMs;
        return (
          Number.isFinite(startMs) &&
          startMs >= now.getTime() &&
          String(a.status).toLowerCase() !== AppointmentStatus.CANCELLED.toLowerCase()
        );
      })
      .sort((a, b) => getAppointmentInterval(a).startMs - getAppointmentInterval(b).startMs);
  }
}

export function getUpcoming(appointments: Appointment[]): Appointment[] {
  const nowMs = Date.now();
  return appointments
    .filter((a) => {
      const startMs = getAppointmentInterval(a).startMs;
      return (
        Number.isFinite(startMs) &&
        startMs >= nowMs &&
        String(a.status).toLowerCase() !== AppointmentStatus.CANCELLED.toLowerCase()
      );
    })
    .sort((a, b) => getAppointmentInterval(a).startMs - getAppointmentInterval(b).startMs);
}

export function getPast(appointments: Appointment[]): Appointment[] {
  const nowMs = Date.now();
  return appointments
    .filter((a) => {
      const startMs = getAppointmentInterval(a).startMs;
      return (
        (Number.isFinite(startMs) && startMs < nowMs) ||
        String(a.status).toLowerCase() === AppointmentStatus.CANCELLED.toLowerCase()
      );
    })
    .sort((a, b) => getAppointmentInterval(b).startMs - getAppointmentInterval(a).startMs);
}

export async function saveAppointment(
  appointment: Omit<Appointment, 'id'> & { id?: string },
  conflictResolutionNote?: string,
): Promise<Appointment> {
  const appt = { ...appointment } as Appointment;
  if (conflictResolutionNote) {
    appt.notes = appt.notes
      ? `${appt.notes}\n\n[Conflict resolution]: ${conflictResolutionNote}`
      : `[Conflict resolution]: ${conflictResolutionNote}`;
  }

  if (appt.id) {
    await upsertAppointment(appt);
  }

  try {
    if (appt.id) {
      const response = await apiClient.put<{ data: Appointment }>(`${BASE_URL}/${appt.id}`, appt);
      const saved = response.data.data;
      await upsertAppointment(saved);
      return saved;
    }
    const response = await apiClient.post<{ data: Appointment }>(BASE_URL, appt);
    const saved = response.data.data;
    await upsertAppointment(saved);
    return saved;
  } catch {
    return appt;
  }
}

/** Cancel an appointment via the dedicated cancel endpoint. */
export async function cancelAppointmentById(id: string, reason?: string): Promise<Appointment> {
  try {
    const response = await apiClient.post<{ data: Appointment }>(`${BASE_URL}/${id}/cancel`, {
      reason,
    });
    const cancelled = response.data.data;
    await upsertAppointment(cancelled);
    return cancelled;
  } catch {
    // Offline: update locally
    const local = (await getAllLocalAppointments<Appointment>()).find((a) => a.id === id);
    if (local) {
      const updated = { ...local, status: AppointmentStatus.CANCELLED, cancellationReason: reason };
      await upsertAppointment(updated);
      return updated;
    }
    throw new Error('Appointment not found');
  }
}

/** Reschedule an appointment via the dedicated reschedule endpoint. */
export async function rescheduleAppointment(
  id: string,
  date: string,
  time: string,
  durationMinutes?: number,
): Promise<Appointment> {
  try {
    const response = await apiClient.post<{ data: Appointment }>(`${BASE_URL}/${id}/reschedule`, {
      date,
      time,
      durationMinutes,
    });
    const rescheduled = response.data.data;
    await upsertAppointment(rescheduled);
    return rescheduled;
  } catch {
    const local = (await getAllLocalAppointments<Appointment>()).find((a) => a.id === id);
    if (local) {
      const updated = {
        ...local,
        date,
        time,
        ...(durationMinutes !== undefined ? { durationMinutes } : {}),
        status: AppointmentStatus.RESCHEDULED,
        rescheduledFrom: `${local.date}T${local.time}`,
      };
      await upsertAppointment(updated);
      return updated;
    }
    throw new Error('Appointment not found');
  }
}

export async function deleteAppointment(id: string): Promise<void> {
  await deleteAppointmentById(id);
  try {
    await apiClient.delete(`${BASE_URL}/${id}`);
  } catch {
    // Offline: deletion already happened locally
  }
}

// ─── Notification helpers ─────────────────────────────────────────────────────

/**
 * Schedule 24h and 1h reminder notifications for an appointment.
 * Returns [notifId24h, notifId1h] — either may be null if scheduling failed
 * (e.g. appointment is too soon or in the past).
 */
export async function scheduleAppointmentReminders(
  appointment: Appointment,
): Promise<[string | null, string | null]> {
  const { scheduleAppointmentNotification } = await import('./notificationService');

  // Appointment.date may already contain a complete ISO instant; never append another time.
  const apptMs = getAppointmentInterval(appointment).startMs;
  const now = Date.now();

  const title = appointment.title ?? appointment.notes ?? 'Vet Appointment';

  const notif24h =
    apptMs - 24 * 60 * 60 * 1000 > now
      ? await scheduleAppointmentNotification({
          id: `${appointment.id}-24h`,
          title: `Reminder: ${title} tomorrow`,
          date: new Date(apptMs - 24 * 60 * 60 * 1000).toISOString(),
          location: appointment.location,
        }).catch(() => null)
      : null;

  const notif1h =
    apptMs - 60 * 60 * 1000 > now
      ? await scheduleAppointmentNotification({
          id: `${appointment.id}-1h`,
          title: `Reminder: ${title} in 1 hour`,
          date: new Date(apptMs - 60 * 60 * 1000).toISOString(),
          location: appointment.location,
        }).catch(() => null)
      : null;

  return [notif24h, notif1h];
}

/** Legacy single-reminder helper (kept for backward compatibility). */
export async function scheduleAppointmentReminder(
  appointment: Appointment,
): Promise<string | null> {
  const [notif24h] = await scheduleAppointmentReminders(appointment);
  return notif24h;
}

export async function cancelAppointmentReminder(notificationId: string): Promise<void> {
  const { cancelEntityNotification } = await import('./notificationService');
  return cancelEntityNotification(notificationId);
}

/** Cancel all reminders for an appointment (both 24h and 1h). */
export async function cancelAllAppointmentReminders(appointmentId: string): Promise<void> {
  const { cancelEntityNotification } = await import('./notificationService');
  await Promise.allSettled([
    cancelEntityNotification(`${appointmentId}-24h`),
    cancelEntityNotification(`${appointmentId}-1h`),
    cancelEntityNotification(appointmentId), // legacy single-id
  ]);
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function getAppointmentBufferMs(bufferMinutes: number): number {
  const bufferMs = bufferMinutes * 60_000;
  if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0 || !Number.isFinite(bufferMs)) {
    throw new RangeError('Appointment buffer must be a finite nonnegative number of minutes.');
  }
  return bufferMs;
}

function _formatTimeDiff(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(ms / 3_600_000);
  return `${hrs} hr`;
}

function getAppointmentInterval(appt: Appointment): AppointmentInterval {
  const start = appt.date.includes('T')
    ? new Date(appt.date)
    : new Date(`${appt.date}T${appt.time ?? '00:00'}:00`);
  const durationMinutes = appt.durationMinutes ?? 30;
  return {
    startMs: start.getTime(),
    endMs: start.getTime() + durationMinutes * 60_000,
  };
}

function getAppointmentIntervalsNear(
  appt: Appointment,
  proposedInterval: AppointmentInterval,
  appointmentBufferMs: number,
): AppointmentInterval[] {
  const baseInterval = getAppointmentInterval(appt);
  const recurrence = appt.recurrence;
  if (!recurrence) return [baseInterval];

  const interval =
    Number.isInteger(recurrence.interval) && (recurrence.interval ?? 0) > 0
      ? recurrence.interval!
      : 1;
  const count =
    recurrence.count === undefined
      ? undefined
      : Number.isInteger(recurrence.count) && recurrence.count > 0
        ? recurrence.count
        : 1;
  const untilMs =
    recurrence.until && /^\d{4}-\d{2}-\d{2}$/.test(recurrence.until)
      ? new Date(`${recurrence.until}T23:59:59.999`).getTime()
      : undefined;
  const durationMs = baseInterval.endMs - baseInterval.startMs;
  const windowStartMs = proposedInterval.startMs - appointmentBufferMs - durationMs;
  const windowEndMs = proposedInterval.endMs + appointmentBufferMs;
  const baseStart = new Date(baseInterval.startMs);
  const candidates = new Set<number>([0]);

  const addNearbyIndexes = (targetMs: number) => {
    const approximate = approximateRecurrenceIndex(baseStart, targetMs, recurrence, interval);
    for (let offset = -2; offset <= 2; offset++) {
      candidates.add(Math.max(0, approximate + offset));
    }
  };

  addNearbyIndexes(windowStartMs);
  addNearbyIndexes(proposedInterval.startMs);
  addNearbyIndexes(windowEndMs);
  if (untilMs !== undefined && Number.isFinite(untilMs)) addNearbyIndexes(untilMs);
  if (count !== undefined) candidates.add(Math.max(0, count - 1));

  const intervals: AppointmentInterval[] = [];
  const seenStarts = new Set<number>();
  for (const occurrenceIndex of [...candidates].sort((a, b) => a - b)) {
    if (count !== undefined && occurrenceIndex >= count) continue;
    const start = recurrenceStartAt(baseStart, recurrence, interval, occurrenceIndex);
    const startMs = start.getTime();
    if (!Number.isFinite(startMs) || seenStarts.has(startMs)) continue;
    if (occurrenceIndex > 0 && untilMs !== undefined && startMs > untilMs) continue;
    if (
      occurrenceIndex > 0 &&
      (startMs > windowEndMs || startMs + durationMs < windowStartMs)
    ) {
      continue;
    }

    seenStarts.add(startMs);
    intervals.push({ startMs, endMs: startMs + durationMs });
  }

  return intervals.length > 0 ? intervals : [baseInterval];
}

function approximateRecurrenceIndex(
  baseStart: Date,
  targetMs: number,
  recurrence: AppointmentRecurrence,
  interval: number,
): number {
  if (targetMs <= baseStart.getTime()) return 0;
  if (recurrence.frequency === 'daily' || recurrence.frequency === 'weekly') {
    const daysPerOccurrence = recurrence.frequency === 'daily' ? interval : interval * 7;
    return Math.max(
      0,
      Math.floor(
        (targetMs - baseStart.getTime()) / (daysPerOccurrence * 24 * 60 * 60 * 1000),
      ),
    );
  }

  const target = new Date(targetMs);
  const monthDelta =
    (target.getFullYear() - baseStart.getFullYear()) * 12 +
    target.getMonth() -
    baseStart.getMonth();
  return Math.max(0, Math.floor(monthDelta / interval));
}

function recurrenceStartAt(
  baseStart: Date,
  recurrence: AppointmentRecurrence,
  interval: number,
  occurrenceIndex: number,
): Date {
  const next = new Date(baseStart);
  const step = interval * occurrenceIndex;

  if (recurrence.frequency === 'daily') {
    next.setDate(next.getDate() + step);
    return next;
  }
  if (recurrence.frequency === 'weekly') {
    next.setDate(next.getDate() + step * 7);
    return next;
  }

  const originalDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + step);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, lastDay));
  return next;
}

function getIntervalGapMs(a: AppointmentInterval, b: AppointmentInterval): number {
  if (a.startMs <= b.endMs && b.startMs <= a.endMs) {
    return 0;
  }
  return Math.min(Math.abs(a.startMs - b.endMs), Math.abs(b.startMs - a.endMs));
}

function mergeAppointmentsById(primary: Appointment[], secondary: Appointment[]): Appointment[] {
  const byId = new Map<string, Appointment>();
  [...primary, ...secondary].forEach((appointment) => {
    byId.set(appointment.id, appointment);
  });
  return Array.from(byId.values());
}

function _formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export interface ConflictCheckResponse {
  conflicts: Array<{
    type: 'exact' | 'near';
    appointment: Appointment;
  }>;
  canSave: boolean;
  hasWarning: boolean;
  reason?: string;
}

/**
 * Check for appointment conflicts for a pet and vet at a given time.
 * @param petId - Pet ID
 * @param vetId - Vet ID
 * @param date - Date in YYYY-MM-DD format
 * @param time - Time in HH:MM format
 * @param durationMinutes - Appointment duration (default 30)
 * @param excludeId - Appointment ID to exclude from conflicts (for updates)
 */
export async function checkConflicts(
  petId: string,
  vetId: string,
  date: string,
  time: string,
  durationMinutes: number = 30,
  excludeId?: string,
): Promise<ConflictCheckResponse> {
  try {
    const response = await apiClient.post<{ data: ConflictCheckResponse }>(
      `${BASE_URL}/check-conflicts`,
      {
        petId,
        vetId,
        date,
        time,
        durationMinutes,
        excludeId,
      },
    );
    return response.data.data;
  } catch (error) {
    console.error('Failed to check conflicts:', error);
    // Return safe defaults on error - allow booking but log
    return {
      conflicts: [],
      canSave: true,
      hasWarning: false,
      reason: null,
    };
  }
}
