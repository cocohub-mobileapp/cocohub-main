import express from 'express';
import request from 'supertest';

import { UserRole } from '../../../backend/models/UserRole';
import predictionsRouter, {
  _resetSymptomPredictionUsageForTest,
} from '../../../backend/server/routes/predictions';

jest.mock('../../../backend/middleware/auth', () => ({
  authenticateJWT: (req: any, _res: any, next: any) => {
    req.user = req.headers['x-test-user']
      ? JSON.parse(req.headers['x-test-user'] as string)
      : { id: 'u-demo-1', role: 'owner' };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/predictions', predictionsRouter);

describe('predictions routes', () => {
  beforeEach(() => {
    _resetSymptomPredictionUsageForTest();
  });

  it('returns symptom triage for the authenticated pet owner', async () => {
    const res = await request(app).post('/predictions/symptoms').send({
      petId: 'p-demo-1',
      species: 'dog',
      breed: 'Mixed',
      symptoms: 'Vomiting repeatedly this morning and not eating.',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        petId: 'p-demo-1',
        ownerId: 'u-demo-1',
        urgency: expect.any(String),
        probableConditions: expect.arrayContaining([
          expect.objectContaining({
            condition: expect.any(String),
            confidence: expect.any(Number),
            description: expect.any(String),
          }),
        ]),
        recommendedActions: expect.any(Array),
        disclaimer: expect.stringContaining('not veterinary advice'),
      }),
    );
  });

  it('blocks owners from analysing another owner pet', async () => {
    const res = await request(app)
      .post('/predictions/symptoms')
      .set('x-test-user', JSON.stringify({ id: 'u-other', role: UserRole.OWNER }))
      .send({
        petId: 'p-demo-1',
        symptoms: 'Vomiting repeatedly this morning.',
      });

    expect(res.status).toBe(403);
  });

  it('limits free symptom checks to ten per user per day', async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post('/predictions/symptoms')
        .send({
          petId: 'p-demo-1',
          symptoms: `Vomiting and not eating example ${i}`,
        });
      expect(res.status).toBe(200);
    }

    const limited = await request(app).post('/predictions/symptoms').send({
      petId: 'p-demo-1',
      symptoms: 'Vomiting and not eating after previous checks.',
    });

    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  });
});
