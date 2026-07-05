import { buildWatchCompanionGlance } from '../watchCompanionService';
import type { WidgetData } from '../widgetService';

const widgetData: WidgetData = {
  medications: [
    {
      id: 'med-1-today',
      medicationId: 'med-1',
      medicationName: 'Amoxicillin',
      dosage: '50mg',
      petName: 'Milo',
      petId: 'pet-1',
      scheduledTime: '09:00',
      frequency: 12,
      taken: true,
    },
    {
      id: 'med-2-today',
      medicationId: 'med-2',
      medicationName: 'Heartworm',
      dosage: '1 tab',
      petName: 'Piper',
      petId: 'pet-2',
      scheduledTime: '18:00',
      frequency: 24,
      taken: false,
    },
  ],
  appointments: [
    {
      id: 'apt-1',
      title: 'Annual checkup',
      date: '2026-07-06',
      time: '10:30',
      petName: 'Milo',
      petId: 'pet-1',
      vetName: 'Dr. Lee',
      durationMinutes: 30,
    },
  ],
  healthScores: [
    {
      petId: 'pet-1',
      petName: 'Milo',
      petSpecies: 'cat',
      healthScore: 81,
      lastUpdated: '2026-07-05T08:00:00.000Z',
    },
    {
      petId: 'pet-2',
      petName: 'Piper',
      petSpecies: 'dog',
      healthScore: 94,
      lastUpdated: '2026-07-05T08:00:00.000Z',
    },
  ],
  lastUpdated: '2026-07-05T08:00:00.000Z',
  timestamp: 1783238400000,
};

describe('watchCompanionService', () => {
  it('builds a compact watch glance from widget data', () => {
    const glance = buildWatchCompanionGlance(widgetData);

    expect(glance.activePet).toEqual({
      petId: 'pet-2',
      petName: 'Piper',
      petSpecies: 'dog',
      healthScore: 94,
    });
    expect(glance.nextMedication?.medicationName).toBe('Heartworm');
    expect(glance.nextMedication?.deepLink).toBe('cocohub://medications/med-2');
    expect(glance.nextAppointment?.deepLink).toBe('cocohub://appointments/apt-1');
    expect(glance.healthDeepLink).toBe('cocohub://health/pet-2');
    expect(glance.emergencyDeepLink).toBe('cocohub://sos');
  });

  it('handles empty widget data without throwing', () => {
    const glance = buildWatchCompanionGlance({
      medications: [],
      appointments: [],
      healthScores: [],
      lastUpdated: '2026-07-05T08:00:00.000Z',
      timestamp: 1783238400000,
    });

    expect(glance.activePet).toBeNull();
    expect(glance.nextMedication).toBeNull();
    expect(glance.nextAppointment).toBeNull();
    expect(glance.healthDeepLink).toBeNull();
  });
});
