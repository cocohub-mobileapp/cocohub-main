import { resilientRequest } from '../apiClient';
import {
  getPolicies,
  getClaims,
  submitClaim,
  connectProvider,
} from '../claimsService';

jest.mock('../apiClient', () => ({
  resilientRequest: jest.fn(),
}));

const mockResilientRequest = resilientRequest as jest.Mock;

describe('claimsService (#42)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches insurance policies', async () => {
    const mockPolicies = [
      { id: 'pol-1', provider: 'HealthyPaws', policyNumber: 'HP-1234', coverageLimit: 5000, deductible: 250, premium: 45, status: 'active', expiresAt: '2027-01-01' },
    ];
    mockResilientRequest.mockResolvedValue({ data: { data: mockPolicies } });

    const result = await getPolicies();
    expect(mockResilientRequest).toHaveBeenCalledWith({ method: 'GET', url: '/insurance/policies' });
    expect(result).toEqual(mockPolicies);
  });

  it('submits a new claim', async () => {
    const newClaimInput = {
      policyId: 'pol-1',
      petId: 'pet-123',
      amount: 450.0,
      description: 'Emergency dental extraction',
      attachmentUrls: ['https://storage.cocohub.app/receipt1.pdf'],
    };

    const mockResponse = {
      id: 'claim-999',
      ...newClaimInput,
      status: 'submitted',
      submittedAt: '2026-10-20T00:00:00Z',
      updatedAt: '2026-10-20T00:00:00Z',
    };
    mockResilientRequest.mockResolvedValue({ data: { data: mockResponse } });

    const result = await submitClaim(newClaimInput);
    expect(mockResilientRequest).toHaveBeenCalledWith({
      method: 'POST',
      url: '/insurance/claims',
      data: newClaimInput,
    });
    expect(result.id).toBe('claim-999');
    expect(result.status).toBe('submitted');
  });

  it('fetches existing claims', async () => {
    const mockClaims = [
      { id: 'c-1', policyId: 'pol-1', amount: 200, description: 'Ear infection', status: 'approved', attachmentUrls: [], submittedAt: '2026-09-01', updatedAt: '2026-09-05' },
    ];
    mockResilientRequest.mockResolvedValue({ data: { data: mockClaims } });

    const result = await getClaims();
    expect(mockResilientRequest).toHaveBeenCalledWith({ method: 'GET', url: '/insurance/claims' });
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('approved');
  });
});
