import express from 'express';

import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import { UserRole } from '../../models/UserRole';
import mlPredictionService from '../../services/mlPredictionService';
import { ok, sendError } from '../response';
import { store } from '../store';

const router = express.Router();
router.use(authenticateJWT);

const DAILY_FREE_LIMIT = 10;
const symptomUsage = new Map<string, { date: string; count: number }>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function consumeDailySymptomQuota(userId: string): boolean {
  const date = todayKey();
  const current = symptomUsage.get(userId);
  if (!current || current.date !== date) {
    symptomUsage.set(userId, { date, count: 1 });
    return true;
  }

  if (current.count >= DAILY_FREE_LIMIT) return false;
  current.count += 1;
  symptomUsage.set(userId, current);
  return true;
}

export function _resetSymptomPredictionUsageForTest(): void {
  symptomUsage.clear();
}

router.post('/symptoms', (req: AuthenticatedRequest, res) => {
  const body = req.body as {
    petId?: string;
    species?: string;
    breed?: string;
    symptoms?: string;
  };

  const petId = body.petId?.trim();
  const symptoms = body.symptoms?.trim();
  if (!petId || !symptoms) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId and symptoms are required');
  }

  if (symptoms.length < 8) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'symptoms must describe what you observed');
  }

  const pet = store.pets.get(petId);
  if (!pet) return sendError(res, 404, 'NOT_FOUND', 'Pet not found');

  const user = req.user!;
  if (user.role === UserRole.OWNER && pet.ownerId !== user.id) {
    return sendError(res, 403, 'FORBIDDEN', 'You can only analyse symptoms for your own pets');
  }

  if (!consumeDailySymptomQuota(user.id)) {
    return sendError(
      res,
      429,
      'RATE_LIMITED',
      `Free symptom checks are limited to ${DAILY_FREE_LIMIT} per day`,
    );
  }

  const prediction = mlPredictionService.predictSymptoms({
    petId,
    ownerId: pet.ownerId,
    species: body.species?.trim() || pet.species,
    breed: body.breed?.trim() || pet.breed,
    symptoms,
  });

  return res.json(ok(prediction));
});

export default router;
