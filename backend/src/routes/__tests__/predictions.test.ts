import type { Request, Response, NextFunction } from 'express';

// Mock mlPredictionService before importing the route handler
jest.mock('../../services/mlPredictionService', () => ({
  predictSymptoms: jest.fn(),
  getProvider: jest.fn(() => 'fallback'),
}));

import { postSymptomPrediction } from '../predictions';
import { predictSymptoms } from '../../services/mlPredictionService';

const mockPredictSymptoms = predictSymptoms as jest.MockedFunction<typeof predictSymptoms>;

function mockReq(body: unknown, user?: { id: string; email: string; role: number }): Request {
  return { body, user } as unknown as Request;
}

function mockRes(): Response & {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
} {
  const res: any = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
  return res;
}

describe('POST /predictions/symptoms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    const req = mockReq({ petId: '1', species: 'dog', breed: 'Lab', symptoms: 'lethargic' });
    const res = mockRes();
    await postSymptomPrediction(req as any, res as any, jest.fn() as NextFunction);
    expect(res.statusCode).toBe(401);
    expect((res.body as any).error).toContain('Authentication required');
  });

  it('returns 400 when petId is missing', async () => {
    const req = mockReq(
      { species: 'dog', breed: 'Lab', symptoms: 'lethargic' },
      { id: 'user1', email: 'a@b.c', role: 0 },
    );
    const res = mockRes();
    await postSymptomPrediction(req as any, res as any, jest.fn() as NextFunction);
    expect(res.statusCode).toBe(400);
    expect((res.body as any).error).toContain('petId');
  });

  it('returns 400 when symptoms is too short', async () => {
    const req = mockReq(
      { petId: '1', species: 'dog', breed: 'Lab', symptoms: 'ab' },
      { id: 'user1', email: 'a@b.c', role: 0 },
    );
    const res = mockRes();
    await postSymptomPrediction(req as any, res as any, jest.fn() as NextFunction);
    expect(res.statusCode).toBe(400);
    expect((res.body as any).error).toContain('symptoms');
  });

  it('returns 200 with prediction on valid input', async () => {
    const mockPrediction = {
      probableConditions: [{ condition: 'Test', confidence: 0.8, description: 'desc' }],
      urgency: 'low' as const,
      urgencyReason: 'test',
      recommendedActions: ['action1'],
      disclaimer: 'disclaimer',
    };
    mockPredictSymptoms.mockResolvedValueOnce(mockPrediction);

    const req = mockReq(
      { petId: '1', species: 'dog', breed: 'Lab', symptoms: 'seems tired' },
      { id: 'user1', email: 'a@b.c', role: 0 },
    );
    const res = mockRes();
    await postSymptomPrediction(req as any, res as any, jest.fn() as NextFunction);
    expect(res.statusCode).toBe(200);
    expect((res.body as any).data.urgency).toBe('low');
    expect(res.headers['X-RateLimit-Remaining']).toBe('9');
  });

  it('returns 429 after 10 requests in one day', async () => {
    for (let i = 0; i < 10; i++) {
      const req = mockReq(
        { petId: '1', species: 'dog', breed: 'Lab', symptoms: 'tired' },
        { id: 'rateuser', email: 'a@b.c', role: 0 },
      );
      const res = mockRes();
      mockPredictSymptoms.mockResolvedValueOnce({
        probableConditions: [],
        urgency: 'low',
        urgencyReason: '',
        recommendedActions: [],
        disclaimer: 'd',
      });
      await postSymptomPrediction(req as any, res as any, jest.fn() as NextFunction);
      expect(res.statusCode).toBe(200);
    }

    // 11th request should be rate limited
    const req = mockReq(
      { petId: '1', species: 'dog', breed: 'Lab', symptoms: 'tired' },
      { id: 'rateuser', email: 'a@b.c', role: 0 },
    );
    const res = mockRes();
    await postSymptomPrediction(req as any, res as any, jest.fn() as NextFunction);
    expect(res.statusCode).toBe(429);
    expect((res.body as any).error).toContain('limit');
  });

  it('returns 500 when prediction throws', async () => {
    mockPredictSymptoms.mockRejectedValueOnce(new Error('LLM unavailable'));
    const req = mockReq(
      { petId: '1', species: 'dog', breed: 'Lab', symptoms: 'tired' },
      { id: 'erruser', email: 'a@b.c', role: 0 },
    );
    const res = mockRes();
    await postSymptomPrediction(req as any, res as any, jest.fn() as NextFunction);
    expect(res.statusCode).toBe(500);
    expect((res.body as any).error).toContain('failed');
  });
});
