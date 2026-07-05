/**
 * Consultation routes — /api/consultations
 *
 * REST endpoints for telemedicine video consultation management.
 * Real-time WebRTC signaling is handled separately via Socket.IO
 * (see backend/services/webrtcService.ts → createSignalingServer).
 */

import express from 'express';

import type { AuditableRequest } from '../../middleware/auditLog';
import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import { UserRole } from '../../models/UserRole';
import {
  createConsultation,
  getConsultationById,
  getIceServers,
  getWaitingPosition,
  estimatedWaitMinutes,
  listConsultationsForUser,
  recordConsent,
} from '../../services/webrtcService';
import { ok, sendError } from '../response';
import { store } from '../store';

const router = express.Router();

// All consultation routes require authentication
router.use(authenticateJWT);

// ---- POST /api/consultations — schedule a new consultation ----------------
router.post('/', (req: AuthenticatedRequest, res) => {
  const { petId, vetId, scheduledAt, durationMinutes } = req.body as {
    petId?: string;
    vetId?: string;
    scheduledAt?: string;
    durationMinutes?: number;
  };

  if (!petId || !vetId || !scheduledAt) {
    return sendError(res, 400, 'MISSING_FIELDS', 'petId, vetId, and scheduledAt are required');
  }

  const pet = store.pets.get(petId);
  if (!pet) return sendError(res, 404, 'NOT_FOUND', 'Pet not found');

  if (req.user!.role === UserRole.OWNER && req.user!.id !== pet.ownerId) {
    return sendError(res, 403, 'FORBIDDEN', 'You can only schedule consultations for your pets');
  }

  // Validate scheduledAt is an ISO 8601 date in the future
  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    return sendError(res, 400, 'INVALID_DATE', 'scheduledAt must be a future ISO 8601 datetime');
  }

  const consultation = createConsultation(petId, pet.ownerId, vetId, scheduledAt, durationMinutes);

  (req as AuditableRequest).audit?.('consultation.scheduled', 'pet', petId, {
    consultationId: consultation.id,
    vetId,
  });

  return res.status(201).json(ok(toResponse(consultation)));
});

// ---- GET /api/consultations — list consultations for the current user ------
router.get('/', (req: AuthenticatedRequest, res) => {
  const list = listConsultationsForUser(req.user!.id).map(toResponse);
  return res.json(ok(list));
});

// ---- GET /api/consultations/:id — single consultation details --------------
router.get('/:id', (req: AuthenticatedRequest, res) => {
  const consultation = getConsultationById(req.params.id as string);
  if (!consultation) return sendError(res, 404, 'NOT_FOUND', 'Consultation not found');

  if (consultation.ownerId !== req.user!.id && consultation.vetId !== req.user!.id) {
    return sendError(res, 403, 'FORBIDDEN', 'Access denied');
  }

  return res.json(ok(toResponse(consultation)));
});

// ---- POST /api/consultations/:id/join — get room token + ICE servers ------
router.post('/:id/join', (req: AuthenticatedRequest, res) => {
  const consultation = getConsultationById(req.params.id as string);
  if (!consultation) return sendError(res, 404, 'NOT_FOUND', 'Consultation not found');

  const userId = req.user!.id;
  if (consultation.ownerId !== userId && consultation.vetId !== userId) {
    return sendError(res, 403, 'FORBIDDEN', 'You are not a participant in this consultation');
  }

  const isOwner = consultation.ownerId === userId;

  const position =
    isOwner && consultation.status === 'waiting' ? getWaitingPosition(consultation.id) : undefined;
  const waitMins =
    isOwner && consultation.status === 'waiting'
      ? estimatedWaitMinutes(consultation.id)
      : undefined;

  (req as AuditableRequest).audit?.('consultation.joined', 'pet', consultation.petId, {
    consultationId: consultation.id,
    isOwner,
  });

  return res.json(
    ok({
      consultationId: consultation.id,
      roomToken: consultation.roomToken,
      iceServers: getIceServers(),
      userId,
      userRole: req.user!.role,
      ...(position != null ? { waitingRoomPosition: position } : {}),
      ...(waitMins != null ? { estimatedWaitMinutes: waitMins } : {}),
    }),
  );
});

// ---- POST /api/consultations/:id/consent — record recording consent --------
router.post('/:id/consent', (req: AuthenticatedRequest, res) => {
  const consultation = getConsultationById(req.params.id as string);
  if (!consultation) return sendError(res, 404, 'NOT_FOUND', 'Consultation not found');

  const userId = req.user!.id;
  if (consultation.ownerId !== userId && consultation.vetId !== userId) {
    return sendError(res, 403, 'FORBIDDEN', 'You are not a participant in this consultation');
  }

  const updated = recordConsent(consultation.id, userId, req.user!.role);
  if (!updated) return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to record consent');

  (req as AuditableRequest).audit?.('consultation.consent_recorded', 'pet', consultation.petId, {
    consultationId: consultation.id,
    userId,
  });

  const bothConsented =
    updated.recordingConsent.ownerConsented && updated.recordingConsent.vetConsented;

  return res.json(
    ok({
      consultationId: consultation.id,
      recordingConsent: updated.recordingConsent,
      recordingEnabled: bothConsented,
    }),
  );
});

// ---- Helper ----------------------------------------------------------------
function toResponse(c: ReturnType<typeof getConsultationById>) {
  if (!c) return null;
  return {
    id: c.id,
    petId: c.petId,
    ownerId: c.ownerId,
    vetId: c.vetId,
    scheduledAt: c.scheduledAt,
    durationMinutes: c.durationMinutes,
    status: c.status,
    waitingRoomJoinedAt: c.waitingRoomJoinedAt,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    medicalRecordId: c.medicalRecordId,
    recordingConsent: c.recordingConsent,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export default router;
