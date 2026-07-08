import { type AxiosResponse } from 'axios';

import apiClient from './apiClient';
import {
  getAllLocalAppointments,
  getAllAppointmentsByPetId,
  getAppointmentsInWindow,
  upsertAppointment,
  deleteAppointmentById,
} from './localDB';
import { getScheduleForRange } from './medicationService';
import { AppointmentStatus } from '../models/Appointment';
import type { Appointment } from '../models/Appointment';
import type { Medication } from '../models/Medication';

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type { Appointment } from '../models/Appointment';
export { AppointmentStatus } from '../models/Appointment';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = '/appointments';

/** Buffer window (ms) around each appointment that counts as a conflict */
export const CONFLICT_BUFFER_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;
const CONFLICT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppointmentConflict {
  type: 'appointment' | 'medication';
  severity?: 'conflict' | 'warning';
  description: string;
  conflictingAppointment?: Appointment;
  medicationName?: string;
  medicationTime?: Date;
}

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: AppointmentConflict[];
  suggestedTime?: Date;
}

export interface AvailabilityResult {
  vetId: string;
  date: string;
  availableSlots: string[];
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
  durationMinutes: number = DEFAULT_APPOINTMENT_DURATION_MINUTES,
  includeSuggestedTime: boolean = true,
): Promise<ConflictDetectionResult> {
  const conflicts: AppointmentConflict[] = [];
  const proposedStart = proposedTime;
  const proposedEnd = new Date(proposedStart.getTime() + durationMinutes * 60_000);

  const windowStart = new Date(proposedStart.getTime() - CONFLICT_LOOKBACK_MS).toISOString();
  const windowEnd = new Date(proposedEnd.getTime() + CONFLICT_BUFFER_MS).toISOString();

  const nearby = await getAppointmentsInWindow<Appointment>(petId, windowStart, windowEnd);
  for (const appt of nearby) {
    if (excludeId && appt.id === excludeId) continue;
    if (isInactiveAppointment(appt)) continue;

    const apptRange = getAppointmentRange(appt);
    if (!apptRange) continue;

    const overlaps = timeRangesOverlap(proposedStart, proposedEnd, apptRange.start, apptRange.end);
    const gapMs = minGapBetweenRanges(proposedStart, proposedEnd, apptRange.start, apptRange.end);

    if (overlaps || gapMs <= CONFLICT_BUFFER_MS) {
      const severity = overlaps ? 'conflict' : 'warning';
      conflicts.push({
        type: 'appointment',
        severity,
        description: describeAppointmentConflict(appt, overlaps, gapMs),
        conflictingAppointment: appt,
      });
    }
  }

  const windowStartDate = new Date(proposedTime.getTime() - CONFLICT_BUFFER_MS);
  const windowEndDate = new Date(proposedTime.getTime() + CONFLICT_BUFFER_MS);

  for (const med of medications) {
    if (!isVetSupervised(med)) continue;
    const doseTimes = getScheduleForRange(med, windowStartDate, windowEndDate);
    for (const doseTime of doseTimes) {
      const diffMs = Math.abs(doseTime.getTime() - proposedTime.getTime());
      if (diffMs <= CONFLICT_BUFFER_MS) {
        conflicts.push({
          type: 'medication',
          severity: 'warning',
          description: `"${med.name}" requires vet supervision at ${_formatTime(doseTime)} (within ${_formatTimeDiff(diffMs)} of the proposed time).`,
          medicationName: med.name,
          medicationTime: doseTime,
        });
      }
    }
  }

  const hasConflicts = conflicts.length > 0;
  const suggestedTime =
    hasConflicts && includeSuggestedTime
      ? await findNextAvailableSlot(petId, proposedTime, medications, durationMinutes)
      : undefined;

  return { hasConflicts, conflicts, suggestedTime };
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
  durationMinutes: number = DEFAULT_APPOINTMENT_DURATION_MINUTES,
): Promise<Date | undefined> {
  const MAX_ITERATIONS = 14 * 24;
  let candidate = new Date(from.getTime() + CONFLICT_BUFFER_MS);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = await detectConflicts(
      petId,
      candidate,
      medications,
      undefined,
      durationMinutes,
      false,
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
      .filter((a) => new Date(`${a.date}T${a.time}`) >= now)
      .sort(
        (a, b) =>
          new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime(),
      );
    await Promise.all(upcoming.map((a) => upsertAppointment(a)));
    return upcoming;
  } catch {
    const local = await getAllAppointmentsByPetId<Appointment>(petId);
    const now = new Date();
    return local
      .filter((a) => new Date(a.date) >= now && a.status !== AppointmentStatus.CANCELLED)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
}

export function getUpcoming(appointments: Appointment[]): Appointment[] {
  const now = new Date();
  return appointments
    .filter((a) => {
      const d = new Date(a.date);
      return (
        d >= now && a.status !== AppointmentStatus.CANCELLED && (a.status as string) !== 'cancelled'
      );
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getPast(appointments: Appointment[]): Appointment[] {
  const now = new Date();
  return appointments
    .filter((a) => {
      const d = new Date(a.date);
      return (
        d < now || a.status === AppointmentStatus.CANCELLED || (a.status as string) === 'cancelled'
      );
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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

  const apptMs = new Date(`${appointment.date}T${appointment.time ?? '00:00'}:00`).getTime();
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

function _formatTimeDiff(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(ms / 3_600_000);
  return `${hrs} hr`;
}

function _formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isInactiveAppointment(appt: Appointment): boolean {
  return (
    appt.status === AppointmentStatus.CANCELLED ||
    appt.status === AppointmentStatus.COMPLETED ||
    appt.status === AppointmentStatus.NO_SHOW ||
    (appt.status as string) === 'cancelled'
  );
}

function getAppointmentRange(appt: Appointment): { start: Date; end: Date } | undefined {
  const start = parseAppointmentStart(appt);
  if (!start || isNaN(start.getTime())) return undefined;
  const duration = appt.durationMinutes ?? DEFAULT_APPOINTMENT_DURATION_MINUTES;
  return {
    start,
    end: new Date(start.getTime() + duration * 60_000),
  };
}

function parseAppointmentStart(appt: Appointment): Date | undefined {
  if (!appt.date) return undefined;
  if (appt.date.includes('T')) return new Date(appt.date);
  return new Date(`${appt.date}T${appt.time ?? '00:00'}`);
}

function timeRangesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
  return start1 < end2 && end1 > start2;
}

function minGapBetweenRanges(start1: Date, end1: Date, start2: Date, end2: Date): number {
  if (end1 <= start2) return start2.getTime() - end1.getTime();
  if (end2 <= start1) return start1.getTime() - end2.getTime();
  return 0;
}

function describeAppointmentConflict(appt: Appointment, overlaps: boolean, gapMs: number): string {
  const title = appt.title ?? 'Appointment';
  if (overlaps) {
    return `"${title}" overlaps the proposed appointment time.`;
  }
  if (gapMs === 0) {
    return `"${title}" is back-to-back with the proposed appointment; allow travel or check-in time.`;
  }
  return `"${title}" is scheduled ${_formatTimeDiff(gapMs)} from the proposed appointment; allow travel or check-in time.`;
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
