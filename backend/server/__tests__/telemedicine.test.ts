import express from 'express';
import request from 'supertest';

import { UserRole } from '../../../backend/models/UserRole';
import consultationsRouter from '../../../backend/server/routes/consultations';
import telemedicineRouter from '../../../backend/server/routes/telemedicine';
import { store } from '../../../backend/server/store';
import { consultations } from '../../../backend/services/webrtcService';

const mockSendToUser = jest.fn().mockResolvedValue(1);

jest.mock('../../../backend/middleware/auth', () => ({
  authenticateJWT: (req: any, _res: any, next: any) => {
    req.user = req.headers['x-test-user']
      ? JSON.parse(req.headers['x-test-user'] as string)
      : { id: 'u-demo-1', role: 'owner' };
    next();
  },
}));

jest.mock('../../../backend/services/pushService', () => ({
  sendToUser: (...args: unknown[]) => mockSendToUser(...args),
}));

const app = express();
app.use(express.json());
app.use('/telemedicine', telemedicineRouter);
app.use('/consultations', consultationsRouter);

function futureDate(daysAhead = 30): { date: string; time: string } {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  return {
    date: d.toISOString().slice(0, 10),
    time: '10:00',
  };
}

describe('telemedicine consultation booking flow', () => {
  beforeEach(() => {
    mockSendToUser.mockClear();
  });

  afterEach(() => {
    consultations.clear();
    for (const [id, appointment] of store.appointments) {
      if (appointment.vetId === 'v-telemedicine-route-test') {
        store.appointments.delete(id);
      }
    }
    for (const [id, record] of store.medicalRecords) {
      if (record.vetId === 'v-telemedicine-route-test') {
        store.medicalRecords.delete(id);
      }
    }
  });

  it('links booking, vet notification, join, decision, and note capture', async () => {
    const { date, time } = futureDate();

    const booking = await request(app).post('/telemedicine/appointments').send({
      petId: 'p-demo-1',
      vetId: 'v-telemedicine-route-test',
      date,
      time,
      timeZone: 'UTC',
      durationMinutes: 30,
    });

    expect(booking.status).toBe(201);
    expect(booking.body.data).toEqual(
      expect.objectContaining({
        isTelemedicine: true,
        consultationId: expect.any(String),
        videoCallUrl: expect.any(String),
      }),
    );
    expect(mockSendToUser).toHaveBeenCalledWith(
      'v-telemedicine-route-test',
      'appointment_alerts',
      'New telemedicine request',
      expect.any(String),
      expect.objectContaining({
        type: 'telemedicine_request',
        appointmentId: booking.body.data.id,
        consultationId: booking.body.data.consultationId,
      }),
    );

    const join = await request(app).post(`/consultations/${booking.body.data.consultationId}/join`);

    expect(join.status).toBe(200);
    expect(join.body.data).toEqual(
      expect.objectContaining({
        consultationId: booking.body.data.consultationId,
        roomToken: expect.any(String),
        userId: 'u-demo-1',
        userRole: UserRole.OWNER,
        iceServers: expect.any(Array),
      }),
    );

    const vetHeader = JSON.stringify({ id: 'v-telemedicine-route-test', role: UserRole.VET });
    const decision = await request(app)
      .post(`/consultations/${booking.body.data.consultationId}/decision`)
      .set('x-test-user', vetHeader)
      .send({ decision: 'accepted' });

    expect(decision.status).toBe(200);
    expect(decision.body.data.consultation).toEqual(
      expect.objectContaining({
        id: booking.body.data.consultationId,
        vetDecision: 'accepted',
        vetDecisionAt: expect.any(String),
      }),
    );
    expect(decision.body.data.appointment).toEqual(
      expect.objectContaining({
        id: booking.body.data.id,
        vetDecision: 'accepted',
      }),
    );

    const note = await request(app)
      .post(`/consultations/${booking.body.data.consultationId}/notes`)
      .set('x-test-user', vetHeader)
      .send({
        subjective: 'Owner reports limping after a walk.',
        objective: 'Mild favoring of front left paw on video exam.',
        assessment: 'Likely mild soft tissue strain.',
        plan: 'Rest for 48 hours and follow up if swelling appears.',
      });

    expect(note.status).toBe(201);
    expect(note.body.data.record).toEqual(
      expect.objectContaining({
        petId: 'p-demo-1',
        vetId: 'v-telemedicine-route-test',
        type: 'telemedicine_consultation',
        diagnosis: 'Likely mild soft tissue strain.',
      }),
    );
    expect(note.body.data.appointment).toEqual(
      expect.objectContaining({
        id: booking.body.data.id,
        consultationNoteRecordId: note.body.data.record.id,
      }),
    );
  });
});
