import { randomUUID } from 'crypto';

export type VitalType = 'weight' | 'temperature' | 'heart_rate' | 'activity_level';
export type RiskLevel = 'low' | 'medium' | 'high';
export type SymptomUrgency = 'low' | 'moderate' | 'high' | 'emergency';

export interface VitalReading {
  petId: string;
  vitalType: VitalType;
  value: number;
  unit?: string;
  recordedAt: string;
}

export interface PetPredictionInput {
  petId: string;
  ownerId: string;
  species?: string;
  vitals: VitalReading[];
}

export interface HealthPrediction {
  petId: string;
  ownerId: string;
  predictedIssue: string;
  riskScore: number;
  riskLevel: RiskLevel;
  contributingFactors: string[];
  modelVersion: string;
  generatedAt: string;
}

export interface SymptomPredictionInput {
  petId: string;
  ownerId?: string;
  species: string;
  breed?: string;
  symptoms: string;
}

export interface SymptomPrediction {
  probableConditions: Array<{
    condition: string;
    confidence: number;
    description: string;
  }>;
  urgency: SymptomUrgency;
  urgencyReason: string;
  recommendedActions: string[];
  disclaimer: string;
  modelVersion: string;
  generatedAt: string;
}

export interface GeneratedHealthAlert {
  id: string;
  petId: string;
  ownerId: string;
  predictedIssue: string;
  riskScore: number;
  riskLevel: 'medium' | 'high';
  contributingFactors: string[];
  modelVersion: string;
  status: 'active';
  createdAt: string;
}

type FeatureVector = [number, number, number, number, number];

interface TrainingSample {
  features: FeatureVector;
  label: 0 | 1;
}

const MODEL_VERSION = 'cocohub-logreg-v1';
const ALERT_THRESHOLD = 0.65;
const MEDIUM_THRESHOLD = 0.42;

// Anonymized pet-vitals feature rows. Features are:
// weightGainPct, temperatureRisk, lowActivityRatio, heartRateRisk, sparseDataPenalty.
const ANONYMIZED_TRAINING_DATA: TrainingSample[] = [
  { features: [0.02, 0.05, 0.1, 0.05, 0], label: 0 },
  { features: [0.04, 0.1, 0.2, 0.05, 0], label: 0 },
  { features: [0.08, 0.15, 0.25, 0.1, 0], label: 0 },
  { features: [0.16, 0.25, 0.55, 0.25, 0], label: 1 },
  { features: [0.2, 0.4, 0.65, 0.35, 0], label: 1 },
  { features: [0.12, 0.65, 0.5, 0.45, 0], label: 1 },
  { features: [0.01, 0.8, 0.3, 0.2, 0], label: 1 },
  { features: [0.03, 0.15, 0.7, 0.15, 0], label: 1 },
  { features: [0.0, 0.05, 0.05, 0.05, 0.3], label: 0 },
  { features: [0.11, 0.2, 0.35, 0.15, 0.1], label: 0 },
];

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function trainLogisticRegression(samples: TrainingSample[]) {
  const weights = new Array(samples[0].features.length).fill(0);
  let bias = -1.2;
  const learningRate = 0.55;

  for (let epoch = 0; epoch < 700; epoch += 1) {
    for (const sample of samples) {
      const z =
        bias + sample.features.reduce((sum, feature, index) => sum + feature * weights[index], 0);
      const error = sigmoid(z) - sample.label;
      for (let i = 0; i < weights.length; i += 1) {
        weights[i] -= learningRate * error * sample.features[i];
      }
      bias -= learningRate * error;
    }
  }

  return { weights, bias };
}

const MODEL = trainLogisticRegression(ANONYMIZED_TRAINING_DATA);
const SYMPTOM_MODEL_VERSION = 'cocohub-symptom-triage-v1';
const VET_DISCLAIMER =
  'This is AI-assisted triage only and is not a medical diagnosis. Contact a licensed veterinarian for definitive advice.';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sortByDate(readings: VitalReading[]): VitalReading[] {
  return [...readings].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
}

