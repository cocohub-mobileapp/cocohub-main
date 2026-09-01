import express from 'express';

import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import { AppointmentStatus, AppointmentType } from '../../models/Appointment';
import { UserRole } from '../../models/UserRole';
import { sendToUser } from '../../services/pushService';
import { getVetAvailability } from '../../services/telemedicineService';
import { generateVideoCallLink } from '../../services/videoCallService';
import {
  createConsultation,
  getConsultationById,
  getIceServers,
  getWaitingPosition,
  estimatedWaitMinutes,
  joinWaitingRoom,
} from '../../services/webrtcService';
import { addMinutes, getCurrentDateInTimezone, parseZonedDateTime } from '../../utils/dateUtils';
import { ok, sendError } from '../response';
import { store, type StoredAppointment, type StoredMedicalRecord } from '../store';

const router = express.Router();
router.use(authenticateJWT);

interface QuestionnairePayload {
  responses?: Record<string, string>;
}

function appointmentResponse(appt: StoredAppointment) {
  return {
    success: true as const,
    data: appt,
    timestamp: new Date().toISOString(),
  };
}

router.get('/availability', (req: AuthenticatedRequest, res) => {
  const { vetId, date, timeZone } = req.query as Record<string, string | undefined>;
  if (!vetId) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'vetId is required');
  }

  const tz = timeZone?.trim() || 'UTC';
  const targetDate = date?.trim() || getCurrentDateInTimezone(tz);
  const slots = getVetAvailability(vetId, targetDate, tz);
  return res.json(ok({ slots, timeZone: tz }));
});

router.post('/appointments', (req: AuthenticatedRequest, res) => {
  const body = req.body as {
    petId?: string;
    vetId?: string;
    date?: string;
    time?: string;
    durationMinutes?: number;
    timeZone?: string;
    type?: AppointmentType;
    notes?: string;
  };

  if (!body.petId?.trim() || !body.vetId?.trim() || !body.date?.trim() || !body.time?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId, vetId, date, and time are required');
  }

  const pet = store.pets.get(body.petId.trim());
  if (!pet) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'petId must reference an existing pet');
  }

  if (req.user!.role === UserRole.OWNER && pet.ownerId !== req.user!.id) {
    return sendError(
      res,
      403,
      'FORBIDDEN',
      'You can only schedule consultations for your own pets',
    );
  }

  const timeZone = body.timeZone?.trim() || 'UTC';
  let scheduledAt: Date;

  try {
    scheduledAt = parseZonedDateTime(body.date.trim(), body.time.trim(), timeZone);
  } catch {
    return sendError(res, 400, 'INVALID_DATE', 'Unable to parse requested appointment date/time');
  }

  if (scheduledAt <= new Date()) {
    return sendError(res, 400, 'INVALID_DATE', 'Appointment must be scheduled in the future');
  }

  const appointmentId = store.newId();
  const videoCallLink = generateVideoCallLink(appointmentId);

  // Create linked WebRTC consultation session
  const consultation = createConsultation(
    body.petId.trim(),
    pet.ownerId,
    body.vetId.trim(),
    scheduledAt.toISOString(),
    body.durationMinutes ?? 30,
    appointmentId,
  );

  const row: StoredAppointment = {
    id: appointmentId,
    petId: body.petId.trim(),
    vetId: body.vetId.trim(),
    date: body.date.trim(),
    time: body.time.trim(),
    durationMinutes: body.durationMinutes ?? 30,
    type: body.type ?? AppointmentType.ROUTINE_CHECKUP,
    status: AppointmentStatus.CONFIRMED,
    notes: body.notes?.trim(),
    timeZone,
    isTelemedicine: true,
    videoCallUrl: videoCallLink.url,
    videoProvider: videoCallLink.provider,
    consultationId: consultation.id,
    roomToken: consultation.roomToken,
    questionnaireDueAt: addMinutes(scheduledAt, -24 * 60).toISOString(),
    questionnaireSentAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.appointments.set(appointmentId, row);

  // Notify the assigned veterinarian
  try {
    void sendToUser(
      body.vetId.trim(),
      'appointment_alerts',
      'New Telemedicine Consultation',
      `New telemedicine consultation scheduled for ${pet.name}`,
      {
        appointmentId,
        consultationId: consultation.id,
        petId: pet.id,
      },
    );
  } catch {
    // Non-blocking notification
  }

  return res.status(201).json(appointmentResponse(row));
});

router.post('/:id/questionnaire', (req: AuthenticatedRequest, res) => {
  const appointment = store.appointments.get(req.params.id);
  if (!appointment) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  const pet = store.pets.get(appointment.petId);
  if (!pet) return sendError(res, 404, 'NOT_FOUND', 'Pet not found');
  if (req.user!.role === UserRole.OWNER && pet.ownerId !== req.user!.id) {
    return sendError(
      res,
      403,
      'FORBIDDEN',
      'You can only submit questionnaires for your own appointments',
    );
  }

  const payload = req.body as QuestionnairePayload;
  if (!payload.responses || typeof payload.responses !== 'object') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'questionnaire responses are required');
  }

  appointment.questionnaireResponses = payload.responses;
  appointment.questionnaireRespondedAt = new Date().toISOString();
  appointment.updatedAt = new Date().toISOString();

  store.appointments.set(appointment.id, appointment);
  return res.json(appointmentResponse(appointment));
});

