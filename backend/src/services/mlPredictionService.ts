import axios, { type AxiosInstance } from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SymptomPredictionRequest {
  petId: string;
  species: string;
  breed: string;
  symptoms: string;
}

export interface ProbableCondition {
  condition: string;
  confidence: number; // 0–1
  description: string;
}

export type UrgencyLevel = 'low' | 'moderate' | 'high' | 'emergency';

export interface SymptomPrediction {
  probableConditions: ProbableCondition[];
  urgency: UrgencyLevel;
  urgencyReason: string;
  recommendedActions: string[];
  disclaimer: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────

const HUGGINGFACE_MODEL = process.env.HUGGINGFACE_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct';
const HUGGINGFACE_BASE_URL =
  process.env.HUGGINGFACE_BASE_URL || 'https://api-inference.huggingface.co/models';

export type LLMProvider = 'openai' | 'anthropic' | 'huggingface' | 'fallback';

export function getProvider(): LLMProvider {
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.HUGGINGFACE_API_KEY) return 'huggingface';
  return 'fallback';
}

// ─── Prompt construction ─────────────────────────────────────────────────────

function buildPrompt(req: SymptomPredictionRequest): string {
  return `You are a veterinary triage assistant. A pet owner reports the following symptoms for their ${req.species} (${req.breed}).

Symptoms: "${req.symptoms}"

Based on the symptoms, species, and breed, provide a structured JSON response with:
- probableConditions: array of up to 3 objects with { condition, confidence (0-1), description }
- urgency: one of "low", "moderate", "high", "emergency"
- urgencyReason: a short explanation of the urgency level
- recommendedActions: array of 2-4 actionable next steps for the owner

Respond with ONLY valid JSON, no markdown fences or extra text. The JSON must match this TypeScript type:

interface SymptomPrediction {
  probableConditions: Array<{ condition: string; confidence: number; description: string }>;
  urgency: "low" | "moderate" | "high" | "emergency";
  urgencyReason: string;
  recommendedActions: string[];
}`;
}

const DISCLAIMER =
  'This AI-generated assessment is informational only and does not replace professional veterinary care. If your pet is in distress, contact a veterinarian immediately.';

// ─── OpenAI provider ──────────────────────────────────────────────────────────

const openaiClient: AxiosInstance = axios.create({
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  timeout: 30_000,
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY || ''}` },
});

async function predictWithOpenAI(req: SymptomPredictionRequest): Promise<SymptomPrediction> {
  const prompt = buildPrompt(req);

  const resp = await openaiClient.post('/chat/completions', {
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a veterinary triage assistant that outputs only JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  });

  const content = resp.data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty response');

  const parsed = JSON.parse(content);
  return normalizePrediction(parsed);
}

// ─── Anthropic provider ───────────────────────────────────────────────────────

const anthropicClient: AxiosInstance = axios.create({
  baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1',
  timeout: 30_000,
  headers: {
    'x-api-key': process.env.ANTHROPIC_API_KEY || '',
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
});

async function predictWithAnthropic(req: SymptomPredictionRequest): Promise<SymptomPrediction> {
  const prompt = buildPrompt(req);

  const resp = await anthropicClient.post('/messages', {
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 800,
    system: 'You are a veterinary triage assistant that outputs only JSON.',
    messages: [{ role: 'user', content: prompt }],
  });

  const content = resp.data?.content?.[0]?.text;
  if (!content) throw new Error('Anthropic returned empty response');

  const cleaned = content
    .replace(/```json\n?/g, '')
    .replace(/```/g, '')
    .trim();
  const parsed = JSON.parse(cleaned);
  return normalizePrediction(parsed);
}

// ─── HuggingFace provider ─────────────────────────────────────────────────────

async function predictWithHuggingFace(req: SymptomPredictionRequest): Promise<SymptomPrediction> {
  const prompt = buildPrompt(req);
  const url = `${HUGGINGFACE_BASE_URL}/${HUGGINGFACE_MODEL}`;

  const resp = await axios.post(
    url,
    { inputs: prompt, parameters: { temperature: 0.3, max_new_tokens: 800 } },
    {
      timeout: 30_000,
      headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY || ''}` },
    },
  );

  const text =
    typeof resp.data === 'string'
      ? resp.data
      : resp.data?.[0]?.generated_text || resp.data?.generated_text || '';

  if (!text) throw new Error('HuggingFace returned empty response');

  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('HuggingFace response did not contain JSON');
  }

  const jsonStr = text.slice(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(jsonStr);
  return normalizePrediction(parsed);
}

// ─── Fallback (no API key configured) ─────────────────────────────────────────

const URGENT_KEYWORDS = [
  'bleeding',
  'unconscious',
  'seizure',
  'collapse',
  'difficulty breathing',
  'cant breathe',
  "can't breathe",
  'pale gums',
  'blue gums',
  'cyanosis',
  'prolonged vomiting',
  'bloody diarrhea',
  'blood in stool',
  'toxin',
  'poison',
  'rat poison',
  'chocolate',
  'xylitol',
  'trauma',
  'hit by car',
  'fall',
  'drowning',
  'heatstroke',
  'hypothermia',
  'foaming',
  'paralysis',
];

