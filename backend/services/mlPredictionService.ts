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

export interface SymptomPredictionInput {
  petId: string;
  ownerId: string;
  species?: string;
  breed?: string;
  symptoms: string;
}

export interface SymptomConditionPrediction {
  condition: string;
  confidence: number;
  description: string;
}

export interface SymptomPrediction {
  petId: string;
  ownerId: string;
  species?: string;
  breed?: string;
  probableConditions: SymptomConditionPrediction[];
  urgency: SymptomUrgency;
  urgencyReason: string;
  recommendedActions: string[];
  disclaimer: string;
  modelVersion: string;
  generatedAt: string;
}

type FeatureVector = [number, number, number, number, number];

interface TrainingSample {
  features: FeatureVector;
  label: 0 | 1;
}

const MODEL_VERSION = 'cocohub-logreg-v1';
const SYMPTOM_MODEL_VERSION = 'cocohub-symptom-triage-v1';
const ALERT_THRESHOLD = 0.65;
const MEDIUM_THRESHOLD = 0.42;
const SYMPTOM_DISCLAIMER =
  'This is not veterinary advice. It is an AI-assisted triage estimate; contact a licensed veterinarian for diagnosis and treatment.';

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

interface SymptomConditionProfile {
  condition: string;
  description: string;
  keywords: string[];
  urgency: SymptomUrgency;
  actions: string[];
  species?: string[];
}

const SYMPTOM_CONDITIONS: SymptomConditionProfile[] = [
  {
    condition: 'Respiratory distress',
    description:
      'Breathing difficulty, blue gums, collapse, or severe panting can become life-threatening quickly.',
    keywords: ['breathing', 'panting', 'gasping', 'wheezing', 'blue gums', 'collapse', 'labored'],
    urgency: 'emergency',
    actions: [
      'Seek emergency veterinary care immediately.',
      'Keep your pet calm and avoid forcing food, water, or medication.',
    ],
  },
  {
    condition: 'Gastrointestinal upset',
    description:
      'Vomiting, diarrhea, appetite loss, or abdominal discomfort may indicate stomach or intestinal illness.',
    keywords: ['vomit', 'vomiting', 'diarrhea', 'not eating', 'appetite', 'nausea', 'stomach'],
    urgency: 'moderate',
    actions: [
      'Offer small amounts of water and monitor frequency of vomiting or diarrhea.',
      'Book a vet visit if symptoms persist, worsen, or include blood.',
    ],
  },
  {
    condition: 'Possible toxin ingestion',
    description:
      'Known or suspected ingestion of toxic foods, plants, chemicals, or medication requires urgent guidance.',
    keywords: [
      'poison',
      'toxin',
      'chocolate',
      'grape',
      'raisin',
      'xylitol',
      'medication',
      'ate pills',
    ],
    urgency: 'emergency',
    actions: [
      'Call an emergency vet or poison control hotline now.',
      'Do not induce vomiting unless a veterinary professional instructs you to do so.',
    ],
  },
  {
    condition: 'Pain or orthopedic injury',
    description:
      'Limping, swelling, reluctance to move, or yelping may reflect strain, sprain, fracture, or joint pain.',
    keywords: ['limp', 'limping', 'pain', 'swollen', 'swelling', 'yelping', 'leg', 'paw', 'injury'],
    urgency: 'high',
    actions: [
      'Restrict activity and prevent jumping or running.',
      'Schedule a vet exam soon, especially if your pet cannot bear weight.',
    ],
  },
  {
    condition: 'Ear or skin irritation',
    description:
      'Scratching, head shaking, odor, redness, or hair loss can indicate ear infection, allergy, or dermatitis.',
    keywords: [
      'itch',
      'itching',
      'scratching',
      'ear',
      'ears',
      'rash',
      'redness',
      'hot spot',
      'shaking head',
    ],
    urgency: 'low',
    actions: [
      'Prevent excessive scratching and keep the area clean and dry.',
      'Schedule a non-urgent vet visit if irritation lasts more than a day or two.',
    ],
  },
  {
    condition: 'Urinary tract concern',
    description:
      'Straining, frequent urination, blood in urine, or inability to urinate can signal urinary disease.',
    keywords: ['urine', 'urinating', 'pee', 'peeing', 'straining', 'litter box', 'blood in urine'],
    urgency: 'high',
    actions: [
      'Contact a vet promptly for urinary symptoms.',
      'Treat inability to urinate, especially in cats, as an emergency.',
    ],
  },
  {
    condition: 'General lethargy or systemic illness',
    description:
      'Low energy, weakness, fever, hiding, or behavior change can accompany many underlying conditions.',
    keywords: [
      'lethargic',
      'lethargy',
      'weak',
      'tired',
      'hiding',
      'fever',
      'not moving',
      'sleeping',
    ],
    urgency: 'moderate',
    actions: [
      'Monitor temperature, appetite, water intake, and behavior changes.',
      'Arrange veterinary care if lethargy is marked, persistent, or paired with other symptoms.',
    ],
  },
];

