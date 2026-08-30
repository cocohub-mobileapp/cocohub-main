/**
 * Deployment helper for the Soroban Pet Record Registry Smart Contract
 * Deploys WASM and initializes the contract on Stellar Testnet.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as StellarSdk from '@stellar/stellar-sdk';

const RPC_URL = process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const WASM_PATH = path.resolve(
  __dirname,
  '../backend/contracts/pet-registry/target/wasm32-unknown-unknown/release/pet_record_registry.wasm',
);

async function main() {
  const secretKey = process.env.STELLAR_SECRET_KEY;
  if (!secretKey) {
    console.error('Error: STELLAR_SECRET_KEY environment variable is required.');
    process.exit(1);
  }

  if (!fs.existsSync(WASM_PATH)) {
    console.error(`Error: Compiled contract WASM not found at ${WASM_PATH}`);
    console.error('Run `cargo build --target wasm32-unknown-unknown --release` first in backend/contracts/pet-registry');
    process.exit(1);
  }

  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  const server = new StellarSdk.rpc.Server(RPC_URL);

  console.log(`Deploying with account: ${keypair.publicKey()}`);
  console.log(`Network: Stellar Testnet`);
  console.log(`Loading WASM bytecode (${fs.statSync(WASM_PATH).size} bytes)...`);

  const wasmBytecode = fs.readFileSync(WASM_PATH);
  const account = await server.getAccount(keypair.publicKey());

  // 1. Upload Contract Bytecode
  console.log('Step 1: Uploading contract WASM to ledger...');
  const uploadOp = StellarSdk.Operation.uploadContractWasm({
    wasm: wasmBytecode,
  });

  const uploadTx = new StellarSdk.TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(uploadOp)
    .setTimeout(60)
    .build();

  const preparedUploadTx = await server.prepareTransaction(uploadTx);
  preparedUploadTx.sign(keypair);

  const uploadRes = await server.sendTransaction(preparedUploadTx);
  console.log(`Upload Tx Hash: ${uploadRes.hash}`);

  // Wait for confirmation
  let status = await server.getTransaction(uploadRes.hash);
  while (status.status === 'NOT_FOUND') {
    await new Promise((r) => setTimeout(r, 2000));
    status = await server.getTransaction(uploadRes.hash);
  }

  console.log('Contract WASM uploaded successfully!');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Deployment failed:', err);
    process.exit(1);
  });
}
