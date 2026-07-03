import {
  exchangeOAuthCode,
  getPolicies,
  getPolicy,
  submitClaim,
  generateClaimSummaryPdf,
  getClaims,
  getClaim,
  type InsurancePolicy,
  type InsuranceClaim,
} from '../insuranceService';

describe('insuranceService', () => {
  const testUserId = 'user-123';
  const testPetId = 'pet-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exchangeOAuthCode', () => {
    it('should create policy from OAuth code', async () => {
      const policy = await exchangeOAuthCode('trupanion', 'auth_code_123', testUserId);

      expect(policy).toBeDefined();
      expect(policy.userId).toBe(testUserId);
      expect(policy.provider).toBe('trupanion');
      expect(policy.status).toBe('active');
    });

    it('should generate unique policy IDs', async () => {
      const policy1 = await exchangeOAuthCode('trupanion', 'code_1', testUserId);
      const policy2 = await exchangeOAuthCode('nationwide', 'code_2', testUserId);

      expect(policy1.id).not.toBe(policy2.id);
    });

    it('should set policy number from OAuth code', async () => {
      const policy = await exchangeOAuthCode('trupanion', 'auth_code_123', testUserId);

      expect(policy.policyNumber).toContain('TRUPANION');
      expect(policy.policyNumber).toContain('AUTH_CODE');
    });

    it('should set default coverage limits', async () => {
      const policy = await exchangeOAuthCode('trupanion', 'code_123', testUserId);

      expect(policy.coverageLimit).toBe(10000);
      expect(policy.deductible).toBe(250);
      expect(policy.premium).toBe(49.99);
    });

    it('should set expiration date one year from now', async () => {
      const beforeTime = new Date();
      beforeTime.setFullYear(beforeTime.getFullYear() + 1);

      const policy = await exchangeOAuthCode('trupanion', 'code_123', testUserId);

      const expiresAt = new Date(policy.expiresAt);
      const expectedTime = new Date(beforeTime);

      // Allow 1 minute tolerance
      expect(Math.abs(expiresAt.getTime() - expectedTime.getTime())).toBeLessThan(60000);
    });

    it('should support multiple providers', async () => {
      const providers = ['trupanion', 'nationwide', 'mock'];

      for (const provider of providers) {
        const policy = await exchangeOAuthCode(provider as any, 'code_123', testUserId);
        expect(policy.provider).toBe(provider);
      }
    });
  });

  describe('getPolicies', () => {
    it('should return all policies for user', async () => {
      await exchangeOAuthCode('trupanion', 'code_1', testUserId);
      await exchangeOAuthCode('nationwide', 'code_2', testUserId);

      const policies = getPolicies(testUserId);

      expect(policies.length).toBe(2);
      expect(policies.every((p) => p.userId === testUserId)).toBe(true);
    });

    it('should return empty array for user with no policies', () => {
      const policies = getPolicies('non-existent-user');

      expect(policies).toEqual([]);
    });

    it('should not include policies from other users', async () => {
      await exchangeOAuthCode('trupanion', 'code_1', testUserId);
      await exchangeOAuthCode('nationwide', 'code_2', 'other-user');

      const policies = getPolicies(testUserId);

      expect(policies.length).toBe(1);
      expect(policies[0].userId).toBe(testUserId);
    });
  });

  describe('getPolicy', () => {
    it('should return specific policy by ID', async () => {
      const created = await exchangeOAuthCode('trupanion', 'code_123', testUserId);
      const retrieved = getPolicy(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.userId).toBe(testUserId);
    });

    it('should return undefined for non-existent policy', () => {
      const policy = getPolicy('non-existent-id');

      expect(policy).toBeUndefined();
    });

    it('should return policy with all fields', async () => {
      const policy = await exchangeOAuthCode('trupanion', 'code_123', testUserId);
      const retrieved = getPolicy(policy.id);

      expect(retrieved).toHaveProperty('id');
      expect(retrieved).toHaveProperty('userId');
      expect(retrieved).toHaveProperty('provider');
      expect(retrieved).toHaveProperty('policyNumber');
      expect(retrieved).toHaveProperty('coverageLimit');
      expect(retrieved).toHaveProperty('deductible');
      expect(retrieved).toHaveProperty('premium');
      expect(retrieved).toHaveProperty('status');
      expect(retrieved).toHaveProperty('expiresAt');
    });
  });

  describe('submitClaim', () => {
    let policyId: string;

    beforeEach(async () => {
      const policy = await exchangeOAuthCode('trupanion', 'code_123', testUserId);
      policyId = policy.id;
    });

    it('should create claim with submitted status', () => {
      const claim = submitClaim(policyId, testUserId, {
        petId: testPetId,
        amount: 500,
        description: 'Veterinary treatment',
      });

      expect(claim).toBeDefined();
      expect(claim.policyId).toBe(policyId);
      expect(claim.userId).toBe(testUserId);
      expect(claim.petId).toBe(testPetId);
      expect(claim.amount).toBe(500);
      expect(claim.status).toBe('submitted');
      expect(claim.statusEvents).toEqual([
        expect.objectContaining({ status: 'submitted', label: 'Submitted' }),
      ]);
    });

    it('should generate unique claim IDs', () => {
      const claim1 = submitClaim(policyId, testUserId, {
        amount: 500,
        description: 'Treatment 1',
      });

      const claim2 = submitClaim(policyId, testUserId, {
        amount: 300,
        description: 'Treatment 2',
      });

      expect(claim1.id).not.toBe(claim2.id);
    });

    it('should handle optional attachment URLs', () => {
      const claim = submitClaim(policyId, testUserId, {
        amount: 500,
        description: 'Treatment',
        attachmentUrls: ['https://example.com/receipt.pdf'],
      });

      expect(claim.attachmentUrls).toEqual(['https://example.com/receipt.pdf']);
    });

    it('should set empty attachments if not provided', () => {
      const claim = submitClaim(policyId, testUserId, {
        amount: 500,
        description: 'Treatment',
      });

      expect(claim.attachmentUrls).toEqual([]);
    });

    it('should set submission timestamp', () => {
      const beforeTime = new Date();
      const claim = submitClaim(policyId, testUserId, {
        amount: 500,
        description: 'Treatment',
      });
      const afterTime = new Date();

      const submittedAt = new Date(claim.submittedAt);
      expect(submittedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(submittedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should transition to under_review after delay', async () => {
      const claim = submitClaim(policyId, testUserId, {
        amount: 500,
        description: 'Treatment',
      });

      expect(claim.status).toBe('submitted');

      // Advance timers to trigger status change
      jest.advanceTimersByTime(6000);

      const updated = getClaim(claim.id);
      expect(updated?.status).toBe('under_review');
      expect(updated?.statusEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: 'submitted' }),
          expect.objectContaining({ status: 'under_review', label: 'Under Review' }),
        ]),
      );
    });

    it('generates a PDF summary for a claim', async () => {
      const claim = submitClaim(policyId, testUserId, {
        amount: 500,
        description: 'Treatment',
        attachmentUrls: ['https://example.com/receipt.pdf'],
      });

      const result = await generateClaimSummaryPdf(claim.id);

      expect(result).not.toBeNull();
      expect(result?.filename).toMatch(/^insurance-claim-.+\.pdf$/);
      expect(result?.buffer.slice(0, 4).toString()).toBe('%PDF');
    });
  });

  describe('getClaims', () => {
    let policyId: string;

    beforeEach(async () => {
      const policy = await exchangeOAuthCode('trupanion', 'code_123', testUserId);
      policyId = policy.id;
    });

    it('should return all claims for user', () => {
      submitClaim(policyId, testUserId, {
        amount: 500,
        description: 'Treatment 1',
      });

      submitClaim(policyId, testUserId, {
        amount: 300,
        description: 'Treatment 2',
      });

      const claims = getClaims(testUserId);

      expect(claims.length).toBe(2);
      expect(claims.every((c) => c.userId === testUserId)).toBe(true);
    });

    it('should return empty array for user with no claims', () => {
      const claims = getClaims('non-existent-user');

      expect(claims).toEqual([]);
    });

    it('should return claims sorted by submission date (newest first)', () => {
      const claim1 = submitClaim(policyId, testUserId, {
        amount: 500,
        description: 'Treatment 1',
      });

      jest.advanceTimersByTime(1000);

      const claim2 = submitClaim(policyId, testUserId, {
        amount: 300,
        description: 'Treatment 2',
      });

      const claims = getClaims(testUserId);

      expect(claims[0].id).toBe(claim2.id);
      expect(claims[1].id).toBe(claim1.id);
    });

    it('should not include claims from other users', async () => {
      submitClaim(policyId, testUserId, {
        amount: 500,
        description: 'Treatment',
      });

      const otherPolicy = await exchangeOAuthCode('nationwide', 'code_456', 'other-user');
      submitClaim(otherPolicy.id, 'other-user', {
        amount: 300,
        description: 'Other treatment',
      });

      const claims = getClaims(testUserId);

      expect(claims.length).toBe(1);
      expect(claims[0].userId).toBe(testUserId);
    });
  });

  describe('getClaim', () => {
    let policyId: string;

    beforeEach(async () => {
      const policy = await exchangeOAuthCode('trupanion', 'code_123', testUserId);
      policyId = policy.id;
    });

    it('should return specific claim by ID', () => {
      const created = submitClaim(policyId, testUserId, {
        amount: 500,
        description: 'Treatment',
      });

      const retrieved = getClaim(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.userId).toBe(testUserId);
    });

    it('should return undefined for non-existent claim', () => {
      const claim = getClaim('non-existent-id');

      expect(claim).toBeUndefined();
    });

    it('should return claim with all fields', () => {
      const created = submitClaim(policyId, testUserId, {
        petId: testPetId,
        amount: 500,
        description: 'Treatment',
        attachmentUrls: ['https://example.com/receipt.pdf'],
      });

      const retrieved = getClaim(created.id);

      expect(retrieved).toHaveProperty('id');
      expect(retrieved).toHaveProperty('policyId');
      expect(retrieved).toHaveProperty('userId');
      expect(retrieved).toHaveProperty('petId');
      expect(retrieved).toHaveProperty('amount');
      expect(retrieved).toHaveProperty('description');
      expect(retrieved).toHaveProperty('status');
      expect(retrieved).toHaveProperty('attachmentUrls');
      expect(retrieved).toHaveProperty('statusEvents');
      expect(retrieved).toHaveProperty('submittedAt');
      expect(retrieved).toHaveProperty('updatedAt');
    });
  });
});
