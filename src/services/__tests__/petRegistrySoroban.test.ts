import {
  storePetRecordOnSoroban,
  grantVetAccessOnSoroban,
  revokeVetAccessOnSoroban,
  hasVetAccessOnSoroban,
  BlockchainServiceError,
} from '../blockchainService';

describe('Soroban Pet Registry Service Integration (#28)', () => {
  const OWNER_PK = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  const VET_PK = 'GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57';
  const PET_ID = 'pet_milo_882';
  const RECORD_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

  it('stores pet record hash on Soroban contract', async () => {
    const res = await storePetRecordOnSoroban(PET_ID, RECORD_HASH, OWNER_PK);
    expect(res.petId).toBe(PET_ID);
    expect(res.recordHash).toBe(RECORD_HASH);
    expect(res.owner).toBe(OWNER_PK);
    expect(typeof res.updatedAt).toBe('number');
  });

  it('rejects storing record when petId is missing', async () => {
    await expect(storePetRecordOnSoroban('', RECORD_HASH, OWNER_PK)).rejects.toThrow(
      BlockchainServiceError
    );
  });

  it('grants and revokes vet read access', async () => {
    const grant = await grantVetAccessOnSoroban(PET_ID, VET_PK, OWNER_PK);
    expect(grant.granted).toBe(true);

    const check = await hasVetAccessOnSoroban(PET_ID, VET_PK);
    expect(check).toBe(true);

    const revoke = await revokeVetAccessOnSoroban(PET_ID, VET_PK, OWNER_PK);
    expect(revoke.revoked).toBe(true);
  });
});
