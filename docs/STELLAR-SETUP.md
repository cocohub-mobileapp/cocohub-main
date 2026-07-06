# Stellar Testnet Setup for Local Development

This guide explains how to run Cocohub against the Stellar testnet while developing locally. Use testnet accounts only. Testnet XLM has no cash value and can be reset by the Stellar network.

## Prerequisites

- Node.js 18 or newer
- Project dependencies installed with `npm install --legacy-peer-deps`
- Local backend dependencies running with `docker-compose up`
- A local environment file copied from `.env.example`
- A browser for Stellar Laboratory and a wallet extension for Freighter testing

## 1. Create a Stellar testnet keypair

You can create a keypair in either Stellar Laboratory or the project code.

### Option A: Stellar Laboratory

1. Open the Stellar Laboratory account tool: https://lab.stellar.org/account/create
2. Choose **Testnet**.
3. Generate a keypair.
4. Copy both values:
   - Public key: starts with `G`
   - Secret key: starts with `S`

### Option B: local Node script

Run this from the repository root after installing dependencies:

```bash
node -e "const StellarSdk=require('@stellar/stellar-sdk'); const kp=StellarSdk.Keypair.random(); console.log('PUBLIC_KEY=' + kp.publicKey()); console.log('SECRET_KEY=' + kp.secret());"
```

Never commit the secret key. Treat it like a password, even on testnet.

## 2. Fund the account with Friendbot

New Stellar accounts do not exist on-chain until they receive their first funding transaction.

1. Replace `<PUBLIC_KEY>` with the `G...` public key created above:

   ```text
   https://friendbot.stellar.org/?addr=<PUBLIC_KEY>
   ```

2. Open that URL in a browser. A successful response means Friendbot created and funded the testnet account.
3. Confirm the account in a testnet explorer:

   ```text
   https://stellar.expert/explorer/testnet/account/<PUBLIC_KEY>
   ```

The Cocohub app also exposes Friendbot through `src/services/stellarAccountService.ts` with `fundTestnet(publicKey)`. That helper is disabled in production and points to `https://friendbot.stellar.org/` in local and non-production environments.

## 3. Configure local environment variables

Create your local env file:

```bash
cp .env.example .env.development
```

Add or update these Stellar values:

```dotenv
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_RECEIVING_PUBLIC_KEY=<PUBLIC_KEY>
STELLAR_RECEIVING_SECRET=<SECRET_KEY>
STELLAR_SOURCE_SECRET=<SECRET_KEY>
STELLAR_PATH_FEE_STROOPS=100
```

Notes:

- `STELLAR_NETWORK=testnet` keeps payment and anchoring flows away from mainnet.
- `STELLAR_HORIZON_URL` should be `https://horizon-testnet.stellar.org` for local development.
- `STELLAR_RECEIVING_PUBLIC_KEY` and `STELLAR_RECEIVING_SECRET` are used by Stellar payment/path-payment services.
- `STELLAR_SOURCE_SECRET` is used by backend anchoring flows such as medical record, vaccination, note, and travel certificate anchoring.
- Keep all `S...` secret keys in local env files only.

## 4. Set up Freighter on testnet

Freighter is useful for wallet-oriented flows and for checking that a testnet account can sign transactions.

1. Install Freighter from https://freighter.app.
2. Create a new wallet or import the testnet secret key generated above.
3. Open Freighter settings and switch the network to **Testnet**.
4. Copy the Freighter public key and fund it with Friendbot if it is a new account.
5. Confirm that Freighter does not show **Public Network** before testing Cocohub flows.

Do not import a mainnet wallet into local development.

## 5. Start the local app and backend

In one terminal:

```bash
docker-compose up
```

In another terminal:

```bash
npm run migrate
npm run seed:dev
npx expo start --web
```

After seeding, sign in with:

```text
Email:    owner1@example.com
Password: Password123!
```

## 6. Test `blockchainService.ts` locally

The React Native app routes blockchain record verification through `src/services/blockchainService.ts`. Useful local checks:

1. Confirm the active Stellar network:

   - `getStellarNetworkInfo()` should return `TESTNET`.
   - The Horizon URL should be `https://horizon-testnet.stellar.org`.

2. Create or load a testnet account:

   - `createStellarAccount()` generates a local keypair.
   - `fundTestnetAccount(publicKey)` funds it with Friendbot.
   - `getStellarAccountDetails(publicKey)` should return account balances after funding.

3. Exercise a record verification flow in the app:

   - Start the backend and web app.
   - Create or open a medical record.
   - Trigger the blockchain verification or anchoring action in the UI.
   - Copy the returned transaction hash or account ID.
   - Verify it in Stellar Expert testnet:

     ```text
     https://stellar.expert/explorer/testnet
     ```

4. For backend anchoring services, confirm `STELLAR_SOURCE_SECRET` is present before creating records that anchor hashes. Missing secrets usually produce an anchoring failure while the rest of the record flow can still work.

## Useful test commands

Run the most relevant tests for Stellar account and blockchain service work:

```bash
npm test -- src/services/__tests__/stellarAccountService.test.ts --runInBand
npm test -- src/services/__tests__/blockchainService.test.ts --runInBand
npm test -- backend/services/__tests__/stellarService.test.ts --runInBand
npm test -- backend/services/__tests__/stellarPathPaymentService.test.ts --runInBand
```

If a test file does not exist on your branch, run the closest service-specific test under `src/services/__tests__` or `backend/services/__tests__`.

## Troubleshooting

| Problem | Fix |
|---|---|
| Horizon returns account not found | Fund the `G...` public key with Friendbot first. |
| Friendbot returns an error | Wait and retry; Friendbot can rate-limit repeated requests for the same account. |
| Freighter transaction prompts mention Public Network | Switch Freighter to Testnet before signing. |
| Secret key validation fails | Confirm the secret starts with `S` and is 56 characters. |
| Public key validation fails | Confirm the public key starts with `G` and is 56 characters. |
| Anchoring fails in backend flows | Check `STELLAR_SOURCE_SECRET` and `STELLAR_HORIZON_URL` in `.env.development`. |
| Payment/path-payment flow fails | Check `STELLAR_RECEIVING_PUBLIC_KEY`, `STELLAR_RECEIVING_SECRET`, and account funding. |
| Testnet balance is too low | Fund the account again or create a fresh testnet keypair. |

## Security reminders

- Never commit `.env.development`, `.env`, or any `S...` secret key.
- Use testnet accounts for local development.
- Keep mainnet wallets and production secrets out of local test flows.
- Only hashes and transaction metadata should be written to Stellar; do not write personal pet or owner data on-chain.
