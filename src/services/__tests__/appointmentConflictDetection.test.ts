/**
 * Unit tests for appointment conflict detection logic.
 *
 * Tests cover:
 *  - detectConflicts: appointment buffer check
 *  - detectConflicts: vet-supervised medication time check
 *  - isVetSupervised: heuristic flag
 *  - findNextAvailableSlot: suggests first gap
 *  - saveAppointment: persists conflict resolution note
 *  - getAppointments / deleteAppointment: local CRUD fallback
 */

import type { Medication } from '../../models/Medication';
import {
  detectConflicts,
  isVetSupervised,
  findNextAvailableSlot,
  saveAppointment,
  getAppointments,
  deleteAppointment,
  getUpcoming,
  getPast,
  CONFLICT_BUFFER_MS,
  type Appointment,
} from '../appointmentService';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock localDB
jest.mock('../localDB', () => ({
  getAppointmentsInWindow: jest.fn().mockResolvedValue([]),
  getAllLocalAppointments: jest.fn().mockResolvedValue([]),
  getAllAppointmentsByPetId: jest.fn().mockResolvedValue([]),
  upsertAppointment: jest.fn().mockResolvedValue(undefined),
  deleteAppointmentById: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock apiClient — default to failing so local fallback activates
jest.mock('../apiClient', () => ({
  default: {
    get: jest.fn().mockRejectedValue(new Error('offline')),
    post: jest.fn().mockRejectedValue(new Error('offline')),
    put: jest.fn().mockRejectedValue(new Error('offline')),
    delete: jest.fn().mockRejectedValue(new Error('offline')),
  },
}));

// Mock notificationService
jest.mock('../notificationService', () => ({
  scheduleAppointmentNotification: jest.fn().mockResolvedValue('notif-id'),
  cancelEntityNotification: jest.fn().mockResolvedValue(undefined),
}));

// Mock medicationService (only getScheduleForRange used during conflict check)
jest.mock('../medicationService', () => ({
  getScheduleForRange: jest.fn().mockReturnValue([]),
}));

import {
  getAppointmentsInWindow,
  upsertAppointment,
  deleteAppointmentById,
  getAllLocalAppointments,
} from '../localDB';
import { getScheduleForRange } from '../medicationService';

const mockGetInWindow = getAppointmentsInWindow as jest.MockedFunction<
  typeof getAppointmentsInWindow
>;
const mockUpsert = upsertAppointment as jest.MockedFunction<typeof upsertAppointment>;
const mockDeleteById = deleteAppointmentById as jest.MockedFunction<typeof deleteAppointmentById>;
const mockGetAll = getAllLocalAppointments as jest.MockedFunction<typeof getAllLocalAppointments>;
const mockGetSchedule = getScheduleForRange as jest.MockedFunction<typeof getScheduleForRange>;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_TIME = new Date('2026-06-15T10:00:00.000Z');

const makeAppt = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'appt-1',
  petId: 'pet-1',
  vetId: 'vet-1',
  petName: 'Buddy',
  title: 'Annual Checkup',
  date: BASE_TIME.toISOString(),
  time: '10:00',
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

// ─── isVetSupervised ──────────────────────────────────────────────────────────

describe('isVetSupervised', () => {
  it('returns false for a regular oral medication', () => {
    expect(isVetSupervised(makeMed({ instructions: 'Give with food' }))).toBe(false);
  });

  it('returns true when instructions contain "vet"', () => {
    expect(isVetSupervised(makeMed({ instructions: 'Administer at vet clinic' }))).toBe(true);
  });

  it('returns true when instructions contain "injection"', () => {
    expect(isVetSupervised(makeMed({ instructions: 'Injection required' }))).toBe(true);
  });

  it('returns true when instructions contain "supervised"', () => {
    expect(isVetSupervised(makeMed({ instructions: 'Must be supervised by a professional' }))).toBe(
      true,
    );
  });

  it('returns true when notes contain "infusion"', () => {
    expect(isVetSupervised(makeMed({ notes: 'IV infusion every 8 hours' }))).toBe(true);
  });

  it('returns true when notes contain "administered by"', () => {
    expect(isVetSupervised(makeMed({ notes: 'Must be administered by a vet technician' }))).toBe(
      true,
    );
  });

  it('is case-insensitive', () => {
    expect(isVetSupervised(makeMed({ instructions: 'VET SUPERVISED INFUSION' }))).toBe(true);
  });
});

// ─── detectConflicts — no conflicts ───────────────────────────────────────────

describe('detectConflicts — clear schedule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInWindow.mockResolvedValue([]);
    mockGetSchedule.mockReturnValue([]);
  });

  it('returns hasConflicts=false when no appointments or meds conflict', async () => {
    const result = await detectConflicts('pet-1', BASE_TIME, []);
    expect(result.hasConflicts).toBe(false);
    expect(result.conflicts).toHaveLength(0);
    expect(result.suggestedTime).toBeUndefined();
  });
});

