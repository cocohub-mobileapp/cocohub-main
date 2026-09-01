import { Router, type NextFunction, type Response } from 'express';

import { authenticateJWT as authenticate, type AuthenticatedRequest } from '../../middleware/auth';
import { predictSymptoms, type SymptomPredictionRequest } from '../services/mlPredictionService';

// ─── Rate limit: 10 requests per user per day (free tier) ───────────────────

// In-memory counter with daily reset. In production this would use Redis.
// Key: userId|date -> count
const dailyRequestCounts = new Map<string, number>();

function getTodayKey(userId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `${userId}|${today}`;
}

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const key = getTodayKey(userId);
  const count = dailyRequestCounts.get(key) || 0;
  const DAILY_LIMIT = 10;

  if (count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  dailyRequestCounts.set(key, count + 1);
  return { allowed: true, remaining: DAILY_LIMIT - count - 1 };
}

// ─── Validation ────────────────────────────────────────────────────────────────

function validateBody(
  body: unknown,
): { valid: true; data: SymptomPredictionRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const record = body as Record<string, unknown>;

  if (typeof record.petId !== 'string' || !record.petId.trim()) {
    return { valid: false, error: 'petId is required and must be a non-empty string' };
  }
  if (typeof record.species !== 'string' || !record.species.trim()) {
    return { valid: false, error: 'species is required and must be a non-empty string' };
  }
  if (typeof record.breed !== 'string' || !record.breed.trim()) {
    return { valid: false, error: 'breed is required and must be a non-empty string' };
  }
  if (typeof record.symptoms !== 'string' || record.symptoms.trim().length < 3) {
    return {
      valid: false,
      error: 'symptoms is required and must be at least 3 characters',
    };
  }

  return {
    valid: true,
    data: {
      petId: record.petId.trim(),
      species: record.species.trim(),
      breed: record.breed.trim(),
      symptoms: record.symptoms.trim(),
    },
  };
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function postSymptomPrediction(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  // Require authentication
  if (!req.user?.id) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Validate input
  const validation = validateBody(req.body);
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  // Rate limit: 10 requests/user/day on free tier
  const rateLimitResult = checkRateLimit(req.user.id);
  if (!rateLimitResult.allowed) {
    res.setHeader('X-RateLimit-Limit', '10');
    res.setHeader('X-RateLimit-Remaining', '0');
    res.setHeader('Retry-After', '86400');
    res.status(429).json({
      error: 'Daily symptom check limit reached. Try again tomorrow.',
    });
    return;
  }

  res.setHeader('X-RateLimit-Limit', '10');
  res.setHeader('X-RateLimit-Remaining', String(rateLimitResult.remaining));

  // Predict
  try {
    const prediction = await predictSymptoms(validation.data);
    res.status(200).json({ data: prediction });
  } catch {
    res.status(500).json({ error: 'Symptom prediction failed' });
  }
}

// ─── Router ────────────────────────────────────────────────────────────────────

const predictionsRouter = Router();

predictionsRouter.post('/symptoms', authenticate, postSymptomPrediction);

export default predictionsRouter;
