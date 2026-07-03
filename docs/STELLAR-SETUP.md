# Stellar Testnet Setup For Local Development

This guide explains how to create and fund a Stellar testnet account, configure Cocohub for local testnet development, and verify the blockchain record flow end to end.

Cocohub stores private pet health data off-chain and anchors record hashes on Stellar. Local development should use Stellar testnet only.

## Prerequisites

- Node.js 18 or newer
- npm
- Docker Desktop if you are running the backend locally
- A browser for Stellar Laboratory and Freighter
- Cocohub dependencies installed with `npm install --legacy-peer-deps`

Useful links:

- Stellar Laboratory: https://laboratory.stellar.org/
- Stellar testnet Friendbot: https://friendbot.stellar.org/
- Stellar testnet Horizon: https://horizon-testnet.stellar.org/
- Freighter wallet: https://freighter.app/

## 1. Create A Stellar Testnet Keypair

1. Open https://laboratory.stellar.org/#account-creator?network=test
2. Confirm the network is `Test SDF Network ; September 2015`.
3. Click **Generate keypair**.
4. Copy the public key. It starts with `G`.
5. Copy the secret key only into a local `.env` file. It starts with `S`.

Never use a mainnet secret key for local development. Never commit a Stellar secret key.

## 2. Fund The Testnet Account With Friendbot

Fund the public key from the browser:

```text
https://friendbot.stellar.org/?addr=YOUR_TESTNET_PUBLIC_KEY
```

Or with curl:

```bash
curl "https://friendbot.stellar.org/?addr=YOUR_TESTNET_PUBLIC_KEY"
```

Confirm the account exists in testnet Horizon:

```bash
curl https://horizon-testnet.stellar.org/accounts/YOUR_TESTNET_PUBLIC_KEY
```

You should see balances that include testnet XLM.

## 3. Configure Cocohub Environment Variables

Create or update `.env.development` from the example file:

```bash
cp .env.example .env.development
```

Add local Stellar testnet values:

```env
STELLAR_NETWORK=TESTNET
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SOURCE_PUBLIC_KEY=YOUR_TESTNET_PUBLIC_KEY
STELLAR_SOURCE_SECRET_KEY=YOUR_TESTNET_SECRET_KEY
```

If you run the backend through Docker Compose, mirror the same values in `.env.docker` so the backend container can read them.

Keep `API_BASE_URL=http://localhost:3000/api` for local app-to-backend requests.

## 4. Set Up Freighter For Testnet

1. Install Freighter from https://freighter.app/.
2. Create or import a wallet.
3. Open Freighter settings and switch the network to **Testnet**.
4. Import the Stellar Laboratory testnet account only if you are comfortable storing that local test key in Freighter. Otherwise create a separate Freighter testnet account.
5. Fund the Freighter testnet public key with Friendbot.

Freighter is useful for manually checking testnet account state and for future wallet-connected flows.

## 5. Run The Local Backend

From the repository root:

```bash
docker-compose up postgres redis
npm run migrate
npm run seed:dev
npm run server
```

If you prefer the full compose stack:

```bash
docker-compose up
```

## 6. Test `blockchainService.ts` Locally

The client-side blockchain service lives at `src/services/blockchainService.ts` and points to Stellar testnet Horizon when the network is `TESTNET`.

Run the existing blockchain-related tests first:

```bash
npm test -- --runInBand src/services/__tests__/blockchainService.test.ts
npm test -- --runInBand src/services/__tests__/blockchainIntegration.test.ts
```

To verify the backend API flow manually, start the backend and call the blockchain endpoints from the OpenAPI docs or with curl. The OpenAPI path definitions describe:

- `POST /blockchain/records/store` for anchoring a record hash on Stellar
- `POST /blockchain/records/verify` for verifying a record hash against Stellar

Example test payload for the store flow:

```json
{
  "recordId": "local-test-record-001",
  "hash": "a3f5c8d2e1b4f7a9c2d5e8f1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9f2a5b8",
  "metadata": {
    "petId": "local-test-pet-001",
    "recordType": "vaccination"
  }
}
```

Use a seeded user token when an endpoint requires authentication.

## 7. Verify The Transaction On Testnet

After a successful store call, copy the transaction hash and check it in Stellar Laboratory:

1. Open https://laboratory.stellar.org/#explorer?network=test
2. Search for the transaction hash returned by Cocohub.
3. Confirm the transaction succeeded.
4. Check that the memo or operation metadata contains the expected record hash reference.

You can also query Horizon directly:

```bash
curl https://horizon-testnet.stellar.org/transactions/YOUR_TRANSACTION_HASH
```

## Troubleshooting

### Friendbot Says The Account Already Exists
That is fine. Friendbot only needs to create and fund the account once. Check the account in Horizon to confirm it has testnet XLM.

### Horizon Returns 404 For The Account
The account is not funded yet, or the public key is wrong. Re-run Friendbot with the `G...` public key.

### Freighter Shows Mainnet Instead Of Testnet
Switch Freighter network settings to Testnet before testing. Mainnet XLM and testnet XLM are separate.

### Backend Cannot Find Stellar Variables
Confirm the variables exist in the environment used by the running process. For Docker Compose, use `.env.docker`. For local Node commands, use `.env.development` or export the variables in your shell.

### Tests Hit Mainnet By Accident
Stop and verify `STELLAR_NETWORK=TESTNET` and `STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org` before rerunning tests.

### Transaction Verification Fails
Wait a few seconds for testnet Horizon indexing, then retry the verification call. If it still fails, compare the local record hash with the hash stored in the transaction memo or backend response.

## Safety Checklist

- Use testnet only for local development.
- Never commit `S...` secret keys.
- Never paste a mainnet secret into `.env.development` or `.env.docker`.
- Keep record data off-chain; only hashes should be anchored on Stellar.
