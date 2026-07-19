import { Router } from 'express';
import { predictSymptoms } from '../services/mlPredictionService';

const router = Router();

router.post('/predictions/symptoms', predictSymptoms);

export default router;