// ─── detectConflicts — appointment conflicts ──────────────────────────────────

describe('detectConflicts — appointment buffer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSchedule.mockReturnValue([]);
  });

  it('flags an existing appointment at the exact same time', async () => {
    const existing = makeAppt({ id: 'existing-1', date: BASE_TIME.toISOString() });
    mockGetInWindow.mockResolvedValue([existing]);

    const result = await detectConflicts('pet-1', BASE_TIME, []);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].type).toBe('appointment');
    expect(result.conflicts[0].conflictingAppointment?.id).toBe('existing-1');
  });

  it('flags an appointment within the 1-hour buffer', async () => {
    const thirtyMinLater = new Date(BASE_TIME.getTime() + 30 * 60_000);
    const existing = makeAppt({ id: 'near-1', date: thirtyMinLater.toISOString() });
    mockGetInWindow.mockResolvedValue([existing]);

    const result = await detectConflicts('pet-1', BASE_TIME, []);
    expect(result.hasConflicts).toBe(true);
  });

  it('does not flag an appointment outside the 1-hour buffer', async () => {
    // 90 min away is outside the buffer
    const ninetyMinLater = new Date(BASE_TIME.getTime() + 90 * 60_000);
    const distant = makeAppt({ id: 'far-1', date: ninetyMinLater.toISOString() });
    // Window query would not return this (SQL filter); simulate empty result
    mockGetInWindow.mockResolvedValue([]);

    const result = await detectConflicts('pet-1', BASE_TIME, []);
    expect(result.hasConflicts).toBe(false);
  });

  it('excludes the appointment with the given excludeId', async () => {
    const self = makeAppt({ id: 'self-appt', date: BASE_TIME.toISOString() });
    mockGetInWindow.mockResolvedValue([self]);

    const result = await detectConflicts('pet-1', BASE_TIME, [], 'self-appt');
    expect(result.hasConflicts).toBe(false);
  });

  it('provides a suggestedTime when conflicts exist', async () => {
    const existing = makeAppt({ id: 'blocker', date: BASE_TIME.toISOString() });
    // First call (for BASE_TIME) returns conflict; second call (slot +1h) returns clear
    mockGetInWindow
      .mockResolvedValueOnce([existing]) // for detectConflicts itself
      .mockResolvedValueOnce([existing]) // for findNextAvailableSlot first candidate (same window)
      .mockResolvedValue([]); // slot +1h is clear

    const result = await detectConflicts('pet-1', BASE_TIME, []);
    expect(result.suggestedTime).toBeInstanceOf(Date);
    // Suggested time should be after the proposed time
    expect(result.suggestedTime!.getTime()).toBeGreaterThan(BASE_TIME.getTime());
  });
});

// ─── detectConflicts — medication conflicts ───────────────────────────────────

describe('detectConflicts — vet-supervised medication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInWindow.mockResolvedValue([]);
  });

  it('flags a vet-supervised medication dose within the buffer', async () => {
    const med = makeMed({ instructions: 'Vet injection required' });
    // Dose at same time as proposed appointment
    mockGetSchedule.mockReturnValue([BASE_TIME]);

    const result = await detectConflicts('pet-1', BASE_TIME, [med]);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].type).toBe('medication');
    expect(result.conflicts[0].medicationName).toBe('Amoxicillin');
  });

  it('ignores non-supervised medication doses', async () => {
    const med = makeMed({ instructions: 'Give with food twice daily' });
    mockGetSchedule.mockReturnValue([BASE_TIME]); // dose falls in window

    const result = await detectConflicts('pet-1', BASE_TIME, [med]);
    expect(result.hasConflicts).toBe(false);
  });

  it('ignores vet-supervised medication whose dose is outside the buffer', async () => {
    const med = makeMed({ instructions: 'Vet injection required' });
    // Dose is 90 min away — outside CONFLICT_BUFFER_MS (1h)
    const farDose = new Date(BASE_TIME.getTime() + 90 * 60_000);
    mockGetSchedule.mockReturnValue([farDose]);

    const result = await detectConflicts('pet-1', BASE_TIME, [med]);
    expect(result.hasConflicts).toBe(false);
  });
});

