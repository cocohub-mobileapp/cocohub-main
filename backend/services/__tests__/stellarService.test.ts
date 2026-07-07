import { StellarAnchorService } from '../stellarService';

jest.mock('../../src/db', () => ({
  query: jest.fn(() => Promise.resolve({ rows: [] })),
}));

jest.mock('@stellar/stellar-sdk', () => {
  const operation = { type: 'invoke-contract' };
  const builtTransaction = { built: true };
  const preparedTransaction = { sign: jest.fn() };
  const mocks = {
    contractCall: jest.fn(() => operation),
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn(() => builtTransaction),
    getAccount: jest.fn(() => Promise.resolve({ accountId: 'GSOURCE' })),
    prepareTransaction: jest.fn(() => Promise.resolve(preparedTransaction)),
    sendTransaction: jest.fn(() =>
      Promise.resolve({
        hash: 'txhash',
        latestLedger: 123,
        status: 'PENDING',
      }),
    ),
    preparedTransaction,
  };

  return {
    __mocks: mocks,
    BASE_FEE: '100',
    Horizon: {
      Server: jest.fn(),
    },
    Keypair: {
      fromSecret: jest.fn(() => ({
        publicKey: () => 'GSOURCE',
      })),
    },
    Networks: {
      PUBLIC: 'Public Global Stellar Network ; September 2015',
      TESTNET: 'Test SDF Network ; September 2015',
    },
    Operation: {
      manageData: jest.fn(() => ({ type: 'manage-data' })),
    },
    Contract: jest.fn().mockImplementation(() => ({
      call: mocks.contractCall,
    })),
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: mocks.addOperation,
      setTimeout: mocks.setTimeout,
      build: mocks.build,
    })),
    nativeToScVal: jest.fn((value: unknown, opts: { type: string }) => ({
      type: opts.type,
      value,
    })),
    rpc: {
      Server: jest.fn().mockImplementation(() => ({
        getAccount: mocks.getAccount,
        prepareTransaction: mocks.prepareTransaction,
        sendTransaction: mocks.sendTransaction,
      })),
    },
    xdr: {
      ScVal: {
        scvBytes: jest.fn((value: Buffer) => ({
          type: 'bytes',
          value,
        })),
      },
    },
  };
});

const { query } = jest.requireMock('../../src/db') as {
  query: jest.Mock;
};

const stellarSdk = jest.requireMock('@stellar/stellar-sdk') as {
  __mocks: {
    contractCall: jest.Mock;
    addOperation: jest.Mock;
    setTimeout: jest.Mock;
    build: jest.Mock;
    getAccount: jest.Mock;
    prepareTransaction: jest.Mock;
    sendTransaction: jest.Mock;
    preparedTransaction: { sign: jest.Mock };
  };
  nativeToScVal: jest.Mock;
  xdr: { ScVal: { scvBytes: jest.Mock } };
};

describe('StellarAnchorService', () => {
  beforeEach(() => {
    query.mockClear();
    query.mockResolvedValue({ rows: [] });
    stellarSdk.__mocks.contractCall.mockClear();
    stellarSdk.__mocks.addOperation.mockClear();
    stellarSdk.__mocks.setTimeout.mockClear();
    stellarSdk.__mocks.build.mockClear();
    stellarSdk.__mocks.getAccount.mockClear();
    stellarSdk.__mocks.prepareTransaction.mockClear();
    stellarSdk.__mocks.sendTransaction.mockClear();
    stellarSdk.__mocks.preparedTransaction.sign.mockClear();
    stellarSdk.nativeToScVal.mockClear();
    stellarSdk.xdr.ScVal.scvBytes.mockClear();
    delete process.env.STELLAR_SOURCE_SECRET;
  });

  it('hashes payloads deterministically with SHA-256', () => {
    const service = new StellarAnchorService();
    const a = service.hashPayload({ b: 2, a: 1 });
    const b = service.hashPayload({ a: 1, b: 2 });

    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('creates pending anchor records when no source secret is configured', async () => {
    const service = new StellarAnchorService();
    const result = await service.anchorRecord({ recordId: 'mr1', payload: { id: 'mr1' } });

    expect(result.status).toBe('pending');
    expect(result.recordHash).toHaveLength(64);
  });

  it('stores registry records as pending when signing material is not configured', async () => {
    const service = new StellarAnchorService();
    const recordHash = 'b'.repeat(64);

    const result = await service.storeMedicalRecordInRegistry({
      petId: 'pet-1',
      recordHash,
      vetAddress: 'GVETADDRESS',
      contractId: 'CCONTRACT',
    });

    expect(result).toEqual({
      recordId: recordHash,
      recordHash,
      contractId: 'CCONTRACT',
      status: 'pending',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO blockchain_transactions'),
      [
        recordHash,
        recordHash,
        `pending-contract:CCONTRACT:${recordHash}`,
        null,
        'pending',
        'testnet',
      ],
    );
  });

  it('verifies registry records from persisted transaction status', async () => {
    const service = new StellarAnchorService();
    const recordHash = 'c'.repeat(64);
    query.mockResolvedValueOnce({
      rows: [
        {
          record_id: recordHash,
          record_hash: recordHash,
          transaction_id: 'submitted-contract:CCONTRACT',
          ledger_sequence: null,
          status: 'submitted',
        },
      ],
    });

    const result = await service.verifyMedicalRecordInRegistry(recordHash, 'CCONTRACT');

    expect(result).toEqual({
      recordId: recordHash,
      verified: true,
      contractId: 'CCONTRACT',
    });
  });

  it('submits store_record through Soroban RPC when signing material is configured', async () => {
    const service = new StellarAnchorService();
    const recordHash = 'd'.repeat(64);

    const result = await service.storeMedicalRecordInRegistry({
      petId: 'pet-1',
      recordHash,
      vetAddress: 'GVETADDRESS',
      contractId: 'CCONTRACT',
      sourceSecret: 'SSECRET',
    });

    expect(stellarSdk.__mocks.contractCall).toHaveBeenCalledWith(
      'store_record',
      { type: 'string', value: 'pet-1' },
      { type: 'bytes', value: Buffer.from(recordHash, 'hex') },
      { type: 'address', value: 'GVETADDRESS' },
    );
    expect(stellarSdk.__mocks.addOperation).toHaveBeenCalledWith({ type: 'invoke-contract' });
    expect(stellarSdk.__mocks.preparedTransaction.sign).toHaveBeenCalled();
    expect(result).toEqual({
      recordId: recordHash,
      recordHash,
      contractId: 'CCONTRACT',
      txHash: 'txhash',
      ledger: 123,
      status: 'submitted',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO blockchain_transactions'),
      [recordHash, recordHash, 'txhash', 123, 'submitted', 'testnet'],
    );
  });
});
