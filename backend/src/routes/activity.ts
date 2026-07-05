import express from 'express';

import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import { ok, sendError } from '../../server/response';
import wearableService from '../../services/wearableService';
import { query } from '../db';

const router = express.Router();
router.use(authenticateJWT);

router.get('/providers', async (_req: AuthenticatedRequest, res) => {
  return res.json(ok(wearableService.getSupportedProviders()));
});

router.get('/oauth/:providerKey/start', async (req: AuthenticatedRequest, res) => {
  const providerKey = req.params.providerKey;
  const petId = String(req.query.petId ?? '');
  const redirectUri = String(
    req.query.redirectUri ?? `${req.protocol}://${req.get('host')}/api/activity/oauth/callback`,
  );

  if (!petId) return sendError(res, 400, 'VALIDATION_ERROR', 'petId required');

  const authUrl = wearableService.buildOAuthAuthorizationUrl(providerKey, petId, redirectUri);
  if (!authUrl) {
    return sendError(
      res,
      503,
      'WEARABLE_PROVIDER_UNAVAILABLE',
      'Wearable provider OAuth is not configured',
    );
  }

  return res.json(ok({ authUrl }));
});

// Link a wearable provider to a pet (OAuth callback handler or direct token exchange)
router.post('/connect', async (req: AuthenticatedRequest, res) => {
  const { petId, providerKey, accessToken, refreshToken, expiresAt } = req.body as Record<
    string,
    string
  >;
  if (!petId || !providerKey || !accessToken)
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'petId, providerKey and accessToken are required',
    );
  try {
    await wearableService.connectProviderOAuth(
      petId,
      providerKey,
      accessToken,
      refreshToken,
      expiresAt,
      {},
    );
    return res.status(201).json(ok(null, 'Connected'));
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_ERROR', (err as Error).message);
  }
});

// Trigger on-demand sync for a pet+provider
router.post('/sync', async (req: AuthenticatedRequest, res) => {
  const { petId, providerKey } = req.body as Record<string, string>;
  if (!petId || !providerKey)
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId and providerKey required');
  try {
    const result = await wearableService.syncProviderForPet(providerKey, petId);
    return res.json(ok(result));
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_ERROR', (err as Error).message);
  }
});

// Summary
router.get('/summary/:petId', async (req: AuthenticatedRequest, res) => {
  const petId = req.params.petId;
  if (!petId) return sendError(res, 400, 'VALIDATION_ERROR', 'petId required');
  try {
    const summary = await wearableService.getActivitySummary(petId);
    return res.json(ok(summary));
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_ERROR', (err as Error).message);
  }
});

// Historical data
router.get('/historical/:petId', async (req: AuthenticatedRequest, res) => {
  const petId = req.params.petId;
  const metricType = String(req.query.metricType ?? 'steps');
  const from = String(
    req.query.from ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  );
  const to = String(req.query.to ?? new Date().toISOString());
  try {
    const rows = await wearableService.getHistoricalActivity(petId, metricType, from, to);
    return res.json(ok(rows));
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_ERROR', (err as Error).message);
  }
});

// Device Status
router.get('/status/:petId', async (req: AuthenticatedRequest, res) => {
  const petId = req.params.petId;
  if (!petId) return sendError(res, 400, 'VALIDATION_ERROR', 'petId required');
  try {
    const result = await query(
      'SELECT provider_key, updated_at FROM wearable_tokens WHERE pet_id = $1',
      [petId],
    );
    if (result.rows.length === 0) {
      return res.json(ok({ connected: false }));
    }
    const token = result.rows[0];
    return res.json(
      ok({
        connected: true,
        providerKey: token.provider_key,
        lastSync: token.updated_at,
      }),
    );
  } catch (err) {
    return sendError(res, 500, 'INTERNAL_ERROR', (err as Error).message);
  }
});

export default router;
