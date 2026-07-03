/**
 * Edge-case coverage for appointment conflict detection (issue #49).
 */

import type { Medication } from '../../models/Medication';
import {
  DEFAULT_CONFLICT_BUFFER_MINUTES,
  appointmentToInterval,
  detectConflicts,
  expandRecurringOccurrences,
  intervalsConflict,
  resolveConflictBufferMs,
  type Appointment,
} from '../appointmentService';

jest.mock('../localDB', () => ({
  getAppointmentsInWindow: jest.fn().mockResolvedValue([]),
  getAllLocalAppointments: jest.fn().mockResolvedValue([]),
  getAllAppointmentsByPetId: jest.fn().mockResolvedValue([]),
  upsertAppointment: jest.fn().mockResolvedValue(undefined),
  deleteAppointmentById: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../apiClient', () => ({
  default: {
    get: jest.fn().mockRejectedValue(new Error('offline')),
    post: jest.fn().mockRejectedValue(new Error('offline')),
    put: jest.fn().mockRejectedValue(new Error('offline')),
    delete: jest.fn().mockRejectedValue(new Error('offline')),
  },
}));

jest.mock('../medicationService', () => ({
  getScheduleForRange: jest.fn().mockReturnValue([]),
}));

import { getAppointmentsInWindow } from '../localDB';
import { getScheduleForRange } from '../medicationService';

const mockGetInWindow = getAppointmentsInWindow as jest.MockedFunction<
  typeof getAppointmentsInWindow
>;
const mockGetSchedule = getScheduleForRange as jest.MockedFunction<typeof getScheduleForRange>;

const BASE_TIME = new Date('2026-06-15T10:00:00.000Z');

const makeAppt = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'appt-1',
  petId: 'pet-1',
  vetId: 'vet-1',
  petName: 'Buddy',
  title: 'Annual Checkup',
  date: '2026-06-15',
  time: '10:00',
  durationMinutes: 30,
  type: 'ROUTINE_CHECKUP' as Appointment['type'],
  status: 'PENDING' as Appointment['status'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const makeMed = (overrides: Partial<Medication> = {}): Medication => ({
  id: 'med-1',
  petId: 'pet-1',
  name: 'Amoxicillin',
  dosage: '250mg',
  frequency: 8,
  startDate: new Date(Date.now() - 86_400_000).toISOString(),
  ...overrides,
});

describe('interval helpers', () => {
  it('uses configurable buffer minutes with 30-minute default', () => {
    expect(resolveConflictBufferMs()).toBe(DEFAULT_CONFLICT_BUFFER_MINUTES * 60 * 1000);
    expect(resolveConflictBufferMs(45)).toBe(45 * 60 * 1000);
  });

  it('detects overlapping appointment intervals on the same day', () => {
    const existing = appointmentToInterval('2026-06-15', '10:00', 30);
    const overlapping = appointmentToInterval('2026-06-15', '10:15', 30);
    const bufferMs = resolveConflictBufferMs(30);
    expect(intervalsConflict(overlapping, existing, bufferMs)).toBe(true);
  });

  it('allows appointments separated by the configured buffer', () => {
    const existing = appointmentToInterval('2026-06-15', '10:00', 30);
    const later = appointmentToInterval('2026-06-15', '11:01', 30);
    const bufferMs = resolveConflictBufferMs(30);
    expect(intervalsConflict(later, existing, bufferMs)).toBe(false);
  });
});

describe('expandRecurringOccurrences', () => {
  it('materializes weekly recurring occurrences', () => {
    const dates = expandRecurringOccurrences(BASE_TIME, {
      frequency: 'weekly',
      count: 3,
    });
    expect(dates).toHaveLength(3);
    expect(dates[1].getTime() - dates[0].getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('detectConflicts edge cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('flags overlapping same-day appointments instead of only exact matches', async () => {
    const existing = makeAppt({
      id: 'existing-1',
      date: '2026-06-15',
      time: '10:00',
      durationMinutes: 45,
    });
    mockGetInWindow.mockResolvedValue([existing]);

    const result = await detectConflicts('pet-1', new Date('2026-06-15T10:30:00'), [], undefined, {
      proposedDurationMinutes: 30,
      bufferMinutes: 30,
    });

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].type).toBe('appointment');
  });

  it('detects conflicts against recurring existing appointments via horizon fetch', async () => {
    const recurring = makeAppt({
      id: 'recurring-1',
      date: '2026-06-15',
      time: '14:00',
      recurrence: { frequency: 'weekly', count: 4 },
    });
    mockGetInWindow.mockImplementation(async (_petId, windowStart: string, windowEnd: string) => {
      const spanMs = new Date(windowEnd).getTime() - new Date(windowStart).getTime();
      return spanMs > 2 * 24 * 60 * 60 * 1000 ? [recurring] : [];
    });

    const result = await detectConflicts('pet-1', new Date('2026-06-22T14:00:00'), [], undefined, {
      proposedDurationMinutes: 30,
      bufferMinutes: 30,
    });

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts.some((c) => c.description.includes('Recurring'))).toBe(true);
  });

  it('checks medication conflicts for each proposed recurring occurrence', async () => {
    const med = makeMed({ instructions: 'Vet injection required' });
    mockGetInWindow.mockResolvedValue([]);
    mockGetSchedule.mockImplementation((_med, start: Date, end: Date) => {
      const target = new Date('2026-06-22T14:00:00').getTime();
      return start.getTime() <= target && end.getTime() >= target ? [new Date(target)] : [];
    });

    const result = await detectConflicts(
      'pet-1',
      new Date('2026-06-15T14:00:00'),
      [med],
      undefined,
      {
        proposedDurationMinutes: 30,
        bufferMinutes: 30,
        recurrence: { frequency: 'weekly', count: 2 },
      },
    );

    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts.some((c) => c.type === 'medication')).toBe(true);
  });

  it('flags proposed recurring appointments that collide with an existing slot', async () => {
    const existing = makeAppt({
      id: 'existing-2',
      date: '2026-06-22',
      time: '14:00',
    });
    mockGetInWindow.mockResolvedValue([existing]);

    const result = await detectConflicts(
      'pet-1',
      new Date('2026-06-15T14:00:00'),
      [] as Medication[],
      undefined,
      {
        proposedDurationMinutes: 30,
        bufferMinutes: 30,
        recurrence: { frequency: 'weekly', count: 2 },
      },
    );

    expect(result.hasConflicts).toBe(true);
  });
});