interface SymptomTrainingSample {
  condition: string;
  text: string;
}

const SYMPTOM_TRAINING_DATA: SymptomTrainingSample[] = [
  {
    condition: 'Respiratory distress',
    text: 'difficulty breathing labored breathing panting gasping wheezing blue gums collapsed cannot breathe',
  },
  {
    condition: 'Respiratory distress',
    text: 'breathing faster than normal struggling to breathe noisy breathing pale gums severe panting',
  },
  {
    condition: 'Gastrointestinal upset',
    text: 'vomiting repeatedly diarrhea not eating nausea stomach upset appetite loss abdominal discomfort',
  },
  {
    condition: 'Gastrointestinal upset',
    text: 'threw up this morning loose stool refuses food seems nauseous belly pain',
  },
  {
    condition: 'Possible toxin ingestion',
    text: 'ate chocolate grapes raisin xylitol medication pills poison toxin chemical ingestion',
  },
  {
    condition: 'Possible toxin ingestion',
    text: 'swallowed human medicine got into cleaner toxic plant ate something poisonous',
  },
  {
    condition: 'Pain or orthopedic injury',
    text: 'limping swollen paw yelping pain leg injury cannot bear weight after jumping',
  },
  {
    condition: 'Pain or orthopedic injury',
    text: 'favoring back leg sore joint reluctant to walk hurt paw swelling after playing',
  },
  {
    condition: 'Ear or skin irritation',
    text: 'scratching ears shaking head redness rash itching hot spot ear odor skin irritation',
  },
  {
    condition: 'Ear or skin irritation',
    text: 'itchy skin chewing paws hair loss red ears constant scratching dermatitis allergy',
  },
  {
    condition: 'Urinary tract concern',
    text: 'straining to pee frequent urination blood in urine litter box not urinating urinary pain',
  },
  {
    condition: 'Urinary tract concern',
    text: 'trying to pee small amounts accidents crying in litter box bladder urine problem',
  },
  {
    condition: 'General lethargy or systemic illness',
    text: 'lethargic weak tired hiding fever not moving sleeping more than usual behavior change',
  },
  {
    condition: 'General lethargy or systemic illness',
    text: 'low energy depressed weakness seems sick feverish inactive unusually quiet',
  },
];

const EMERGENCY_PHRASES = [
  'cannot breathe',
  'trouble breathing',
  'difficulty breathing',
  'blue gums',
  'collapsed',
  'seizure',
  'unconscious',
  'hit by car',
  'not urinating',
  'ate chocolate',
  'ate grapes',
  'xylitol',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^\w\s]/g, ' ');
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

interface NaiveBayesModel {
  vocabulary: Set<string>;
  priors: Map<string, number>;
  tokenLogProbabilities: Map<string, Map<string, number>>;
  unknownLogProbabilities: Map<string, number>;
}

function trainSymptomClassifier(samples: SymptomTrainingSample[]): NaiveBayesModel {
  const vocabulary = new Set<string>();
  const classTokenCounts = new Map<string, Map<string, number>>();
  const classSampleCounts = new Map<string, number>();
  const classTotalTokens = new Map<string, number>();

  for (const sample of samples) {
    const tokens = tokenize(sample.text);
    classSampleCounts.set(sample.condition, (classSampleCounts.get(sample.condition) ?? 0) + 1);

    const counts = classTokenCounts.get(sample.condition) ?? new Map<string, number>();
    for (const token of tokens) {
      vocabulary.add(token);
      counts.set(token, (counts.get(token) ?? 0) + 1);
      classTotalTokens.set(sample.condition, (classTotalTokens.get(sample.condition) ?? 0) + 1);
    }
    classTokenCounts.set(sample.condition, counts);
  }

  const priors = new Map<string, number>();
  const tokenLogProbabilities = new Map<string, Map<string, number>>();
  const unknownLogProbabilities = new Map<string, number>();
  const totalSamples = samples.length;
  const vocabularySize = vocabulary.size;

  for (const [condition, sampleCount] of classSampleCounts) {
    priors.set(condition, Math.log(sampleCount / totalSamples));
    const counts = classTokenCounts.get(condition) ?? new Map<string, number>();
    const denominator = (classTotalTokens.get(condition) ?? 0) + vocabularySize;
    const probabilities = new Map<string, number>();

    for (const token of vocabulary) {
      probabilities.set(token, Math.log(((counts.get(token) ?? 0) + 1) / denominator));
    }

    tokenLogProbabilities.set(condition, probabilities);
    unknownLogProbabilities.set(condition, Math.log(1 / denominator));
  }

  return { vocabulary, priors, tokenLogProbabilities, unknownLogProbabilities };
}