function recent(readings: VitalReading[], days: number): VitalReading[] {
  if (!readings.length) return [];
  const latest = Math.max(...readings.map((reading) => new Date(reading.recordedAt).getTime()));
  const cutoff = latest - days * 24 * 60 * 60 * 1000;
  return readings.filter((reading) => new Date(reading.recordedAt).getTime() >= cutoff);
}

function buildFeatures(vitals: VitalReading[]): { features: FeatureVector; factors: string[] } {
  const byType = {
    weight: sortByDate(vitals.filter((reading) => reading.vitalType === 'weight')),
    temperature: sortByDate(vitals.filter((reading) => reading.vitalType === 'temperature')),
    heart_rate: sortByDate(vitals.filter((reading) => reading.vitalType === 'heart_rate')),
    activity_level: sortByDate(vitals.filter((reading) => reading.vitalType === 'activity_level')),
  };

  const factors: string[] = [];
  const firstWeight = byType.weight[0]?.value;
  const latestWeight = byType.weight[byType.weight.length - 1]?.value;
  const weightGainPct =
    firstWeight && latestWeight ? clamp((latestWeight - firstWeight) / firstWeight, 0, 0.4) : 0;
  if (weightGainPct >= 0.1) factors.push('weight gain');

  const latestTemp = byType.temperature[byType.temperature.length - 1]?.value;
  const temperatureRisk = latestTemp ? clamp(Math.abs(latestTemp - 38.6) / 2.2, 0, 1) : 0.15;
  if (latestTemp && (latestTemp > 39.4 || latestTemp < 37.8)) factors.push('abnormal temperature');

  const recentActivity = recent(byType.activity_level, 14);
  const lowActivityRatio = recentActivity.length
    ? recentActivity.filter((reading) => reading.value <= 1).length / recentActivity.length
    : 0.2;
  if (lowActivityRatio >= 0.5) factors.push('reduced activity');

  const latestHeartRate = byType.heart_rate[byType.heart_rate.length - 1]?.value;
  const heartRateRisk = latestHeartRate
    ? latestHeartRate < 60
      ? clamp((60 - latestHeartRate) / 40, 0, 1)
      : clamp((latestHeartRate - 140) / 80, 0, 1)
    : 0.1;
  if (latestHeartRate && (latestHeartRate < 60 || latestHeartRate > 140)) {
    factors.push('heart rate outside baseline');
  }

  const sparseDataPenalty = vitals.length < 4 ? 0.3 : 0;
  if (sparseDataPenalty) factors.push('limited recent vitals');

  return {
    features: [weightGainPct, temperatureRisk, lowActivityRatio, heartRateRisk, sparseDataPenalty],
    factors,
  };
}

