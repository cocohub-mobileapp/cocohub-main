import express from 'express';

import {
  analyzeSymptoms,
  symptomOptions,
  type SymptomCheckerInput,
} from '../../services/symptomCheckerService';
import { ok, sendError } from '../response';

const router = express.Router();

router.get('/symptoms', (_req, res) => {
  return res.json(ok(symptomOptions));
});

router.post('/check', (req, res) => {
  const body = (req.body ?? {}) as SymptomCheckerInput;
  const hasText = typeof body.symptoms === 'string' && body.symptoms.trim().length > 0;
  const hasSelectedSymptoms =
    Array.isArray(body.selectedSymptoms) &&
    body.selectedSymptoms.some((item) => typeof item === 'string' && item.trim());

  if (!hasText && !hasSelectedSymptoms) {
    return sendError(
      res,
      400,
      'SYMPTOMS_REQUIRED',
      'Provide a symptom description or at least one selected symptom.',
    );
  }

  return res.json(ok(analyzeSymptoms(body)));
});

export default router;
