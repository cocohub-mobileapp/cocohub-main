import { v4 as uuidv4 } from 'uuid';

export type InsuranceProvider = 'trupanion' | 'nationwide' | 'mock';
export type ClaimStatus = 'submitted' | 'under_review' | 'approved' | 'denied';

export interface InsurancePolicy {
  id: string;
  userId: string;
  provider: InsuranceProvider;
  policyNumber: string;
  petId?: string;
  coverageLimit: number;
  deductible: number;
  premium: number;
  status: 'active' | 'expired' | 'cancelled';
  expiresAt: string;
}

export interface InsuranceClaim {
  id: string;
  policyId: string;
  userId: string;
  petId?: string;
  amount: number;
  description: string;
  status: ClaimStatus;
  attachmentUrls: string[];
  submittedAt: string;
  updatedAt: string;
}

// In-memory stores (replace with DB in production)
const policies = new Map<string, InsurancePolicy>();
const claims = new Map<string, InsuranceClaim>();

export function resetStores(): void {
  policies.clear();
  claims.clear();
}

export async function exchangeOAuthCode(
  provider: InsuranceProvider,
  code: string,
  userId: string,
): Promise<InsurancePolicy> {
  const policy: InsurancePolicy = {
    id: uuidv4(),
    userId,
    provider,
    policyNumber: `${provider.toUpperCase()}-${code.slice(0, 16).toUpperCase()}`,
    coverageLimit: 10000,
    deductible: 250,
    premium: 49.99,
    status: 'active',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };
  policies.set(policy.id, policy);
  return policy;
}

export function getPolicies(userId: string): InsurancePolicy[] {
  return [...policies.values()].filter((p) => p.userId === userId);
}

export function getPolicy(policyId: string): InsurancePolicy | undefined {
  return policies.get(policyId);
}

export function submitClaim(
  policyId: string,
  userId: string,
  data: { petId?: string; amount: number; description: string; attachmentUrls?: string[] },
): InsuranceClaim {
  const claim: InsuranceClaim = {
    id: uuidv4(),
    policyId,
    userId,
    petId: data.petId,
    amount: data.amount,
    description: data.description,
    status: 'submitted',
    attachmentUrls: data.attachmentUrls ?? [],
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  claims.set(claim.id, claim);

  // Simulate async status progression (mock)
  setTimeout(() => {
    const c = claims.get(claim.id);
    if (c) {
      c.status = 'under_review';
      c.updatedAt = new Date().toISOString();
    }
  }, 5000);

  return claim;
}

export function getClaims(userId: string): InsuranceClaim[] {
  return [...claims.values()]
    .filter((c) => c.userId === userId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function getClaim(claimId: string): InsuranceClaim | undefined {
  return claims.get(claimId);
}
