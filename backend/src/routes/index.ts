import express from 'express';
import rateLimit from 'express-rate-limit';
import importRouter from './import';
import lostFoundRouter from './lostFound';
import petsRouterV2 from './v2/pets';
import { predictPetSymptoms } from '../services/mlPredictionService';
import { deprecationHeaders } from '../../middleware/deprecation';
import analyticsRouter from '../../server/routes/analytics';
import appointmentsRouter from '../../server/routes/appointments';
import medicalRecordsRouter from '../../server/routes/medicalRecords';
import medicationsRouter from '../../server/routes/medications';
import petsRouterV1 from '../../server/routes/pets';
import usersRouter from '../../server/routes/users';

const predictionLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  message: { error: 'Rate limit exceeded. Maximum 10 requests per day on free tier.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const predictionsRouter = express.Router();

predictionsRouter.post('/symptoms', predictionLimiter, async (req, res) => {
  try {
    const { petId, species, breed, symptoms } = req.body;
    if (!species || !breed || !symptoms) {
       res.status(400).json({ error: 'Missing required fields' });
       return;
    }
    const result = await predictPetSymptoms({ petId, species, breed, symptoms });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export function createV1Router() {
  const v1 = express.Router();
  v1.use(deprecationHeaders);

  v1.get('/health', (_req, res) => {
    res.json({ ok: true, version: 'v1', timestamp: new Date().toISOString() });
  });

  v1.use('/analytics', analyticsRouter);
  v1.use('/users', usersRouter);
  v1.use('/pets', petsRouterV1);
  v1.use('/medical-records', medicalRecordsRouter);
  v1.use('/appointments', appointmentsRouter);
  v1.use('/medications', medicationsRouter);
  v1.use('/import', importRouter);
  v1.use('/predictions', predictionsRouter);

  return v1;
}

export function createV2Router() {
  const v2 = express.Router();

  v2.get('/health', (_req, res) => {
    res.json({ ok: true, version: 'v2', timestamp: new Date().toISOString() });
  });

  v2.use('/analytics', analyticsRouter);
  v2.use('/users', usersRouter);
  v2.use('/pets', petsRouterV2);
  v2.use('/medical-records', medicalRecordsRouter);
  v2.use('/appointments', appointmentsRouter);
  v2.use('/medications', medicationsRouter);
  v2.use('/import', importRouter);
  v2.use('/predictions', predictionsRouter);

  return v2;
}
