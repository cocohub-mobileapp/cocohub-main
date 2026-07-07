import express from 'express';

import importRouter from './import';
import lostFoundRouter from './lostFound';
import predictionsRouter from './predictions';
import petsRouterV2 from './v2/pets';
import { deprecationHeaders } from '../../middleware/deprecation';
import analyticsRouter from '../../server/routes/analytics';
import appointmentsRouter from '../../server/routes/appointments';
import medicalRecordsRouter from '../../server/routes/medicalRecords';
import medicationsRouter from '../../server/routes/medications';
import petsRouterV1 from '../../server/routes/pets';
import usersRouter from '../../server/routes/users';

/**
 * v1 — all existing routes, wrapped with deprecation headers.
 */
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
  v1.use('/predictions', predictionsRouter);
  v1.use('/import', importRouter);

  return v1;
}

/**
 * v2 — stable routes reuse v1 handlers; only pets has breaking changes.
 */
export function createV2Router() {
  const v2 = express.Router();

  v2.get('/health', (_req, res) => {
    res.json({ ok: true, version: 'v2', timestamp: new Date().toISOString() });
  });

  v2.use('/analytics', analyticsRouter);
  v2.use('/users', usersRouter);
  v2.use('/pets', petsRouterV2); // breaking changes
  v2.use('/medical-records', medicalRecordsRouter);
  v2.use('/appointments', appointmentsRouter);
  v2.use('/medications', medicationsRouter);
  v2.use('/predictions', predictionsRouter);
  v2.use('/import', importRouter);

  return v2;
}
