export interface Appointment {
  id: string;
  petId: string;
  veterinarian: string;
  date: string;
  durationMinutes: number;
  type: string;
  notes: string;
  recurringPattern?: 'daily' | 'weekly' | 'monthly';
  recurringEndDate?: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflictingAppointments: Appointment[];
  message: string;
}

const DEFAULT_BUFFER_MINUTES = 30;

/**
 * Check if two appointments overlap in time, with configurable buffer.
 */
export function appointmentsOverlap(
  a: { date: string; durationMinutes: number },
  b: { date: string; durationMinutes: number },
  bufferMinutes: number = DEFAULT_BUFFER_MINUTES,
): boolean {
  const startA = new Date(a.date).getTime();
  const endA = startA + (a.durationMinutes + bufferMinutes) * 60 * 1000;
  const startB = new Date(b.date).getTime();
  const endB = startB + (b.durationMinutes + bufferMinutes) * 60 * 1000;
  return startA < endB && startB < endA;
}

/**
 * Detect conflicts between a new appointment and existing ones.
 */
export function detectConflicts(
  newAppointment: { date: string; durationMinutes: number },
  existingAppointments: Appointment[],
  bufferMinutes: number = DEFAULT_BUFFER_MINUTES,
): ConflictResult {
  const conflicting = existingAppointments.filter((existing) =>
    appointmentsOverlap(newAppointment, existing, bufferMinutes),
  );

  if (conflicting.length === 0) {
    return { hasConflict: false, conflictingAppointments: [], message: '' };
  }

  const summary = conflicting
    .map((c) => `${c.type} with ${c.veterinarian} at ${new Date(c.date).toLocaleTimeString()}`)
    .join(', ');

  return {
    hasConflict: true,
    conflictingAppointments: conflicting,
    message: `Conflicts with: ${summary}. Allow ${bufferMinutes}min buffer between appointments.`,
  };
}

/**
 * Generate recurring appointment dates.
 */
export function generateRecurringDates(
  baseDate: string,
  pattern: 'daily' | 'weekly' | 'monthly',
  endDate: string,
  maxOccurrences: number = 52,
): string[] {
  const dates: string[] = [];
  const current = new Date(baseDate);
  const end = new Date(endDate);
  let count = 0;

  while (current <= end && count < maxOccurrences) {
    dates.push(current.toISOString());
    count++;
    switch (pattern) {
      case 'daily':
        current.setDate(current.getDate() + 1);
        break;
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
    }
  }

  return dates;
}
