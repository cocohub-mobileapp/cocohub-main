import express from 'express';
import request from 'supertest';

import { AppointmentStatus, AppointmentType } from '../../models/Appointment';
import { UserRole } from '../../models/UserRole';
import consultationsRouter from '../routes/consultations';
import telemedicineRouter from '../routes/telemedicine';
import { store } from '../store';
import { getConsultationById } from '../../services/webrtcService';

// Mock auth middleware to inject user from header
jest.mock('../../middleware/auth', () => ({
  authenticateJWT: (req: any, _res: any, next: any) => {
    req.user = req.headers['x-test-user']
      ? JSON.parse(req.headers['x-test-user'] as string)
      : { id: 'u-owner-1', role: 'OWNER' };
    next();
  },
}));

// Mock push service to track notifications without network calls
const mockSendToUser = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/pushService', () => ({
  sendToUser: (...args: any[]) => mockSendToUser(...args),
}));

jest.mock('../../middleware/auditLogger', () => ({
  logAuditTrail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/logger', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const app = express();
app.use(express.json());
app.use('/telemedicine', telemedicineRouter);
app.use('/consultations', consultationsRouter);

const OWNER_ID = 'u-owner-1';
const VET_ID = 'v-vet-1';
const OTHER_VET_ID = 'v-vet-2';
const PET_ID = 'pet-dog-1';

const OWNER_HEADER = JSON.stringify({ id: OWNER_ID, role: UserRole.OWNER });
const VET_HEADER = JSON.stringify({ id: VET_ID, role: UserRole.VET });
const OTHER_VET_HEADER = JSON.stringify({ id: OTHER_VET_ID, role: UserRole.VET });

function getFutureDate(daysAhead = 7): { date: string; time: string } {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  return {
    date: d.toISOString().slice(0, 10),
    time: '14:00',
  };
}

describe('Telemedicine WebRTC End-to-End Integration', () => {
  beforeEach(() => {
    store.clear();
    mockSendToUser.mockClear();

    // Seed test pet
    store.pets.set(PET_ID, {
      id: PET_ID,
      ownerId: OWNER_ID,
      name: 'Barnaby',
      species: 'Dog',
      breed: 'Golden Retriever',
      dob: '2020-01-01',
      weight: 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it('completes the full flow: booking -> vet notification -> accept -> join -> submit notes -> medical record', async () => {
    const { date, time } = getFutureDate(5);

    // 1. Owner schedules a telemedicine appointment
    const bookRes = await request(app)
      .post('/telemedicine/appointments')
      .set('x-test-user', OWNER_HEADER)
      .send({
        petId: PET_ID,
        vetId: VET_ID,
        date,
        time,
        durationMinutes: 30,
        type: AppointmentType.ROUTINE_CHECKUP,
        notes: 'Follow-up on itchy skin',
      });

    expect(bookRes.status).toBe(201);
    expect(bookRes.body.success).toBe(true);
    const appointment = bookRes.body.data;
    expect(appointment.id).toBeDefined();
    expect(appointment.consultationId).toBeDefined();
    expect(appointment.roomToken).toBeDefined();
    expect(appointment.isTelemedicine).toBe(true);

    // Verify push notification sent to vet
    expect(mockSendToUser).toHaveBeenCalledWith(
      VET_ID,
      'appointment_alerts',
      'New Telemedicine Consultation',
      expect.stringContaining('Barnaby'),
      expect.objectContaining({
        appointmentId: appointment.id,
        consultationId: appointment.consultationId,
      }),
    );

    // 2. Vet accepts the appointment
    const acceptRes = await request(app)
      .post(`/telemedicine/${appointment.id}/accept`)
      .set('x-test-user', VET_HEADER);

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.status).toBe(AppointmentStatus.CONFIRMED);

    // Verify push notification sent to pet owner
    expect(mockSendToUser).toHaveBeenCalledWith(
      OWNER_ID,
      'appointment_alerts',
      'Consultation Confirmed',
      expect.any(String),
      expect.objectContaining({ appointmentId: appointment.id }),
    );

    // 3. Owner joins the consultation room
    const ownerJoinRes = await request(app)
      .post(`/telemedicine/${appointment.id}/join`)
      .set('x-test-user', OWNER_HEADER);

    expect(ownerJoinRes.status).toBe(200);
    expect(ownerJoinRes.body.data.consultationId).toBe(appointment.consultationId);
    expect(ownerJoinRes.body.data.roomToken).toBe(appointment.roomToken);
    expect(Array.isArray(ownerJoinRes.body.data.iceServers)).toBe(true);

    // 4. Vet joins the consultation room
    const vetJoinRes = await request(app)
      .post(`/telemedicine/${appointment.id}/join`)
      .set('x-test-user', VET_HEADER);

    expect(vetJoinRes.status).toBe(200);
    expect(vetJoinRes.body.data.consultationId).toBe(appointment.consultationId);

    // 5. Vet submits SOAP notes upon call completion
    const notesRes = await request(app)
      .post(`/telemedicine/${appointment.id}/notes`)
      .set('x-test-user', VET_HEADER)
      .send({
        diagnosis: 'Atopic Dermatitis',
        treatment: 'Prescribed Apoquel 16mg once daily',
        subjective: 'Owner reports scratching ears and paws for 2 weeks',
        objective: 'Erythema noted in bilateral pinnae and interdigital spaces',
        assessment: 'Mild environmental allergic dermatitis',
        plan: 'Recheck in 14 days; hypoallergenic shampoo twice weekly',
        prescription: 'Apoquel 16mg #14',
      });

    expect(notesRes.status).toBe(201);
    expect(notesRes.body.success).toBe(true);
    expect(notesRes.body.data.appointment.status).toBe(AppointmentStatus.COMPLETED);

    // Verify medical record was created in the store
    const record = notesRes.body.data.medicalRecord;
    expect(record).toBeDefined();
    expect(record.petId).toBe(PET_ID);
    expect(record.vetId).toBe(VET_ID);
    expect(record.diagnosis).toBe('Atopic Dermatitis');
    expect(record.notes).toContain('Subjective: Owner reports scratching');
    expect(record.notes).toContain('Plan: Recheck in 14 days');

    expect(store.medicalRecords.get(record.id)).toBeDefined();

    // Verify consultation status transitioned to completed
    const consultation = getConsultationById(appointment.consultationId);
    expect(consultation?.status).toBe('completed');
  });

  it('handles vet decline flow with cancellation reason and owner notification', async () => {
    const { date, time } = getFutureDate(3);

    const bookRes = await request(app)
      .post('/telemedicine/appointments')
      .set('x-test-user', OWNER_HEADER)
      .send({
        petId: PET_ID,
        vetId: VET_ID,
        date,
        time,
      });

    const appointment = bookRes.body.data;

    // Vet declines
    const declineRes = await request(app)
      .post(`/telemedicine/${appointment.id}/decline`)
      .set('x-test-user', VET_HEADER)
      .send({ reason: 'Emergency surgery scheduled during this time slot' });

    expect(declineRes.status).toBe(200);
    expect(declineRes.body.data.status).toBe(AppointmentStatus.CANCELLED);
    expect(declineRes.body.data.cancellationReason).toBe(
      'Emergency surgery scheduled during this time slot',
    );

    // Verify notification sent to owner
    expect(mockSendToUser).toHaveBeenCalledWith(
      OWNER_ID,
      'appointment_alerts',
      'Consultation Declined',
      expect.stringContaining('Emergency surgery'),
      expect.objectContaining({ appointmentId: appointment.id }),
    );

    const consultation = getConsultationById(appointment.consultationId);
    expect(consultation?.status).toBe('cancelled');
  });

  it('prevents unauthorized vet from accepting or declining an appointment', async () => {
    const { date, time } = getFutureDate(4);

    const bookRes = await request(app)
      .post('/telemedicine/appointments')
      .set('x-test-user', OWNER_HEADER)
      .send({
        petId: PET_ID,
        vetId: VET_ID,
        date,
        time,
      });

    const appointment = bookRes.body.data;

    // Other vet tries to accept
    const unauthorizedAccept = await request(app)
      .post(`/telemedicine/${appointment.id}/accept`)
      .set('x-test-user', OTHER_VET_HEADER);

    expect(unauthorizedAccept.status).toBe(403);
  });
});
