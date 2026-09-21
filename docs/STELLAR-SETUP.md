# Stellar Testnet Setup Guide for Local Development

This guide documents the setup and configuration process for running and testing Cocohub blockchain features against the Stellar Testnet.

Cocohub utilizes the Stellar blockchain for decentralized, tamper-proof verification of pet medical records without publishing sensitive Personally Identifiable Information (PII) to the public ledger. Canonical SHA-256 digests of records are anchored using Stellar `manageData` operations.

---

## Prerequisites

Ensure the following tools are installed before proceeding:

- Node.js (version 18 or higher)
- npm (version 9 or higher)
- Docker Desktop (required if running the full backend stack locally)
- Modern web browser (Chrome, Brave, Firefox, or Edge) with extension support

Install repository dependencies:

```bash
npm install --legacy-peer-deps
```

---

## 1. Create a Stellar Testnet Keypair

A Stellar account consists of a public key (starting with `G`) and a secret seed key (starting with `S`). You need a valid keypair to sign transactions and interact with Horizon on the testnet.

### Method A: Stellar Laboratory (Recommended)

1. Navigate to the [Stellar Laboratory Account Creator](https://lab.stellar.org/account/create?network=testnet).
2. Ensure the network selector in the top bar is set to **Testnet**.
3. Click the **Generate keypair** button.
4. Record both keys securely:
   - **Public Key**: Starts with `G` (e.g., `GBVHELLD2JE235Y2NGTDT3MWI3T65ON6SY4N6FBHYVDAQ5FZC2CP5QXH`). This is your account address.
   - **Secret Key**: Starts with `S` (e.g., `SB...`). This is used to sign transactions. Keep this secret and never commit it to source control.

### Method B: Programmatic Generation via Node.js CLI

You can generate a testnet keypair using the project's installed `@stellar/stellar-sdk` dependency:

```bash
node -e "const StellarSdk = require('@stellar/stellar-sdk'); const kp = StellarSdk.Keypair.random(); console.log('PUBLIC_KEY=' + kp.publicKey()); console.log('SECRET_KEY=' + kp.secret());"
```

### Method C: Application Service Function

Inside the codebase, `src/services/blockchainService.ts` exports `createStellarAccount()`:

```typescript
import { createStellarAccount } from './src/services/blockchainService';

const { publicKey, secretKey } = createStellarAccount();
```

---

## 2. Fund the Account via Friendbot

On Stellar, accounts must hold a minimum reserve balance (1 XLM base reserve) to exist on the ledger. Friendbot is the official Stellar testnet faucet that creates and funds new accounts with 10,000 testnet XLM.

### Option 1: Direct HTTP Request via curl

Send a GET request to Friendbot with your public key:

```bash
curl "https://friendbot.stellar.org?addr=<YOUR_PUBLIC_KEY>"
```

Expected JSON response:

```json
{
  "successful": true
}
```

### Option 2: Stellar Laboratory Friendbot Form

1. Open the [Stellar Laboratory Friendbot](https://lab.stellar.org/account/friendbot?network=testnet).
2. Paste your public key into the input field.
3. Click **Get test network Lumens**.

### Option 3: Built-in Service Helper

Use `fundTestnetAccount` from `src/services/blockchainService.ts`:

```typescript
import { fundTestnetAccount } from './src/services/blockchainService';

await fundTestnetAccount('<YOUR_PUBLIC_KEY>');
```

### Verifying Account Funding

Check your account balance and sequence number via the Horizon Testnet API:

```bash
curl "https://horizon-testnet.stellar.org/accounts/<YOUR_PUBLIC_KEY>"
```

You can also view the account in the [Stellar Expert Testnet Explorer](https://stellar.expert/explorer/testnet).

---

## 3. Configure Freighter Wallet for Testnet

Freighter is the non-custodial browser extension wallet designed for the Stellar ecosystem. It allows testing user-facing transaction signing flows.

1. Install the extension from [Freighter.app](https://www.freighter.app/).
2. Complete initial wallet creation and set a password.
3. Switch the active network to Testnet:
   - Click the gear icon (**Settings**) in the bottom right corner of Freighter.
   - Select **Preferences** -> **Network**.
   - Select **Testnet** (`https://horizon-testnet.stellar.org`).
4. Import your testnet account:
   - Click the account dropdown at the top.
   - Select **Add Account** -> **Import Account**.
   - Enter the secret key (`S...`) generated in Step 1.
5. Verify that your 10,000 testnet XLM balance appears in the extension interface.

---

## 4. Configure Environment Variables

Create or update `.env.development` in the root of the repository:

```bash
cp .env.example .env.development
```

Add the Stellar testnet configuration variables:

```env
# Stellar Testnet Network Configuration
STELLAR_NETWORK=TESTNET
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_PUBLIC_KEY=<YOUR_PUBLIC_KEY>
STELLAR_SECRET_KEY=<YOUR_SECRET_KEY>
```

### Backend Configuration (Docker / Local API)

If running the backend API containers (`docker-compose up`), configure the following variables in `backend/.env`:

```env
STELLAR_NETWORK=TESTNET
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SOURCE_SECRET=<YOUR_SECRET_KEY>
STELLAR_SOURCE_SEED=<YOUR_SECRET_KEY>
STELLAR_ISSUER_PUBLIC_KEY=<YOUR_PUBLIC_KEY>
STELLAR_ISSUER_SEED=<YOUR_SECRET_KEY>
```

> **Security Warning:** Never commit `.env` or `.env.development` files containing secret keys to git. Ensure `.env.development` remains listed in `.gitignore`.

---

## 5. Test blockchainService.ts Locally

The core Stellar logic resides in `src/services/blockchainService.ts`. Run the unit test suite to verify operation against Horizon specifications:

```bash
npm test -- src/services/__tests__/blockchainService.test.ts
```

The test cases verify:
- Deterministic canonical SHA-256 hash generation (`computeRecordHash`)
- On-chain record storage verification (`verifyRecordOnChain`)
- Hash integrity checking (`verifyRecordIntegrity`)
- Stellar account creation and keypair validation (`createStellarAccount`)
- Friendbot testnet funding integration (`fundTestnetAccount`)
- Transaction history retrieval (`getTransactionHistory`)
- Batch record verification (`batchVerifyRecords`)

### End-to-End Blockchain Record Anchoring Flow

To test the record anchoring flow end-to-end against the Stellar Testnet:

1. **Hash Generation:**
   Before submission, the client computes a canonical SHA-256 hash of the medical record payload, excluding transient metadata:
   ```typescript
   import { computeRecordHash } from './src/services/blockchainService';

   const sampleRecord = {
     id: 'rec_test_123',
     petId: 'pet_test_456',
     vetId: 'vet_test_789',
     diagnosis: 'Annual Wellness Checkup',
     treatment: 'Vaccination completed',
     date: '2026-09-21T00:00:00.000Z',
   };

   const hash = computeRecordHash(sampleRecord);
   ```

2. **On-Chain Anchoring (manageData):**
   The digest is anchored onto the Stellar ledger via a `manageData` operation, binding the record ID to its cryptographic digest:
   ```typescript
   import { storeDataOnStellar } from './src/services/blockchainService';

   const secretKey = process.env.STELLAR_SECRET_KEY!;
   const txResponse = await storeDataOnStellar(
     secretKey,
     `rec:${sampleRecord.id}`,
     hash,
   );
   console.log('Transaction submitted:', txResponse.hash);
   ```

3. **Verification:**
   A third party or veterinary clinic verifies authenticity by fetching the entry from Horizon and comparing hashes:
   ```typescript
   import { verifyRecordIntegrity } from './src/services/blockchainService';

   const integrityResult = await verifyRecordIntegrity(sampleRecord);
   console.log('Record verified on chain:', integrityResult.onChainVerified);
   ```

---

## Testnet vs. Mainnet Reference

| Property | Testnet | Public (Mainnet) |
|---|---|---|
| Horizon URL | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` |
| Network Passphrase | `Test SDF Network ; September 2015` | `Public Global Stellar Network ; September 2015` |
| Faucet Availability | Friendbot (free 10,000 XLM) | None (real funds required) |
| Data Persistence | Ephemeral (resets quarterly) | Permanent |
| Cocohub Usage | Development, staging, CI | Production releases |

---

## Troubleshooting

### Error: Failed to fund testnet account (FUNDING_FAILED)
- **Cause:** Friendbot rate limiting or transient Horizon Testnet downtime.
- **Resolution:** Wait 30 seconds and retry, or use the web form at [Stellar Laboratory Friendbot](https://lab.stellar.org/account/friendbot?network=testnet).

### Error: Account not found on Stellar network (ACCOUNT_NOT_FOUND)
- **Cause:** Transactions were attempted using a keypair that was never funded through Friendbot.
- **Resolution:** Fund the account via Friendbot before making Horizon transactions.

### Error: Friendbot only available on testnet (INVALID_NETWORK)
- **Cause:** `STELLAR_NETWORK` is set to `PUBLIC`.
- **Resolution:** Update `STELLAR_NETWORK=TESTNET` in `.env.development`.

### Error: Circuit breaker open (CIRCUIT_BREAKER_OPEN)
- **Cause:** Horizon returned consecutive errors, triggering the circuit breaker timeout.
- **Resolution:** Check Horizon status or call `resetCircuitBreaker()` from `src/services/blockchainService.ts`.

### Error: op_underfunded
- **Cause:** The account XLM balance dropped below the minimum reserve plus base fees (100 stroops per operation).
- **Resolution:** Re-fund the account via Friendbot.

---

## Related Resources

- [README.md](../README.md): Overview of Cocohub architecture and features
- [CONTRIBUTING.md](../CONTRIBUTING.md): Contribution guidelines and bounty lifecycle
- [BOUNTIES.md](../BOUNTIES.md): Open bounties and GrantFox reward terms
- [Stellar Documentation](https://developers.stellar.org/): Official Stellar developer documentation
- [Freighter Documentation](https://docs.freighter.app/): Guide to integrating Freighter
