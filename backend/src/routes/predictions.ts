import { Router, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';

import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import { ok, sendError } from '../../server/response';
import mlPredictionService, {
  type SymptomPredictionInput,
} from '../../services/mlPredictionService';

const router = Router();

const freeTierSymptomLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.id ?? req.ip ?? 'anonymous',
  message: {
    success: false,
    error: {
      code: 'SYMPTOM_RATE_LIMITED',
      message: 'Free symptom checker limit reached. Please try again tomorrow.',
    },
  },
});

router.use(authenticateJWT);

router.post(
  '/symptoms',
  freeTierSymptomLimit,
  async (
    req: AuthenticatedRequest<Record<string, string>, unknown, Partial<SymptomPredictionInput>>,
    res: Response,
  ) => {
    const { petId, species, breed, symptoms } = req.body;

    if (!petId || typeof petId !== 'string') {
      return sendError(res, 400, 'INVALID_PET_ID', 'petId is required.');
    }

    if (!species || typeof species !== 'string') {
      return sendError(res, 400, 'INVALID_SPECIES', 'species is required.');
    }

    if (!symptoms || typeof symptoms !== 'string' || symptoms.trim().length < 3) {
      return sendError(res, 400, 'INVALID_SYMPTOMS', 'Please describe the symptoms.');
    }

    const prediction = await mlPredictionService.analyzeSymptoms({
      petId,
      species,
      breed,
      symptoms,
      ownerId: req.user?.id,
    });

    return res.json(ok(prediction));
  },
);

export default router;
