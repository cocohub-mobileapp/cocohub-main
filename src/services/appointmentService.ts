import { type AxiosResponse } from 'axios';

import apiClient from './apiClient';
import {
  getAllLocalAppointments,
  getAllAppointmentsByPetId,
  getAppointmentsInWindow,
  upsertAppointment,
  deleteAppointmentById,
} from './localDB';
import { AppointmentStatus } from '../models/Appointment';
import type { Appointment } from '../models/Appointment';
import type { Medication } from '../models/Medication';

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type { Appointment } from '../models/Appointment';
export { AppointmentStatus } from '../models/Appointment';

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = '/appointments';

/** Default buffer between appointments (acceptance: 30 minutes, configurable). */
export const DEFAULT_CONFLICT_BUFFER_MINUTES = 30;

let conflictBufferMinutes = DEFAULT_CONFLICT_BUFFER_MINUTES;

/** Configure buffer between appointments (minutes). Clamped 0–240. */
export function setConflictBufferMinutes(minutes: number): void {
  if (!Number.isFinite(minutes)) return;
  conflictBufferMinutes = Math.max(0, Math.min(240, Math.floor(minutes)));
}

export function getConflictBufferMinutes(): number {
  return conflictBufferMinutes;
}

export function getConflictBufferMs(): number {
  return conflictBufferMinutes * 60 * 1000;
}

/** @deprecated use getConflictBufferMs — kept for callers */
export const CONFLICT_BUFFER_MS = 30 * 60 * 1000;

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

// ─── Pure conflict helpers (unit-tested) ─────────────────────────────────────

export interface TimeInterval {
  startMs: number;
  endMs: number;
}

/** True when [aStart,aEnd) overlaps [bStart,bEnd) with optional padding on both sides. */
export function intervalsOverlap(
  a: TimeInterval,
  b: TimeInterval,
  padMs = 0,
): boolean {
  const a0 = a.startMs - padMs;
  const a1 = a.endMs + padMs;
  const b0 = b.startMs - padMs;
  const b1 = b.endMs + padMs;
  return a0 < b1 && b0 < a1;
}

export function appointmentInterval(
  start: Date,
  durationMinutes = 30,
): TimeInterval {
  const startMs = start.getTime();
  return { startMs, endMs: startMs + Math.max(1, durationMinutes) * 60 * 1000 };
}

/**
 * Expand a simple weekly recurrence into occurrence starts within a window.
 * recurrenceRule examples: "weekly", "WEEKLY", "RRULE:FREQ=WEEKLY"
 */
