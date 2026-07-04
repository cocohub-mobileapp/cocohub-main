jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  })),
  NativeModules: {},
  Platform: { OS: 'ios' },
}));

jest.mock('../emergencyService', () => ({
  __esModule: true,
  default: { triggerSOS: jest.fn() },
}));

jest.mock('../healthMetricService', () => ({
  getHealthMetrics: jest.fn(),
}));

jest.mock('../medicationService', () => ({
  getDoseLogs: jest.fn(),
  getDoseStatus: jest.fn(),
  getMedications: jest.fn(),
  getUpcomingDoseTimes: jest.fn(),
  isMedicationActive: jest.fn(),
}));

jest.mock('../petService', () => ({
  __esModule: true,
  default: { getAllPets: jest.fn() },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { getHealthMetrics } from '../healthMetricService';
import {
  getDoseLogs,
  getDoseStatus,
  getMedications,
  getUpcomingDoseTimes,
  isMedicationActive,
} from '../medicationService';
import petService from '../petService';
import {
  buildWatchPetSummary,
  getWatchHealthStatus,
  resolveActivePet,
  selectNextDoseForPet,
} from '../watchConnectivityService';
import type { Medication } from '../../models/Medication';
import type { Pet } from '../../models/Pet';

const pets: Pet[] = [
  {
    id: 'pet-1',
    name: 'Miso',
    species: 'cat',
    ownerId: 'owner-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pet-2',
    name: 'Bramble',
    species: 'dog',
    ownerId: 'owner-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const meds: Medication[] = [
  {
    id: 'med-later',
    petId: 'pet-2',
    name: 'Antibiotic',
    dosage: '5mg',
    frequency: 8,
    startDate: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'med-sooner',
    petId: 'pet-2',
    name: 'Pain relief',
    dosage: '1 tablet',
    frequency: 12,
    startDate: '2026-01-01T00:00:00.000Z',
  },
];

describe('watchConnectivityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isMedicationActive as jest.Mock).mockReturnValue(true);
    (getDoseStatus as jest.Mock).mockReturnValue('pending');
  });

  it('resolves the persisted active pet and falls back to the first pet', () => {
    expect(resolveActivePet(pets, 'pet-2')?.name).toBe('Bramble');
    expect(resolveActivePet(pets, 'missing')?.name).toBe('Miso');
    expect(resolveActivePet([], 'pet-2')).toBeNull();
  });

  it('maps health scores to watch status bands', () => {
    expect(getWatchHealthStatus(90)).toBe('good');
    expect(getWatchHealthStatus(74)).toBe('watch');
    expect(getWatchHealthStatus(49)).toBe('urgent');
  });

  it('selects the earliest pending dose for the active pet', () => {
    const now = new Date('2026-07-04T09:00:00.000Z');

    (getUpcomingDoseTimes as jest.Mock).mockImplementation((medication: Medication) =>
      medication.id === 'med-later'
        ? [new Date('2026-07-04T13:00:00.000Z')]
        : [new Date('2026-07-04T10:00:00.000Z')],
    );

    const nextDose = selectNextDoseForPet(meds, [], 'pet-2', now);

    expect(nextDose?.medicationId).toBe('med-sooner');
    expect(nextDose?.medicationName).toBe('Pain relief');
    expect(nextDose?.scheduledFor).toBe('2026-07-04T10:00:00.000Z');
  });

  it('builds a watch summary from selected pet, health metrics, and medication data', async () => {
    (petService.getAllPets as jest.Mock).mockResolvedValue(pets);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('pet-2');
    (getHealthMetrics as jest.Mock).mockResolvedValue([]);
    (getMedications as jest.Mock).mockResolvedValue(meds);
    (getDoseLogs as jest.Mock).mockResolvedValue([]);
    (getUpcomingDoseTimes as jest.Mock).mockImplementation((medication: Medication) =>
      medication.id === 'med-later'
        ? [new Date('2026-07-04T13:00:00.000Z')]
        : [new Date('2026-07-04T10:00:00.000Z')],
    );

    const summary = await buildWatchPetSummary();

    expect(summary?.petName).toBe('Bramble');
    expect(summary?.healthScore).toBe(75);
    expect(summary?.nextDose?.medicationId).toBe('med-sooner');
    expect(summary?.emergencyMessage).toBe('Pet emergency - need immediate help');
  });
});
