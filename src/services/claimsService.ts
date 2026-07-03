import { resilientRequest } from './apiClient';

export type ClaimStatus = 'submitted' | 'under_review' | 'approved' | 'denied';

export interface InsurancePolicy {
  id: string;
  provider: string;
  policyNumber: string;
  petId?: string;
  coverageLimit: number;
  deductible: number;
  premium: number;
  status: string;
  expiresAt: string;
}

export interface InsuranceClaim {
  id: string;
  policyId: string;
  petId?: string;
  amount: number;
  description: string;
  status: ClaimStatus;
  attachmentUrls: string[];
  statusEvents?: Array<{
    status: ClaimStatus;
    label: string;
    timestamp: string;
  }>;
  submittedAt: string;
  updatedAt: string;
}

export async function getPolicies(): Promise<InsurancePolicy[]> {
  const res = await resilientRequest<{ data: InsurancePolicy[] }>({
    method: 'GET',
    url: '/insurance/policies',
  });
  return res.data.data;
}

export async function connectProvider(provider: string, code: string): Promise<InsurancePolicy> {
  const res = await resilientRequest<{ data: InsurancePolicy }>({
    method: 'POST',
    url: '/insurance/connect',
    data: { provider, code },
  });
  return res.data.data;
}

export async function getClaims(): Promise<InsuranceClaim[]> {
  const res = await resilientRequest<{ data: InsuranceClaim[] }>({
    method: 'GET',
    url: '/insurance/claims',
  });
  return res.data.data;
}

export async function submitClaim(data: {
  policyId: string;
  petId?: string;
  amount: number;
  description: string;
  attachmentUrls?: string[];
}): Promise<InsuranceClaim> {
  const res = await resilientRequest<{ data: InsuranceClaim }>({
    method: 'POST',
    url: '/insurance/claims',
    data,
  });
  return res.data.data;
}
