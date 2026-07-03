import express from 'express';

import {
  analyzeSymptoms,
  hasSymptomInput,
  SYMPTOM_OPTIONS,
  type SymptomCheckerInput,
} from '../../services/symptomCheckerService';
import { ok, sendError } from '../response';

const router = express.Router();

router.get('/symptoms', (_req, res) => {
  return res.json(
    ok(
      SYMPTOM_OPTIONS.map((option) => ({
        id: option.id,
        label: option.label,
      })),
    ),
  );
});

router.post('/check', (req, res) => {
  const input = (req.body ?? {}) as SymptomCheckerInput;

  if (!hasSymptomInput(input)) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Select at least one symptom or describe what you are seeing.',
    );
  }

  return res.json(ok(analyzeSymptoms(input)));
});

export default router;
