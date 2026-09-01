import { randomUUID } from 'crypto';
import axios, { AxiosInstance } from 'axios';

export type VitalType = 'weight' | 'temperature' | 'heart_rate' | 'activity_level';
export type RiskLevel = 'low' | 'medium' | 'high';

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

type FeatureVector = [number, number, number, number, number];

interface TrainingSample {
  features: FeatureVector;
  label: 0 | 1;
}

const MODEL_VERSION = 'cocohub-logreg-v1';
const SYMPTOM_MODEL_VERSION = 'cocohub-symptom-v1.0';
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

// ─────────────────────────────────────────────────────────────────────────────
// AI Symptom Checker Types & Engine (Issue #31)
// ─────────────────────────────────────────────────────────────────────────────

export type UrgencyLevel = 'low' | 'moderate' | 'high' | 'emergency';

export interface ProbableCondition {
  condition: string;
  confidence: number; // 0–1
  description: string;
}

export interface SymptomPredictionRequest {
  petId: string;
  species?: string;
  breed?: string;
  symptoms: string;
  userId?: string;
}

export interface SymptomPrediction {
  probableConditions: ProbableCondition[];
  urgency: UrgencyLevel;
  urgencyReason: string;
  recommendedActions: string[];
  disclaimer: string;
  modelVersion?: string;
}

export const VETERINARY_DISCLAIMER =
  'This is an AI-assisted triage assessment and does not constitute a formal veterinary diagnosis. Please consult a licensed veterinarian for definitive diagnosis and medical treatment.';

export type LLMProvider = 'openai' | 'anthropic' | 'huggingface' | 'local';

export function getLLMProvider(): LLMProvider {
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.HUGGINGFACE_API_KEY) return 'huggingface';
  return 'local';
}

function buildTriagePrompt(req: SymptomPredictionRequest): string {
  const species = req.species || 'Unknown species';
  const breed = req.breed || 'Unknown breed';
  return `You are a licensed veterinary triage assistant. Analyze the following pet symptoms and provide a structured clinical assessment in valid JSON format.

Pet Information:
- Species: ${species}
- Breed: ${breed}
- Reported Symptoms: "${req.symptoms}"

Respond with ONLY a raw JSON object conforming strictly to this schema:
{
  "urgency": "low" | "moderate" | "high" | "emergency",
  "urgencyReason": "Concise explanation of why this urgency level was assigned based on clinical risk.",
  "probableConditions": [
    {
      "condition": "Name of condition",
      "confidence": number between 0.0 and 1.0,
      "description": "Brief clinical explanation of the condition and how it relates to reported symptoms."
    }
  ],
  "recommendedActions": [
    "Actionable next step for the pet owner"
  ]
}

Urgency Guidelines:
- "emergency": Life-threatening indicators such as severe difficulty breathing, cyanosis/pale gums, collapse, seizures, severe active bleeding, toxin/poison ingestion (e.g. chocolate, lilies, rodenticide), gastric dilatation volvulus (bloat), or urinary blockage.
- "high": High fever, continuous vomiting/diarrhea >24h, severe pain, inability to bear weight, eye injuries.
- "moderate": Ear infections, mild limping, localized itching, mild gastroenteritis (1-2 episodes), persistent coughing without respiratory distress.
- "low": Mild seasonal itching, minor cosmetic coat changes, slight tartar, general behavioral observation.`;
}

// ─── OpenAI Provider ─────────────────────────────────────────────────────────