// ─── findNextAvailableSlot ────────────────────────────────────────────────────

describe('findNextAvailableSlot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSchedule.mockReturnValue([]);
  });

  it('returns the very next hour when that slot is clear', async () => {
    const blocker = makeAppt({ id: 'b1', date: BASE_TIME.toISOString() });
    // First candidate (+1h) is clear
    mockGetInWindow
      .mockResolvedValueOnce([blocker]) // proposed slot itself blocked
      .mockResolvedValue([]); // +1h is free

    const slot = await findNextAvailableSlot('pet-1', BASE_TIME, []);
    expect(slot).toBeInstanceOf(Date);
    expect(slot!.getTime()).toBe(BASE_TIME.getTime() + 2 * CONFLICT_BUFFER_MS);
  });

  it('skips multiple blocked slots to find a free one', async () => {
    const block = makeAppt({ id: 'b1', date: BASE_TIME.toISOString() });
    // First two candidate slots are blocked, third is free
    mockGetInWindow
      .mockResolvedValueOnce([block]) // +1h blocked
      .mockResolvedValueOnce([block]) // +2h blocked
      .mockResolvedValue([]); // +3h free

    const slot = await findNextAvailableSlot('pet-1', BASE_TIME, []);
    expect(slot!.getTime()).toBe(BASE_TIME.getTime() + 2 * CONFLICT_BUFFER_MS);
  });
});

// ─── saveAppointment — conflict resolution note ───────────────────────────────

describe('saveAppointment — conflict resolution note', () => {
  beforeEach(() => jest.clearAllMocks());

  it('appends resolution note to existing notes', async () => {
    const appt = makeAppt({ notes: 'Bring records' });
    await saveAppointment(appt, 'Proceeded despite conflict.');

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: expect.stringContaining('[Conflict resolution]: Proceeded despite conflict.'),
      }),
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: expect.stringContaining('Bring records'),
      }),
    );
  });

  it('sets notes to just the resolution note when notes were empty', async () => {
    const appt = makeAppt({ notes: undefined });
    await saveAppointment(appt, 'Scheduled at suggested time.');

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: '[Conflict resolution]: Scheduled at suggested time.',
      }),
    );
  });

  it('does not modify notes when no resolution note provided', async () => {
    const appt = makeAppt({ notes: 'Original note' });
    await saveAppointment(appt);

    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ notes: 'Original note' }));
  });
});

// ─── getAppointments / deleteAppointment — local fallback ─────────────────────

describe('getAppointments — local fallback', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns local appointments when API is unreachable', async () => {
    const local = [makeAppt({ id: 'local-1' })];
    mockGetAll.mockResolvedValue(local);

    const result = await getAppointments();
    expect(result).toEqual(local);
  });
});

describe('deleteAppointment', () => {
  it('deletes from local DB', async () => {
    await deleteAppointment('appt-1');
    expect(mockDeleteById).toHaveBeenCalledWith('appt-1');
  });
});

// ─── getUpcoming / getPast ────────────────────────────────────────────────────

describe('getUpcoming', () => {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();

  it('returns only future non-cancelled appointments', () => {
    const future = makeAppt({ id: 'f1', date: tomorrow });
    const past = makeAppt({
      id: 'p1',
      date: yesterday,
      status: 'COMPLETED' as Appointment['status'],
    });
    const cancelled = makeAppt({
      id: 'c1',
      date: tomorrow,
      status: 'CANCELLED' as Appointment['status'],
    });

    const result = getUpcoming([future, past, cancelled]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f1');
  });

  it('sorts ascending by date', () => {
    const soon = makeAppt({ id: 's1', date: new Date(Date.now() + 3_600_000).toISOString() });
    const later = makeAppt({ id: 'l1', date: new Date(Date.now() + 7_200_000).toISOString() });
    expect(getUpcoming([later, soon])[0].id).toBe('s1');
  });
});

describe('getPast', () => {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();

  it('returns past and cancelled appointments', () => {
    const past = makeAppt({
      id: 'p1',
      date: yesterday,
      status: 'COMPLETED' as Appointment['status'],
    });
    const cancelled = makeAppt({
      id: 'c1',
      date: tomorrow,
      status: 'CANCELLED' as Appointment['status'],
    });
    const upcoming = makeAppt({ id: 'u1', date: tomorrow });

    const result = getPast([past, cancelled, upcoming]);
    const ids = result.map((a) => a.id);
    expect(ids).toContain('p1');
    expect(ids).toContain('c1');
    expect(ids).not.toContain('u1');
  });
});
