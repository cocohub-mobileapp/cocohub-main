import { UserRole } from '../../models/UserRole';
import type {
  StoredMedicalRecord,
  StoredMedication,
  StoredPet,
  StoredUser,
} from '../../server/store';
import {
  filterByDateRange,
  generateHealthReport,
  generateQRCodeBuffer,
  type ReportOptions,
} from '../reportService';

const pet: StoredPet = {
  id: 'p-1',
  name: 'Buddy',
  species: 'dog',
  breed: 'Mixed',
  dateOfBirth: '2020-01-15',
  microchipId: 'CHIP-1',
  ownerId: 'u-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const owner: StoredUser = {
  id: 'u-1',
  email: 'owner@test.com',
  name: 'Test Owner',
  phone: '+10000000000',
  role: UserRole.OWNER,
  pets: [{ id: 'p-1', name: 'Buddy' }],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  isEmailVerified: true,
};

const makeRecord = (id: string, visitDate: string, txHash?: string): StoredMedicalRecord => ({
  id,
  petId: 'p-1',
  vetId: 'v-1',
  type: 'vaccination',
  diagnosis: 'Annual wellness',
  treatment: 'Rabies vaccine',
  notes: 'No issues',
  visitDate,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  blockchainTxHash: txHash,
});

const makeMed = (id: string, active: boolean): StoredMedication => ({
  id,
  petId: 'p-1',
  name: 'TestMed',
  dosage: '5mg',
  frequency: 'once_daily',
  startDate: '2024-01-01',
  active,
});

describe('filterByDateRange', () => {
  const records = [
    makeRecord('r1', '2024-01-01'),
    makeRecord('r2', '2024-06-15'),
    makeRecord('r3', '2024-12-31'),
  ];

  it('returns all records when no range given', () => {
    expect(filterByDateRange(records)).toHaveLength(3);
  });

  it('filters by dateFrom', () => {
    const result = filterByDateRange(records, '2024-06-01');
    expect(result.map((r) => r.id)).toEqual(['r2', 'r3']);
  });

  it('filters by dateTo', () => {
    const result = filterByDateRange(records, undefined, '2024-06-30');
    expect(result.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('filters by both dateFrom and dateTo', () => {
    const result = filterByDateRange(records, '2024-06-01', '2024-06-30');
    expect(result.map((r) => r.id)).toEqual(['r2']);
  });

  it('returns empty array when no records match', () => {
    expect(filterByDateRange(records, '2025-01-01')).toHaveLength(0);
  });
});

describe('generateQRCodeBuffer', () => {
  it('returns a non-empty Buffer', async () => {
    const buf = await generateQRCodeBuffer('https://cocohub.app/verify/p-1');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
  });
});

describe('generateHealthReport', () => {
  const baseOpts: ReportOptions = {
    pet,
    owner,
    records: [makeRecord('r1', '2024-06-15', 'tx-abc123')],
    medications: [makeMed('m1', true), makeMed('m2', false)],
    generatedBy: 'u-1',
  };

  it('returns a PDF buffer with correct metadata', async () => {
    const result = await generateHealthReport(baseOpts);
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.filename).toMatch(/^health-report-p-1-\d+\.pdf$/);
    expect(result.recordCount).toBe(1);
  });

  it('applies date range filtering', async () => {
    const result = await generateHealthReport({
      ...baseOpts,
      records: [makeRecord('r1', '2024-01-01'), makeRecord('r2', '2024-06-15')],
      dateFrom: '2024-06-01',
    });
    expect(result.recordCount).toBe(1);
  });

  it('returns recordCount 0 when no records match date range', async () => {
    const result = await generateHealthReport({
      ...baseOpts,
      dateFrom: '2025-01-01',
    });
    expect(result.recordCount).toBe(0);
  });

  it('PDF starts with PDF magic bytes', async () => {
    const result = await generateHealthReport(baseOpts);
    expect(result.buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('accepts a health dashboard snapshot for vet-ready sections', async () => {
    const result = await generateHealthReport({
      ...baseOpts,
      dashboard: {
        petName: 'Buddy',
        healthScore: 87,
        healthScoreLabel: 'Excellent',
        latestMetric: {
          recordedAt: '2026-07-09T10:00:00.000Z',
          weightKg: 12.4,
          temperatureC: 38.6,
          activityLevel: 'high',
          notes: 'Bright and active',
        },
        weightHistory: [
          { date: '2026-07-01', weightKg: 12.1 },
          { date: '2026-07-08', weightKg: 12.4, note: 'Healthy gain' },
        ],
        activeMedications: [
          { name: 'HeartGuard', dosage: '1 tablet', frequency: 'monthly', startDate: '2026-01-01' },
        ],
        upcomingAppointments: [
          { date: '2026-07-20', time: '09:00', type: 'Wellness', status: 'scheduled' },
        ],
        recentRecords: [{ type: 'checkup', date: '2026-07-08', notes: 'Routine wellness visit' }],
      },
    });

    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.buffer.slice(0, 4).toString()).toBe('%PDF');
    expect(result.recordCount).toBe(1);
  });
});
