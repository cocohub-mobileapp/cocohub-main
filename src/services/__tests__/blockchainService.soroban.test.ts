import * as StellarSdk from '@stellar/stellar-sdk';
import {
  checkVetAccessOnSoroban,
  clearBlockchainCache,
  DEFAULT_PET_REGISTRY_CONTRACT_ID,
  getOwnerPetsFromSoroban,
  getPetRecordFromSoroban,
  getSorobanRpcServer,
  getVetPetsFromSoroban,
  grantVetAccessOnSoroban,
  hashHexToScVal,
  registerPetRecordOnSoroban,
  revokeVetAccessOnSoroban,
  SOROBAN_RPC_URL,
  updatePetRecordOnSoroban,
} from '../blockchainService';

jest.mock('@stellar/stellar-sdk');

describe('Soroban Pet Record Registry Service', () => {
  const mockOwnerKeypair = {
    publicKey: jest.fn().mockReturnValue('GD6W5F67P6D2M67A5GBOD2H2P57S7EZZ7W57S7EZZ7W57S7EZZ7W57S7'),
    secret: jest.fn().mockReturnValue('SCZANGBA5YHTNYVVV4C3U252E2B6P6OGVU7STKZKT4GIDCVHDOA4AON6'),
    sign: jest.fn(),
  };

  const mockRpcServer = {
    getAccount: jest.fn(),
    prepareTransaction: jest.fn(),
    sendTransaction: jest.fn(),
    simulateTransaction: jest.fn(),
  };

  const mockContract = {
    call: jest.fn(),
  };

  const mockTxBuilder = {
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn(),
  };

  const samplePetId = 'PET_DOG_001';
  const sampleHash = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
  const sampleVetAddress = 'GAVET5F67P6D2M67A5GBOD2H2P57S7EZZ7W57S7EZZ7W57S7EZZ7W57S7VET';

  beforeEach(() => {
    jest.clearAllMocks();
    clearBlockchainCache();

    (StellarSdk.Keypair.fromSecret as jest.Mock).mockReturnValue(mockOwnerKeypair);
    (StellarSdk.Keypair.random as jest.Mock).mockReturnValue(mockOwnerKeypair);
    (StellarSdk.rpc.Server as unknown as jest.Mock).mockImplementation(() => mockRpcServer);
    (StellarSdk.Contract as unknown as jest.Mock).mockImplementation(() => mockContract);
    (StellarSdk.TransactionBuilder as unknown as jest.Mock).mockImplementation(() => mockTxBuilder);
    (StellarSdk.Address as unknown as jest.Mock).mockImplementation((addr: string) => ({
      toScVal: jest.fn().mockReturnValue({ address: addr }),
    }));
    (StellarSdk.Account as unknown as jest.Mock).mockImplementation((addr: string, seq: string) => ({
      accountId: addr,
      sequenceNumber: seq,
    }));

    (StellarSdk.xdr.ScVal.scvSymbol as jest.Mock).mockImplementation((sym: string) => ({
      symbol: sym,
    }));
    (StellarSdk.xdr.ScVal.scvBytes as jest.Mock).mockImplementation((bytes: Buffer) => ({
      bytes,
    }));

    mockContract.call.mockReturnValue({ type: 'invokeHostFunction' });
    mockTxBuilder.build.mockReturnValue({
      toXDR: jest.fn().mockReturnValue('mock-tx-xdr'),
      sign: jest.fn(),
    });
    mockRpcServer.getAccount.mockResolvedValue({
      accountId: mockOwnerKeypair.publicKey(),
      sequenceNumber: '100',
    });
  });

  describe('hashHexToScVal', () => {
    it('should convert valid 64-character hex hash into ScVal bytes', () => {
      const result = hashHexToScVal(sampleHash);
      expect(StellarSdk.xdr.ScVal.scvBytes).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle hex strings with 0x prefix', () => {
      const result = hashHexToScVal(`0x${sampleHash}`);
      expect(StellarSdk.xdr.ScVal.scvBytes).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw error for invalid hash lengths', () => {
      expect(() => hashHexToScVal('tooshort')).toThrow(
        'Hash must be a 32-byte (64 hex characters) string',
      );
    });
  });

  describe('registerPetRecordOnSoroban', () => {
    it('should successfully build, prepare, sign, and submit registration tx', async () => {
      const mockPreparedTx = {
        sign: jest.fn(),
      };
      mockRpcServer.prepareTransaction.mockResolvedValue(mockPreparedTx);
      mockRpcServer.sendTransaction.mockResolvedValue({
        status: 'SUCCESS',
        hash: 'tx-soroban-reg-12345',
      });

      const result = await registerPetRecordOnSoroban({
        ownerSecretKey: mockOwnerKeypair.secret(),
        petId: samplePetId,
        recordHashHex: sampleHash,
      });

      expect(StellarSdk.Keypair.fromSecret).toHaveBeenCalledWith(mockOwnerKeypair.secret());
      expect(mockContract.call).toHaveBeenCalledWith(
        'register_pet_record',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      expect(mockRpcServer.prepareTransaction).toHaveBeenCalled();
      expect(mockPreparedTx.sign).toHaveBeenCalledWith(mockOwnerKeypair);
      expect(mockRpcServer.sendTransaction).toHaveBeenCalledWith(mockPreparedTx);
      expect(result.successful).toBe(true);
      expect(result.hash).toBe('tx-soroban-reg-12345');
    });

    it('should throw validation error when required params are missing', async () => {
      await expect(
        registerPetRecordOnSoroban({
          ownerSecretKey: '',
          petId: samplePetId,
          recordHashHex: sampleHash,
        }),
      ).rejects.toThrow('Owner secret key is required');

      await expect(
        registerPetRecordOnSoroban({
          ownerSecretKey: mockOwnerKeypair.secret(),
          petId: '',
          recordHashHex: sampleHash,
        }),
      ).rejects.toThrow('Pet ID is required');

      await expect(
        registerPetRecordOnSoroban({
          ownerSecretKey: mockOwnerKeypair.secret(),
          petId: samplePetId,
          recordHashHex: '',
        }),
      ).rejects.toThrow('Record hash is required');
    });

    it('should throw error when RPC returns ERROR status', async () => {
      const mockPreparedTx = {
        sign: jest.fn(),
      };
      mockRpcServer.prepareTransaction.mockResolvedValue(mockPreparedTx);
      mockRpcServer.sendTransaction.mockResolvedValue({
        status: 'ERROR',
        errorResult: { toXDR: () => 'tx_failed_xdr' },
      });

      await expect(
        registerPetRecordOnSoroban({
          ownerSecretKey: mockOwnerKeypair.secret(),
          petId: samplePetId,
          recordHashHex: sampleHash,
        }),
      ).rejects.toThrow('Soroban transaction failed');
    });
  });

  describe('updatePetRecordOnSoroban', () => {
    it('should update record hash on-chain', async () => {
      const mockPreparedTx = { sign: jest.fn() };
      mockRpcServer.prepareTransaction.mockResolvedValue(mockPreparedTx);
      mockRpcServer.sendTransaction.mockResolvedValue({
        status: 'SUCCESS',
        hash: 'tx-soroban-upd-12345',
      });

      const result = await updatePetRecordOnSoroban({
        ownerSecretKey: mockOwnerKeypair.secret(),
        petId: samplePetId,
        newRecordHashHex: sampleHash,
      });

      expect(mockContract.call).toHaveBeenCalledWith(
        'update_pet_record',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      expect(result.successful).toBe(true);
      expect(result.hash).toBe('tx-soroban-upd-12345');
    });
  });

  describe('grantVetAccessOnSoroban and revokeVetAccessOnSoroban', () => {
    it('should grant vet access to a pet', async () => {
      const mockPreparedTx = { sign: jest.fn() };
      mockRpcServer.prepareTransaction.mockResolvedValue(mockPreparedTx);
      mockRpcServer.sendTransaction.mockResolvedValue({
        status: 'SUCCESS',
        hash: 'tx-grant-12345',
      });

      const result = await grantVetAccessOnSoroban({
        ownerSecretKey: mockOwnerKeypair.secret(),
        vetAddress: sampleVetAddress,
        petId: samplePetId,
      });

      expect(mockContract.call).toHaveBeenCalledWith(
        'grant_vet_access',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      expect(result.successful).toBe(true);
      expect(result.hash).toBe('tx-grant-12345');
    });

    it('should revoke vet access to a pet', async () => {
      const mockPreparedTx = { sign: jest.fn() };
      mockRpcServer.prepareTransaction.mockResolvedValue(mockPreparedTx);
      mockRpcServer.sendTransaction.mockResolvedValue({
        status: 'SUCCESS',
        hash: 'tx-revoke-12345',
      });

      const result = await revokeVetAccessOnSoroban({
        ownerSecretKey: mockOwnerKeypair.secret(),
        vetAddress: sampleVetAddress,
        petId: samplePetId,
      });

      expect(mockContract.call).toHaveBeenCalledWith(
        'revoke_vet_access',
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      expect(result.successful).toBe(true);
      expect(result.hash).toBe('tx-revoke-12345');
    });
  });

  describe('checkVetAccessOnSoroban', () => {
    it('should simulate check_vet_access call and return boolean result', async () => {
      (StellarSdk.rpc.Api.isSimulationSuccess as unknown as jest.Mock).mockReturnValue(true);
      (StellarSdk.scValToNative as jest.Mock).mockReturnValue(true);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        result: { retval: { type: 'scvBool', value: true } },
      });

      const hasAccess = await checkVetAccessOnSoroban({
        vetAddress: sampleVetAddress,
        petId: samplePetId,
      });

      expect(mockContract.call).toHaveBeenCalledWith(
        'check_vet_access',
        expect.anything(),
        expect.anything(),
      );
      expect(hasAccess).toBe(true);
    });

    it('should return false if simulation fails or returns false', async () => {
      (StellarSdk.rpc.Api.isSimulationSuccess as unknown as jest.Mock).mockReturnValue(false);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        error: 'Simulation failed',
      });

      const hasAccess = await checkVetAccessOnSoroban({
        vetAddress: sampleVetAddress,
        petId: samplePetId,
      });

      expect(hasAccess).toBe(false);
    });
  });

  describe('getPetRecordFromSoroban', () => {
    it('should read record and return typed SorobanPetRecord', async () => {
      (StellarSdk.rpc.Api.isSimulationSuccess as unknown as jest.Mock).mockReturnValue(true);
      (StellarSdk.scValToNative as jest.Mock).mockReturnValue({
        owner: mockOwnerKeypair.publicKey(),
        record_hash: Buffer.from(sampleHash, 'hex'),
        timestamp: 1714000000,
      });

      mockRpcServer.simulateTransaction.mockResolvedValue({
        result: { retval: { type: 'scvMap' } },
      });

      const record = await getPetRecordFromSoroban({
        requesterSecretKey: mockOwnerKeypair.secret(),
        petId: samplePetId,
      });

      expect(record.owner).toBe(mockOwnerKeypair.publicKey());
      expect(record.recordHash).toBe(sampleHash);
      expect(record.timestamp).toBe(1714000000);
    });

    it('should throw error when requester is unauthorized or record not found', async () => {
      (StellarSdk.rpc.Api.isSimulationSuccess as unknown as jest.Mock).mockReturnValue(false);
      mockRpcServer.simulateTransaction.mockResolvedValue({
        error: 'HostError: Unauthorized',
      });

      await expect(
        getPetRecordFromSoroban({
          requesterSecretKey: mockOwnerKeypair.secret(),
          petId: samplePetId,
        }),
      ).rejects.toThrow('Failed to read pet record or unauthorized requester');
    });
  });

  describe('getVetPetsFromSoroban & getOwnerPetsFromSoroban', () => {
    it('should return array of pet IDs for a vet', async () => {
      (StellarSdk.rpc.Api.isSimulationSuccess as unknown as jest.Mock).mockReturnValue(true);
      (StellarSdk.scValToNative as jest.Mock).mockReturnValue(['PET_1', 'PET_2']);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        result: { retval: { type: 'scvVec' } },
      });

      const pets = await getVetPetsFromSoroban({
        vetAddress: sampleVetAddress,
      });

      expect(pets).toEqual(['PET_1', 'PET_2']);
    });

    it('should return array of pet IDs for an owner', async () => {
      (StellarSdk.rpc.Api.isSimulationSuccess as unknown as jest.Mock).mockReturnValue(true);
      (StellarSdk.scValToNative as jest.Mock).mockReturnValue(['PET_DOG_01', 'PET_CAT_02']);

      mockRpcServer.simulateTransaction.mockResolvedValue({
        result: { retval: { type: 'scvVec' } },
      });

      const pets = await getOwnerPetsFromSoroban({
        ownerAddress: mockOwnerKeypair.publicKey(),
      });

      expect(pets).toEqual(['PET_DOG_01', 'PET_CAT_02']);
    });
  });
});
