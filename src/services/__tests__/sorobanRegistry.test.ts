import * as StellarSdk from '@stellar/stellar-sdk';
import {
  registerPetOnSoroban,
  grantVetAccessOnSoroban,
  anchorRecordOnSoroban,
} from '../blockchainService';

jest.mock('@stellar/stellar-sdk', () => {
  const actual = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...actual,
    rpc: {
      Server: jest.fn().mockImplementation(() => ({
        getAccount: jest.fn().mockResolvedValue({
          sequenceNumber: () => '100',
          accountId: () => 'GOWNER123',
          incrementSequenceNumber: jest.fn(),
        }),
        sendTransaction: jest.fn().mockResolvedValue({
          hash: 'mock_tx_hash_soroban_123',
          status: 'SUCCESS',
        }),
      })),
    },
  };
});

describe('Soroban Pet Record Registry Integration (Issue #28)', () => {
  const dummySecret = StellarSdk.Keypair.random().secret();
  const dummyVetKeypair = StellarSdk.Keypair.random();
  const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';

  it('successfully builds, signs and sends register_pet invocation', async () => {
    const res = await registerPetOnSoroban(dummySecret, 'pet_test_999', contractId);
    expect(res.txHash).toBe('mock_tx_hash_soroban_123');
    expect(res.petId).toBe('pet_test_999');
  });

  it('successfully invokes grant_vet_access', async () => {
    const res = await grantVetAccessOnSoroban(
      dummySecret,
      'pet_test_999',
      dummyVetKeypair.publicKey(),
      contractId,
    );
    expect(res.txHash).toBe('mock_tx_hash_soroban_123');
    expect(res.success).toBe(true);
  });

  it('successfully anchors medical record hash on-chain', async () => {
    const hashHex = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const res = await anchorRecordOnSoroban(
      dummySecret,
      'pet_test_999',
      'rec_vaccine_001',
      hashHex,
      contractId,
    );
    expect(res.txHash).toBe('mock_tx_hash_soroban_123');
    expect(res.recordHash).toBe(hashHex);
  });
});
