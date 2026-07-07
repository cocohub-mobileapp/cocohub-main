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

  it('classifies emergency symptom descriptions with immediate action guidance', () => {
    const prediction = mlPredictionService.predictSymptoms({
      petId: 'pet-emergency',
      ownerId: 'owner-1',
      species: 'dog',
      breed: 'Mixed',
      symptoms: 'My dog cannot breathe and has blue gums after collapsing.',
    });

    expect(prediction.urgency).toBe('emergency');
    expect(prediction.probableConditions[0].condition).toBe('Respiratory distress');
    expect(prediction.recommendedActions).toContain('Seek emergency veterinary care immediately.');
    expect(prediction.disclaimer).toContain('not veterinary advice');
  });

  it('returns likely conditions for common non-emergency symptoms', () => {
    const prediction = mlPredictionService.predictSymptoms({
      petId: 'pet-skin',
      ownerId: 'owner-1',
      species: 'cat',
      symptoms: 'Scratching ears constantly and shaking head with redness.',
    });

    expect(prediction.urgency).toBe('low');
    expect(prediction.probableConditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          condition: 'Ear or skin irritation',
          confidence: expect.any(Number),
        }),
      ]),
    );
  });
});
