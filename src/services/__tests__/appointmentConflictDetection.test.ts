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
  getAllAppointmentsByPetId,
} from '../localDB';
import { getScheduleForRange } from '../medicationService';

const mockGetInWindow = getAppointmentsInWindow as jest.MockedFunction<
  typeof getAppointmentsInWindow
>;
const mockUpsert = upsertAppointment as jest.MockedFunction<typeof upsertAppointment>;
const mockDeleteById = deleteAppointmentById as jest.MockedFunction<typeof deleteAppointmentById>;
const mockGetAll = getAllLocalAppointments as jest.MockedFunction<typeof getAllLocalAppointments>;
const mockGetAllByPetId = getAllAppointmentsByPetId as jest.MockedFunction<
  typeof getAllAppointmentsByPetId
>;
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
    mockGetAllByPetId.mockResolvedValue([]);
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
    mockGetAllByPetId.mockResolvedValue([]);
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

  it('flags an appointment within the 30-min default buffer', async () => {
    // 20 min later, both with 30-min duration → gap = 0 (they touch) → conflict
    const twentyMinLater = new Date(BASE_TIME.getTime() + 20 * 60_000);
    const existing = makeAppt({ id: 'near-1', date: twentyMinLater.toISOString() });
    mockGetInWindow.mockResolvedValue([existing]);

    const result = await detectConflicts('pet-1', BASE_TIME, []);
    expect(result.hasConflicts).toBe(true);
  });

  it('does not flag an appointment outside the 30-min default buffer', async () => {
    // Proposed: 10:00–10:30. Existing: 11:30–12:00. Gap = 60 min > 30-min buffer.
    const farAppt = makeAppt({
      id: 'far-1',
      date: new Date(BASE_TIME.getTime() + 90 * 60_000).toISOString(),
      durationMinutes: 30,
    });
    mockGetInWindow.mockResolvedValue([farAppt]);

    const result = await detectConflicts('pet-1', BASE_TIME, []);
    expect(result.hasConflicts).toBe(false);
  });

  it('detects overlap using appointment duration, not just start-time proximity', async () => {
    // Existing: starts 15 min before proposed, lasts 60 min → overlaps proposed slot.
    const fifteenMinBefore = new Date(BASE_TIME.getTime() - 15 * 60_000);
    const longAppt = makeAppt({
      id: 'long-1',
      date: fifteenMinBefore.toISOString(),
      durationMinutes: 60,
    });
    mockGetInWindow.mockResolvedValue([longAppt]);

    const result = await detectConflicts('pet-1', BASE_TIME, []);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].conflictingAppointment?.id).toBe('long-1');
  });

  it('respects a custom bufferMs parameter', async () => {
    // Gap = 45 min. With default 30-min buffer: no conflict. With 60-min buffer: conflict.
    const fortyFiveMinLater = new Date(BASE_TIME.getTime() + 75 * 60_000); // start 75 min later
    const appt = makeAppt({ id: 'buf-1', date: fortyFiveMinLater.toISOString(), durationMinutes: 30 });
    // Proposed 10:00–10:30, existing 11:15–11:45. Gap = 45 min.
    mockGetInWindow.mockResolvedValue([appt]);

    const defaultResult = await detectConflicts('pet-1', BASE_TIME, [], undefined, 30 * 60_000);
    expect(defaultResult.hasConflicts).toBe(false);

    mockGetInWindow.mockResolvedValue([appt]);
    mockGetAllByPetId.mockResolvedValue([]);
    const wideResult = await detectConflicts('pet-1', BASE_TIME, [], undefined, 60 * 60_000);
    expect(wideResult.hasConflicts).toBe(true);
  });

  it('excludes the appointment with the given excludeId', async () => {
    const self = makeAppt({ id: 'self-appt', date: BASE_TIME.toISOString() });
    mockGetInWindow.mockResolvedValue([self]);

    const result = await detectConflicts('pet-1', BASE_TIME, [], 'self-appt');
    expect(result.hasConflicts).toBe(false);
  });

  it('provides a suggestedTime when conflicts exist', async () => {
    const existing = makeAppt({ id: 'blocker', date: BASE_TIME.toISOString() });
    // detectConflicts(BASE_TIME) → conflict; findNextAvailableSlot tries +30min → conflict (gap=0);
    // then tries +60min → mock returns [] → clear.
    mockGetInWindow
      .mockResolvedValueOnce([existing]) // detectConflicts for BASE_TIME
      .mockResolvedValueOnce([existing]) // findNextAvailableSlot: BASE_TIME+30min still conflicts
      .mockResolvedValue([]);             // BASE_TIME+60min is clear

    const result = await detectConflicts('pet-1', BASE_TIME, []);
    expect(result.suggestedTime).toBeInstanceOf(Date);
    expect(result.suggestedTime!.getTime()).toBeGreaterThan(BASE_TIME.getTime());
  });
});