async function predictWithOpenAI(req: SymptomPredictionRequest): Promise<SymptomPrediction> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const client: AxiosInstance = axios.create({
    baseURL: baseUrl,
    timeout: 25000,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const response = await client.post('/chat/completions', {
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a veterinary triage assistant that outputs strictly valid JSON without markdown fences.',
      },
      {
        role: 'user',
        content: buildTriagePrompt(req),
      },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty response');
  const parsed = JSON.parse(content);
  return normalizeSymptomPrediction(parsed, 'openai-' + model);
}

// ─── Anthropic Provider ──────────────────────────────────────────────────────

async function predictWithAnthropic(req: SymptomPredictionRequest): Promise<SymptomPrediction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1';
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';

  const client: AxiosInstance = axios.create({
    baseURL: baseUrl,
    timeout: 25000,
    headers: {
      'x-api-key': apiKey || '',
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
  });

  const response = await client.post('/messages', {
    model,
    max_tokens: 800,
    system:
      'You are a veterinary triage assistant that outputs strictly valid JSON without markdown fences.',
    messages: [{ role: 'user', content: buildTriagePrompt(req) }],
  });

  const content = response.data?.content?.[0]?.text;
  if (!content) throw new Error('Anthropic returned empty response');
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(cleaned);
  return normalizeSymptomPrediction(parsed, 'anthropic-' + model);
}

// ─── HuggingFace Provider ────────────────────────────────────────────────────

async function predictWithHuggingFace(req: SymptomPredictionRequest): Promise<SymptomPrediction> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;
  const model = process.env.HUGGINGFACE_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct';
  const url = `https://api-inference.huggingface.co/models/${model}`;

  const response = await axios.post(
    url,
    {
      inputs: buildTriagePrompt(req),
      parameters: { temperature: 0.2, max_new_tokens: 700, return_full_text: false },
    },
    {
      timeout: 25000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const text =
    typeof response.data === 'string'
      ? response.data
      : response.data?.[0]?.generated_text || response.data?.generated_text || '';
  if (!text) throw new Error('HuggingFace returned empty response');

  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No JSON object found in HuggingFace response');
  }
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  return normalizeSymptomPrediction(parsed, 'huggingface-' + model);
}

// ─── Local Multi-Class Triage & Clinical Classifier ──────────────────────────

interface ConditionProfile {
  name: string;
  urgency: UrgencyLevel;
  species: Array<'dog' | 'cat' | 'any'>;
  primaryKeywords: string[];
  secondaryKeywords: string[];
  description: string;
  defaultAction: string;
}

const CLINICAL_CONDITION_PROFILES: ConditionProfile[] = [
  // ── EMERGENCY ──
  {
    name: 'Acute Poisoning / Toxic Ingestion',
    urgency: 'emergency',
    species: ['any'],
    primaryKeywords: [
      'poison',
      'toxin',
      'toxic',
      'chocolate',
      'xylitol',
      'lily',
      'lilies',
      'rat poison',
      'antifreeze',
      'grape',
      'raisin',
      'bleach',
      'ibuprofen',
      'advil',
      'tylenol',
      'rodenticide',
      'swallowed battery',
      'ate poison',
      'ingested toxic',
    ],
    secondaryKeywords: ['salivating excessively', 'tremors', 'drooling', 'foaming at mouth'],
    description:
      'Suspected ingestion of toxic substances can lead to rapid organ failure, neurotoxicity, or death.',
    defaultAction:
      'Contact emergency veterinary clinic or animal poison control immediately. Bring packaging if available. Do not induce vomiting without explicit veterinary instructions.',
  },
  {
    name: 'Gastric Dilatation-Volvulus (Bloat / GDV)',
    urgency: 'emergency',
    species: ['dog'],
    primaryKeywords: [
      'bloat',
      'bloated',
      'distended stomach',
      'swollen abdomen',
      'dry heaving',
      'unproductive retching',
      'unproductive vomiting',
      'trying to throw up nothing comes out',
      'pacing restlessness',
    ],
    secondaryKeywords: ['panting', 'drooling', 'weakness', 'collapse'],
    description:
      'GDV is a critical, life-threatening emergency where the stomach dilates and rotates, cutting off blood supply.',
    defaultAction:
      'Transport immediately to the nearest 24/7 veterinary emergency hospital. Immediate surgical decompression is required.',
  },
  {
    name: 'Acute Respiratory Distress / Dyspnea',
    urgency: 'emergency',
    species: ['any'],
    primaryKeywords: [
      'difficulty breathing',
      'cannot breathe',
      "can't breathe",
      'struggling to breathe',
      'gasping',
      'cyanosis',
      'blue gums',
      'blue tongue',
      'pale white gums',
      'choking',
      'suffocating',
      'open mouth breathing in cat',
    ],
    secondaryKeywords: ['panting heavily', 'lethargic', 'collapse', 'wheezing'],
    description:
      'Impaired oxygenation due to upper airway obstruction, pulmonary edema, pleural effusion, or cardiac failure.',
    defaultAction:
      'Seek emergency veterinary care immediately. Keep the pet calm, minimize handling, and avoid stressing the airway.',
  },
  {
    name: 'Acute Neurological Crisis (Seizures / Collapse / Loss of Consciousness)',
    urgency: 'emergency',
    species: ['any'],
    primaryKeywords: [
      'seizure',
      'convulsion',
      'collapsed',
      'unconscious',
      'fainted',
      'unresponsive',
      'paralysis',
      'dragging legs',
      'cannot stand',
      'sudden paralysis',
      'paralyzed',
    ],
    secondaryKeywords: ['tremors', 'shaking violently', 'loss of bladder control', 'dazed'],
    description:
      'Severe central nervous system disturbance, cluster seizures, status epilepticus, or sudden circulatory collapse.',
    defaultAction:
      'Protect the pet from injury, do not put hands near the mouth, keep the environment dark and quiet, and transport urgently to an emergency hospital.',
  },
  {
    name: 'Feline Lower Urinary Tract Obstruction (Blocked Cat)',
    urgency: 'emergency',
    species: ['cat'],
    primaryKeywords: [
      'straining to urinate',
      'crying in litterbox',
      'no urine coming out',
      'crying in litter box',
      'blocked cat',
      'urinary blockage',
      'frequent trips to litter box without peeing',
      'screaming while peeing',
    ],
    secondaryKeywords: ['licking genitals', 'lethargic', 'painful belly'],
    description:
      'Complete urethral obstruction prevents urination, causing hyperkalemia and acute uremic death within 24–48 hours.',
    defaultAction:
      'Transport your cat immediately to an emergency vet. Complete urinary blockage is fatal without immediate catheterization.',
  },
  {
    name: 'Severe Hemorrhage / Active Trauma',
    urgency: 'emergency',
    species: ['any'],
    primaryKeywords: [
      'bleeding profusely',
      'blood spurting',
      'severe bleeding',
      'hit by car',
      'fell from balcony',
      'deep puncture wound',
      'severe trauma',
      'compound fracture',
    ],
    secondaryKeywords: ['shock', 'whimpering', 'weak pulse'],
    description:
      'Uncontrolled arterial or venous bleeding, hypovolemic shock, or severe internal trauma.',
    defaultAction:
      'Apply direct gentle pressure with a clean cloth. Keep the pet warm and transport immediately to veterinary emergency care.',
  },

  // ── HIGH URGENCY ──
  {
    name: 'Severe Gastroenteritis / Dehydration / Parvovirus Suspicion',
    urgency: 'high',
    species: ['any'],
    primaryKeywords: [
      'vomiting blood',
      'bloody diarrhea',
      'black stool',
      'severe vomiting and diarrhea',
      'foul smelling bloody',
      'high fever',
      'continuous vomiting',
      'vomited 5 times',
      'cannot keep water down',
    ],
    secondaryKeywords: ['lethargy', 'dehydrated', 'sunken eyes', 'not drinking'],
    description:
      'Rapid fluid loss, electrolyte imbalance, hemorrhagic gastroenteritis, or acute infectious enteritis.',
    defaultAction:
      'Schedule a same-day urgent veterinary appointment. Do not administer human anti-diarrheal medications.',
  },
  {
    name: 'Corneal Ulceration / Acute Ocular Injury',
    urgency: 'high',
    species: ['any'],
    primaryKeywords: [
      'cloudy eye',
      'squinting eye',
      'eye swollen shut',
      'eye injury',
      'scratch on eye',
      'scratch on cornea',
      'corneal ulcer',
      'blood in eye',
      'protruding eye',
    ],
    secondaryKeywords: ['yellow eye discharge', 'pawing at eye', 'red eye'],
    description:
      'Corneal abrasions, ulcers, or acute glaucoma can progress rapidly to permanent vision loss if untreated.',
    defaultAction:
      'Visit a veterinarian within 12–24 hours. Prevent the pet from rubbing or pawing the eye with an Elizabethan collar.',
  },
  {
    name: 'Acute Musculoskeletal Trauma / Severe Lameness',
    urgency: 'high',
    species: ['any'],
    primaryKeywords: [
      'cannot put weight on leg',
      'non weight bearing',
      'crying when walking',
      'severe limp',
      'broken leg',
      'cruciate ligament',
      'swollen joint',
      'acute lameness',
    ],
    secondaryKeywords: ['whimpering', 'reluctant to move', 'swollen paw'],
    description:
      'Possible ligament tear, fracture, joint luxation, or severe soft tissue trauma.',
    defaultAction:
      'Restrict all physical activity and crating. Schedule an urgent veterinary orthopedic evaluation and X-rays.',
  },

  // ── MODERATE URGENCY ──
  {
    name: 'Otitis Externa (Ear Infection)',
    urgency: 'moderate',
    species: ['any'],
    primaryKeywords: [
      'scratching ear',
      'scratching ears',
      'shaking head',
      'head shaking',
      'ear odor',
      'smelly ears',
      'brown ear discharge',
      'smelly brown',
      'red ear canal',
      'ear infection',
    ],
    secondaryKeywords: ['tilting head', 'whining when ear touched'],
    description:
      'Bacterial or yeast overgrowth in the external ear canal causing inflammation, pain, and pruritus.',
    defaultAction:
      'Schedule a routine veterinary exam for ear cytology and targeted topical antibacterial/antifungal drops.',
  },
  {
    name: 'Infectious Tracheobronchitis (Kennel Cough) / Upper Respiratory Infection',
    urgency: 'moderate',
    species: ['any'],
    primaryKeywords: [
      'honking cough',
      'hacking cough',
      'coughing',
      'sneezing',
      'nasal discharge',
      'runny nose',
      'eye discharge',
      'mild cough',
    ],
    secondaryKeywords: ['mild lethargy', 'loss of appetite', 'throat clearing'],
    description:
      'Contagious viral or bacterial infection of the upper respiratory tract commonly contracted in social settings.',
    defaultAction:
      'Isolate from other pets, use a humidifier in the resting area, and consult your veterinarian for evaluation.',
  },
  {
    name: 'Mild Gastroenteritis / Dietary Indiscretion',
    urgency: 'moderate',
    species: ['any'],
    primaryKeywords: [
      'vomited once',
      'vomited twice',
      'mild diarrhea',
      'loose stool',
      'soft stool',
      'mild stomach upset',
      'ate table scraps',
      'slight loss of appetite',
    ],
    secondaryKeywords: ['gurgling stomach', 'eating grass', 'mild sluggishness'],
    description:
      'Self-limiting gastrointestinal irritation frequently caused by dietary changes or minor indiscretion.',
    defaultAction:
      'Offer small amounts of fresh water. If vomiting has stopped, consider a bland diet (boiled chicken and white rice) for 24–48 hours.',
  },
  {
    name: 'Allergic Dermatitis / Flea Allergy',
    urgency: 'moderate',
    species: ['any'],
    primaryKeywords: [
      'itching',
      'scratching body',
      'licking paws',
      'chewing feet',
      'hair loss',
      'red skin',
      'hot spot',
      'scabs',
      'flea dirt',
    ],
    secondaryKeywords: ['shedding heavily'],
    description:
      'Hypersensitivity reaction triggered by environmental allergens, food proteins, or flea bites.',
    defaultAction:
      'Ensure monthly flea preventative is up to date and schedule a veterinary dermatology consult for soothing treatment.',
  },

  // ── LOW URGENCY ──
  {
    name: 'Mild Dermatological / Coat Irritation',
    urgency: 'low',
    species: ['any'],
    primaryKeywords: [
      'dandruff',
      'mild dandruff',
      'dry coat',
      'seasonal shedding',
      'minor flake',
      'flaky coat',
    ],
    secondaryKeywords: ['eating normally', 'active normally'],
    description:
      'Benign coat dryness or normal seasonal molting without signs of severe inflammation or infection.',
    defaultAction:
      'Brush regularly, consider omega-3 fatty acid dietary supplementation, and monitor during regular grooming.',
  },
  {
    name: 'Early Periodontal Disease / Dental Calculus',
    urgency: 'low',
    species: ['any'],
    primaryKeywords: ['bad breath', 'mild tartar', 'yellow teeth', 'halitosis', 'plaque'],
    secondaryKeywords: ['chewing normally'],
    description:
      'Accumulation of oral bacteria and mineralized plaque on tooth surfaces.',
    defaultAction:
      'Introduce pet-safe dental enzymatic toothpaste and discuss professional dental scaling at your next wellness visit.',
  },
  {
    name: 'General Observation / Behavioral Shift',
    urgency: 'low',
    species: ['any'],
    primaryKeywords: ['slightly clingy', 'mildly quiet', 'sleeping a little more', 'picky eater', 'different mood'],
    secondaryKeywords: ['drinking normally', 'urinating normally'],
    description:
      'Subtle behavioral shift without overt physiological signs of acute distress or illness.',
    defaultAction:
      'Continue monitoring baseline appetite, water intake, and litterbox/bathroom habits over the next 48 hours.',
  },
];

function scoreCondition(
  profile: ConditionProfile,
  symptomsLower: string,
  petSpecies: string,
): number {
  if (profile.species[0] !== 'any' && !profile.species.includes(petSpecies as 'dog' | 'cat')) {
    return 0;
  }

  let score = 0;
  for (const kw of profile.primaryKeywords) {
    if (symptomsLower.includes(kw)) {
      score += 0.5;
    }
  }

  for (const kw of profile.secondaryKeywords) {
    if (symptomsLower.includes(kw)) {
      score += 0.15;
    }
  }

  return score;
}

export function predictSymptomsLocal(req: SymptomPredictionRequest): SymptomPrediction {
  const rawSymptoms = req.symptoms || '';
  const symptomsLower = rawSymptoms.toLowerCase();
  const petSpecies = (req.species || 'any').toLowerCase();

  // Score all condition profiles
  const scored = CLINICAL_CONDITION_PROFILES.map((profile) => ({
    profile,
    score: scoreCondition(profile, symptomsLower, petSpecies),
  })).filter((item) => item.score > 0);

  scored.sort((a, b) => b.score - a.score);

  // Highest urgency among strong matched conditions
  let calculatedUrgency: UrgencyLevel = 'low';
  let urgencyReason = 'Reported symptoms appear mild with low immediate clinical risk.';

  // Check strong matches
  const strongEmergency = scored.find(
    (s) => s.profile.urgency === 'emergency' && s.score >= 0.5,
  );
  const strongHigh = scored.find((s) => s.profile.urgency === 'high' && s.score >= 0.5);

  if (strongEmergency) {
    calculatedUrgency = 'emergency';
    urgencyReason =
      'High-risk clinical indicators detected that require immediate emergency veterinary evaluation.';
  } else if (strongHigh && scored[0]?.profile.urgency !== 'emergency') {
    calculatedUrgency = 'high';
    urgencyReason =
      'Symptoms suggest a serious or rapidly evolving medical issue requiring prompt veterinary attention.';
  } else if (scored.length > 0) {
    calculatedUrgency = scored[0].profile.urgency;
    if (calculatedUrgency === 'emergency') {
      urgencyReason =
        'High-risk clinical indicators detected that require immediate emergency veterinary evaluation.';
    } else if (calculatedUrgency === 'high') {
      urgencyReason =
        'Symptoms suggest a serious or rapidly evolving medical issue requiring prompt veterinary attention.';
    } else if (calculatedUrgency === 'moderate') {
      urgencyReason =
        'Symptoms indicate a moderate condition that should be evaluated by a veterinarian if symptoms persist.';
    } else {
      urgencyReason = 'Reported symptoms appear mild with low immediate clinical risk.';
    }
  }

  const topMatches = scored.slice(0, 3);
  let probableConditions: ProbableCondition[];

  if (topMatches.length > 0) {
    const totalScore = topMatches.reduce((acc, m) => acc + m.score, 0) || 1;
    probableConditions = topMatches.map((m) => ({
      condition: m.profile.name,
      confidence: Number(Math.min(0.95, Math.max(0.35, m.score / (totalScore + 0.3))).toFixed(2)),
      description: m.profile.description,
    }));
  } else {
    probableConditions = [
      {
        condition: 'General Observation / Undetermined',
        confidence: 0.3,
        description:
          'Symptoms do not strongly match common acute profiles. Continued monitoring is recommended.',
      },
    ];
  }

  const recommendedActions: string[] = [];
  if (calculatedUrgency === 'emergency') {
    recommendedActions.push('Contact an emergency 24/7 veterinary hospital immediately.');
    recommendedActions.push('Keep the pet calm, warm, and minimize physical movement during transport.');
    recommendedActions.push('Do not administer human medications (e.g. Advil, Tylenol, Aspirin).');
  } else if (calculatedUrgency === 'high') {
    recommendedActions.push('Schedule an urgent same-day appointment with your veterinarian.');
    recommendedActions.push('Monitor vital signs, hydration, and appetite closely.');
    recommendedActions.push('Prevent access to stairs and strenuous physical activity.');
  } else if (calculatedUrgency === 'moderate') {
    recommendedActions.push('Schedule an examination with your veterinarian within 24 to 48 hours.');
    recommendedActions.push('Ensure continuous access to fresh water and keep resting area clean.');
    recommendedActions.push('Isolate from other pets if infectious respiratory or GI symptoms are present.');
  } else {
    recommendedActions.push('Monitor your pet for any new or worsening symptoms over the next 48 hours.');
    recommendedActions.push('Maintain regular feeding, fresh water, and normal exercise routine.');
    recommendedActions.push('Contact your vet if you observe any decline in energy or appetite.');
  }

  // Include top condition specific action if available
  if (topMatches[0]?.profile.defaultAction) {
    recommendedActions.unshift(topMatches[0].profile.defaultAction);
  }

  // Deduplicate recommended actions
  const uniqueActions = Array.from(new Set(recommendedActions)).slice(0, 4);

  return {
    probableConditions,
    urgency: calculatedUrgency,
    urgencyReason,
    recommendedActions: uniqueActions,
    disclaimer: VETERINARY_DISCLAIMER,
    modelVersion: SYMPTOM_MODEL_VERSION,
  };
}

function normalizeSymptomPrediction(
  raw: Record<string, any>,
  modelName: string,
): SymptomPrediction {
  const urgencyRaw = String(raw.urgency || '').toLowerCase();
  let urgency: UrgencyLevel = 'low';
  if (['emergency', 'high', 'moderate', 'low'].includes(urgencyRaw)) {
    urgency = urgencyRaw as UrgencyLevel;
  }

  const rawConditions = Array.isArray(raw.probableConditions) ? raw.probableConditions : [];
  const probableConditions: ProbableCondition[] = rawConditions.slice(0, 3).map((c: any) => ({
    condition: String(c.condition || 'General Observation'),
    confidence: Math.max(0, Math.min(1, Number(c.confidence) || 0.5)),
    description: String(c.description || ''),
  }));

  if (probableConditions.length === 0) {
    probableConditions.push({
      condition: 'General Observation',
      confidence: 0.4,
      description: 'Consult a licensed veterinarian for definitive assessment.',
    });
  }

  const rawActions = Array.isArray(raw.recommendedActions) ? raw.recommendedActions : [];
  const recommendedActions = rawActions.map((a: any) => String(a)).slice(0, 4);
  if (recommendedActions.length === 0) {
    recommendedActions.push('Consult a licensed veterinarian for a full clinical examination.');
  }

  return {
    probableConditions,
    urgency,
    urgencyReason: String(raw.urgencyReason || 'Clinical assessment based on reported symptoms.'),
    recommendedActions,
    disclaimer: VETERINARY_DISCLAIMER,
    modelVersion: modelName,
  };
}

export async function predictSymptoms(req: SymptomPredictionRequest): Promise<SymptomPrediction> {
  const provider = getLLMProvider();

  try {
    switch (provider) {
      case 'openai':
        return await predictWithOpenAI(req);
      case 'anthropic':
        return await predictWithAnthropic(req);
      case 'huggingface':
        return await predictWithHuggingFace(req);
      case 'local':
      default:
        return predictSymptomsLocal(req);
    }
  } catch (error) {
    // If any external LLM provider fails (e.g. rate limit, network timeout, invalid key),
    // seamlessly fall back to the robust local classification engine.
    return predictSymptomsLocal(req);
  }
}

export default {
  predictPetHealth,
  runDailyPredictions,
  predictSymptoms,
  predictSymptomsLocal,
  getLLMProvider,
  VETERINARY_DISCLAIMER,
};
