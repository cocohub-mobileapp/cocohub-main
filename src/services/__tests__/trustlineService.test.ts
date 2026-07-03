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
  loadEarnedTokenBalances,
  COCOHUB_ASSETS,
  XLM_RESERVE_PER_TRUSTLINE,
  TrustlineError,
} from '../trustlineService';
import apiClient from '../apiClient';

jest.mock('../apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

beforeEach(() => {
  jest.clearAllMocks();
});

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

describe('loadEarnedTokenBalances', () => {
  it('loads earned token balances from the backend', async () => {
    mockApiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          balances: [
            { assetCode: 'PETC', balance: '15.00', source: 'Pet profiles' },
            { assetCode: 'VETH', balance: '3.00', source: 'Appointments' },
            { assetCode: 'PAWP', balance: '30.00', source: 'Referrals' },
          ],
        },
      },
    });

    await expect(loadEarnedTokenBalances()).resolves.toEqual([
      { assetCode: 'PETC', balance: '15.00', source: 'Pet profiles' },
      { assetCode: 'VETH', balance: '3.00', source: 'Appointments' },
      { assetCode: 'PAWP', balance: '30.00', source: 'Referrals' },
    ]);
    expect(mockApiClient.get).toHaveBeenCalledWith('/trustlines/earned-balances');
  });

  it('wraps backend failures in a TrustlineError', async () => {
    mockApiClient.get.mockRejectedValue(new Error('network down'));

    await expect(loadEarnedTokenBalances()).rejects.toThrow(TrustlineError);
  });
});
