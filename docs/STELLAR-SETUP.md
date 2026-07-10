# Stellar Testnet Setup for Local Development

Cocohub anchors pet medical-record hashes on Stellar. Use the Stellar **testnet** for all
local development so you can create accounts, fund them with Friendbot, and submit
`manageData` transactions without spending real XLM.

This guide covers the full loop required to exercise `src/services/blockchainService.ts`
locally: create a keypair, fund it, configure local environment values, run service-level
checks, inspect transactions in Stellar Lab (Stellar Laboratory), and connect Freighter for browser-wallet flows.

## Quick links

- [Stellar Lab / Stellar Laboratory](https://lab.stellar.org/) — all-in-one Stellar web tool.
- [Keypair generator](https://lab.stellar.org/account/create) — generate a testnet public key
  and secret key.
- [Friendbot funding page](https://lab.stellar.org/account/fund) — fund a testnet account with
  10,000 test XLM.
- [Horizon testnet account lookup](https://horizon-testnet.stellar.org/accounts/) — append your
  public key to inspect account JSON.
- [Freighter wallet](https://freighter.app/) and
  [Freighter testnet guide](https://developers.stellar.org/docs/build/guides/freighter/connect-testnet).

## 1. Create a Stellar testnet keypair

A Stellar account starts as an Ed25519 keypair:

- **Public key** starts with `G` and is safe to share. Cocohub uses it as the account ID.
- **Secret key** starts with `S` and signs transactions. Treat it like a password, even on
  testnet.

### Option A: Stellar Laboratory (Stellar Lab)

1. Open the [Stellar Lab keypair generator](https://lab.stellar.org/account/create).
2. Select **Testnet** if the Lab asks for a network.
3. Click **Generate keypair**.
4. Copy both values:
   - `Public Key` -> `STELLAR_PUBLIC_KEY`
   - `Secret Key` -> `STELLAR_SECRET_KEY`

### Option B: local script

Run this from the repository root after installing dependencies:

```bash
node -e "const { Keypair } = require('@stellar/stellar-sdk'); const kp = Keypair.random(); console.log('STELLAR_PUBLIC_KEY=' + kp.publicKey()); console.log('STELLAR_SECRET_KEY=' + kp.secret());"
```

## 2. Fund the account with Friendbot

New testnet keypairs do not exist on-chain until they are funded. Friendbot creates the account
and sends test XLM.

### Stellar Laboratory flow

1. Open [Stellar Lab Friendbot](https://lab.stellar.org/account/fund).
2. Paste your `STELLAR_PUBLIC_KEY`.
3. Submit the request and wait for the success message.

### CLI flow

```bash
curl "https://friendbot.stellar.org?addr=<YOUR_STELLAR_PUBLIC_KEY>"
```

Verify the account exists:

```bash
curl "https://horizon-testnet.stellar.org/accounts/<YOUR_STELLAR_PUBLIC_KEY>"
```

Look for a native balance (`asset_type: native`) in the response. Friendbot and the testnet reset
periodically, so re-run this step if Horizon later returns `404` or you see `op_underfunded`.

## 3. Configure `.env.development`

Create a local env file and keep it out of Git:

```bash
cp .env.example .env.development
```

Add or update these values:

```bash
APP_ENV=development
API_BASE_URL=http://localhost:3000/api

# Stellar testnet only. Never use a mainnet secret key for local work.
STELLAR_NETWORK=TESTNET
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_FRIENDBOT_URL=https://friendbot.stellar.org
STELLAR_PUBLIC_KEY=<YOUR_STELLAR_PUBLIC_KEY>
STELLAR_SECRET_KEY=<YOUR_STELLAR_SECRET_KEY>
```

Notes:

- `.env.development` is for local values only; do not commit it.
- `src/services/blockchainService.ts` defaults its Horizon client to `TESTNET` and
  `https://horizon-testnet.stellar.org`; the env values keep scripts, backend work, and future
  config-driven code aligned with the same account.
- Use `API_BASE_URL=http://localhost:3000/api` when exercising backend-backed record store or
  verify endpoints locally.

If you need to load the env file into your terminal for one-off smoke scripts:

```bash
# macOS/Linux/Git Bash
set -a
source .env.development
set +a
```

```powershell
# Windows PowerShell
Get-Content .env.development |
  Where-Object { $_ -match '^[A-Z0-9_]+=' } |
  ForEach-Object {
    $key, $value = $_.Split('=', 2)
    Set-Item -Path "Env:$key" -Value $value
  }
```

## 4. Run local `blockchainService.ts` checks

Install dependencies first:

```bash
npm install --legacy-peer-deps
```

### Unit tests

These tests mock network calls and confirm hashing, Friendbot wiring, Horizon account lookup, and
record store/verify request shapes:

```bash
npm test -- --runTestsByPath src/services/__tests__/blockchainService.test.ts
```

### Horizon + Friendbot smoke test

This creates a throwaway testnet account through `blockchainService.ts`, funds it with Friendbot,
loads it from Horizon, and writes one `manageData` entry. It does not touch mainnet.

```bash
npx tsx -e "import { createStellarAccount, fundTestnetAccount, getStellarAccountDetails, getStellarNetworkInfo, storeDataOnStellar } from './src/services/blockchainService'; const account = createStellarAccount(); console.log('publicKey=', account.publicKey); console.log('secretKey=', account.secretKey); await fundTestnetAccount(account.publicKey); const info = await getStellarNetworkInfo(); console.log('network=', info.network, 'horizon=', info.horizonUrl, 'ledger=', info.currentLedger); const details = await getStellarAccountDetails(account.publicKey); console.log('balances=', details.balances); const tx = await storeDataOnStellar(account.secretKey, 'cocohub-local-test', 'ok-' + Date.now()); console.log('txHash=', tx.hash);"
```

Copy the printed `txHash` for Stellar Lab inspection in the next step.

### End-to-end record flow with the local backend

The high-level `storeMedicalRecordOnChain`, `verifyMedicalRecordOnChain`, `storeRecordOnChain`,
and `verifyRecordOnChain` helpers call Cocohub API endpoints. To test the full app/backend record
flow locally:

```bash
# Terminal 1: database, Redis, and API dependencies
docker-compose up

# Terminal 2: migrations, seed data, and API
npm run migrate
npm run seed:dev
npm run server

# Terminal 3: app
npx expo start --web
```

Then create or edit a medical record in the web app. In network logs or backend logs, confirm calls
to `/blockchain/records/store` and `/blockchain/records/verify`. Recomputing a record hash locally
with `computeRecordHash(record)` should match the hash that was submitted for verification.

## 5. Inspect transactions in Stellar Lab

Use Stellar Lab (Stellar Laboratory) to verify that your smoke test or backend flow reached testnet:

1. Open [Stellar Lab](https://lab.stellar.org/) and select **Testnet**.
2. Use the transaction or endpoint explorer to search for the `txHash` printed by the smoke test.
3. Confirm the transaction is successful and contains a `manageData` operation named
   `cocohub-local-test` or the record key created by your backend flow.
4. Use the account explorer for `STELLAR_PUBLIC_KEY` to confirm balance changes and data entries.

Useful direct URLs:

- Account JSON: `https://horizon-testnet.stellar.org/accounts/<YOUR_STELLAR_PUBLIC_KEY>`
- Transaction JSON: `https://horizon-testnet.stellar.org/transactions/<TX_HASH>`

## 6. Set up Freighter for wallet testing

Freighter is useful for browser-based Stellar flows and for confirming your local key can be used in
a standard wallet.

1. Install Freighter from [freighter.app](https://freighter.app/).
2. Create a new wallet or import the testnet account you generated above.
3. Open the network selector and switch from **Public** to **Testnet**.
4. If Freighter shows the account as unfunded, use its **Fund with Friendbot** prompt or repeat the
   Friendbot step in this guide.
5. Copy the Freighter public key and compare it with `STELLAR_PUBLIC_KEY` in `.env.development`.
6. Keep Freighter on **Testnet** while running `npx expo start --web`; only switch to Public when
   intentionally testing production wallet behavior.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Horizon returns `404` for the account | Fund the public key with Friendbot; the keypair is not an on-chain account until funded. |
| `op_underfunded` or failed transaction fee | Re-run Friendbot or create a fresh testnet account; testnet balances reset. |
| Freighter shows no XLM | Confirm Freighter is on **Testnet**, then use **Fund with Friendbot**. |
| Local record store calls hit the wrong API | Confirm `APP_ENV=development` and `API_BASE_URL=http://localhost:3000/api` before starting Expo/backend. |
| Secret key leaked in logs or Git | Rotate by generating a new keypair and funding the new public key; never commit `.env.development`. |
