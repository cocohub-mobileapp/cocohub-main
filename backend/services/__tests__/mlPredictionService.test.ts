import axios from 'axios';
import mlPredictionService, {
  type VitalReading,
  predictSymptomsLocal,
  predictSymptoms,
  VETERINARY_DISCLAIMER,
} from '../mlPredictionService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Pet Vitals Health Predictions', () => {
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
  });

  describe('AI Symptom Checker Local Clinical Triage Engine', () => {
    it('classifies toxic ingestion as emergency triage', () => {
      const result = predictSymptomsLocal({
        petId: 'pet-1',
        species: 'dog',
        breed: 'Labrador',
        symptoms: 'Ate dark chocolate bar and is now vomiting and salivating excessively',
      });

      expect(result.urgency).toBe('emergency');
      expect(result.urgencyReason).toContain('High-risk clinical indicators detected');
      expect(result.probableConditions.length).toBeGreaterThan(0);
      expect(result.probableConditions[0].condition).toContain('Toxic Ingestion');
      expect(result.probableConditions[0].confidence).toBeGreaterThanOrEqual(0.35);
      expect(result.recommendedActions.length).toBeGreaterThan(0);
      expect(result.disclaimer).toBe(VETERINARY_DISCLAIMER);
    });

    it('classifies canine GDV / bloat as emergency triage', () => {
      const result = predictSymptomsLocal({
        petId: 'pet-2',
        species: 'dog',
        breed: 'Great Dane',
        symptoms: 'Distended swollen abdomen, pacing restlessness, and unproductive retching',
      });

      expect(result.urgency).toBe('emergency');
      expect(result.probableConditions[0].condition).toContain('Gastric Dilatation-Volvulus');
      expect(result.recommendedActions[0]).toContain('emergency');
    });

    it('classifies respiratory distress / cyanosis as emergency triage', () => {
      const result = predictSymptomsLocal({
        petId: 'pet-3',
        species: 'dog',
        symptoms: 'Severe difficulty breathing, cannot breathe, gasping with blue gums',
      });

      expect(result.urgency).toBe('emergency');
      expect(result.probableConditions[0].condition).toContain('Respiratory Distress');
    });

    it('classifies blocked cat / feline urinary obstruction as emergency triage', () => {
      const result = predictSymptomsLocal({
        petId: 'pet-4',
        species: 'cat',
        breed: 'Domestic Shorthair',
        symptoms: 'Straining to urinate in litter box, crying in litterbox with no urine coming out',
      });

      expect(result.urgency).toBe('emergency');
      expect(result.probableConditions[0].condition).toContain('Urinary Tract Obstruction');
    });

    it('classifies severe hemorrhagic gastroenteritis as high urgency', () => {
      const result = predictSymptomsLocal({
        petId: 'pet-5',
        species: 'dog',
        symptoms: 'Continuous vomiting, vomiting blood and foul smelling bloody diarrhea with high fever',
      });

      expect(result.urgency).toBe('high');
      expect(result.probableConditions[0].condition).toContain('Gastroenteritis');
    });

    it('classifies otitis externa (ear infection) as moderate urgency', () => {
      const result = predictSymptomsLocal({
        petId: 'pet-6',
        species: 'dog',
        breed: 'Cocker Spaniel',
        symptoms: 'Frequent scratching ears, head shaking, smelly brown ear discharge',
      });

      expect(result.urgency).toBe('moderate');
      expect(result.probableConditions[0].condition).toContain('Otitis Externa');
      expect(result.probableConditions[0].confidence).toBeGreaterThan(0.4);
    });

    it('classifies kennel cough as moderate urgency', () => {
      const result = predictSymptomsLocal({
        petId: 'pet-7',
        species: 'dog',
        symptoms: 'Honking cough and runny nose after visiting boarding facility',
      });

      expect(result.urgency).toBe('moderate');
      expect(result.probableConditions[0].condition).toContain('Kennel Cough');
    });

    it('classifies mild dandruff and coat flaking as low urgency', () => {
      const result = predictSymptomsLocal({
        petId: 'pet-8',
        species: 'cat',
        symptoms: 'Mild dandruff and seasonal shedding, eating normally and active',
      });

      expect(result.urgency).toBe('low');
      expect(result.probableConditions[0].condition).toContain('Dermatological');
    });

    it('returns general observation when symptoms do not match known acute conditions', () => {
      const result = predictSymptomsLocal({
        petId: 'pet-9',
        species: 'dog',
        symptoms: 'Slightly different mood today while sitting on couch',
      });

      expect(result.urgency).toBe('low');
      expect(result.probableConditions).toHaveLength(1);
      expect(result.probableConditions[0].condition).toContain('General Observation');
      expect(result.disclaimer).toBe(VETERINARY_DISCLAIMER);
    });
  });

  describe('predictSymptoms with LLM Providers and Fallback', () => {
    it('uses OpenAI when OPENAI_API_KEY is configured', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      const mockResponse = {
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  urgency: 'high',
                  urgencyReason: 'Rapid onset fever and lethargy.',
                  probableConditions: [
                    {
                      condition: 'Acute Systemic Infection',
                      confidence: 0.88,
                      description: 'Potential bacterial or viral infection.',
                    },
                  ],
                  recommendedActions: ['Visit vet within 24 hours.'],
                }),
              },
            },
          ],
        },
      };

      const mockClient = {
        post: jest.fn().mockResolvedValue(mockResponse),
      };
      (mockedAxios.create as jest.Mock).mockReturnValue(mockClient as any);

      const prediction = await predictSymptoms({
        petId: 'pet-10',
        species: 'dog',
        symptoms: 'Lethargic with 104F fever',
      });

      expect(prediction.urgency).toBe('high');
      expect(prediction.probableConditions[0].condition).toBe('Acute Systemic Infection');
      expect(prediction.modelVersion).toContain('openai-');
    });

    it('uses Anthropic when ANTHROPIC_API_KEY is configured', async () => {
      delete process.env.OPENAI_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'ant-test-key';

      const mockResponse = {
        data: {
          content: [
            {
              text: JSON.stringify({
                urgency: 'moderate',
                urgencyReason: 'Pruritus and localized dermatitis.',
                probableConditions: [
                  {
                    condition: 'Allergic Dermatitis',
                    confidence: 0.75,
                    description: 'Skin allergy to food or environmental triggers.',
                  },
                ],
                recommendedActions: ['Consult vet for soothing wash.'],
              }),
            },
          ],
        },
      };

      const mockClient = {
        post: jest.fn().mockResolvedValue(mockResponse),
      };
      (mockedAxios.create as jest.Mock).mockReturnValue(mockClient as any);

      const prediction = await predictSymptoms({
        petId: 'pet-11',
        species: 'dog',
        symptoms: 'Constant itching paws and belly',
      });

      expect(prediction.urgency).toBe('moderate');
      expect(prediction.probableConditions[0].condition).toBe('Allergic Dermatitis');
      expect(prediction.modelVersion).toContain('anthropic-');
    });

    it('falls back cleanly to local triage if external LLM provider throws an error', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';
      const mockClient = {
        post: jest.fn().mockRejectedValue(new Error('OpenAI service timeout (504)')),
      };
      (mockedAxios.create as jest.Mock).mockReturnValue(mockClient as any);

      const prediction = await predictSymptoms({
        petId: 'pet-12',
        species: 'dog',
        symptoms: 'Distended stomach and non-productive retching',
      });

      expect(prediction.urgency).toBe('emergency');
      expect(prediction.probableConditions[0].condition).toContain('Gastric Dilatation-Volvulus');
      expect(prediction.disclaimer).toBe(VETERINARY_DISCLAIMER);
    });
  });
});
