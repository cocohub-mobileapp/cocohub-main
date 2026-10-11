import { SorobanClient, Address, Symbol } from '@stellar/stellar-sdk'; // Assumindo uso de SDK compatível

const CONTRACT_ID = "C...YOUR_CONTRACT_ID_HERE..."; // ID do contrato após deploy

export class BlockchainService {
    private client: any; // Representação do cliente Soroban

    constructor(rpcUrl: string) {
        // Inicialização do cliente para Stellar Testnet
        this.client = new SorobanClient(rpcUrl);
    }

    /**
     * Registra um novo pet no contrato Soroban
     */
    async registerPetOnChain(petId: string, recordHash: string, ownerAddress: string): Promise<void> {
        try {
            await this.client.invokeContract({
                contractId: CONTRACT_ID,
                functionName: 'register_pet',
                args: [
                    Symbol.from(petId),
                    this.hexToBytes32(recordHash),
                    Address.from(ownerAddress)
                ],
            });
        } catch (error) {
            console.error("Failed to register pet on Soroban:", error);
            throw error;
        }
    }

    /**
     * Concede acesso a um veterinário
     */
    async grantVetAccess(petId: string, vetAddress: string): Promise<void> {
        try {
            await this.client.invokeContract({
                contractId: CONTRACT_ID,
                functionName: 'grant_vet_access',
                args: [
                    Symbol.from(petId),
                    Address.from(vetAddress)
                ],
            });
        } catch (error) {
            console.error("Failed to grant vet access:", error);
            throw error;
        }
    }

    /**
     * Busca o hash do registro do pet
     */
    async getPetRecord(petId: string, callerAddress: string): Promise<string> {
        try {
            const result = await this.client.invokeContract({
                contractId: CONTRACT_ID,
                functionName: 'get_pet_record',
                args: [
                    Symbol.from(petId),
                    Address.from(callerAddress)
                ],
            });
            return this.bytes32ToHex(result);
        } catch (error) {
            console.error("Failed to fetch pet record:", error);
            throw error;
        }
    }

    private hexToBytes32(hex: string): Uint8Array {
        const bytes = new Uint8Array(32);
        const cleanHex = hex.replace(/^0x/, '');
        for (let i = 0; i < 64; i += 2) {
            bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
        }
        return bytes;
    }

    private bytes32ToHex(bytes: Uint8Array): string {
        return '0x' + Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
}