export function expandWeeklyRecurrence(
  seedStart: Date,
  windowStart: Date,
  windowEnd: Date,
  maxOccurrences = 52,
): Date[] {
  const out: Date[] = [];
  let cursor = new Date(seedStart.getTime());
  // Walk forward from seed until past windowEnd
  let guard = 0;
  while (cursor.getTime() < windowStart.getTime() && guard < 520) {
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
    guard++;
  }
  while (cursor.getTime() <= windowEnd.getTime() && out.length < maxOccurrences) {
    if (cursor.getTime() >= windowStart.getTime()) out.push(new Date(cursor.getTime()));
    cursor = new Date(cursor.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return out;
}

function isRecurringAppointment(appt: Appointment): boolean {
  const anyAppt = appt as Appointment & { recurrenceRule?: string; recurring?: boolean };
  if (anyAppt.recurring === true) return true;
  const rule = (anyAppt.recurrenceRule || '').toUpperCase();
  return rule.includes('WEEKLY') || rule === 'WEEKLY' || rule.includes('FREQ=WEEKLY');
}

function apptStartDate(appt: Appointment): Date {
  if (appt.time && appt.date && !appt.date.includes('T')) {
    return new Date(`${appt.date}T${appt.time}`);
  }
  return new Date(appt.date);
}


export async function detectConflicts(
  petId: string,
  proposedTime: Date,
  medications: Medication[] = [],
  excludeId?: string,
  options?: { bufferMinutes?: number; durationMinutes?: number },
): Promise<ConflictDetectionResult> {
  const conflicts: AppointmentConflict[] = [];
  const bufferMs =
    options?.bufferMinutes != null
      ? Math.max(0, options.bufferMinutes) * 60 * 1000
      : getConflictBufferMs();
  const proposedDuration = options?.durationMinutes ?? 30;
  const proposed = appointmentInterval(proposedTime, proposedDuration);

  // Look at a full day window so same-day overlaps are caught, not only exact times.
  const dayStart = new Date(proposedTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(proposedTime);
  dayEnd.setHours(23, 59, 59, 999);
  // Expand search by one week to catch weekly recurrences that land today
  const searchStart = new Date(dayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const searchEnd = new Date(dayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);

  const nearby = await getAppointmentsInWindow<Appointment>(
    petId,
    searchStart.toISOString(),
    searchEnd.toISOString(),
  );

  for (const appt of nearby) {
    if (excludeId && appt.id === excludeId) continue;
    if (
      appt.status === AppointmentStatus.CANCELLED ||
      (appt.status as string) === 'cancelled'
    ) {
      continue;
    }

    const duration = appt.durationMinutes ?? 30;
    const seed = apptStartDate(appt);
    const occurrences = isRecurringAppointment(appt)
      ? expandWeeklyRecurrence(seed, dayStart, dayEnd)
      : [seed];

    for (const occ of occurrences) {
      // Only flag same calendar day or true interval overlap with buffer
      const sameDay =
        occ.getFullYear() === proposedTime.getFullYear() &&
        occ.getMonth() === proposedTime.getMonth() &&
        occ.getDate() === proposedTime.getDate();
      const other = appointmentInterval(occ, duration);
      if (!intervalsOverlap(proposed, other, bufferMs)) continue;
      if (!sameDay && !intervalsOverlap(proposed, other, 0)) continue;

      const diffMs = Math.abs(occ.getTime() - proposedTime.getTime());
      const recurringNote = isRecurringAppointment(appt) ? ' (recurring series)' : '';
      conflicts.push({
        type: 'appointment',
        description: `"${appt.title ?? 'Appointment'}"${recurringNote} overlaps the proposed slot (${_formatTimeDiff(diffMs)} apart; buffer ${Math.round(bufferMs / 60000)}m).`,
        conflictingAppointment: appt,
      });
      break; // one conflict entry per appointment
    }
  }

  const { getScheduleForRange } = await import('./medicationService');
  const windowStartDate = new Date(proposed.startMs - bufferMs);
  const windowEndDate = new Date(proposed.endMs + bufferMs);

  for (const med of medications) {
    if (!isVetSupervised(med)) continue;
    const doseTimes = getScheduleForRange(med, windowStartDate, windowEndDate);
    for (const doseTime of doseTimes) {
      const medInterval = appointmentInterval(doseTime, 15);
      if (!intervalsOverlap(proposed, medInterval, bufferMs)) continue;
      const diffMs = Math.abs(doseTime.getTime() - proposedTime.getTime());
      conflicts.push({
        type: 'medication',
        description: `"${med.name}" requires vet supervision at ${_formatTime(doseTime)} (within ${_formatTimeDiff(diffMs)} of the proposed time).`,
        medicationName: med.name,
        medicationTime: doseTime,
      });
    }
  }

  const hasConflicts = conflicts.length > 0;
  const suggestedTime = hasConflicts
    ? await findNextAvailableSlot(petId, proposedTime, medications)
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
): Promise<Date | undefined> {
  const MAX_ITERATIONS = 14 * 24;
  let candidate = new Date(from.getTime() + getConflictBufferMs());

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = await detectConflicts(petId, candidate, medications);
    if (!result.hasConflicts) return candidate;
    candidate = new Date(candidate.getTime() + getConflictBufferMs());
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
