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

/** Buffer window (ms) around each appointment that counts as a conflict */
export const DEFAULT_CONFLICT_BUFFER_MINUTES = 30;
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;
export const CONFLICT_BUFFER_MS = DEFAULT_CONFLICT_BUFFER_MINUTES * 60 * 1000;

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

export interface ConflictDetectionOptions {
  bufferMinutes?: number;
  durationMinutes?: number;
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
  options: ConflictDetectionOptions = {},
): Promise<ConflictDetectionResult> {
  const conflicts: AppointmentConflict[] = [];

  const bufferMs = (options.bufferMinutes ?? DEFAULT_CONFLICT_BUFFER_MINUTES) * 60_000;
  const durationMs = (options.durationMinutes ?? DEFAULT_APPOINTMENT_DURATION_MINUTES) * 60_000;
  const proposedEnd = new Date(proposedTime.getTime() + durationMs);
  const windowStart = startOfDay(proposedTime).toISOString();
  const windowEnd = endOfDay(proposedEnd).toISOString();

  const [nearby, allAppointments] = await Promise.all([
    getAppointmentsInWindow<Appointment>(petId, windowStart, windowEnd),
    getAllAppointmentsByPetId<Appointment>(petId).catch(() => []),
  ]);
  const recurringAppointments = allAppointments.filter((appt) => isRecurringAppointment(appt));
  const appointmentsById = new Map<string, Appointment>();
  for (const appt of [...nearby, ...recurringAppointments]) {
    appointmentsById.set(appt.id, appt);
  }

  for (const appt of appointmentsById.values()) {
    if (excludeId && appt.id === excludeId) continue;

    const occurrences = getAppointmentOccurrencesInRange(
      appt,
      startOfDay(proposedTime),
      endOfDay(proposedEnd),
    );
    for (const occurrenceStart of occurrences) {
      const occurrenceEnd = new Date(
        occurrenceStart.getTime() +
          (appt.durationMinutes ?? DEFAULT_APPOINTMENT_DURATION_MINUTES) * 60_000,
      );

      if (intervalsConflict(proposedTime, proposedEnd, occurrenceStart, occurrenceEnd, bufferMs)) {
        conflicts.push({
          type: 'appointment',
          description: `"${appt.title ?? 'Appointment'}" overlaps or is within ${_formatTimeDiff(bufferMs)} of the proposed time.`,
          conflictingAppointment: appt,
        });
        break;
      }
    }
  }

  const { getScheduleForRange } = await import('./medicationService');
  const windowStartDate = new Date(proposedTime.getTime() - bufferMs);
  const windowEndDate = new Date(proposedEnd.getTime() + bufferMs);

  for (const med of medications) {
    if (!isVetSupervised(med)) continue;
    const doseTimes = getScheduleForRange(med, windowStartDate, windowEndDate);
    for (const doseTime of doseTimes) {
      const diffMs = Math.abs(doseTime.getTime() - proposedTime.getTime());
      if (
        doseTime.getTime() >= windowStartDate.getTime() &&
        doseTime.getTime() <= windowEndDate.getTime()
      ) {
        conflicts.push({
          type: 'medication',
          description: `"${med.name}" requires vet supervision at ${_formatTime(doseTime)} (within ${_formatTimeDiff(diffMs)} of the proposed time).`,
          medicationName: med.name,
          medicationTime: doseTime,
        });
      }
    }
  }

  const hasConflicts = conflicts.length > 0;
  const suggestedTime = hasConflicts
    ? await findNextAvailableSlot(petId, proposedTime, medications, options)
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
  options: ConflictDetectionOptions = {},
): Promise<Date | undefined> {
  const MAX_ITERATIONS = 14 * 24;
  const stepMs =
    ((options.bufferMinutes ?? DEFAULT_CONFLICT_BUFFER_MINUTES) +
      (options.durationMinutes ?? DEFAULT_APPOINTMENT_DURATION_MINUTES)) *
    60_000;
  let candidate = new Date(from.getTime() + stepMs);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = await detectConflicts(petId, candidate, medications, undefined, options);
    if (!result.hasConflicts) return candidate;
    candidate = new Date(candidate.getTime() + stepMs);
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

type RecurringAppointment = Appointment & {
  recurrence?: { frequency?: string; interval?: number; until?: string };
  recurrenceRule?: string;
  repeatFrequency?: string;
  recurrenceEndDate?: string;
};

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function getAppointmentStart(appt: Appointment): Date {
  if (appt.date.includes('T')) {
    return new Date(appt.date);
  }
  return new Date(`${appt.date}T${appt.time ?? '00:00'}:00`);
}

function intervalsConflict(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
  bufferMs: number,
): boolean {
  return (
    firstStart.getTime() < secondEnd.getTime() + bufferMs &&
    firstEnd.getTime() > secondStart.getTime() - bufferMs
  );
}

function isRecurringAppointment(appt: Appointment): boolean {
  const recurring = appt as RecurringAppointment;
  return Boolean(recurring.recurrence || recurring.recurrenceRule || recurring.repeatFrequency);
}

function getAppointmentOccurrencesInRange(
  appt: Appointment,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  const firstStart = getAppointmentStart(appt);
  const recurrence = getRecurrenceConfig(appt as RecurringAppointment);

  if (!recurrence) {
    return firstStart.getTime() >= rangeStart.getTime() &&
      firstStart.getTime() <= rangeEnd.getTime()
      ? [firstStart]
      : [];
  }

  const until = recurrence.until ? new Date(recurrence.until) : rangeEnd;
  if (until.getTime() < rangeStart.getTime() || firstStart.getTime() > rangeEnd.getTime()) {
    return [];
  }

  const occurrences: Date[] = [];
  let candidate = new Date(firstStart);
  const interval = recurrence.interval || 1;
  let guard = 0;

  while (candidate.getTime() <= rangeEnd.getTime() && candidate.getTime() <= until.getTime()) {
    if (candidate.getTime() >= rangeStart.getTime()) {
      occurrences.push(new Date(candidate));
    }

    guard += 1;
    if (guard > 500) break;

    if (recurrence.frequency === 'weekly') {
      candidate = new Date(candidate.getTime() + interval * 7 * 24 * 60 * 60_000);
    } else if (recurrence.frequency === 'monthly') {
      candidate = new Date(candidate);
      candidate.setMonth(candidate.getMonth() + interval);
    } else {
      candidate = new Date(candidate.getTime() + interval * 24 * 60 * 60_000);
    }
  }

  return occurrences;
}

function getRecurrenceConfig(
  appt: RecurringAppointment,
): { frequency: 'daily' | 'weekly' | 'monthly'; interval: number; until?: string } | null {
  const rawFrequency =
    appt.recurrence?.frequency ??
    appt.repeatFrequency ??
    parseRRuleValue(appt.recurrenceRule, 'FREQ');
  const normalized = rawFrequency?.toLowerCase();

  if (normalized !== 'daily' && normalized !== 'weekly' && normalized !== 'monthly') {
    return null;
  }

  const intervalRaw =
    appt.recurrence?.interval ?? Number(parseRRuleValue(appt.recurrenceRule, 'INTERVAL'));
  const interval = Number.isFinite(intervalRaw) && intervalRaw > 0 ? intervalRaw : 1;
  const until =
    appt.recurrence?.until ??
    appt.recurrenceEndDate ??
    parseRRuleValue(appt.recurrenceRule, 'UNTIL');

  return { frequency: normalized, interval, until };
}

function parseRRuleValue(rule: string | undefined, key: string): string | undefined {
  return rule
    ?.split(';')
    .map((part) => part.split('='))
    .find(([name]) => name?.toUpperCase() === key)?.[1];
}

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
