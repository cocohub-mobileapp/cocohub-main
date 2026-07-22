# Stellar Testnet Setup for Local Development

This guide walks you through setting up a Stellar testnet account for Cocohub local development. You'll need this to test blockchain features — record anchoring, payments, pet identity assets, and multisig — without using real XLM.

---

## Prerequisites

- Node.js ≥ 18 and npm (already installed if you've set up the project)
- A Stellar wallet browser extension (see [Freighter Setup](#freighter-wallet-setup) below)

---

## 1. Create a Stellar Keypair

You can create a testnet keypair in several ways:

### Option A: Using the Stellar Laboratory (easiest)

1. Open the [Stellar Laboratory](https://laboratory.stellar.org/)
2. Go to **Utilities** > **Keypair Generator**
3. Click **Generate Keypair**
4. Copy and save both:
   - **Public Key** — this is your account address (starts with `G...` or `S...` for older formats)
   - **Secret Key** — this is your private key (starts with `S...`). **Never share this.**

### Option B: Using the Stellar SDK (command line)

```bash
npx ts-node -e "
const { Keypair } = require('@stellar/stellar-sdk');
const kp = Keypair.random();
console.log('Public Key:', kp.publicKey());
console.log('Secret Key:', kp.secret());
"
```

### Option C: Using Freighter (wallet extension)

See [Freighter Wallet Setup](#freighter-wallet-setup) below — Freighter can generate a keypair for you inside the extension.

---

## 2. Fund Your Account with Testnet XLM via Friendbot

New Stellar testnet accounts start with a 0 XLM balance and need a minimum balance to operate. Friendbot gives you free testnet XLM.

### Using the Stellar Laboratory

1. Go to the [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=testnet)
2. Enter your **Public Key**
3. Click **Get test network XLM**
4. You'll receive a transaction result — your account now has 10,000 testnet XLM

### Using curl / command line

```bash
curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"
```

### Using the Stellar SDK

```bash
npx ts-node -e "
const { Keypair, Horizon } = require('@stellar/stellar-sdk');
const server = new Horizon.Server('https://horizon-testnet.stellar.org');
const kp = Keypair.fromSecret('YOUR_SECRET_KEY');

const response = await fetch('https://friendbot.stellar.org?addr=' + kp.publicKey());
const json = await response.json();
console.log('Funded! Hash:', json.hash);
"
```

### Verify your balance

```bash
npx ts-node -e "
const { Horizon } = require('@stellar/stellar-sdk');
const server = new Horizon.Server('https://horizon-testnet.stellar.org');
server.loadAccount('YOUR_PUBLIC_KEY').then(acc => {
  console.log('Balances:', acc.balances);
});
"
```

Expected output:
```
Balances: [
  { balance: '10000', asset_type: 'native', ... }
]
```

---

## 3. Environment Configuration

Copy the example env file and add your Stellar testnet credentials:

```bash
cp .env.example .env.development
```

Edit `.env.development` and add the following:

```env
# Stellar Network
STELLAR_NETWORK=testnet

# Your testnet keypair (generated in step 1)
STELLAR_SOURCE_SECRET=SB7P...YOUR_SECRET_KEY_HERE
STELLAR_PUBLIC_KEY=GDEM...YOUR_PUBLIC_KEY_HERE

# Horizon (testnet)
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org

# Anchor (for SEP-24 fiat on-ramp tests — optional, defaults shown)
ANCHOR_HOME_DOMAIN=testanchor.stellar.org
ANCHOR_ASSET_CODE=SRT
ANCHOR_ASSET_ISSUER=GCDNJUBQSX7AJWLJACMJ7I4BC3Z47BQUTMHEICZLE6MU4KQBRYG5JY6B
```

### Backend configuration

If you're also running the backend, add these to `backend/.env`:

```env
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SOURCE_SECRET=<same secret key>
STELLAR_SOURCE_SEED=SB7P...YOUR_SECRET_KEY_HERE
STELLAR_ISSUER_SEED=SB7P...ISSUER_SECRET_KEY
STELLAR_ISSUER_PUBLIC_KEY=GDEM...ISSUER_PUBLIC_KEY
STELLAR_RECEIVING_SECRET=SB7P...RECEIVING_SECRET
STELLAR_RECEIVING_PUBLIC_KEY=GDEM...RECEIVING_PUBLIC_KEY
STELLAR_PATH_FEE_STROOPS=100
```

> **Note:** For local development you can use the same keypair for source, issuer, and receiving. In production these should be separate.

---

## 4. Testing `blockchainService.ts` Locally

The core blockchain service at `src/services/blockchainService.ts` handles record anchoring on Stellar. Here's how to verify it works with your testnet setup.

### Run the existing tests

```bash
npm test -- --testPathPattern="blockchainService"
```

This runs:
- `src/services/__tests__/blockchainService.test.ts`
- `src/services/__tests__/blockchainService.circuitBreaker.test.ts`

### Manual smoke test

Create a standalone test script:

```bash
cat > test_stellar.ts << 'EOF'
import { BlockchainService } from './src/services/blockchainService';

async function main() {
  const svc = new BlockchainService();

  // Store a test record on testnet
  const record = {
    petId: 'test-pet-1',
    recordType: 'vaccination',
    data: JSON.stringify({ vaccine: 'Rabies', date: '2026-01-15' }),
  };

  const txHash = await svc.anchorRecord(record);
  console.log('Record anchored! Stellar tx hash:', txHash);

  // Verify
  const verified = await svc.verifyRecord(record, txHash);
  console.log('Record verified:', verified);
}

main().catch(console.error);
EOF

npx ts-node test_stellar.ts
```

Expected output:
```
Record anchored! Stellar tx hash: a1b2c3d4e5f6...
Record verified: true
```

### Verify on the Stellar Laboratory

1. Go to the [Stellar Laboratory Transaction Explorer](https://laboratory.stellar.org/#explorer?network=testnet)
2. Paste the transaction hash from the output
3. You should see the `manageData` operation with your anchored record hash

---

## 5. Freighter Wallet Setup

[Freighter](https://freighter.app) is a browser extension wallet for Stellar. It's useful for testing the SEP-24 fiat on-ramp and SEP-10 Web Auth flows.

### Installation

1. Download [Freighter for Chrome](https://chrome.google.com/webstore/detail/freighter/) (also available for Firefox and Edge)
2. Click **Create a new wallet**
3. Save your recovery phrase somewhere safe (testnet only — these keys don't hold real money)
4. Click **I saved my recovery phrase**

### Switch to testnet

1. Open Freighter
2. Click the gear icon ⚙️ to open **Settings**
3. Under **Network**, select **Testnet**
4. The Freighter icon should now show a **flask badge** to indicate testnet

### Fund your Freighter account

1. Copy your public key from Freighter (click your account name, then copy)
2. Go to the [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=testnet)
3. Paste your public key and click **Get test network XLM**
4. Freighter will show the new balance after a few seconds

---

## 6. Useful Stellar Testnet Resources

| Resource | URL | Purpose |
|---|---|---|
| Stellar Laboratory | https://laboratory.stellar.org/ | Keypair generation, transactions, account explorer |
| Friendbot | https://friendbot.stellar.org | Free testnet XLM |
| Horizon Testnet | https://horizon-testnet.stellar.org | Testnet network API |
| Testnet Explorer | https://testnet.stellar.expert/ | Block explorer for testnet |
| Stellar Documentation | https://developers.stellar.org/ | Full SDK and API reference |
| Stellar Expert | https://stellar.expert/ | Mainnet explorer for comparison |
| Freighter Wallet | https://freighter.app | Browser extension wallet |
| Soroban Contracts | https://soroban.stellar.org/ | Smart contract docs |

---

## Troubleshooting

### "Account does not exist" on Horizon

You need to fund it first via Friendbot (step 2). An unfunded account doesn't exist on the ledger yet.

### "Insufficient balance" for operations

Testnet requires a minimum balance (currently ~1 XLM for a basic account, plus 0.5 XLM per additional entry). Friendbot gives 10,000 XLM — plenty for development.

### Transaction fails with "op_no_source_account"

Your `.env.development` has the wrong secret key or `STELLAR_NETWORK` is set to `mainnet`. Double-check both.

### Freighter shows "Wrong network" error

Make sure Freighter is set to **Testnet** (settings > Network). The app sends testnet transactions which will be rejected by mainnet.
