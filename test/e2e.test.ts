import { SorobanClient } from'soroban-client';
import { SorobanRpc } from'soroban-client/dist/rpc';
import { registerPet, grantVetAccess, revokeVetAccess, getPetRecord } from '../src/services/blockchainService';

const sorobanClient = new SorobanClient('https://rpc-futurenet.stellar.org:443/');
const contractId = 'YOUR_CONTRACT_ID_HERE';

describe('E2E Tests', () => {
    it('should register a pet, grant and revoke vet access, and retrieve the pet record', async () => {
        const owner = 'GABC...'; // Replace with a valid Stellar public key
        const vet = 'GXYZ...'; // Replace with a valid Stellar public key
        const recordHash = '0x123456789ABCDEF'; // Replace with a valid hash

        // Register a pet
        await registerPet(owner, recordHash);

        // Grant vet access
        await grantVetAccess(0, vet);

        // Revoke vet access
        await revokeVetAccess(0);

        // Get pet record
        const petRecord = await getPetRecord(0);
        expect(petRecord).toBeDefined();
        expect(petRecord.owner).toBe(owner);
        expect(petRecord.vet).toBeUndefined();
        expect(Buffer.from(petRecord.record_hash).toString('hex')).toBe(recordHash);
    });
});
