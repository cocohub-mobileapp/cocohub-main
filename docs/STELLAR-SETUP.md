# Stellar Testnet Setup for Local Development

Cocohub anchors pet health record hashes on Stellar. Local development should use the Stellar testnet only: testnet accounts are free, Friendbot can fund them, and the ledger resets periodically.

This guide covers the local setup needed to create a testnet account, fund it, configure Cocohub, and test the `blockchainService.ts` record flow end to end.

## Useful links

- Stellar Laboratory: <https://laboratory.stellar.org>
- Testnet Friendbot: <https://friendbot.stellar.org>
- Testnet Horizon: <https://horizon-testnet.stellar.org>
- Freighter wallet: <https://www.freighter.app>
- Stellar docs: <https://developers.stellar.org/docs>

## 1. Install Freighter and switch to testnet

1. Install the Freighter browser extension from <https://www.freighter.app>.
2. Create or import a wallet.
3. Open Freighter settings and switch the network to **Testnet**.
4. Copy the public key. It starts with `G...`.

Keep the secret key private. Never commit a secret key to git or paste it in a public issue/PR.

## 2. Create a testnet keypair

You can create a keypair in either Freighter or Stellar Laboratory.

### Option A: Freighter

1. In Freighter, create a new testnet account.
2. Copy the public key from the account details screen.
3. Export the secret key only if you need to run local signing flows from the backend or scripts.

### Option B: Stellar Laboratory

1. Open <https://laboratory.stellar.org/#account-creator?network=test>.
2. Click **Generate keypair**.
3. Save the public key and secret key somewhere local and private, such as a password manager.

## 3. Fund the account with Friendbot

Friendbot gives testnet XLM to a testnet public key.

### Browser flow

Open this URL after replacing `<PUBLIC_KEY>` with your `G...` key:

```text
https://friendbot.stellar.org?addr=<PUBLIC_KEY>
```

A successful response includes a transaction hash.

### CLI flow

```bash
PUBLIC_KEY="G..."
curl "https://friendbot.stellar.org?addr=${PUBLIC_KEY}"
```

Confirm the account exists on Horizon:

```bash
curl "https://horizon-testnet.stellar.org/accounts/${PUBLIC_KEY}" | jq '.id, .balances'
```

## 4. Configure Cocohub for testnet

Create your local environment file if you have not already:

```bash
cp .env.example .env.development
```

Use testnet values for Stellar-related configuration:

```dotenv
STELLAR_NETWORK=TESTNET
STELLAR_SOURCE_SECRET=S...
COCOHUB_ISSUER_PUBLIC_KEY=G...
```

Notes:

- `STELLAR_NETWORK=TESTNET` keeps local development pointed at `https://horizon-testnet.stellar.org`.
- `STELLAR_SOURCE_SECRET` is only needed for flows that sign and submit transactions from a local source account.
- `COCOHUB_ISSUER_PUBLIC_KEY` is used by token/trustline flows such as PETC, VETH, and PAWP.
- The current app-side `src/services/blockchainService.ts` defaults to testnet and uses `fundTestnetAccount`, `getStellarNetworkInfo`, `getStellarAccountDetails`, `storeDataOnStellar`, and `sendPayment` for local/testnet workflows.

## 5. Run the app and backend

Install dependencies and start local services:

```bash
npm install --legacy-peer-deps
docker-compose up
npm run migrate
npm run seed:dev
```

Start the app:

```bash
npx expo start --web
# or
npx expo start
```

After seeding, the demo owner login is:

```text
Email: owner1@example.com
Password: Password123!
```

## 6. Test `blockchainService.ts` locally

Run the focused blockchain service tests first:

```bash
npm test -- src/services/__tests__/blockchainService.test.ts --runInBand
npm test -- src/services/__tests__/blockchainService.circuitBreaker.test.ts --runInBand
```

If you need to manually smoke-test Horizon connectivity from the app service, use the exported service functions in a temporary local script or debugger session:

```ts
import {
  createStellarAccount,
  fundTestnetAccount,
  getStellarAccountDetails,
  getStellarNetworkInfo,
} from './src/services/blockchainService';

async function smokeTest() {
  const network = await getStellarNetworkInfo();
  console.log(network.network, network.horizonUrl, network.currentLedger);

  const account = createStellarAccount();
  await fundTestnetAccount(account.publicKey);

  const details = await getStellarAccountDetails(account.publicKey);
  console.log(details.id, details.balances);
}

void smokeTest();
```

Expected result:

- `network` is `TESTNET`.
- Horizon URL is `https://horizon-testnet.stellar.org`.
- Friendbot funds the generated account.
- `getStellarAccountDetails` returns balances for the new account.

## 7. Test record hash storage/verification flow

Cocohub stores hashes and references on-chain, not private medical data.

For a local end-to-end pass:

1. Sign in with the seeded owner account.
2. Create or open a pet medical record.
3. Trigger the record verification/share flow that calls `medicalRecordService` and `blockchainService`.
4. Confirm the UI shows a transaction hash or verified status.
5. Open the transaction hash in Stellar Laboratory or Horizon testnet.
6. Confirm the transaction is on testnet and contains only a hash/reference payload, not pet medical content.

If you need a lower-level transaction check, use `storeDataOnStellar(sourceSecret, dataName, dataValue)` with a non-sensitive test value:

```ts
await storeDataOnStellar(
  process.env.STELLAR_SOURCE_SECRET!,
  'cocohub-test-record',
  'sha256:local-development-smoke-test',
);
```

Then search the source account on Stellar Laboratory testnet and inspect the submitted `manage_data` operation.

## Troubleshooting

### Friendbot says the account is already funded

That is fine. Continue with the existing testnet balance.

### Horizon returns account not found

The account has not been funded, the public key is wrong, or Freighter/Laboratory is on the wrong network. Make sure the key starts with `G` and fund it through Friendbot on testnet.

### Freighter transaction prompts fail

Check that Freighter is on **Testnet**, refresh the app, and verify the connected public key matches your local test account.

### Tests fail because dependencies are not installed

Run:

```bash
npm install --legacy-peer-deps
```

The repository currently uses React Navigation versions that require legacy peer dependency resolution during local install.

### Never use mainnet secrets locally

Do not set `STELLAR_NETWORK=PUBLIC` or use a funded mainnet secret key in local development. Testnet is enough for Cocohub feature work and bounty validation.
