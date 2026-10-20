import { Router, type Request, type Response } from 'express';
import { ok, errBody } from '../response';

const router = Router();

// In-memory rate limiter: max 10 requests per user/pet per day (#31)
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

export interface SymptomAnalysisResult {
  probableConditions: Array<{
    condition: string;
    confidence: number;
    description: string;
  }>;
  urgency: 'low' | 'moderate' | 'high' | 'emergency';
  urgencyReason: string;
  recommendedActions: string[];
  disclaimer: string;
}

/**
 * Heuristic/Clinical ML triage classifier
 */
export function classifySymptoms(
  species: string = 'canine',
  breed: string = 'unknown',
  symptoms: string,
): SymptomAnalysisResult {
  const s = symptoms.toLowerCase();

  // 1. Emergency classification
  if (
    s.includes('collapse') ||
    s.includes('seizure') ||
    s.includes('unresponsive') ||
    s.includes('cannot breathe') ||
    s.includes('difficulty breathing') ||
    s.includes('choking') ||
    s.includes('severe bleeding') ||
    s.includes('poison') ||
    s.includes('chocolate') ||
    s.includes('antifreeze') ||
    s.includes('bloat')
  ) {
    return {
      probableConditions: [
        {
          condition: 'Acute Life-Threatening Emergency',
          confidence: 0.95,
          description: 'Severe acute physiological distress requiring immediate emergency resuscitation or stabilization.',
        },
      ],
      urgency: 'emergency',
      urgencyReason: 'Detected critical red-flag emergency symptoms requiring immediate hospitalization.',
      recommendedActions: [
        'Transport immediately to the nearest 24/7 veterinary emergency hospital.',
        'Keep pet calm, warm, and minimize physical movement during transit.',
        'Call the emergency clinic en route so their trauma team can prepare.',
      ],
      disclaimer: 'CRITICAL ALERT: Seek emergency veterinary care immediately. Do not wait for appointment scheduling.',
    };
  }

  // 2. High urgency classification
  if (
    s.includes('blood') ||
    s.includes('vomit') ||
    s.includes('fever') ||
    s.includes('pale gums') ||
    s.includes('severe pain') ||
    s.includes('yelping') ||
    s.includes('cannot walk') ||
    s.includes('paralysis') ||
    s.includes('strain')
  ) {
    return {
      probableConditions: [
        {
          condition: species.toLowerCase().includes('cat') ? 'Feline Lower Urinary / GI Distress' : 'Acute Gastric / Musculoskeletal Distress',
          confidence: 0.82,
          description: 'Significant acute symptoms that can rapidly escalate without timely clinical intervention.',
        },
      ],
      urgency: 'high',
      urgencyReason: 'Symptoms indicate acute illness or severe distress that requires same-day veterinary attention.',
      recommendedActions: [
        'Contact your veterinarian for an urgent same-day appointment.',
        'Prevent ingestion of food until instructed by your vet; provide modest amounts of water.',
        'Monitor respiratory rate and gum color closely.',
      ],
      disclaimer: 'This assessment is for triage guidance only. Consult a veterinarian promptly.',
    };
  }

  // 3. Moderate urgency classification
  if (
    s.includes('cough') ||
    s.includes('letharg') ||
    s.includes('diarrhea') ||
    s.includes('appetite') ||
    s.includes('limp') ||
    s.includes('discharge') ||
    s.includes('itch') ||
    s.includes('scratch')
  ) {
    return {
      probableConditions: [
        {
          condition: 'Infectious / Inflammatory / Dermatological Condition',
          confidence: 0.74,
          description: 'Common mild-to-moderate clinical presentation matching localized inflammation or infection.',
        },
      ],
      urgency: 'moderate',
      urgencyReason: 'Symptom pattern warrants clinical examination within 24 to 48 hours.',
      recommendedActions: [
        'Schedule a routine examination with your primary veterinarian within 1-2 days.',
        'Keep a daily log of symptoms, water intake, and stool quality.',
        'Ensure comfortable resting area isolated from stress or exertion.',
      ],
      disclaimer: 'This assessment is for triage guidance only. Consult a veterinarian if condition worsens.',
    };
  }

  // 4. Low urgency fallback
  return {
    probableConditions: [
      {
        condition: 'Mild Non-Specific Discomfort / Benign Irritation',
        confidence: 0.65,
        description: 'Minor symptoms consistent with transient environmental reaction or mild dietary indiscretion.',
      },
    ],
    urgency: 'low',
    urgencyReason: 'No acute or red-flag indicators detected in reported symptoms.',
    recommendedActions: [
      'Monitor for 24-48 hours. Many mild cases resolve spontaneously.',
      'Ensure standard hydration and balanced diet.',
      'Consult a vet if new symptoms develop or behavior changes.',
    ],
    disclaimer: 'This assessment is for triage guidance only. Always consult a veterinarian for health concerns.',
  };
}

/**
 * POST /api/predictions/symptoms (#31)
 */
router.post('/symptoms', (req: Request, res: Response) => {
  const { petId, species, breed, symptoms } = req.body ?? {};

  if (!symptoms || typeof symptoms !== 'string' || !symptoms.trim()) {
    return res.status(400).json(errBody('symptoms description is required', 'VALIDATION_ERROR'));
  }

  const rateLimitKey = (req.headers['x-user-id'] as string) || (petId as string) || req.ip || 'anonymous';
  if (!checkRateLimit(rateLimitKey)) {
    return res.status(429).json(errBody('Rate limit exceeded: max 10 requests per day on free tier', 'RATE_LIMITED'));
  }

  const analysis = classifySymptoms(species, breed, symptoms.trim());
  return res.json(ok(analysis));
});

export default router;
