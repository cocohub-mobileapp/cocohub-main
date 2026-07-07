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
import { AppointmentStatus } from '../../models/Appointment';
import { UserRole } from '../../models/UserRole';
import { sendToUser } from '../../services/pushService';
import {
  createConsultation,
  getConsultationById,
  getIceServers,
  getWaitingPosition,
  estimatedWaitMinutes,
  listConsultationsForUser,
  joinWaitingRoom,
  recordVetDecision,
  recordConsent,
} from '../../services/webrtcService';
import { ok, sendError } from '../response';
import { store, type StoredAppointment, type StoredMedicalRecord } from '../store';

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

  // Owner joining triggers the waiting room entry
  if (isOwner && consultation.status === 'scheduled') {
    try {
      joinWaitingRoom(consultation.id, userId);
    } catch (err) {
      return sendError(
        res,
        503,
        'WAITING_ROOM_FULL',
        err instanceof Error ? err.message : 'Waiting room is full',
      );
    }
  }

  const position = isOwner ? getWaitingPosition(consultation.id) : undefined;
  const waitMins = isOwner ? estimatedWaitMinutes(consultation.id) : undefined;

  (req as AuditableRequest).audit?.('consultation.joined', 'pet', consultation.petId, {
    consultationId: consultation.id,
    isOwner,
  });

  return res.json(
    ok({
      consultationId: consultation.id,
      roomToken: consultation.roomToken,
      userId,
      userRole: req.user!.role,
      iceServers: getIceServers(),
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

// ---- POST /api/consultations/:id/decision — vet accepts/declines -----------
router.post('/:id/decision', (req: AuthenticatedRequest, res) => {
  const consultation = getConsultationById(req.params.id as string);
  if (!consultation) return sendError(res, 404, 'NOT_FOUND', 'Consultation not found');

  if (consultation.vetId !== req.user!.id) {
    return sendError(res, 403, 'FORBIDDEN', 'Only the assigned vet can respond');
  }

  const { decision, reason } = req.body as { decision?: string; reason?: string };
  if (decision !== 'accepted' && decision !== 'declined') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'decision must be accepted or declined');
  }

  const updated = recordVetDecision(consultation.id, decision, reason?.trim());
  if (!updated) return sendError(res, 500, 'INTERNAL_ERROR', 'Failed to record vet response');

  const appointment = findAppointmentForConsultation(consultation.id);
  if (appointment) {
    appointment.vetDecision = decision;
    appointment.vetDecisionAt = updated.vetDecisionAt;
    appointment.updatedAt = new Date().toISOString();
    if (decision === 'declined') {
      appointment.status = AppointmentStatus.CANCELLED;
      appointment.cancelledAt = appointment.updatedAt;
      appointment.cancellationReason = reason?.trim() || 'Vet declined telemedicine request';
    } else {
      appointment.status = AppointmentStatus.CONFIRMED;
    }
    store.appointments.set(appointment.id, appointment);
  }

  void sendToUser(
    consultation.ownerId,
    'appointment_alerts',
    decision === 'accepted' ? 'Telemedicine request accepted' : 'Telemedicine request declined',
    decision === 'accepted'
      ? 'Your vet accepted the video consultation request.'
      : reason?.trim() || 'Your vet declined the video consultation request.',
    {
      type: 'telemedicine_decision',
      consultationId: consultation.id,
      appointmentId: appointment?.id,
      decision,
    },
  ).catch(() => undefined);

  return res.json(ok({ consultation: toResponse(updated), appointment }));
});

// ---- POST /api/consultations/:id/notes — save consultation note -------------
router.post('/:id/notes', (req: AuthenticatedRequest, res) => {
  const consultation = getConsultationById(req.params.id as string);
  if (!consultation) return sendError(res, 404, 'NOT_FOUND', 'Consultation not found');

  if (consultation.vetId !== req.user!.id) {
    return sendError(res, 403, 'FORBIDDEN', 'Only the assigned vet can save consultation notes');
  }

  const body = req.body as {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    notes?: string;
  };
  if (!body.assessment?.trim() && !body.notes?.trim()) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'assessment or notes are required to save a consultation note',
    );
  }

  const now = new Date().toISOString();
  const record: StoredMedicalRecord = {
    id: store.newId(),
    petId: consultation.petId,
    vetId: consultation.vetId,
    type: 'telemedicine_consultation',
    diagnosis: body.assessment?.trim(),
    treatment: body.plan?.trim(),
    notes: formatConsultationNote(body),
    visitDate: now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
  };

  store.medicalRecords.set(record.id, record);

  const appointment = findAppointmentForConsultation(consultation.id);
  if (appointment) {
    appointment.consultationNoteRecordId = record.id;
    appointment.status = AppointmentStatus.COMPLETED;
    appointment.updatedAt = now;
    store.appointments.set(appointment.id, appointment);
  }

  return res.status(201).json(ok({ record, appointment }));
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
    vetDecision: c.vetDecision,
    vetDecisionAt: c.vetDecisionAt,
    vetDecisionReason: c.vetDecisionReason,
    recordingConsent: c.recordingConsent,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function findAppointmentForConsultation(consultationId: string): StoredAppointment | undefined {
  return [...store.appointments.values()].find(
    (appointment) => appointment.consultationId === consultationId,
  );
}

function formatConsultationNote(body: {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  notes?: string;
}): string {
  return [
    body.notes?.trim(),
    body.subjective?.trim() ? `Subjective: ${body.subjective.trim()}` : undefined,
    body.objective?.trim() ? `Objective: ${body.objective.trim()}` : undefined,
    body.assessment?.trim() ? `Assessment: ${body.assessment.trim()}` : undefined,
    body.plan?.trim() ? `Plan: ${body.plan.trim()}` : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export default router;
