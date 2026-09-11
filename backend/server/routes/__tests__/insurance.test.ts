import express from 'express';
import request from 'supertest';
import insuranceRouter from '../insurance';
import { resetStores } from '../../../services/insuranceService';

jest.mock('../../../middleware/auth', () => ({
  authenticateJWT: (req: any, res: any, next: any) => {
    req.user = {
      id: req.headers['x-user-id'] || 'test-user-1',
      role: 'owner',
    };
    next();
  },
}));

const app = express();
app.use(express.json());
app.use('/api/insurance', insuranceRouter);

describe('Insurance Routes Integration Tests', () => {
  beforeEach(() => {
    resetStores();
  });

  describe('GET /api/insurance/policies', () => {
    it('returns empty policies list initially for a user', async () => {
      const res = await request(app).get('/api/insurance/policies').set('x-user-id', 'test-user-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('POST /api/insurance/connect', () => {
    it('connects an insurance provider using oauth code', async () => {
      const res = await request(app)
        .post('/api/insurance/connect')
        .set('x-user-id', 'test-user-1')
        .send({
          provider: 'trupanion',
          code: 'OAUTH_AUTH_CODE_123',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        userId: 'test-user-1',
        provider: 'trupanion',
        status: 'active',
      });
      expect(res.body.data.id).toBeDefined();
    });

    it('rejects unsupported insurance provider', async () => {
      const res = await request(app)
        .post('/api/insurance/connect')
        .set('x-user-id', 'test-user-1')
        .send({
          provider: 'unsupported-provider',
          code: 'OAUTH_AUTH_CODE_123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects missing code', async () => {
      const res = await request(app)
        .post('/api/insurance/connect')
        .set('x-user-id', 'test-user-1')
        .send({
          provider: 'trupanion',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/insurance/claims & GET /api/insurance/claims', () => {
    let policyId: string;

    beforeEach(async () => {
      const connectRes = await request(app)
        .post('/api/insurance/connect')
        .set('x-user-id', 'test-user-1')
        .send({
          provider: 'trupanion',
          code: 'OAUTH_CODE_FOR_POLICY',
          petId: 'pet-test-1',
        });
      policyId = connectRes.body.data.id;
    });

    it('submits a claim with description, amount, and attachments end-to-end', async () => {
      const claimPayload = {
        policyId,
        petId: 'pet-test-1',
        amount: 250.75,
        description: 'Vaccination and annual wellness exam',
        attachmentUrls: [
          'https://example.com/receipt.pdf',
          'https://example.com/itemized-bill.pdf',
        ],
      };

      const submitRes = await request(app)
        .post('/api/insurance/claims')
        .set('x-user-id', 'test-user-1')
        .send(claimPayload);

      expect(submitRes.status).toBe(201);
      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.data).toMatchObject({
        policyId,
        petId: 'pet-test-1',
        amount: 250.75,
        description: 'Vaccination and annual wellness exam',
        status: 'submitted',
        attachmentUrls: [
          'https://example.com/receipt.pdf',
          'https://example.com/itemized-bill.pdf',
        ],
      });
      expect(submitRes.body.data.id).toBeDefined();
      expect(submitRes.body.data.submittedAt).toBeDefined();

      const claimId = submitRes.body.data.id;

      const getClaimsRes = await request(app)
        .get('/api/insurance/claims')
        .set('x-user-id', 'test-user-1');

      expect(getClaimsRes.status).toBe(200);
      expect(getClaimsRes.body.success).toBe(true);
      expect(getClaimsRes.body.data).toHaveLength(1);
      expect(getClaimsRes.body.data[0].id).toBe(claimId);

      const getByIdRes = await request(app)
        .get(`/api/insurance/claims/${claimId}`)
        .set('x-user-id', 'test-user-1');

      expect(getByIdRes.status).toBe(200);
      expect(getByIdRes.body.success).toBe(true);
      expect(getByIdRes.body.data.id).toBe(claimId);
    });

    it('rejects claim for a policy that belongs to another user', async () => {
      const submitRes = await request(app)
        .post('/api/insurance/claims')
        .set('x-user-id', 'unauthorized-user')
        .send({
          policyId,
          amount: 100,
          description: 'X-ray',
        });

      expect(submitRes.status).toBe(404);
      expect(submitRes.body.success).toBe(false);
    });

    it('rejects claim with non-positive amount', async () => {
      const submitRes = await request(app)
        .post('/api/insurance/claims')
        .set('x-user-id', 'test-user-1')
        .send({
          policyId,
          amount: -50,
          description: 'Consultation',
        });

      expect(submitRes.status).toBe(400);
      expect(submitRes.body.success).toBe(false);
    });

    it('rejects claim with empty description', async () => {
      const submitRes = await request(app)
        .post('/api/insurance/claims')
        .set('x-user-id', 'test-user-1')
        .send({
          policyId,
          amount: 150,
          description: '   ',
        });

      expect(submitRes.status).toBe(400);
      expect(submitRes.body.success).toBe(false);
    });

    it('returns 404 for unknown claim id', async () => {
      const res = await request(app)
        .get('/api/insurance/claims/non-existent-claim')
        .set('x-user-id', 'test-user-1');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
