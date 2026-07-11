# Stellar testnet setup for Cocohub local development

This guide walks through creating a Stellar testnet keypair, funding it with Friendbot, pointing Cocohub at testnet Horizon, and exercising `blockchainService.ts` locally.

> **Payment:** Cocohub bounties on GrantFox use [smart escrow](https://grantfox.xyz) — funds release within 48h of merge.

## Prerequisites

- Node.js 18+
- [Freighter wallet](https://www.freighter.app/) (optional, for browser signing)
- Cocohub repo cloned and dependencies installed (`npm install --legacy-peer-deps`)

## 1. Create a Stellar testnet keypair

### Option A — Stellar Laboratory (recommended for first-time setup)

1. Open [Stellar Laboratory — Account Creator (Testnet)](https://lab.stellar.org/account/create?network=testnet).
2. Click **Generate keypair**.
3. Copy the **public key** (`G...`) and **secret key** (`S...`). Store the secret locally; never commit it.

### Option B — `@stellar/stellar-sdk` in Node

```bash
node -e "const StellarSdk=require('@stellar/stellar-sdk'); const kp=StellarSdk.Keypair.random(); console.log('PUBLIC', kp.publicKey()); console.log('SECRET', kp.secret());"
```

## 2. Fund the account with Friendbot

Testnet accounts need a minimum XLM balance before they can submit transactions.

```bash
curl "https://friendbot.stellar.org?addr=GYOUR_PUBLIC_KEY_HERE"
```

Or use the [Friendbot form](https://lab.stellar.org/account/friendbot?network=testnet) in Stellar Laboratory.

Verify funding:

```bash
curl "https://horizon-testnet.stellar.org/accounts/GYOUR_PUBLIC_KEY_HERE" | jq .balances
```

You should see a native XLM balance (Friendbot typically credits 10,000 XLM).

## 3. Configure Freighter for testnet (optional)

1. Install [Freighter](https://www.freighter.app/).
2. Settings → **Network** → **Testnet**.
3. Import your secret key or create a new testnet account through the extension.
4. Use Freighter to sign transactions when testing wallet flows in the web app.

Useful explorer links:

- [Stellar Laboratory (testnet)](https://lab.stellar.org/?network=testnet)
- [Stellar Expert — testnet](https://stellar.expert/explorer/testnet)

## 4. Point Cocohub at testnet

### Mobile / Expo app

Create or edit `.env.development` in the repo root:

```env
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SECRET_KEY=SYOUR_SECRET_KEY
STELLAR_PUBLIC_KEY=GYOUR_PUBLIC_KEY
```

The app reads testnet Horizon via `src/services/blockchainService.ts` (default `TESTNET` + `https://horizon-testnet.stellar.org`).

### Backend (full stack)

When running `docker-compose up`, set the same variables for the API container or in `backend/.env`:

```env
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SOURCE_SECRET=SYOUR_SECRET_KEY
```

See also [docs/CONTRIBUTING.md](./CONTRIBUTING.md#blockchain--stellar-testnet) for backend anchor URLs.

## 5. Test `blockchainService.ts` locally

Run the focused unit tests (no mainnet calls):

```bash
npm test -- blockchainService.test.ts
npm test -- blockchainService.circuitBreaker.test.ts
```

### Friendbot helper in code

`fundTestnetAccount(publicKey)` wraps Friendbot:

```typescript
import { fundTestnetAccount } from './src/services/blockchainService';

await fundTestnetAccount('GYOUR_PUBLIC_KEY');
```

This only works when `STELLAR_NETWORK` is `TESTNET`.

### Manual hash + manageData smoke test

1. Start the backend: `docker-compose up` (PostgreSQL + Redis + API).
2. Seed dev data: `npm run migrate && npm run seed:dev`.
3. Log into the web app (`npx expo start --web`) with `owner1@example.com` / `Password123!`.
4. Create or open a pet medical record — Cocohub hashes the record and anchors the digest on testnet via `manageData` (see **Blockchain Architecture** in [README.md](../README.md)).

Confirm the transaction on [Stellar Expert testnet](https://stellar.expert/explorer/testnet) using the transaction id shown in the app or backend logs.

## 6. Testnet vs mainnet

| | Testnet | Mainnet |
|---|---------|---------|
| Horizon | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` |
| Free XLM | Friendbot | Real XLM required |
| Cocohub default | Yes (local dev) | Production deployments |
| PII on chain | Never — only SHA-256 hashes | Same |

Cocohub never stores personal data on Stellar; only record hashes are anchored.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Failed to fund testnet account` | Re-run Friendbot; check public key spelling |
| `Account not found on Stellar network` | Fund the account before submitting txs |
| `Friendbot only available on testnet` | Set `STELLAR_NETWORK=testnet` / `TESTNET` in app code path |
| Horizon 429 / 503 | Wait and retry; `blockchainService` uses circuit breaker + backoff |
| Wrong network in Freighter | Switch Freighter to **Testnet** |

## Related docs

- [CONTRIBUTING.md](../CONTRIBUTING.md) — bounty program and dev workflow
- [docs/CONTRIBUTING.md](./CONTRIBUTING.md) — extended blockchain contributor section
- [Stellar docs — testnet](https://developers.stellar.org/docs/fundamentals-and-concepts/testnet-and-pubnet)
