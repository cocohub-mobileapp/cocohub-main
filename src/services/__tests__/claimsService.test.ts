import { resilientRequest } from '../apiClient';
import {
  getPolicies,
  connectProvider,
  getClaims,
  submitClaim,
  type InsurancePolicy,
  type InsuranceClaim,
} from '../claimsService';

jest.mock('../apiClient', () => ({
  resilientRequest: jest.fn(),
}));

const mockResilientRequest = resilientRequest as jest.Mock;

describe('claimsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPolicies', () => {
    it('fetches insurance policies successfully', async () => {
      const mockPolicies: InsurancePolicy[] = [
        {
          id: 'pol-1',
          provider: 'trupanion',
          policyNumber: 'TRUP-12345',
          petId: 'pet-1',
          coverageLimit: 10000,
          deductible: 250,
          premium: 45,
          status: 'active',
          expiresAt: '2027-01-01T00:00:00.000Z',
        },
      ];

      mockResilientRequest.mockResolvedValueOnce({
        data: { data: mockPolicies },
      });

      const result = await getPolicies();
      expect(result).toEqual(mockPolicies);
      expect(mockResilientRequest).toHaveBeenCalledWith({
        method: 'GET',
        url: '/insurance/policies',
      });
    });

    it('propagates error when request fails', async () => {
      mockResilientRequest.mockRejectedValueOnce(new Error('Network error'));
      await expect(getPolicies()).rejects.toThrow('Network error');
    });
  });

  describe('connectProvider', () => {
    it('exchanges provider oauth code for policy', async () => {
      const mockPolicy: InsurancePolicy = {
        id: 'pol-2',
        provider: 'nationwide',
        policyNumber: 'NW-98765',
        petId: 'pet-2',
        coverageLimit: 5000,
        deductible: 100,
        premium: 35,
        status: 'active',
        expiresAt: '2027-01-01T00:00:00.000Z',
      };

      mockResilientRequest.mockResolvedValueOnce({
        data: { data: mockPolicy },
      });

      const result = await connectProvider('nationwide', 'oauth-auth-code');
      expect(result).toEqual(mockPolicy);
      expect(mockResilientRequest).toHaveBeenCalledWith({
        method: 'POST',
        url: '/insurance/connect',
        data: { provider: 'nationwide', code: 'oauth-auth-code' },
      });
    });
  });

  describe('getClaims', () => {
    it('retrieves user insurance claims', async () => {
      const mockClaims: InsuranceClaim[] = [
        {
          id: 'claim-1',
          policyId: 'pol-1',
          petId: 'pet-1',
          amount: 250,
          description: 'Ear infection treatment',
          status: 'submitted',
          attachmentUrls: ['https://example.com/receipt.pdf'],
          submittedAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-01T00:00:00.000Z',
        },
      ];

      mockResilientRequest.mockResolvedValueOnce({
        data: { data: mockClaims },
      });

      const result = await getClaims();
      expect(result).toEqual(mockClaims);
      expect(mockResilientRequest).toHaveBeenCalledWith({
        method: 'GET',
        url: '/insurance/claims',
      });
    });
  });

  describe('submitClaim', () => {
    it('posts new claim with description, amount, and attachments', async () => {
      const input = {
        policyId: 'pol-1',
        petId: 'pet-1',
        amount: 350.5,
        description: 'Vaccination and annual checkup',
        attachmentUrls: ['https://example.com/receipt1.pdf', 'https://example.com/itemized2.pdf'],
      };

      const mockCreatedClaim: InsuranceClaim = {
        id: 'claim-created-123',
        ...input,
        status: 'submitted',
        submittedAt: '2026-03-01T12:00:00.000Z',
        updatedAt: '2026-03-01T12:00:00.000Z',
      };

      mockResilientRequest.mockResolvedValueOnce({
        data: { data: mockCreatedClaim },
      });

      const result = await submitClaim(input);
      expect(result).toEqual(mockCreatedClaim);
      expect(mockResilientRequest).toHaveBeenCalledWith({
        method: 'POST',
        url: '/insurance/claims',
        data: input,
      });
    });

    it('submits claim without attachments when not provided', async () => {
      const input = {
        policyId: 'pol-1',
        amount: 120,
        description: 'Basic blood test',
      };

      const mockCreatedClaim: InsuranceClaim = {
        id: 'claim-created-456',
        ...input,
        status: 'submitted',
        attachmentUrls: [],
        submittedAt: '2026-03-01T12:00:00.000Z',
        updatedAt: '2026-03-01T12:00:00.000Z',
      };

      mockResilientRequest.mockResolvedValueOnce({
        data: { data: mockCreatedClaim },
      });

      const result = await submitClaim(input);
      expect(result).toEqual(mockCreatedClaim);
      expect(mockResilientRequest).toHaveBeenCalledWith({
        method: 'POST',
        url: '/insurance/claims',
        data: input,
      });
    });
  });
});
