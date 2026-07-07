import express from 'express';

import { authenticateJWT, authorizeRoles } from '../../middleware/auth';
import { UserRole } from '../../models/UserRole';
import stellarAnchorService from '../../services/stellarService';
import { sendError } from '../response';

const router = express.Router();

router.use(authenticateJWT);

router.post(
  '/contracts/medical-record-registry/store',
  authorizeRoles(UserRole.ADMIN, UserRole.VET),
  async (req, res) => {
    const body = req.body as {
      petId?: unknown;
      recordHash?: unknown;
      vetAddress?: unknown;
      contractId?: unknown;
      sourceSecret?: unknown;
      network?: unknown;
    };

    if (
      typeof body.petId !== 'string' ||
      typeof body.recordHash !== 'string' ||
      typeof body.vetAddress !== 'string'
    ) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'petId, recordHash, and vetAddress are required',
      );
    }

    try {
      const result = await stellarAnchorService.storeMedicalRecordInRegistry({
        petId: body.petId,
        recordHash: body.recordHash,
        vetAddress: body.vetAddress,
        contractId: typeof body.contractId === 'string' ? body.contractId : undefined,
        sourceSecret: typeof body.sourceSecret === 'string' ? body.sourceSecret : undefined,
        network: body.network === 'mainnet' ? 'mainnet' : 'testnet',
      });

      return res.status(result.status === 'pending' ? 202 : 201).json(result);
    } catch (error) {
      return sendError(
        res,
        400,
        'MEDICAL_RECORD_REGISTRY_ERROR',
        error instanceof Error ? error.message : 'Failed to store record in registry contract',
      );
    }
  },
);

router.post('/contracts/medical-record-registry/verify', async (req, res) => {
  const body = req.body as { recordId?: unknown; contractId?: unknown };

  if (typeof body.recordId !== 'string') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'recordId is required');
  }

  try {
    const result = await stellarAnchorService.verifyMedicalRecordInRegistry(
      body.recordId,
      typeof body.contractId === 'string' ? body.contractId : undefined,
    );

    return res.json(result);
  } catch (error) {
    return sendError(
      res,
      400,
      'MEDICAL_RECORD_REGISTRY_ERROR',
      error instanceof Error ? error.message : 'Failed to verify record in registry contract',
    );
  }
});

export default router;