// ─── detectConflicts — recurring appointment conflicts ────────────────────────

describe('detectConflicts — recurring appointments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInWindow.mockResolvedValue([]);
    mockGetSchedule.mockReturnValue([]);
  });

  it('detects a weekly recurring appointment conflicting with the proposed time', async () => {
    // Base appointment was last week; weekly recurrence means this week conflicts.
    const lastWeek = new Date(BASE_TIME.getTime() - 7 * 24 * 60 * 60_000);
    const recurring = makeAppt({
      id: 'weekly-1',
      date: lastWeek.toISOString(),
      durationMinutes: 30,
      recurrenceRule: 'weekly',
    });
    // Not returned by window query (base is too old), only via getAllAppointmentsByPetId.
    mockGetAllByPetId.mockResolvedValue([recurring]);

    const result = await detectConflicts('pet-1', BASE_TIME, []);
    expect(result.hasConflicts).toBe(true);
    expect(result.conflicts[0].conflictingAppointment?.id).toBe('weekly-1');
  });

  it('does not flag a weekly recurring appointment whose occurrence is well outside the buffer', async () => {
    // Base appointment and all occurrences are 3 hours away from proposed time.
    const threeHoursLater = new Date(BASE_TIME.getTime() + 3 * 60 * 60_000);
    const recurring = makeAppt({
      id: 'weekly-far',
      date: threeHoursLater.toISOString(),
      durationMinutes: 30,
      recurrenceRule: 'weekly',
    });
    mockGetAllByPetId.mockResolvedValue([recurring]);

    const result = await detectConflicts('pet-1', BASE_TIME, []);
    expect(result.hasConflicts).toBe(false);
  });
});

// ─── detectConflicts — medication conflicts ───────────────────────────────────

describe('detectConflicts — vet-supervised medication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInWindow.mockResolvedValue([]);
    mockGetAllByPetId.mockResolvedValue([]);
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
    mockGetAllByPetId.mockResolvedValue([]);
    mockGetSchedule.mockReturnValue([]);
  });

  it('returns the first slot where the gap from the blocking appointment meets the buffer', async () => {
    // Blocker: BASE_TIME, 30-min duration.
    // +30min slot: gap between blocker-end (BASE_TIME+30) and proposed-start (BASE_TIME+30) = 0 → conflict.
    // +60min slot: gap = (BASE_TIME+60) - (BASE_TIME+30) = 30min → NOT < 30min → clear.
    const blocker = makeAppt({ id: 'b1', date: BASE_TIME.toISOString(), durationMinutes: 30 });
    mockGetInWindow
      .mockResolvedValueOnce([blocker]) // BASE_TIME+30min: conflict (gap=0)
      .mockResolvedValue([]);            // BASE_TIME+60min: clear

    const slot = await findNextAvailableSlot('pet-1', BASE_TIME, []);
    expect(slot).toBeInstanceOf(Date);
    // Two CONFLICT_BUFFER_MS steps from BASE_TIME = BASE_TIME + 60min
    expect(slot!.getTime()).toBe(BASE_TIME.getTime() + 2 * CONFLICT_BUFFER_MS);
  });

  it('skips multiple blocked slots to find the first free one', async () => {
    // Blocker has 90-min duration; blocks +30, +60, +90 min slots (overlap), +120min slot clears.
    const block = makeAppt({ id: 'b1', date: BASE_TIME.toISOString(), durationMinutes: 90 });
    mockGetInWindow
      .mockResolvedValueOnce([block]) // +30min: overlap with 90-min block
      .mockResolvedValueOnce([block]) // +60min: still overlaps
      .mockResolvedValueOnce([block]) // +90min: gap=0, still conflict
      .mockResolvedValue([]);          // +120min: gap=30min, just meets buffer → clear

    const slot = await findNextAvailableSlot('pet-1', BASE_TIME, []);
    expect(slot!.getTime()).toBe(BASE_TIME.getTime() + 4 * CONFLICT_BUFFER_MS);
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
