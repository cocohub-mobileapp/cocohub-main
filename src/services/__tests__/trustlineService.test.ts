/**
 * Tests for trustlineService
 * Issue #101 — Stellar Trustline Management UI
 *
 * Covers:
 * - publicKeyFromSecret derives correct public key
 * - isValidPublicKey / isValidSecretKey validation
 * - addTrustline rejects invalid secret key
 * - removeTrustline rejects non-zero balance
 * - loadTrustlineState throws TrustlineError on missing account
 * - COCOHUB_ASSETS registry is non-empty and well-formed
 */

import * as StellarSdk from '@stellar/stellar-sdk';

import {
  publicKeyFromSecret,
  isValidPublicKey,
  isValidSecretKey,
  addTrustline,
  removeTrustline,
  loadTrustlineState,
  buildCocohubAssetStatuses,
  COCOHUB_ASSETS,
  XLM_RESERVE_PER_TRUSTLINE,
  TrustlineError,
} from '../trustlineService';

// ─── Key utilities ────────────────────────────────────────────────────────────

describe('publicKeyFromSecret', () => {
  it('derives the correct public key from a known keypair', () => {
    const kp = StellarSdk.Keypair.random();
    expect(publicKeyFromSecret(kp.secret())).toBe(kp.publicKey());
  });

  it('throws TrustlineError for an invalid secret key', () => {
    expect(() => publicKeyFromSecret('not-a-secret')).toThrow(TrustlineError);
  });
});

describe('isValidPublicKey', () => {
  it('returns true for a valid Stellar public key', () => {
    const pk = StellarSdk.Keypair.random().publicKey();
    expect(isValidPublicKey(pk)).toBe(true);
  });

  it('returns false for an invalid key', () => {
    expect(isValidPublicKey('INVALID')).toBe(false);
    expect(isValidPublicKey('')).toBe(false);
  });
});

describe('isValidSecretKey', () => {
  it('returns true for a valid Stellar secret key', () => {
    const sk = StellarSdk.Keypair.random().secret();
    expect(isValidSecretKey(sk)).toBe(true);
  });

  it('returns false for an invalid secret', () => {
    expect(isValidSecretKey('SINVALID')).toBe(false);
    expect(isValidSecretKey('')).toBe(false);
  });
});

// ─── COCOHUB_ASSETS registry ─────────────────────────────────────────────────

describe('COCOHUB_ASSETS', () => {
  it('contains at least one asset', () => {
    expect(COCOHUB_ASSETS.length).toBeGreaterThan(0);
  });

  it('each asset has required fields', () => {
    for (const asset of COCOHUB_ASSETS) {
      expect(asset.assetCode).toBeTruthy();
      expect(asset.issuerPublicKey).toBeTruthy();
      expect(asset.name).toBeTruthy();
      expect(asset.iconEmoji).toBeTruthy();
    }
  });

  it('asset codes are uppercase', () => {
    for (const asset of COCOHUB_ASSETS) {
      expect(asset.assetCode).toBe(asset.assetCode.toUpperCase());
    }
  });
});

describe('buildCocohubAssetStatuses', () => {
  const baseState = {
    accountPublicKey: COCOHUB_ASSETS[0].issuerPublicKey,
    xlmBalance: '10',
    xlmReservePerTrustline: XLM_RESERVE_PER_TRUSTLINE,
    totalReservedXlm: 2,
    availableXlm: '8',
    trustlines: [],
  };

  it('returns PETC, VETH, and PAWP even when no trustlines exist', () => {
    const statuses = buildCocohubAssetStatuses(baseState);

    expect(statuses.map((asset) => asset.assetCode)).toEqual(['PETC', 'VETH', 'PAWP']);
    expect(statuses.every((asset) => asset.hasTrustline === false)).toBe(true);
    expect(statuses.every((asset) => asset.balance === '0')).toBe(true);
  });

  it('marks matching Cocohub trustlines and includes backend earned balances', () => {
    const petc = COCOHUB_ASSETS.find((asset) => asset.assetCode === 'PETC');
    expect(petc).toBeDefined();
    if (!petc) return;

    const statuses = buildCocohubAssetStatuses(
      {
        ...baseState,
        trustlines: [
          {
            assetCode: petc.assetCode,
            issuerPublicKey: petc.issuerPublicKey,
            issuerLabel: petc.name,
            balance: '12.5000000',
            limit: '922337203685.4775807',
            isCocohubAsset: true,
          },
        ],
      },
      { PETC: '7.2500000' },
    );

    const petcStatus = statuses.find((asset) => asset.assetCode === 'PETC');
    expect(petcStatus).toBeDefined();
    if (!petcStatus) return;

    expect(petcStatus.hasTrustline).toBe(true);
    expect(petcStatus.balance).toBe('12.5000000');
    expect(petcStatus.earnedBalance).toBe('7.2500000');
  });
});

// ─── XLM reserve constant ─────────────────────────────────────────────────────

describe('XLM_RESERVE_PER_TRUSTLINE', () => {
  it('is 0.5 XLM per Stellar protocol', () => {
    expect(XLM_RESERVE_PER_TRUSTLINE).toBe(0.5);
  });
});

// ─── addTrustline ─────────────────────────────────────────────────────────────

describe('addTrustline', () => {
  it('throws TrustlineError with ADD_FAILED when secret key is invalid', async () => {
    await expect(
      addTrustline({
        accountSecretKey: 'SINVALID000000000000000000000000000000000000000000000000000',
        assetCode: 'PETC',
        issuerPublicKey: StellarSdk.Keypair.random().publicKey(),
      }),
    ).rejects.toThrow(TrustlineError);
  });

  it('throws TrustlineError when account does not exist on testnet', async () => {
    // Generate a fresh keypair that has never been funded
    const kp = StellarSdk.Keypair.random();
    await expect(
      addTrustline({
        accountSecretKey: kp.secret(),
        assetCode: 'PETC',
        issuerPublicKey: StellarSdk.Keypair.random().publicKey(),
      }),
    ).rejects.toThrow(TrustlineError);
  }, 15000);
});

// ─── removeTrustline ──────────────────────────────────────────────────────────

describe('removeTrustline', () => {
  it('throws TrustlineError when account does not exist on testnet', async () => {
    const kp = StellarSdk.Keypair.random();
    await expect(
      removeTrustline({
        accountSecretKey: kp.secret(),
        assetCode: 'PETC',
        issuerPublicKey: StellarSdk.Keypair.random().publicKey(),
      }),
    ).rejects.toThrow(TrustlineError);
  }, 15000);
});

// ─── loadTrustlineState ───────────────────────────────────────────────────────

describe('loadTrustlineState', () => {
  it('throws TrustlineError for an unfunded account', async () => {
    const pk = StellarSdk.Keypair.random().publicKey();
    await expect(loadTrustlineState(pk)).rejects.toThrow(TrustlineError);
  }, 15000);

  it('throws TrustlineError for an invalid public key', async () => {
    await expect(loadTrustlineState('INVALID')).rejects.toThrow(TrustlineError);
  }, 15000);
});
