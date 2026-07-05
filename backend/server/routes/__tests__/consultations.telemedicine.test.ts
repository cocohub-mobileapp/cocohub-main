import express from 'express';
import request from 'supertest';

import { UserRole } from '../../../models/UserRole';
import consultationsRouter from '../consultations';
import telemedicineRouter from '../telemedicine';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/telemedicine', telemedicineRouter);
  app.use('/api/consultations', consultationsRouter);
  return app;
}

describe('telemedicine consultations', () => {
  it('creates a telemedicine appointment with a joinable WebRTC room', async () => {
    const app = makeApp();
    const date = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

    const scheduled = await request(app)
      .post('/api/telemedicine/appointments')
      .set('Authorization', 'Bearer mock-u-demo-1')
      .send({
        petId: 'p-demo-1',
        vetId: 'v-demo-1',
        date,
        time: '10:00',
        timeZone: 'UTC',
      })
      .expect(201);

    expect(scheduled.body.data.consultationId).toEqual(expect.any(String));

    const joined = await request(app)
      .post(`/api/consultations/${scheduled.body.data.consultationId}/join`)
      .set('Authorization', 'Bearer mock-u-demo-1')
      .send({})
      .expect(200);

    expect(joined.body.data).toEqual(
      expect.objectContaining({
        consultationId: scheduled.body.data.consultationId,
        roomToken: expect.any(String),
        userId: 'u-demo-1',
        userRole: UserRole.OWNER,
      }),
    );
    expect(Array.isArray(joined.body.data.iceServers)).toBe(true);
  });
});
