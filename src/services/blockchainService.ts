import { SorobanClient } from'soroban-client';
import { SorobanRpc } from 'soroban-client/dist/rpc';

const sorobanClient = new SorobanClient('https://rpc-futurenet.stellar.org:443/');
const contractId = 'YOUR_CONTRACT_ID_HERE';

export const registerPet = async (owner: string, recordHash: string) => {
    const transaction = sorobanClient.createTransactionBuilder()
        .addOperation(sorobanClient.newOperation().invokeContractFunction({
            function: 'register_pet',
            args: [owner, Buffer.from(recordHash, 'hex')],
            contractId,
        }))
       .setTimeout(300)
       .build();

    const response = await sorobanClient.sendTransaction(transaction);
    return response;
};

export const grantVetAccess = async (petId: number, vet: string) => {
    const transaction = sorobanClient.createTransactionBuilder()
       .addOperation(sorobanClient.newOperation().invokeContractFunction({
            function: 'grant_vet_access',
            args: [petId, vet],
            contractId,
        }))
       .setTimeout(300)
       .build();

    const response = await sorobanClient.sendTransaction(transaction);
    return response;
};

export const revokeVetAccess = async (petId: number) => {
    const transaction = sorobanClient.createTransactionBuilder()
       .addOperation(sorobanClient.newOperation().invokeContractFunction({
            function:'revoke_vet_access',
            args: [petId],
            contractId,
        }))
       .setTimeout(300)
       .build();

    const response = await sorobanClient.sendTransaction(transaction);
    return response;
};

export const getPetRecord = async (petId: number) => {
    const result = await sorobanClient.invoke({
        contractId,
        method: 'get_pet_record',
        params: [petId],
    });
    return result;
};