export function predictPetHealth(input: PetPredictionInput): HealthPrediction {
  const { features, factors } = buildFeatures(input.vitals);
  const z =
    MODEL.bias + features.reduce((sum, feature, index) => sum + feature * MODEL.weights[index], 0);
  const riskScore = Number(sigmoid(z).toFixed(3));
  const riskLevel: RiskLevel =
    riskScore >= ALERT_THRESHOLD ? 'high' : riskScore >= MEDIUM_THRESHOLD ? 'medium' : 'low';

  return {
    petId: input.petId,
    ownerId: input.ownerId,
    predictedIssue:
      riskScore >= 0.72 ? 'possible acute health deterioration' : 'possible emerging health issue',
    riskScore,
    riskLevel,
    contributingFactors: factors.length ? factors : ['stable vitals baseline'],
    modelVersion: MODEL_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

export async function analyzeSymptoms(input: SymptomPredictionInput): Promise<SymptomPrediction> {
  const llmPrediction = await analyzeSymptomsWithOpenAI(input);
  if (llmPrediction) return llmPrediction;

  return analyzeSymptomsLocally(input);
}

function analyzeSymptomsLocally(input: SymptomPredictionInput): SymptomPrediction {
  const normalized = input.symptoms.toLowerCase();
  const species = input.species.toLowerCase();
  const breedContext = input.breed ? ` ${input.breed}` : '';
  const matches = (terms: string[]) => terms.some((term) => normalized.includes(term));

  let urgency: SymptomUrgency = 'low';
  const reasons: string[] = [];
  const conditions: SymptomPrediction['probableConditions'] = [];
  const actions = new Set<string>();

  const addCondition = (condition: string, confidence: number, description: string) => {
    conditions.push({ condition, confidence: clamp(confidence, 0.05, 0.98), description });
  };

  const setUrgency = (candidate: SymptomUrgency, reason: string) => {
    const rank: Record<SymptomUrgency, number> = { low: 0, moderate: 1, high: 2, emergency: 3 };
    if (rank[candidate] > rank[urgency]) urgency = candidate;
    reasons.push(reason);
  };

  if (
    matches([
      'trouble breathing',
      'difficulty breathing',
      'cannot breathe',
      'blue gums',
      'collapse',
      'collapsed',
      'seizure',
      'unconscious',
    ])
  ) {
    setUrgency(
      'emergency',
      'Reported breathing, collapse, seizure, or consciousness warning signs.',
    );
    addCondition(
      'Emergency distress',
      0.9,
      'These symptoms can indicate a time-sensitive emergency.',
    );
    actions.add('Seek emergency veterinary care now.');
    actions.add('Call the clinic before arrival if safe to do so.');
  }

  if (matches(['vomit', 'vomiting', 'diarrhea', 'blood in stool', 'bloody stool'])) {
    setUrgency(
      matches(['blood', 'repeated', 'constantly', 'all day']) ? 'high' : 'moderate',
      'Digestive symptoms may require monitoring or urgent care depending on severity.',
    );
    addCondition(
      'Gastrointestinal upset',
      0.72,
      'Vomiting or diarrhea can be caused by diet, infection, toxin exposure, or obstruction.',
    );
    actions.add('Offer small amounts of water if your pet can keep it down.');
    actions.add(
      'Contact your vet promptly if symptoms repeat, blood appears, or lethargy develops.',
    );
  }

  if (matches(['not eating', "won't eat", 'not drinking', 'lethargic', 'lethargy', 'weak'])) {
    setUrgency(
      matches(['2 days', 'two days', '48 hours', 'weak']) ? 'high' : 'moderate',
      'Appetite, hydration, or energy changes can signal systemic illness.',
    );
    addCondition(
      'Systemic illness or dehydration risk',
      0.68,
      'Reduced appetite, drinking, or energy can accompany infection, pain, fever, or dehydration.',
    );
    actions.add(
      'Track food, water, urination, and energy level until a veterinarian advises next steps.',
    );
  }

  if (matches(['limp', 'limping', 'not bearing weight', 'swollen paw', 'injury'])) {
    setUrgency(
      matches(['not bearing weight', 'swollen', 'crying']) ? 'high' : 'moderate',
      'Mobility changes may indicate pain, injury, or inflammation.',
    );
    addCondition(
      'Musculoskeletal pain or injury',
      0.7,
      'Limping commonly reflects strain, paw injury, arthritis flare, or trauma.',
    );
    actions.add('Limit activity and avoid jumping/running until evaluated.');
  }

  if (matches(['scratch', 'scratching', 'ear', 'shaking head', 'itch', 'itchy'])) {
    setUrgency(
      'low',
      'Skin or ear irritation is usually non-emergency but can worsen without care.',
    );
    addCondition(
      'Skin or ear irritation',
      0.64,
      'Scratching or head shaking can reflect allergies, parasites, or ear infection.',
    );
    actions.add('Prevent self-trauma and schedule a routine vet visit if symptoms persist.');
  }

  if (matches(['cough', 'coughing', 'sneeze', 'sneezing', 'nasal', 'eye discharge'])) {
    setUrgency(
      matches(['breathing', 'wheezing']) ? 'high' : 'moderate',
      'Respiratory signs can progress, especially with breathing effort.',
    );
    addCondition(
      'Respiratory irritation or infection',
      0.66,
      'Coughing, sneezing, or discharge may be infectious, allergic, or inflammatory.',
    );
    actions.add('Keep your pet calm and monitor breathing rate at rest.');
  }

  if (
    species.includes('cat') &&
    matches(['not urinating', 'straining to urinate', "can't pee", 'cannot pee'])
  ) {
    setUrgency('emergency', 'Cats with urinary straining can have a life-threatening blockage.');
    addCondition(
      'Possible urinary obstruction',
      0.91,
      'Urinary blockage is an emergency, especially in male cats.',
    );
    actions.add('Go to an emergency veterinarian immediately.');
  }

  if (!conditions.length) {
    addCondition(
      'Non-specific symptom pattern',
      0.45,
      `Reported signs for ${input.species}${breedContext} need more clinical context.`,
    );
    actions.add(
      'Monitor closely and contact your vet if symptoms persist, worsen, or you are worried.',
    );
    reasons.push('No emergency keywords detected, but symptoms still need owner monitoring.');
  }

  actions.add('Use this as triage only, not a diagnosis.');

  return {
    probableConditions: conditions.slice(0, 3),
    urgency,
    urgencyReason: reasons[0] ?? 'No immediate red flags detected from the symptom text.',
    recommendedActions: Array.from(actions).slice(0, 5),
    disclaimer: VET_DISCLAIMER,
    modelVersion: SYMPTOM_MODEL_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

async function analyzeSymptomsWithOpenAI(
  input: SymptomPredictionInput,
): Promise<SymptomPrediction | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.SYMPTOM_CHECKER_MODEL ?? 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a veterinary triage assistant. Return only JSON with probableConditions, urgency, urgencyReason, recommendedActions, disclaimer. Urgency must be low, moderate, high, or emergency. Never diagnose definitively.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              species: input.species,
              breed: input.breed,
              symptoms: input.symptoms,
            }),
          },
        ],
      }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as Partial<SymptomPrediction>;
    if (!isValidUrgency(parsed.urgency) || !Array.isArray(parsed.recommendedActions)) {
      return null;
    }

    return {
      probableConditions: Array.isArray(parsed.probableConditions)
        ? parsed.probableConditions.slice(0, 3).map((condition) => ({
            condition: String(condition.condition ?? 'Possible health issue'),
            confidence: clamp(Number(condition.confidence ?? 0.5), 0.05, 0.98),
            description: String(condition.description ?? ''),
          }))
        : [],
      urgency: parsed.urgency,
      urgencyReason: String(parsed.urgencyReason ?? 'AI triage completed.'),
      recommendedActions: parsed.recommendedActions.slice(0, 5).map(String),
      disclaimer: String(parsed.disclaimer ?? VET_DISCLAIMER),
      modelVersion: process.env.SYMPTOM_CHECKER_MODEL ?? 'gpt-4o-mini',
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function isValidUrgency(value: unknown): value is SymptomUrgency {
  return value === 'low' || value === 'moderate' || value === 'high' || value === 'emergency';
}

export function runDailyPredictions(inputs: PetPredictionInput[]): GeneratedHealthAlert[] {
  return inputs
    .map(predictPetHealth)
    .filter((prediction) => prediction.riskLevel === 'high')
    .map((prediction) => ({
      id: randomUUID(),
      petId: prediction.petId,
      ownerId: prediction.ownerId,
      predictedIssue: prediction.predictedIssue,
      riskScore: prediction.riskScore,
      riskLevel: prediction.riskLevel as 'high',
      contributingFactors: prediction.contributingFactors,
      modelVersion: prediction.modelVersion,
      status: 'active',
      createdAt: prediction.generatedAt,
    }));
}

export default {
  predictPetHealth,
  analyzeSymptoms,
  runDailyPredictions,
};
