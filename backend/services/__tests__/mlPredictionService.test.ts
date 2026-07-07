import mlPredictionService, { type VitalReading } from '../mlPredictionService';

function reading(
  petId: string,
  vitalType: VitalReading['vitalType'],
  value: number,
  day: number,
): VitalReading {
  return {
    petId,
    vitalType,
    value,
    recordedAt: `2026-05-${String(day).padStart(2, '0')}T10:00:00.000Z`,
  };
}

describe('mlPredictionService', () => {
  it('returns low risk for stable vitals', () => {
    const prediction = mlPredictionService.predictPetHealth({
      petId: 'pet-stable',
      ownerId: 'owner-1',
      vitals: [
        reading('pet-stable', 'weight', 10, 1),
        reading('pet-stable', 'weight', 10.2, 20),
        reading('pet-stable', 'temperature', 38.6, 20),
        reading('pet-stable', 'heart_rate', 100, 20),
        reading('pet-stable', 'activity_level', 3, 18),
        reading('pet-stable', 'activity_level', 3, 20),
      ],
    });

    expect(prediction.riskLevel).toBe('low');
    expect(prediction.riskScore).toBeLessThan(0.42);
  });

  it('returns high risk with explainable contributing factors', () => {
    const prediction = mlPredictionService.predictPetHealth({
      petId: 'pet-risky',
      ownerId: 'owner-1',
      vitals: [
        reading('pet-risky', 'weight', 10, 1),
        reading('pet-risky', 'weight', 12.2, 20),
        reading('pet-risky', 'temperature', 39.8, 20),
        reading('pet-risky', 'heart_rate', 168, 20),
        reading('pet-risky', 'activity_level', 1, 18),
        reading('pet-risky', 'activity_level', 1, 20),
      ],
    });

    expect(prediction.riskLevel).toBe('high');
    expect(prediction.riskScore).toBeGreaterThanOrEqual(0.65);
    expect(prediction.contributingFactors).toEqual(
      expect.arrayContaining(['weight gain', 'abnormal temperature', 'reduced activity']),
    );
  });

  it('generates daily alerts only for high-risk predictions', () => {
    const alerts = mlPredictionService.runDailyPredictions([
      {
        petId: 'pet-stable',
        ownerId: 'owner-1',
        vitals: [
          reading('pet-stable', 'weight', 10, 1),
          reading('pet-stable', 'temperature', 38.5, 20),
          reading('pet-stable', 'activity_level', 3, 20),
        ],
      },
      {
        petId: 'pet-risky',
        ownerId: 'owner-1',
        vitals: [
          reading('pet-risky', 'weight', 10, 1),
          reading('pet-risky', 'weight', 12.5, 20),
          reading('pet-risky', 'temperature', 40.0, 20),
          reading('pet-risky', 'activity_level', 1, 20),
        ],
      },
    ]);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].petId).toBe('pet-risky');
    expect(alerts[0].status).toBe('active');
  });

  it('triages emergency symptom text without an external API key', async () => {
    const prediction = await mlPredictionService.analyzeSymptoms({
      petId: 'cat-1',
      ownerId: 'owner-1',
      species: 'cat',
      breed: 'domestic shorthair',
      symptoms: 'Straining to urinate and cannot pee',
    });

    expect(prediction.urgency).toBe('emergency');
    expect(prediction.probableConditions[0].condition).toBe('Possible urinary obstruction');
    expect(prediction.recommendedActions).toEqual(
      expect.arrayContaining(['Go to an emergency veterinarian immediately.']),
    );
  });

  it('returns moderate digestive triage with a vet disclaimer', async () => {
    const prediction = await mlPredictionService.analyzeSymptoms({
      petId: 'dog-1',
      ownerId: 'owner-1',
      species: 'dog',
      breed: 'beagle',
      symptoms: 'Vomiting this morning and not eating much',
    });

    expect(['moderate', 'high']).toContain(prediction.urgency);
    expect(prediction.probableConditions.map((condition) => condition.condition)).toContain(
      'Gastrointestinal upset',
    );
    expect(prediction.disclaimer).toContain('not a medical diagnosis');
  });
});
