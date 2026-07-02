# Stellar Testnet Setup

This guide explains how to create a Stellar testnet account, fund it with Friendbot, configure Cocohub for local testnet work, and verify the `blockchainService.ts` flow end to end.

Use testnet accounts only for local development. Never commit secret keys, mainnet seeds, or wallet recovery phrases.

## Prerequisites

- Node.js 18 or newer
- Project dependencies installed with `npm install --legacy-peer-deps`
- A local `.env.development` file copied from `.env.example`
- Internet access to Stellar Laboratory, Friendbot, and Horizon testnet

## 1. Create A Testnet Keypair

You can create a keypair with Stellar Laboratory:

- Stellar Laboratory keypair generator: https://laboratory.stellar.org/#account-creator?network=test

You can also create one from the project checkout:

```bash
node -e "const { Keypair } = require('@stellar/stellar-sdk'); const kp = Keypair.random(); console.log('STELLAR_PUBLIC_KEY=' + kp.publicKey()); console.log('STELLAR_SOURCE_SECRET=' + kp.secret());"
```

Save both values locally:

- `STELLAR_PUBLIC_KEY` starts with `G` and is safe to share when needed.
- `STELLAR_SOURCE_SECRET` starts with `S` and must stay private.

## 2. Fund The Account With Friendbot

Friendbot funds new accounts on the Stellar testnet only:

```bash
curl "https://friendbot.stellar.org?addr=<STELLAR_PUBLIC_KEY>"
```

Verify the account exists on Horizon testnet:

```bash
curl "https://horizon-testnet.stellar.org/accounts/<STELLAR_PUBLIC_KEY>"
```

You can also inspect the funded account in Stellar Laboratory:

- Stellar Laboratory endpoint explorer: https://laboratory.stellar.org/#explorer?resource=accounts&endpoint=single&network=test

Select the test network, paste your public key, and run the account lookup.

## 3. Configure Cocohub For Testnet

Create the local environment file if it does not exist:

```bash
cp .env.example .env.development
```

Add these local-only values to `.env.development`:

```bash
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_PUBLIC_KEY=<STELLAR_PUBLIC_KEY>
STELLAR_SOURCE_SECRET=<STELLAR_SOURCE_SECRET>
```

Some backend routes and Stellar payment helpers also read these optional names. Set them to the same testnet account when you are testing flows that require a source account:

```bash
STELLAR_SOURCE_SEED=<STELLAR_SOURCE_SECRET>
STELLAR_ISSUER_PUBLIC_KEY=<STELLAR_PUBLIC_KEY>
STELLAR_RECEIVING_PUBLIC_KEY=<STELLAR_PUBLIC_KEY>
```

The mobile `src/services/blockchainService.ts` currently defaults to `TESTNET` and `https://horizon-testnet.stellar.org`. Keep local Stellar work on testnet unless a maintainer explicitly asks for a production configuration change.

## 4. Set Up Freighter For Testnet

Freighter is useful when you need a browser wallet for manual transactions or account checks.

1. Install Freighter from https://freighter.app.
2. Create or import a wallet.
3. Open Freighter settings and switch the network to Testnet.
4. Import the testnet secret key if you want the same account in Freighter.
5. Confirm the account public key matches `STELLAR_PUBLIC_KEY`.

Do not import a mainnet wallet for local development.

## 5. Run The App And Backend Locally

Install dependencies and start the backend:

```bash
npm install --legacy-peer-deps
docker-compose up
npm run migrate
npm run seed:dev
```

Start the app in another terminal:

```bash
npm start
```

Use the existing mocked service tests before making Stellar-related changes:

```bash
npm test -- --runTestsByPath src/services/__tests__/blockchainService.test.ts
```

## 6. Verify `blockchainService.ts` Locally

The service exposes helpers for account creation, Friendbot funding, account lookup, testnet network info, and record verification:

- `createStellarAccount()`
- `fundTestnetAccount(publicKey)`
- `getStellarAccountDetails(publicKey)`
- `getStellarNetworkInfo()`
- `storeDataOnStellar(sourceSecretKey, dataName, dataValue)`
- `verifyRecordOnChain(recordId, hash)`

For a local sanity check, run a focused Jest target:

```bash
npm test -- --runTestsByPath src/services/__tests__/blockchainService.test.ts
```

For manual testnet account verification, use the public key you funded:

```bash
curl "https://horizon-testnet.stellar.org/accounts/<STELLAR_PUBLIC_KEY>"
```

When you test an end-to-end blockchain record flow, keep the data payload non-sensitive. Cocohub should only anchor hashes or test data on Stellar, never raw medical records or personal data.

## Troubleshooting

### Friendbot Returns An Error

Make sure you are using a public key that starts with `G`, not the secret key that starts with `S`. Friendbot can also rate-limit repeated calls; wait a few minutes and retry.

### Horizon Says The Account Was Not Found

The account has not been funded yet, or testnet was reset. Run the Friendbot command again, then retry the Horizon account lookup.

### Transaction Submission Fails With `op_underfunded`

The source account does not have enough testnet XLM. Re-run Friendbot against `STELLAR_PUBLIC_KEY`.

### Network Passphrase Or Sequence Errors

Confirm the local environment uses testnet values:

```bash
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

Then confirm the source account exists with the Horizon account lookup.

### Freighter Shows The Wrong Balance

Check that Freighter is set to Testnet. Mainnet and testnet accounts can share the same public key format, but they are separate ledgers.

## Reference Links

- Stellar Laboratory: https://laboratory.stellar.org
- Friendbot: https://friendbot.stellar.org
- Horizon testnet: https://horizon-testnet.stellar.org
- Freighter wallet: https://freighter.app
- Stellar SDK documentation: https://stellar.github.io/js-stellar-sdk
