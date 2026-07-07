import * as StellarSdk from '@stellar/stellar-sdk';
import axios from 'axios';

import {
  batchVerifyRecords,
  clearBlockchainCache,
  computeRecordHash,
  createStellarAccount,
  fundTestnetAccount,
  getStellarAccountDetails,
  getStellarNetworkInfo,
  getTransactionHistory,
  retrieveRecordHash,
  storeRecordInMedicalRegistryContract,
  storeMedicalRecordOnChain,
  storeRecordOnChain,
  verifyRecordInMedicalRegistryContract,
  verifyMedicalRecordOnChain,
  verifyRecordIntegrity,
  verifyRecordOnChain,
} from '../blockchainService';

jest.mock('axios');
jest.mock('@stellar/stellar-sdk');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('blockchainService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearBlockchainCache();
    // Reset the Stellar server instance
    (StellarSdk.Horizon.Server as jest.Mock).mockClear();
  });

  describe('computeRecordHash', () => {
    it('should compute deterministic hash for record', () => {
      const record = { id: '1', data: 'test' };
      const hash1 = computeRecordHash(record);
      const hash2 = computeRecordHash({ data: 'test', id: '1' });

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should ignore hash/tx metadata fields', () => {
      const record1 = { id: '1', data: 'test' };
      const record2 = { id: '1', data: 'test', hash: 'old-hash', txHash: 'tx-123' };

      expect(computeRecordHash(record1)).toBe(computeRecordHash(record2));
    });
  });

  describe('verifyRecordOnChain', () => {
    it('should return verification result from API', async () => {
      const mockResult = { verified: true, recordId: '1', onChainHash: 'hash123' };
      mockedAxios.post.mockResolvedValue({ data: mockResult });

      const result = await verifyRecordOnChain('1', 'hash123');

      expect(result).toEqual(mockResult);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/blockchain/records/verify'),
        { recordId: '1', hash: 'hash123' },
      );
    });
  });

  describe('verifyRecordIntegrity', () => {
    it('should verify local and on-chain integrity', async () => {
      const record = { id: '1', data: 'test' };
      const realHash = computeRecordHash(record);
      const mockVerifyResult = { verified: true, onChainHash: realHash, recordId: '1' };
      mockedAxios.post.mockResolvedValue({ data: mockVerifyResult });

      const result = await verifyRecordIntegrity({ ...record, recordHash: realHash });

      expect(result.localHashMatchesProvidedHash).toBe(true);
      expect(result.onChainVerified).toBe(true);
    });
  });

  describe('storeRecordOnChain', () => {
    it('should store record on chain', async () => {
      const mockTx = { hash: 'tx123', successful: true };
      mockedAxios.post.mockResolvedValue({ data: mockTx });

      const result = await storeRecordOnChain('record1', 'hash123');

      expect(result).toEqual(mockTx);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/blockchain/records/store'),
        expect.objectContaining({
          recordId: 'record1',
          hash: 'hash123',
        }),
      );
    });

    it('should throw error if recordId is missing', async () => {
      await expect(storeRecordOnChain('', 'hash123')).rejects.toThrow('Record ID is required');
    });

    it('should throw error if hash is missing', async () => {
      await expect(storeRecordOnChain('record1', '')).rejects.toThrow('Record hash is required');
    });
  });

  describe('retrieveRecordHash', () => {
    it('should retrieve record hash from chain', async () => {
      const mockData = { hash: 'hash123', txHash: 'tx123', timestamp: '2024-01-01' };
      mockedAxios.get.mockResolvedValue({ data: mockData });

      const result = await retrieveRecordHash('record1');

      expect(result).toEqual(mockData);
    });

    it('should throw error if recordId is missing', async () => {
      await expect(retrieveRecordHash('')).rejects.toThrow('Record ID is required');
    });
  });

  describe('medical record registry contract', () => {
    const recordHash = 'A'.repeat(64);
    const contractId = 'CCOCOHUBMEDICALREGISTRYTESTNET000000000000000000000000000000';
    const vetAddress = 'GVETADDRESS';

    it('stores a record through the registry contract endpoint', async () => {
      const mockResult = {
        recordId: recordHash.toLowerCase(),
        recordHash: recordHash.toLowerCase(),
        contractId,
        txHash: 'tx123',
        status: 'submitted' as const,
      };
      mockedAxios.post.mockResolvedValue({ data: mockResult });

      const result = await storeRecordInMedicalRegistryContract({
        petId: ' pet-1 ',
        recordHash,
        vetAddress: ` ${vetAddress} `,
        contractId,
      });

      expect(result).toEqual(mockResult);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/blockchain/contracts/medical-record-registry/store'),
        {
          petId: 'pet-1',
          recordHash: recordHash.toLowerCase(),
          vetAddress,
          contractId,
        },
      );
    });

    it('verifies a record through the registry contract endpoint', async () => {
      const mockResult = {
        recordId: recordHash.toLowerCase(),
        verified: true,
        contractId,
      };
      mockedAxios.post.mockResolvedValue({ data: mockResult });

      const result = await verifyRecordInMedicalRegistryContract(recordHash, contractId);

      expect(result).toEqual(mockResult);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/blockchain/contracts/medical-record-registry/verify'),
        {
          recordId: recordHash.toLowerCase(),
          contractId,
        },
      );
    });

    it('rejects malformed record hashes before calling the API', async () => {
      await expect(
        verifyRecordInMedicalRegistryContract('not-a-32-byte-hex-hash', contractId),
      ).rejects.toThrow('Record hash must be a 32-byte hex string');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('requires a contract id before calling the API', async () => {
      await expect(
        storeRecordInMedicalRegistryContract({
          petId: 'pet-1',
          recordHash,
          vetAddress,
          contractId: '',
        }),
      ).rejects.toThrow('Medical record registry contract ID is not configured');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('getTransactionHistory', () => {
    it('should get transaction history', async () => {
      const mockHistory = [{ hash: 'tx1', successful: true }];
      mockedAxios.get.mockResolvedValue({ data: mockHistory });

      const result = await getTransactionHistory('record1');

      expect(result).toEqual(mockHistory);
    });
  });

  describe('getStellarNetworkInfo', () => {
    it('should get network info from Stellar', async () => {
      const mockServer = {
        ledgers: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              call: jest.fn().mockResolvedValue({
                records: [{ sequence: 12345 }],
              }),
            }),
          }),
        }),
      };

      (StellarSdk.Horizon.Server as jest.Mock).mockImplementation(() => mockServer);

      const result = await getStellarNetworkInfo();

      expect(result.network).toBe('TESTNET');
      expect(result.currentLedger).toBe(12345);
    });
  });

  describe('createStellarAccount', () => {
    it('should create a new Stellar keypair', () => {
      const mockKeypair = {
        publicKey: jest.fn().mockReturnValue('GTEST123'),
        secret: jest.fn().mockReturnValue('STEST456'),
      };

      (StellarSdk.Keypair.random as jest.Mock).mockReturnValue(mockKeypair);

      const result = createStellarAccount();

      expect(result.publicKey).toBe('GTEST123');
      expect(result.secretKey).toBe('STEST456');
    });
  });

  describe('getStellarAccountDetails', () => {
    it('should get account details from Stellar', async () => {
      const mockAccount = { id: 'GTEST123', balances: [] };
      const mockLoadAccount = jest.fn().mockResolvedValue(mockAccount);

      (StellarSdk.Horizon.Server as jest.Mock).mockImplementation(() => ({
        loadAccount: mockLoadAccount,
      }));

      const result = await getStellarAccountDetails('GTEST123');

      expect(result).toEqual(mockAccount);
      expect(mockLoadAccount).toHaveBeenCalledWith('GTEST123');
    });

    it('should throw error if account not found', async () => {
      const error = new Error('Not found');
      (error as any).response = { status: 404 };

      const mockLoadAccount = jest.fn().mockRejectedValue(error);

      (StellarSdk.Horizon.Server as jest.Mock).mockImplementation(() => ({
        loadAccount: mockLoadAccount,
      }));
      (axios.isAxiosError as jest.Mock).mockReturnValue(true);

      await expect(getStellarAccountDetails('GTEST123')).rejects.toThrow('Account not found');
    });
  });

  describe('fundTestnetAccount', () => {
    it('should fund testnet account', async () => {
      mockedAxios.get.mockResolvedValue({ data: {} });

      const result = await fundTestnetAccount('GTEST123');

      expect(result).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('friendbot.stellar.org'),
      );
    });
  });

  describe('batchVerifyRecords', () => {
    it('should batch verify multiple records', async () => {
      const mockResults = [
        { verified: true, recordId: '1' },
        { verified: true, recordId: '2' },
      ];
      mockedAxios.post.mockResolvedValue({ data: mockResults });

      const result = await batchVerifyRecords([
        { id: '1', hash: 'hash1' },
        { id: '2', hash: 'hash2' },
      ]);

      expect(result).toEqual(mockResults);
    });

    it('should throw error if records array is empty', async () => {
      await expect(batchVerifyRecords([])).rejects.toThrow(
        'At least one record is required for batch verification',
      );
    });
  });

  describe('storeMedicalRecordOnChain', () => {
    it('should store medical record on chain', async () => {
      const record = { id: 'record1', data: 'test' };
      const mockTx = { hash: 'tx123', successful: true };
      mockedAxios.post.mockResolvedValue({ data: mockTx });

      const result = await storeMedicalRecordOnChain(record);

      expect(result.tx).toEqual(mockTx);
      expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should throw error if record has no id', async () => {
      await expect(storeMedicalRecordOnChain({ data: 'test' } as any)).rejects.toThrow(
        'Valid record with ID is required',
      );
    });
  });

  describe('verifyMedicalRecordOnChain', () => {
    it('should verify medical record on chain', async () => {
      const record = { id: 'record1', data: 'test' };
      const realHash = computeRecordHash(record);
      const mockVerifyResult = { verified: true, onChainHash: realHash, recordId: 'record1' };
      mockedAxios.post.mockResolvedValue({ data: mockVerifyResult });

      const result = await verifyMedicalRecordOnChain(record);

      expect(result.onChainVerified).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully', async () => {
      const error = new Error('Server error');
      (error as any).response = { status: 500, data: { message: 'Server error' } };
      (error as any).isAxiosError = true;

      mockedAxios.post.mockRejectedValueOnce(error);
      (axios.isAxiosError as jest.Mock).mockReturnValue(true);

      await expect(verifyRecordOnChain('test-id', 'test-hash')).rejects.toThrow();
    });
  });
});