const MODERATE_KEYWORDS = [
  'vomiting',
  'diarrhea',
  'lethargic',
  'not eating',
  'loss of appetite',
  'limping',
  'lameness',
  'coughing',
  'sneezing',
  'discharge',
  'itching',
  'scratching',
  'shaking head',
  'bad breath',
  'drooling',
  'panting',
  'weight loss',
  'drinking a lot',
  'frequent urination',
];

function predictFallback(req: SymptomPredictionRequest): SymptomPrediction {
  const lower = req.symptoms.toLowerCase();
  const conditions: ProbableCondition[] = [];
  let urgency: UrgencyLevel = 'low';
  let urgencyReason = 'Symptoms appear mild based on keyword matching.';

  if (URGENT_KEYWORDS.some((k) => lower.includes(k))) {
    urgency = 'emergency';
    urgencyReason = 'One or more emergency indicators detected in the symptom description.';
    conditions.push({
      condition: 'Possible emergency condition',
      confidence: 0.5,
      description:
        'The symptoms contain keywords associated with life-threatening conditions. Immediate veterinary evaluation is strongly recommended.',
    });
  } else if (MODERATE_KEYWORDS.some((k) => lower.includes(k))) {
    urgency = 'moderate';
    urgencyReason =
      'Symptoms suggest a non-emergency condition that should be monitored and evaluated by a vet if it persists.';
    conditions.push({
      condition: 'Possible gastrointestinal or respiratory issue',
      confidence: 0.4,
      description:
        'Common symptoms detected. May resolve on its own, but veterinary consultation is advised if symptoms persist beyond 24 hours.',
    });
  } else {
    conditions.push({
      condition: 'General observation',
      confidence: 0.3,
      description:
        'No high-risk keywords detected. Continue monitoring your pet for changes in behaviour or appetite.',
    });
  }

  const actions: string[] = [];
  if (urgency === 'emergency') {
    actions.push('Contact an emergency veterinarian or animal hospital immediately.');
    actions.push('Do not give human medications.');
    actions.push('Keep the pet calm and transport carefully.');
  } else if (urgency === 'moderate') {
    actions.push('Monitor your pet closely for the next 24 hours.');
    actions.push('Ensure access to fresh water.');
    actions.push('Schedule a vet appointment if symptoms persist or worsen.');
  } else {
    actions.push('Continue normal feeding and activity.');
    actions.push('Monitor for any new or worsening symptoms.');
    actions.push('Contact your vet if you notice changes in appetite or behaviour.');
  }

  return {
    probableConditions: conditions,
    urgency,
    urgencyReason,
    recommendedActions: actions,
    disclaimer: DISCLAIMER,
  };
}

// ─── Normalisation ────────────────────────────────────────────────────────────

function normalizePrediction(raw: Record<string, unknown>): SymptomPrediction {
  const urgencyRaw = String(raw.urgency || 'low').toLowerCase();
  const urgency: UrgencyLevel =
    urgencyRaw === 'emergency' || urgencyRaw === 'high' || urgencyRaw === 'moderate'
      ? (urgencyRaw as UrgencyLevel)
      : 'low';

  const conditionsRaw = Array.isArray(raw.probableConditions)
    ? (raw.probableConditions as Record<string, unknown>[])
    : [];

  const probableConditions: ProbableCondition[] = conditionsRaw.slice(0, 3).map((c) => ({
    condition: String(c.condition || 'Unknown condition'),
    confidence: clamp01(Number(c.confidence) || 0),
    description: String(c.description || ''),
  }));

  const recommendedActions = Array.isArray(raw.recommendedActions)
    ? (raw.recommendedActions as unknown[]).slice(0, 4).map((a) => String(a))
    : [];

  return {
    probableConditions:
      probableConditions.length > 0
        ? probableConditions
        : [{ condition: 'Unable to determine', confidence: 0, description: '' }],
    urgency,
    urgencyReason: String(raw.urgencyReason || ''),
    recommendedActions:
      recommendedActions.length > 0
        ? recommendedActions
        : ['Consult a veterinarian for a proper diagnosis.'],
    disclaimer: DISCLAIMER,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function predictSymptoms(req: SymptomPredictionRequest): Promise<SymptomPrediction> {
  try {
    const provider = getProvider();
    switch (provider) {
      case 'openai':
        return await predictWithOpenAI(req);
      case 'anthropic':
        return await predictWithAnthropic(req);
      case 'huggingface':
        return await predictWithHuggingFace(req);
      default:
        return predictFallback(req);
    }
  } catch {
    // On any LLM error, fall back to keyword-based prediction so the endpoint
    // always returns a useful response.
    return predictFallback(req);
  }
}

export { predictFallback, DISCLAIMER };
