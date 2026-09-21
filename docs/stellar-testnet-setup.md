# Stellar Testnet Setup Guide

> **Bounty #21** — Docs: Stellar testnet setup guide (Issue #32)

This guide explains how to set up a Stellar testnet environment for local development of Cocohub's payment and smart-contract features. Everything here uses the **testnet** — no real funds are involved.

---

## What is the Stellar Testnet?

The Stellar testnet is a public sandbox that mirrors mainnet behaviour. It runs the same protocol but uses valueless test XLM. The testnet is periodically **reset** (roughly once per quarter), wiping all accounts and balances.

Key testnet endpoints:

| Service | URL |
|---------|-----|
| Horizon API | `https://horizon-testnet.stellar.org` |
| Friendbot (faucet) | `https://friendbot.stellar.org` |
| Stellar Expert (explorer) | `https://stellar.expert/explorer/testnet` |
| Laboratory | `https://laboratory.stellar.org/#?network=testnet` |

---

## 1. Install the Freighter Wallet

[Freighter](https://freighter.app) is the official Stellar browser wallet extension.

1. Visit [freighter.app](https://freighter.app) and install the extension for your browser (Chrome, Firefox, or Brave).
2. Open the extension and click **Create a new wallet**.
3. Write down your **12-word recovery phrase** in a safe place — this is the only way to recover your wallet.
4. Set a strong password.

### Switch to Testnet

By default Freighter connects to mainnet. Switch to testnet for development:

1. Click the **network selector** at the top of the Freighter popup (shows "Mainnet").
2. Select **Testnet**.

Your account address (public key, starts with `G…`) is now a testnet address.

---

## 2. Get Free Test XLM from Friendbot

Friendbot funds any testnet account with **10,000 test XLM** for free.

### Via browser

Open this URL, replacing `<YOUR_PUBLIC_KEY>` with your Freighter address:

```
https://friendbot.stellar.org/?addr=<YOUR_PUBLIC_KEY>
```

You'll see a JSON response with a successful transaction hash when it works.

### Via curl

```bash
curl "https://friendbot.stellar.org/?addr=<YOUR_PUBLIC_KEY>"
```

### Via the Stellar Laboratory

1. Go to [laboratory.stellar.org](https://laboratory.stellar.org/#?network=testnet).
2. Click **Friendbot** in the top navigation.
3. Paste your public key and click **Get test lumens**.

Verify your balance:

```bash
curl "https://horizon-testnet.stellar.org/accounts/<YOUR_PUBLIC_KEY>" \
  | python3 -m json.tool | grep '"balance"'
```

---

## 3. Configure the App for Testnet

### 3.1 Environment Variable

In your project root `.env` (copy from `.env.docker` if you haven't already):

```dotenv
# Stellar
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

> [!IMPORTANT]
> The network passphrase is **exact** — any extra space or character will cause signature verification failures.

For mainnet (production), these values would be:

```dotenv
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_NETWORK_PASSPHRASE=Public Global Stellar Network ; September 2015
```

### 3.2 Verify the App Connects to Testnet

The backend health check already probes the Horizon endpoint:

```bash
curl http://localhost:3000/health
```

Look for:

```json
"horizon": { "status": "ok", "latencyMs": 45 }
```

If `status` is `"error"`, verify `STELLAR_HORIZON_URL` is set correctly and that your machine can reach the internet.

---

## 4. GrantFox Integration (Bounty Payments)

Cocohub uses [GrantFox](https://grantfox.xyz) smart escrow for bounty payments. On testnet you can simulate the full payment flow:

1. Make sure your **Freighter wallet is on Testnet** (Step 1).
2. Fund your testnet wallet with Friendbot (Step 2).
3. When submitting a PR, include your Stellar public key in the PR description — e.g.:

   ```
   Stellar address: GABC...XYZ
   ```

4. GrantFox releases XLM to your address after PR merge.

> [!NOTE]
> Actual bounty payments are on **mainnet** XLM. The testnet setup above is for developing and testing the integration locally before going live.

---

## 5. Working with the Stellar SDK (Advanced)

If you're developing Soroban smart-contract features (Bounty #1) or trustline UI (Bounty #10), install the Stellar SDK:

```bash
npm install @stellar/stellar-sdk
```

### Quick example — check account balance

```typescript
import { Horizon } from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');

async function getBalance(publicKey: string) {
  const account = await server.loadAccount(publicKey);
  account.balances.forEach((balance) => {
    console.log(`Asset: ${balance.asset_type}, Balance: ${balance.balance}`);
  });
}

getBalance('YOUR_PUBLIC_KEY');
```

### Quick example — fund account with Friendbot

```typescript
async function fundTestnetAccount(publicKey: string) {
  const response = await fetch(
    `https://friendbot.stellar.org/?addr=${encodeURIComponent(publicKey)}`
  );
  const data = await response.json();
  console.log('Funded:', data.hash);
}
```

---

## 6. Useful Resources

| Resource | Link |
|----------|------|
| Stellar Developer Docs | [developers.stellar.org](https://developers.stellar.org) |
| Stellar Laboratory | [laboratory.stellar.org](https://laboratory.stellar.org/#?network=testnet) |
| Stellar Expert (testnet) | [stellar.expert/explorer/testnet](https://stellar.expert/explorer/testnet) |
| Freighter Wallet | [freighter.app](https://freighter.app) |
| Stellar JavaScript SDK | [github.com/stellar/js-stellar-sdk](https://github.com/stellar/js-stellar-sdk) |
| GrantFox Escrow | [grantfox.xyz](https://grantfox.xyz) |
| Horizon API Reference | [developers.stellar.org/api](https://developers.stellar.org/api) |

---

## 7. Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Friendbot returns 400 | Account already exists | Use a different address or skip — account is already funded |
| `tx_bad_auth` on testnet | Signed with mainnet passphrase | Set `STELLAR_NETWORK_PASSPHRASE` to the testnet value |
| Horizon `404 Not Found` for account | Account not yet funded | Run Friendbot first |
| Testnet balance shows 0 after reset | Periodic testnet reset | Re-fund via Friendbot |
| Freighter shows "Mainnet" | Wrong network selected | Switch to Testnet in the Freighter network selector |

---

*See also: [ARCHITECTURE.md](../ARCHITECTURE.md) · [backend-api-setup.md](./backend-api-setup.md) · [SECURITY-SETUP.md](./SECURITY-SETUP.md)*