router.post('/:id/no-show', (req: AuthenticatedRequest, res) => {
  const appointment = store.appointments.get(req.params.id);
  if (!appointment) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  const pet = store.pets.get(appointment.petId);
  if (!pet) return sendError(res, 404, 'NOT_FOUND', 'Pet not found');
  if (req.user!.role === UserRole.OWNER && pet.ownerId !== req.user!.id) {
    return sendError(
      res,
      403,
      'FORBIDDEN',
      'You can only report no-shows for your own appointments',
    );
  }

  if (appointment.status === AppointmentStatus.CANCELLED) {
    return sendError(res, 400, 'INVALID_STATE', 'Canceled appointments cannot be marked no-show');
  }

  let scheduledAt: Date;
  try {
    scheduledAt = parseZonedDateTime(
      appointment.date,
      appointment.time,
      appointment.timeZone ?? 'UTC',
    );
  } catch {
    scheduledAt = new Date();
  }

  if (new Date().getTime() < scheduledAt.getTime() + 30 * 60 * 1000) {
    return sendError(
      res,
      400,
      'INVALID_STATE',
      'No-show can only be reported after the appointment window has passed',
    );
  }

  appointment.status = AppointmentStatus.NO_SHOW;
  appointment.noShowReportedAt = new Date().toISOString();
  appointment.updatedAt = new Date().toISOString();

  store.appointments.set(appointment.id, appointment);
  return res.json(appointmentResponse(appointment));
});

router.post('/:id/reschedule', (req: AuthenticatedRequest, res) => {
  const appointment = store.appointments.get(req.params.id);
  if (!appointment) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  const pet = store.pets.get(appointment.petId);
  if (!pet) return sendError(res, 404, 'NOT_FOUND', 'Pet not found');
  if (req.user!.role === UserRole.OWNER && pet.ownerId !== req.user!.id) {
    return sendError(res, 403, 'FORBIDDEN', 'You can only reschedule your own appointments');
  }

  const { date, time, timeZone } = req.body as {
    date?: string;
    time?: string;
    timeZone?: string;
  };
  if (!date?.trim() || !time?.trim()) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'date and time are required to reschedule');
  }

  const zone = timeZone?.trim() || appointment.timeZone || 'UTC';
  let newScheduledAt: Date;
  try {
    newScheduledAt = parseZonedDateTime(date.trim(), time.trim(), zone);
  } catch {
    return sendError(res, 400, 'INVALID_DATE', 'Unable to parse new appointment date/time');
  }

  if (newScheduledAt <= new Date()) {
    return sendError(res, 400, 'INVALID_DATE', 'Rescheduled appointment must be in the future');
  }

  const previousDate = `${appointment.date} ${appointment.time}`;
  appointment.date = date.trim();
  appointment.time = time.trim();
  appointment.timeZone = zone;
  appointment.status = AppointmentStatus.RESCHEDULED;
  appointment.rescheduledFrom = previousDate;
  appointment.videoCallUrl = generateVideoCallLink(appointment.id).url;
  appointment.questionnaireDueAt = addMinutes(newScheduledAt, -24 * 60).toISOString();
  appointment.questionnaireSentAt = new Date().toISOString();
  appointment.updatedAt = new Date().toISOString();

  store.appointments.set(appointment.id, appointment);
  return res.json(appointmentResponse(appointment));
});

router.post('/:id/accept', (req: AuthenticatedRequest, res) => {
  const appointment = store.appointments.get(req.params.id);
  if (!appointment) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  if (req.user!.role === UserRole.VET && appointment.vetId !== req.user!.id) {
    return sendError(
      res,
      403,
      'FORBIDDEN',
      'Only the assigned veterinarian can accept this appointment',
    );
  }

  appointment.status = AppointmentStatus.CONFIRMED;
  appointment.updatedAt = new Date().toISOString();
  store.appointments.set(appointment.id, appointment);

  const consultation = getConsultationById(appointment.consultationId || appointment.id);
  if (consultation && consultation.status === 'cancelled') {
    consultation.status = 'scheduled';
    consultation.updatedAt = new Date().toISOString();
  }

  const pet = store.pets.get(appointment.petId);
  if (pet) {
    try {
      void sendToUser(
        pet.ownerId,
        'appointment_alerts',
        'Consultation Confirmed',
        'Your vet has accepted the telemedicine consultation request',
        {
          appointmentId: appointment.id,
          consultationId: appointment.consultationId || appointment.id,
        },
      );
    } catch {
      // Non-blocking
    }
  }

  return res.json(appointmentResponse(appointment));
});

