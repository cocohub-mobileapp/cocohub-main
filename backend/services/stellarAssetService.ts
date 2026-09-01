import * as StellarSdk from '@stellar/stellar-sdk';
import {
  Asset,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
  Horizon,
} from '@stellar/stellar-sdk';

const server = new Horizon.Server(
  process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
);
const networkPassphrase = Networks.TESTNET;

export interface AssetProvenance {
  account: string;
  timestamp: string;
  type: string;
}

export async function issuePetAsset(
  petId: string,
  sourceSeed: string,
  issuerSeed: string,
): Promise<{ assetCode: string; txHash: string }> {
  const sourceKeypair = Keypair.fromSecret(sourceSeed);
  const issuerKeypair = Keypair.fromSecret(issuerSeed);
  const assetCode = `PET${petId.substring(0, 9).toUpperCase()}`;
  const petAsset = new Asset(assetCode, issuerKeypair.publicKey());
  const account = await server.loadAccount(sourceKeypair.publicKey());

  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase })
    .addOperation(Operation.changeTrust({ asset: petAsset, limit: '1' }))
    .addOperation(
      Operation.payment({
        destination: sourceKeypair.publicKey(),
        asset: petAsset,
        amount: '1',
        source: issuerKeypair.publicKey(),
      }),
    )
    .addMemo(Memo.text(`Identity:${petId}`))
    .setTimeout(30)
    .build();

  tx.sign(sourceKeypair);
  tx.sign(issuerKeypair);
  const result = await server.submitTransaction(tx);
  return { assetCode, txHash: result.hash };
}

export async function transferPetAsset(
  assetCode: string,
  issuerPublicKey: string,
  currentOwnerSeed: string,
  newOwnerPublicKey: string,
): Promise<string> {
  const currentOwner = Keypair.fromSecret(currentOwnerSeed);
  const petAsset = new Asset(assetCode, issuerPublicKey);
  const account = await server.loadAccount(currentOwner.publicKey());
  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase })
    .addOperation(
      Operation.payment({ destination: newOwnerPublicKey, asset: petAsset, amount: '1' }),
    )
    .setTimeout(30)
    .build();
  tx.sign(currentOwner);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

export async function getPetProvenance(
  assetCode: string,
  issuerPublicKey: string,
): Promise<AssetProvenance[]> {
  const history: AssetProvenance[] = [];
  try {
    const payments = await server
      .payments()
      .forAsset(new Asset(assetCode, issuerPublicKey))
      .order('desc')
      .call();
    for (const record of payments.records) {
      if (record.type === 'payment') {
        history.push({
          account: record.to,
          timestamp: record.created_at,
          type: 'Ownership Received',
        });
      }
    }
  } catch (error) {
    console.error('[Stellar] Provenance failure:', error);
  }
  return history;
}

export async function setPetAssetFreeze(
  assetCode: string,
  issuerSeed: string,
  targetHolderPublicKey: string,
  freeze: boolean,
): Promise<string | null> {
  try {
    const issuerKeypair = Keypair.fromSecret(issuerSeed);
    const account = await server.loadAccount(issuerKeypair.publicKey());
    const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase })
      .addOperation(
        Operation.setTrustLineFlags({
          trustor: targetHolderPublicKey,
          asset: new Asset(assetCode, issuerKeypair.publicKey()),
          flags: { authorized: !freeze },
        }),
      )
      .setTimeout(30)
      .build();
    tx.sign(issuerKeypair);
    const result = await server.submitTransaction(tx);
    return result.hash;
  } catch (error) {
    console.error('[Stellar] Failed to set pet asset freeze:', error);
    return null;
  }
}

export async function listPetForAdoptionDEX(
  assetCode: string,
  issuerPublicKey: string,
  sellerSeed: string,
  priceInXLM: string,
): Promise<string> {
  const sellerKeypair = Keypair.fromSecret(sellerSeed);
  const account = await server.loadAccount(sellerKeypair.publicKey());
  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase })
    .addOperation(
      Operation.manageSellOffer({
        selling: new Asset(assetCode, issuerPublicKey),
        buying: Asset.native(),
        amount: '1',
        price: priceInXLM,
      }),
    )
    .setTimeout(30)
    .build();
  tx.sign(sellerKeypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}
