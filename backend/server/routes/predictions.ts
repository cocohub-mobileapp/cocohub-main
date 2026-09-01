import express, { Response, NextFunction } from 'express';
import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import { UserRole } from '../../models/UserRole';
import mlPredictionService from '../../services/mlPredictionService';
import { query } from '../../src/db';
import { ok, sendError } from '../response';
import { store } from '../store';

const router = express.Router();
router.use(authenticateJWT);

// ─────────────────────────────────────────────────────────────────────────────
// Free-tier Daily Rate Limiter (Max 10 requests / user / day)
// ─────────────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const FREE_TIER_DAILY_LIMIT = 10;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function _resetSymptomRateLimits(): void {
  rateLimitStore.clear();
}

export function symptomDailyRateLimiter(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const userId = req.user?.id || req.ip || 'anonymous';
  const isAdmin = req.user?.role === UserRole.ADMIN;

  // Admins bypass the rate limit
  if (isAdmin) {
    return next();
  }

  const now = Date.now();
  let entry = rateLimitStore.get(userId);

  if (!entry || now >= entry.resetAt) {
    entry = {
      count: 0,
      resetAt: now + DAY_IN_MS,
    };
    rateLimitStore.set(userId, entry);
  }

  const remaining = Math.max(0, FREE_TIER_DAILY_LIMIT - entry.count);
  const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

  res.setHeader('X-RateLimit-Limit', String(FREE_TIER_DAILY_LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining - 1)));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(entry.resetAt / 1000)));

  if (entry.count >= FREE_TIER_DAILY_LIMIT) {
    res.setHeader('Retry-After', String(resetSeconds));
    return sendError(
      res,
      429,
      'RATE_LIMITED',
      'Daily limit of 10 symptom checks reached on free tier. Upgrade or try again tomorrow.',
    );
  }

  entry.count += 1;
  return next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers for Pet Ownership Verification
// ─────────────────────────────────────────────────────────────────────────────

async function resolvePet(petId: string) {
  try {
    const result = await query(
      `SELECT id, owner_id, species, breed
       FROM pets
       WHERE id = $1`,
      [petId],
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        id: String(row.id),
        ownerId: String(row.owner_id),
        species: row.species ? String(row.species) : undefined,
        breed: row.breed ? String(row.breed) : undefined,
      };
    }
  } catch {
    // Database query fallback to in-memory store
  }

  const inMemoryPet = store.pets.get(petId);
  if (inMemoryPet) {
    return {
      id: inMemoryPet.id,
      ownerId: inMemoryPet.ownerId,
      species: inMemoryPet.species,
      breed: inMemoryPet.breed,
    };
  }

  return null;
}

function userHasPetAccess(req: AuthenticatedRequest, petOwnerId: string): boolean {
  if (req.user!.role === UserRole.ADMIN) return true;
  if (petOwnerId === req.user!.id) return true;

  // Check family sharing if present
  for (const share of store.familySharing.values()) {
    if (share.ownerId === petOwnerId && share.sharedWithUserId === req.user!.id) {
      return true;
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/predictions/symptoms
// ─────────────────────────────────────────────────────────────────────────────

router.post('/symptoms', symptomDailyRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const { petId, species: requestedSpecies, breed: requestedBreed, symptoms } = req.body as {
    petId?: string;
    species?: string;
    breed?: string;
    symptoms?: string;
  };

  if (!petId || typeof petId !== 'string' || !petId.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId is required');
  }

  if (!symptoms || typeof symptoms !== 'string' || symptoms.trim().length < 3) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'symptoms description is required and must be at least 3 characters',
    );
  }

  const pet = await resolvePet(petId.trim());
  if (!pet) {
    return sendError(res, 404, 'NOT_FOUND', 'Pet not found');
  }

  if (!userHasPetAccess(req, pet.ownerId)) {
    return sendError(
      res,
      403,
      'FORBIDDEN',
      'You do not have permission to run symptom checks for this pet',
    );
  }

  const species = requestedSpecies?.trim() || pet.species || 'dog';
  const breed = requestedBreed?.trim() || pet.breed || 'Unknown';

  try {
    const prediction = await mlPredictionService.predictSymptoms({
      petId: pet.id,
      species,
      breed,
      symptoms: symptoms.trim(),
      userId: req.user!.id,
    });

    return res.json(ok(prediction));
  } catch (err) {
    return sendError(
      res,
      500,
      'INTERNAL_ERROR',
      (err as Error).message || 'Failed to process symptom prediction',
    );
  }
});

export default router;