router.post('/:id/decline', (req: AuthenticatedRequest, res) => {
  const appointment = store.appointments.get(req.params.id);
  if (!appointment) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  if (req.user!.role === UserRole.VET && appointment.vetId !== req.user!.id) {
    return sendError(
      res,
      403,
      'FORBIDDEN',
      'Only the assigned veterinarian can decline this appointment',
    );
  }

  const reason = (req.body as { reason?: string })?.reason || 'Declined by veterinarian';
  appointment.status = AppointmentStatus.CANCELLED;
  appointment.cancellationReason = reason;
  appointment.cancelledAt = new Date().toISOString();
  appointment.updatedAt = new Date().toISOString();
  store.appointments.set(appointment.id, appointment);

  const consultation = getConsultationById(appointment.consultationId || appointment.id);
  if (consultation) {
    consultation.status = 'cancelled';
    consultation.updatedAt = new Date().toISOString();
  }

  const pet = store.pets.get(appointment.petId);
  if (pet) {
    try {
      void sendToUser(
        pet.ownerId,
        'appointment_alerts',
        'Consultation Declined',
        `Your vet was unable to accept the consultation: ${reason}`,
        {
          appointmentId: appointment.id,
          reason,
        },
      );
    } catch {
      // Non-blocking
    }
  }

  return res.json(appointmentResponse(appointment));
});

router.post('/:id/join', (req: AuthenticatedRequest, res) => {
  const appointment = store.appointments.get(req.params.id);
  if (!appointment) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  const pet = store.pets.get(appointment.petId);
  const userId = req.user!.id;
  const isOwner = pet?.ownerId === userId || req.user!.role === UserRole.OWNER;
  const isVet = appointment.vetId === userId || req.user!.role === UserRole.VET;

  if (!isOwner && !isVet && req.user!.role !== UserRole.ADMIN) {
    return sendError(res, 403, 'FORBIDDEN', 'You are not a participant in this consultation');
  }

  let consultation = getConsultationById(appointment.consultationId || appointment.id);
  if (!consultation) {
    consultation = createConsultation(
      appointment.petId,
      pet?.ownerId || userId,
      appointment.vetId,
      new Date().toISOString(),
      appointment.durationMinutes ?? 30,
      appointment.id,
    );
    appointment.consultationId = consultation.id;
    appointment.roomToken = consultation.roomToken;
    store.appointments.set(appointment.id, appointment);
  }

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

  return res.json(
    ok({
      consultationId: consultation.id,
      roomToken: consultation.roomToken,
      iceServers: getIceServers(),
      ...(position != null && position > 0 ? { waitingRoomPosition: position } : {}),
      ...(waitMins != null && waitMins > 0 ? { estimatedWaitMinutes: waitMins } : {}),
    }),
  );
});

router.post('/:id/notes', (req: AuthenticatedRequest, res) => {
  const appointment = store.appointments.get(req.params.id);
  if (!appointment) return sendError(res, 404, 'NOT_FOUND', 'Appointment not found');

  if (req.user!.role === UserRole.VET && appointment.vetId !== req.user!.id) {
    return sendError(res, 403, 'FORBIDDEN', 'Only the attending vet can add consultation notes');
  }

  const body = req.body as {
    diagnosis?: string;
    treatment?: string;
    notes?: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    prescription?: string;
  };

  const structuredNotes =
    [
      body.notes,
      body.subjective ? `Subjective: ${body.subjective}` : '',
      body.objective ? `Objective: ${body.objective}` : '',
      body.assessment ? `Assessment: ${body.assessment}` : '',
      body.plan ? `Plan: ${body.plan}` : '',
      body.prescription ? `Prescription: ${body.prescription}` : '',
    ]
      .filter(Boolean)
      .join('\n') || 'Telemedicine Consultation Notes';

  const recordId = store.newId();
  const medicalRecord: StoredMedicalRecord = {
    id: recordId,
    petId: appointment.petId,
    vetId: appointment.vetId,
    type: 'telemedicine_consultation',
    diagnosis: body.diagnosis || body.assessment || 'Telemedicine Consultation',
    treatment: body.treatment || body.plan,
    notes: structuredNotes,
    visitDate: appointment.date,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  store.medicalRecords.set(recordId, medicalRecord);

  appointment.status = AppointmentStatus.COMPLETED;
  appointment.updatedAt = new Date().toISOString();
  store.appointments.set(appointment.id, appointment);

  const consultation = getConsultationById(appointment.consultationId || appointment.id);
  if (consultation) {
    consultation.status = 'completed';
    consultation.endedAt = new Date().toISOString();
    consultation.updatedAt = new Date().toISOString();
  }

  return res.status(201).json(
    ok({
      appointment,
      medicalRecord,
    }),
  );
});

router.get('/pending-questionnaires', (_req: AuthenticatedRequest, res) => {
  const now = new Date();
  const dueSoon = [...store.appointments.values()].filter((appointment) => {
    if (!appointment.isTelemedicine || appointment.status !== AppointmentStatus.CONFIRMED)
      return false;
    if (!appointment.questionnaireDueAt || appointment.questionnaireRespondedAt) return false;
    const dueAt = new Date(appointment.questionnaireDueAt);
    return dueAt.getTime() <= now.getTime() + 24 * 60 * 60 * 1000;
  });
  return res.json(ok({ pendingQuestionnaires: dueSoon }));
});

export default router;
