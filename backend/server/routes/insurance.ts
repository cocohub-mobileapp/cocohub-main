import express from 'express';

import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import {
  exchangeOAuthCode,
  getClaim,
  getClaims,
  getPolicies,
  getPolicy,
  submitClaim,
  type InsuranceProvider,
} from '../../services/insuranceService';
import { ok, sendError } from '../response';

const router = express.Router();
router.use(authenticateJWT);

const PROVIDERS: InsuranceProvider[] = ['trupanion', 'nationwide', 'mock'];

// GET /api/insurance/policies
router.get('/policies', (req: AuthenticatedRequest, res) => {
  return res.json(ok(getPolicies(req.user!.id)));
});

// POST /api/insurance/connect — OAuth code exchange
router.post('/connect', async (req: AuthenticatedRequest, res) => {
  const { provider, code } = req.body as { provider: InsuranceProvider; code: string };
  if (!provider || !PROVIDERS.includes(provider)) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      `provider must be one of: ${PROVIDERS.join(', ')}`,
    );
  }
  if (!code) return sendError(res, 400, 'VALIDATION_ERROR', 'code required');
  try {
    const policy = await exchangeOAuthCode(provider, code, req.user!.id);
    return res.status(201).json(ok(policy));
  } catch (e) {
    return sendError(res, 502, 'PROVIDER_ERROR', 'Failed to connect insurance provider');
  }
});

// GET /api/insurance/claims
router.get('/claims', (req: AuthenticatedRequest, res) => {
  return res.json(ok(getClaims(req.user!.id)));
});

// GET /api/insurance/claims/:id
router.get('/claims/:id', (req: AuthenticatedRequest, res) => {
  const claim = getClaim(req.params.id);
  if (!claim || claim.userId !== req.user!.id) {
    return sendError(res, 404, 'NOT_FOUND', 'Claim not found');
  }
  return res.json(ok(claim));
});

// POST /api/insurance/claims
router.post('/claims', (req: AuthenticatedRequest, res) => {
  const { policyId, petId, amount, description, attachmentUrls } = req.body as {
    policyId: string;
    petId?: string;
    amount: number;
    description: string;
    attachmentUrls?: string[];
  };
  if (
    !policyId ||
    typeof amount !== 'number' ||
    isNaN(amount) ||
    amount <= 0 ||
    !description ||
    typeof description !== 'string' ||
    !description.trim()
  ) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Valid policyId, positive amount, and non-empty description required',
    );
  }
  const policy = getPolicy(policyId);
  if (!policy || policy.userId !== req.user!.id) {
    return sendError(res, 404, 'NOT_FOUND', 'Policy not found');
  }
  const claim = submitClaim(policyId, req.user!.id, { petId, amount, description, attachmentUrls });
  return res.status(201).json(ok(claim));
});

export default router;