const SYMPTOM_CLASSIFIER = trainSymptomClassifier(SYMPTOM_TRAINING_DATA);

function scoreSymptomClassifier(
  text: string,
): Array<{ profile: SymptomConditionProfile; score: number }> {
  const tokens = tokenize(text);
  const rawScores = SYMPTOM_CONDITIONS.map((profile) => {
    const prior = SYMPTOM_CLASSIFIER.priors.get(profile.condition) ?? Math.log(1e-6);
    const tokenScores = SYMPTOM_CLASSIFIER.tokenLogProbabilities.get(profile.condition);
    const unknownScore = SYMPTOM_CLASSIFIER.unknownLogProbabilities.get(profile.condition) ?? -12;
    const logScore = tokens.reduce((sum, token) => {
      return sum + (tokenScores?.get(token) ?? unknownScore);
    }, prior);

    return { profile, logScore };
  });

  const maxLogScore = Math.max(...rawScores.map((item) => item.logScore));
  const expScores = rawScores.map((item) => ({
    profile: item.profile,
    expScore: Math.exp(item.logScore - maxLogScore),
  }));
  const total = expScores.reduce((sum, item) => sum + item.expScore, 0) || 1;

  return expScores
    .map((item) => ({ profile: item.profile, score: item.expScore / total }))
    .sort((a, b) => b.score - a.score);
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

export function predictSymptoms(input: SymptomPredictionInput): SymptomPrediction {
  const text = normalizeText(input.symptoms);
  const ranked = scoreSymptomClassifier(text);
  const emergencyMatch = EMERGENCY_PHRASES.find((phrase) => text.includes(phrase));
  const emergencyProfile = emergencyMatch
    ? (ranked.find((match) => match.profile.urgency === 'emergency')?.profile ??
      SYMPTOM_CONDITIONS.find((profile) => profile.urgency === 'emergency'))
    : undefined;
  const topMatches = ranked.slice(0, 3);
  if (
    emergencyMatch &&
    emergencyProfile &&
    !topMatches.some((match) => match.profile === emergencyProfile)
  ) {
    topMatches.unshift({
      profile: emergencyProfile,
      score: Math.max(topMatches[0]?.score ?? 0, 0.9),
    });
  }

  const probableConditions = topMatches.map(({ profile, score }) => ({
    condition: profile.condition,
    confidence: Number(clamp(0.35 + score * 0.6, 0.35, 0.95).toFixed(2)),
    description: profile.description,
  }));

  const urgency: SymptomUrgency = emergencyMatch ? 'emergency' : topMatches[0].profile.urgency;
  const primary = topMatches[0].profile;
  const recommendedActions = [
    ...new Set([
      ...(emergencyMatch ? ['Seek emergency veterinary care immediately.'] : []),
      ...primary.actions,
      'Share this triage summary with your veterinarian.',
    ]),
  ];

  const urgencyReason = emergencyMatch
    ? `Emergency phrase detected: "${emergencyMatch}".`
    : `${primary.condition} signs suggest ${urgency} urgency based on the provided symptoms.`;

  return {
    petId: input.petId,
    ownerId: input.ownerId,
    species: input.species,
    breed: input.breed,
    probableConditions,
    urgency,
    urgencyReason,
    recommendedActions,
    disclaimer: SYMPTOM_DISCLAIMER,
    modelVersion: SYMPTOM_MODEL_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

export default {
  predictPetHealth,
  predictSymptoms,
  runDailyPredictions,
};
