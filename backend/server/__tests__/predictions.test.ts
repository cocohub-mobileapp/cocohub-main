import http from 'http';
import { UserRole } from '../../models/UserRole';
import { createApp } from '../app';
import { store } from '../store';
import { _resetSymptomRateLimits } from '../routes/predictions';

function postJson(
  port: number,
  path: string,
  data: Record<string, any>,
  token?: string,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload).toString(),
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'POST', headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: parsed });
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
    refunds: { create: jest.fn() },
  }));
}, { virtual: true });

jest.mock('../../src/repositories/petRepository', () => ({
  petRepository: {
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    findByOwnerId: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../src/repositories/userRepository', () => ({
  userRepository: {
    findById: jest.fn().mockResolvedValue(null),
  },
}));

describe('POST /api/predictions/symptoms', () => {
  let server: http.Server;
  let port: number;

  const ownerUserId = 'user-owner-123';
  const otherUserId = 'user-other-456';
  const sharedUserId = 'user-shared-789';
  const adminUserId = 'user-admin-999';

  const testPetId = 'pet-symptom-test-1';

  beforeAll((done) => {
    // Setup test users in in-memory store
    store.users.set(ownerUserId, {
      id: ownerUserId,
      email: 'owner@test.com',
      name: 'Pet Owner',
      role: UserRole.OWNER,
      pets: [{ id: testPetId, name: 'Daisy' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEmailVerified: true,
    });

    store.users.set(otherUserId, {
      id: otherUserId,
      email: 'other@test.com',
      name: 'Unrelated User',
      role: UserRole.OWNER,
      pets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEmailVerified: true,
    });

    store.users.set(sharedUserId, {
      id: sharedUserId,
      email: 'shared@test.com',
      name: 'Family Member',
      role: UserRole.OWNER,
      pets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEmailVerified: true,
    });

    store.users.set(adminUserId, {
      id: adminUserId,
      email: 'admin@test.com',
      name: 'Admin User',
      role: UserRole.ADMIN,
      pets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEmailVerified: true,
    });

    // Setup test pet
    store.pets.set(testPetId, {
      id: testPetId,
      name: 'Daisy',
      species: 'dog',
      breed: 'Golden Retriever',
      dateOfBirth: '2021-04-10',
      ownerId: ownerUserId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Setup family sharing for sharedUserId
    (store as any).familySharing = [
      {
        id: 'fs-1',
        petId: testPetId,
        sharedWithUserId: sharedUserId,
        ownerId: ownerUserId,
        permission: 'view',
        status: 'active',
      },
    ];

    const app = createApp();
    server = app.listen(0, () => {
      const addr = server.address();
      if (typeof addr === 'object' && addr) port = addr.port;
      done();
    });
  });

  beforeEach(() => {
    _resetSymptomRateLimits();
  });

  afterAll((done) => {
    store.users.delete(ownerUserId);
    store.users.delete(otherUserId);
    store.users.delete(sharedUserId);
    store.users.delete(adminUserId);
    store.pets.delete(testPetId);
    server.close(() => done());
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await postJson(port, '/api/predictions/symptoms', {
      petId: testPetId,
      symptoms: 'Coughing constantly',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects missing petId with 400', async () => {
    const res = await postJson(
      port,
      '/api/predictions/symptoms',
      { symptoms: 'Coughing continuously' },
      `mock-${ownerUserId}`,
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('petId is required');
  });

  it('rejects invalid or too short symptoms with 400', async () => {
    const res = await postJson(
      port,
      '/api/predictions/symptoms',
      { petId: testPetId, symptoms: 'a' },
      `mock-${ownerUserId}`,
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('at least 3 characters');
  });

  it('returns 404 when pet is not found', async () => {
    const res = await postJson(
      port,
      '/api/predictions/symptoms',
      { petId: 'non-existent-pet', symptoms: 'Limping on right back leg' },
      `mock-${ownerUserId}`,
    );

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when user is not the owner, family shared, or admin', async () => {
    const res = await postJson(
      port,
      '/api/predictions/symptoms',
      { petId: testPetId, symptoms: 'Scratching ears continuously' },
      `mock-${otherUserId}`,
    );

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows pet owner to analyze symptoms and returns 200 with full analysis', async () => {
    const res = await postJson(
      port,
      '/api/predictions/symptoms',
      {
        petId: testPetId,
        symptoms: 'Scratching ears frequently and shaking head with brown smelly discharge',
      },
      `mock-${ownerUserId}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const data = res.body.data;
    expect(data.urgency).toBe('moderate');
    expect(data.urgencyReason).toBeDefined();
    expect(Array.isArray(data.probableConditions)).toBe(true);
    expect(data.probableConditions.length).toBeGreaterThan(0);
    expect(data.probableConditions[0].condition).toContain('Otitis Externa');
    expect(typeof data.probableConditions[0].confidence).toBe('number');
    expect(Array.isArray(data.recommendedActions)).toBe(true);
    expect(data.disclaimer).toContain('AI-assisted triage assessment');
    expect(data.modelVersion).toBeDefined();
  });

  it('allows family sharing member to analyze symptoms', async () => {
    const res = await postJson(
      port,
      '/api/predictions/symptoms',
      {
        petId: testPetId,
        symptoms: 'Ate chocolate bar and is vomiting',
      },
      `mock-${sharedUserId}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.urgency).toBe('emergency');
    expect(res.body.data.probableConditions[0].condition).toContain('Toxic Ingestion');
  });

  it('allows admin user to analyze symptoms for any pet', async () => {
    const res = await postJson(
      port,
      '/api/predictions/symptoms',
      {
        petId: testPetId,
        symptoms: 'Mild dandruff and shedding coat',
      },
      `mock-${adminUserId}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.urgency).toBe('low');
  });

  it('enforces 10 requests/day rate limiting on free tier with 429 and Retry-After header', async () => {
    const token = `mock-${ownerUserId}`;
    const payload = {
      petId: testPetId,
      symptoms: 'Dry cough after visiting dog park',
    };

    // Make 10 successful requests
    for (let i = 0; i < 10; i++) {
      const res = await postJson(port, '/api/predictions/symptoms', payload, token);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }

    // 11th request must be rejected with 429 RATE_LIMITED
    const limitedRes = await postJson(port, '/api/predictions/symptoms', payload, token);
    expect(limitedRes.status).toBe(429);
    expect(limitedRes.body.success).toBe(false);
    expect(limitedRes.body.error.code).toBe('RATE_LIMITED');
    expect(limitedRes.body.error.message).toContain('Daily limit of 10 symptom checks reached');
    expect(limitedRes.headers['retry-after']).toBeDefined();
    expect(Number(limitedRes.headers['retry-after'])).toBeGreaterThan(0);
  });
});
