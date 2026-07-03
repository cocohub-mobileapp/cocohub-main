import express from 'express';

import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import {
  exchangeOAuthCode,
  getClaim,
  getClaims,
  getPolicies,
  getPolicy,
  generateClaimSummaryPdf,
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

// GET /api/insurance/claims/:id/summary.pdf
router.get('/claims/:id/summary.pdf', async (req: AuthenticatedRequest, res) => {
  const claim = getClaim(req.params.id);
  if (!claim || claim.userId !== req.user!.id) {
    return sendError(res, 404, 'NOT_FOUND', 'Claim not found');
  }

  try {
    const result = await generateClaimSummaryPdf(req.params.id);
    if (!result) return sendError(res, 404, 'NOT_FOUND', 'Claim not found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    return res.send(result.buffer);
  } catch (err) {
    console.error('[insurance] claim summary PDF failed:', err);
    return sendError(res, 500, 'PDF_FAILED', 'Failed to generate claim summary PDF');
  }
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
  if (!policyId || !amount || !description) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'policyId, amount, and description required');
  }
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'amount must be greater than zero');
  }
  if (attachmentUrls && !Array.isArray(attachmentUrls)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'attachmentUrls must be an array');
  }
  const policy = getPolicy(policyId);
  if (!policy || policy.userId !== req.user!.id) {
    return sendError(res, 404, 'NOT_FOUND', 'Policy not found');
  }
  const claim = submitClaim(policyId, req.user!.id, {
    petId,
    amount: Number(amount),
    description,
    attachmentUrls,
  });
  return res.status(201).json(ok(claim));
});

export default router;
