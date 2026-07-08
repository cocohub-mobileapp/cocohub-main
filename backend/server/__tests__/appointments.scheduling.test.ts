/**
 * Tests for the appointment scheduling system:
 * - Backend route: availability, booking, conflict detection, concurrency,
 *   cancel, reschedule
 * - Client service: dual reminders, calendar sync, reschedule/cancel API
 * - calendarSyncService: permission, create, update, delete
 */

// ─── Backend route tests ──────────────────────────────────────────────────────

import express from 'express';
import request from 'supertest';

import { AppointmentStatus, AppointmentType } from '../../../backend/models/Appointment';
import { UserRole } from '../../../backend/models/UserRole';
import appointmentsRouter from '../../../backend/server/routes/appointments';
import { store } from '../../../backend/server/store';

// Mock auth middleware to inject user
jest.mock('../../../backend/middleware/auth', () => ({
  authenticateJWT: (req: any, _res: any, next: any) => {
    req.user = req.headers['x-test-user']
      ? JSON.parse(req.headers['x-test-user'] as string)
      : { id: 'u-demo-1', role: 'OWNER' };
    next();
  },
}));

jest.mock('../../../backend/middleware/auditLogger', () => ({
  logAuditTrail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../backend/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const app = express();
app.use(express.json());
app.use('/appointments', appointmentsRouter);

const OWNER_HEADER = JSON.stringify({ id: 'u-demo-1', role: UserRole.OWNER });
const ADMIN_HEADER = JSON.stringify({ id: 'u-admin', role: UserRole.ADMIN });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function futureDate(daysAhead = 7): { date: string; time: string } {
  const d = new Date(Date.now() + daysAhead * 86_400_000);
  return {
    date: d.toISOString().slice(0, 10),
    time: '10:00',
  };
}

// ─── GET /availability ────────────────────────────────────────────────────────

describe('GET /appointments/availability', () => {
  it('returns available slots for a vet on a date', async () => {
    const { date } = futureDate(10);
    const res = await request(app)
      .get('/appointments/availability')
      .set('x-test-user', OWNER_HEADER)
      .query({ vetId: 'v-demo-1', date });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.availableSlots)).toBe(true);
    expect(res.body.data.availableSlots.length).toBeGreaterThan(0);
  });

  it('returns 400 when vetId is missing', async () => {
    const res = await request(app)
      .get('/appointments/availability')
      .set('x-test-user', OWNER_HEADER)
      .query({ date: '2026-12-01' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid date format', async () => {
    const res = await request(app)
      .get('/appointments/availability')
      .set('x-test-user', OWNER_HEADER)
      .query({ vetId: 'v-demo-1', date: 'not-a-date' });

    expect(res.status).toBe(400);
  });

  it('excludes already-booked slots', async () => {
    const { date, time } = futureDate(15);
    // Book a slot first
    await request(app)
      .post('/appointments')
      .set('x-test-user', ADMIN_HEADER)
      .send({ petId: 'p-demo-1', vetId: 'v-test-avail', date, time, durationMinutes: 30 });

    const res = await request(app)
      .get('/appointments/availability')
      .set('x-test-user', OWNER_HEADER)
      .query({ vetId: 'v-test-avail', date });

    expect(res.status).toBe(200);
    expect(res.body.data.availableSlots).not.toContain(time);
  });
});

// ─── POST /appointments (booking + conflict detection) ────────────────────────

describe('POST /appointments', () => {
  it('creates an appointment successfully', async () => {
    const { date, time } = futureDate(20);
    const res = await request(app)
      .post('/appointments')
      .set('x-test-user', OWNER_HEADER)
      .send({ petId: 'p-demo-1', vetId: 'v-new-1', date, time });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.status).toBe(AppointmentStatus.PENDING);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/appointments')
      .set('x-test-user', OWNER_HEADER)
      .send({ petId: 'p-demo-1' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid date format', async () => {
    const res = await request(app)
      .post('/appointments')
      .set('x-test-user', OWNER_HEADER)
      .send({ petId: 'p-demo-1', vetId: 'v-new-1', date: 'bad-date', time: '10:00' });

    expect(res.status).toBe(400);
  });

  it('returns 409 when slot is already booked (conflict detection)', async () => {
    const { date, time } = futureDate(25);
    const vetId = 'v-conflict-test';

    // First booking succeeds
    const first = await request(app)
      .post('/appointments')
      .set('x-test-user', ADMIN_HEADER)
      .send({ petId: 'p-demo-1', vetId, date, time, durationMinutes: 30 });
    expect(first.status).toBe(201);

    // Second booking at same slot conflicts
    const second = await request(app)
      .post('/appointments')
      .set('x-test-user', ADMIN_HEADER)
      .send({ petId: 'p-demo-1', vetId, date, time, durationMinutes: 30 });
    expect(second.status).toBe(409);
  });

  it("returns 403 when owner tries to book for another owner's pet", async () => {
    const { date, time } = futureDate(30);
    const res = await request(app)
      .post('/appointments')
      .set('x-test-user', JSON.stringify({ id: 'u-other', role: UserRole.OWNER }))
      .send({ petId: 'p-demo-1', vetId: 'v-new-1', date, time });

    expect(res.status).toBe(403);
  });

  it('returns 400 for non-existent petId', async () => {
    const { date, time } = futureDate(35);
    const res = await request(app)
      .post('/appointments')
      .set('x-test-user', ADMIN_HEADER)
      .send({ petId: 'p-nonexistent', vetId: 'v-new-1', date, time });

    expect(res.status).toBe(400);
  });
});

// ─── POST /appointments/check-conflicts ────────────────────────────────────────

describe('POST /appointments/check-conflicts', () => {
  it('flags back-to-back appointments as a warning', async () => {
    const { date } = futureDate(80);

    const existing = await request(app)
      .post('/appointments')
      .set('x-test-user', ADMIN_HEADER)
      .send({
        petId: 'p-demo-1',
        vetId: 'v-check-back-to-back-source',
        date,
        time: '10:00',
        durationMinutes: 30,
      });
    expect(existing.status).toBe(201);

    const res = await request(app)
      .post('/appointments/check-conflicts')
      .set('x-test-user', ADMIN_HEADER)
      .send({
        petId: 'p-demo-1',
        vetId: 'v-check-back-to-back-next',
        date,
        time: '10:30',
        durationMinutes: 30,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.canSave).toBe(true);
    expect(res.body.data.hasWarning).toBe(true);
    expect(res.body.data.conflicts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'near' })]),
    );
  });

  it('warns when appointments leave less than 30 minutes for travel', async () => {
    const { date } = futureDate(81);

    const existing = await request(app)
      .post('/appointments')
      .set('x-test-user', ADMIN_HEADER)
      .send({
        petId: 'p-demo-1',
        vetId: 'v-check-travel-source',
        date,
        time: '11:00',
        durationMinutes: 30,
      });
    expect(existing.status).toBe(201);

    const res = await request(app)
      .post('/appointments/check-conflicts')
      .set('x-test-user', ADMIN_HEADER)
      .send({
        petId: 'p-demo-1',
        vetId: 'v-check-travel-next',
        date,
        time: '11:40',
        durationMinutes: 30,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.canSave).toBe(true);
    expect(res.body.data.hasWarning).toBe(true);
    expect(res.body.data.reason).toContain('<= 30 min gap');
  });

  it('blocks appointments that overlap across midnight', async () => {
    const { date } = futureDate(82);
    const nextDate = new Date(`${date}T00:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    const existing = await request(app)
      .post('/appointments')
      .set('x-test-user', ADMIN_HEADER)
      .send({
        petId: 'p-demo-1',
        vetId: 'v-check-midnight',
        date,
        time: '23:30',
        durationMinutes: 90,
      });
    expect(existing.status).toBe(201);

    const res = await request(app)
      .post('/appointments/check-conflicts')
      .set('x-test-user', ADMIN_HEADER)
      .send({
        petId: 'p-demo-1',
        vetId: 'v-check-midnight',
        date: nextDate.toISOString().slice(0, 10),
        time: '00:15',
        durationMinutes: 30,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.canSave).toBe(false);
    expect(res.body.data.hasWarning).toBe(false);
    expect(res.body.data.conflicts).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'exact' })]),
    );
  });
});

// ─── Concurrent booking (race condition prevention) ───────────────────────────

describe('Concurrent booking attempts', () => {
  it('only one of two simultaneous bookings for the same slot succeeds', async () => {
    const { date, time } = futureDate(40);
    const vetId = 'v-concurrent';

    const [r1, r2] = await Promise.all([
      request(app)
        .post('/appointments')
        .set('x-test-user', ADMIN_HEADER)
        .send({ petId: 'p-demo-1', vetId, date, time }),
      request(app)
        .post('/appointments')
        .set('x-test-user', ADMIN_HEADER)
        .send({ petId: 'p-demo-1', vetId, date, time }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });
});

// ─── POST /appointments/:id/cancel ────────────────────────────────────────────

describe('POST /appointments/:id/cancel', () => {
  let apptId: string;
  let cancelVetSeq = 0;

  beforeEach(async () => {
    const { date, time } = futureDate(50);
    const vetId = `v-cancel-test-${cancelVetSeq++}`;
    const res = await request(app)
      .post('/appointments')
      .set('x-test-user', OWNER_HEADER)
      .send({ petId: 'p-demo-1', vetId, date, time });
    apptId = res.body.data.id;
  });

  it('cancels an appointment', async () => {
    const res = await request(app)
      .post(`/appointments/${apptId}/cancel`)
      .set('x-test-user', OWNER_HEADER)
      .send({ reason: 'Schedule conflict' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(AppointmentStatus.CANCELLED);
    expect(res.body.data.cancellationReason).toBe('Schedule conflict');
    expect(res.body.data.cancelledAt).toBeDefined();
  });

  it('returns 400 when cancelling an already-cancelled appointment', async () => {
    await request(app).post(`/appointments/${apptId}/cancel`).set('x-test-user', OWNER_HEADER);

    const res = await request(app)
      .post(`/appointments/${apptId}/cancel`)
      .set('x-test-user', OWNER_HEADER);

    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown appointment', async () => {
    const res = await request(app)
      .post('/appointments/nonexistent/cancel')
      .set('x-test-user', OWNER_HEADER);

    expect(res.status).toBe(404);
  });

  it('frees the slot after cancellation', async () => {
    const appt = store.appointments.get(apptId)!;
    await request(app).post(`/appointments/${apptId}/cancel`).set('x-test-user', OWNER_HEADER);

    // Same slot should now be bookable
    const res = await request(app)
      .post('/appointments')
      .set('x-test-user', ADMIN_HEADER)
      .send({ petId: 'p-demo-1', vetId: appt.vetId, date: appt.date, time: appt.time });

    expect(res.status).toBe(201);
  });
});

// ─── POST /appointments/:id/reschedule ────────────────────────────────────────

describe('POST /appointments/:id/reschedule', () => {
  let apptId: string;
  let rescheduleVetSeq = 0;

  beforeEach(async () => {
    const { date, time } = futureDate(60);
    const vetId = `v-reschedule-test-${rescheduleVetSeq++}`;
    const res = await request(app)
      .post('/appointments')
      .set('x-test-user', OWNER_HEADER)
      .send({ petId: 'p-demo-1', vetId, date, time });
    apptId = res.body.data.id;
  });

  it('reschedules to a free slot', async () => {
    const { date, time } = futureDate(65);
    const res = await request(app)
      .post(`/appointments/${apptId}/reschedule`)
      .set('x-test-user', OWNER_HEADER)
      .send({ date, time });

    expect(res.status).toBe(200);
    expect(res.body.data.date).toBe(date);
    expect(res.body.data.time).toBe(time);
    expect(res.body.data.status).toBe(AppointmentStatus.RESCHEDULED);
    expect(res.body.data.rescheduledFrom).toBeDefined();
  });

  it('returns 409 when new slot is already taken', async () => {
    const { date, time } = futureDate(70);
    const vetId = 'v-reschedule-conflict';

    // Book the target slot
    await request(app)
      .post('/appointments')
      .set('x-test-user', ADMIN_HEADER)
      .send({ petId: 'p-demo-1', vetId, date, time });

    // Create appointment to reschedule
    const orig = await request(app)
      .post('/appointments')
      .set('x-test-user', ADMIN_HEADER)
      .send({ petId: 'p-demo-1', vetId, date: futureDate(71).date, time: '14:00' });

    const res = await request(app)
      .post(`/appointments/${orig.body.data.id}/reschedule`)
      .set('x-test-user', ADMIN_HEADER)
      .send({ date, time });

    expect(res.status).toBe(409);
  });

  it('returns 400 when date/time missing', async () => {
    const res = await request(app)
      .post(`/appointments/${apptId}/reschedule`)
      .set('x-test-user', OWNER_HEADER)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when rescheduling a cancelled appointment', async () => {
    await request(app).post(`/appointments/${apptId}/cancel`).set('x-test-user', OWNER_HEADER);

    const { date, time } = futureDate(75);
    const res = await request(app)
      .post(`/appointments/${apptId}/reschedule`)
      .set('x-test-user', OWNER_HEADER)
      .send({ date, time });

    expect(res.status).toBe(400);
  });
});
