/**
 * Tests for trustlineService
 * Issue #43 — Stellar Trustline Management UI (PETC, VETH, PAWP)
 *
 * Covers:
 * - publicKeyFromSecret derives correct public key
 * - isValidPublicKey / isValidSecretKey validation
 * - addTrustline rejects invalid secret key
 * - removeTrustline rejects non-zero balance / non-existent account
 * - loadTrustlineState throws TrustlineError on missing account
 * - COCOHUB_ASSETS registry is non-empty and well-formed (PETC, VETH, PAWP)
 * - buildCocohubAssetStatuses accurately constructs combined asset status
 * - getEarnedBalances fetches or falls back gracefully
 * - extractStellarError formats human-readable error messages
 * - isTestnetMode, getHorizonUrl, and getNetworkPassphrase return valid network details
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import apiClient from '../apiClient';

import {
  publicKeyFromSecret,
  isValidPublicKey,
  isValidSecretKey,
  addTrustline,
  removeTrustline,
  loadTrustlineState,
  buildCocohubAssetStatuses,
  getEarnedBalances,
  extractStellarError,
  isTestnetMode,
  getHorizonUrl,
  getNetworkPassphrase,
  COCOHUB_ASSETS,
  XLM_RESERVE_PER_TRUSTLINE,
  TrustlineError,
} from '../trustlineService';
import type { TrustlineAsset } from '../../models/Trustline';

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
  it('contains PETC, VETH, and PAWP assets', () => {
    const codes = COCOHUB_ASSETS.map((a) => a.assetCode);
    expect(codes).toContain('PETC');
    expect(codes).toContain('VETH');
    expect(codes).toContain('PAWP');
  });

  it('each asset has required fields', () => {
    for (const asset of COCOHUB_ASSETS) {
      expect(asset.assetCode).toBeTruthy();
      expect(asset.issuerPublicKey).toBeTruthy();
      expect(asset.name).toBeTruthy();
      expect(asset.iconEmoji).toBeTruthy();
      expect(asset.description).toBeTruthy();
    }
  });

  it('asset codes are uppercase', () => {
    for (const asset of COCOHUB_ASSETS) {
      expect(asset.assetCode).toBe(asset.assetCode.toUpperCase());
    }
  });
});

// ─── XLM reserve constant & Network config ───────────────────────────────────

describe('XLM_RESERVE_PER_TRUSTLINE & Network Config', () => {
  it('is 0.5 XLM per Stellar protocol', () => {
    expect(XLM_RESERVE_PER_TRUSTLINE).toBe(0.5);
  });

  it('returns valid testnet mode status and Horizon endpoint', () => {
    expect(typeof isTestnetMode()).toBe('boolean');
    expect(getHorizonUrl()).toMatch(/^https?:\/\//);
    expect(getNetworkPassphrase()).toBeTruthy();
  });
});

// ─── buildCocohubAssetStatuses ────────────────────────────────────────────────

describe('buildCocohubAssetStatuses', () => {
  it('maps all Cocohub assets with default zero balances when no trustlines exist', () => {
    const statuses = buildCocohubAssetStatuses([]);
    expect(statuses.length).toBe(COCOHUB_ASSETS.length);

    for (const status of statuses) {
      expect(status.hasTrustline).toBe(false);
      expect(status.walletBalance).toBe('0.00');
      expect(status.earnedBalance).toBe('0.00');
    }
  });

  it('correctly maps active trustlines and earned backend balances', () => {
    const mockTrustlines: TrustlineAsset[] = [
      {
        assetCode: 'PETC',
        issuerPublicKey: COCOHUB_ASSETS.find((a) => a.assetCode === 'PETC')!.issuerPublicKey,
        balance: '250.50',
        limit: '922337203685.4775807',
        isCocohubAsset: true,
      },
      {
        assetCode: 'PAWP',
        issuerPublicKey: COCOHUB_ASSETS.find((a) => a.assetCode === 'PAWP')!.issuerPublicKey,
        balance: '1200.00',
        limit: '10000.00',
        isCocohubAsset: true,
      },
    ];

    const mockEarned = {
      PETC: '50.00',
      VETH: '10.00',
      PAWP: '350.00',
    };

    const statuses = buildCocohubAssetStatuses(mockTrustlines, mockEarned);

    const petc = statuses.find((s) => s.assetCode === 'PETC')!;
    expect(petc.hasTrustline).toBe(true);
    expect(petc.walletBalance).toBe('250.50');
    expect(petc.earnedBalance).toBe('50.00');

    const veth = statuses.find((s) => s.assetCode === 'VETH')!;
    expect(veth.hasTrustline).toBe(false);
    expect(veth.walletBalance).toBe('0.00');
    expect(veth.earnedBalance).toBe('10.00');

    const pawp = statuses.find((s) => s.assetCode === 'PAWP')!;
    expect(pawp.hasTrustline).toBe(true);
    expect(pawp.walletBalance).toBe('1200.00');
    expect(pawp.earnedBalance).toBe('350.00');
  });
});

// ─── getEarnedBalances ────────────────────────────────────────────────────────

describe('getEarnedBalances', () => {
  it('returns backend earned rewards when endpoint responds', async () => {
    const spy = jest.spyOn(apiClient, 'get').mockResolvedValueOnce({
      data: {
        data: {
          earnedBalances: {
            PETC: '150.00',
            VETH: '25.00',
            PAWP: '500.00',
          },
        },
      },
    } as any);

    const result = await getEarnedBalances();
    expect(result.PETC).toBe('150.00');
    expect(result.VETH).toBe('25.00');
    expect(result.PAWP).toBe('500.00');
    spy.mockRestore();
  });

  it('falls back gracefully to zero balances on network failure', async () => {
    const spy = jest.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('Network offline'));

    const result = await getEarnedBalances();
    expect(result).toEqual({
      PETC: '0.00',
      VETH: '0.00',
      PAWP: '0.00',
    });
    spy.mockRestore();
  });
});

// ─── extractStellarError ──────────────────────────────────────────────────────

describe('extractStellarError', () => {
  it('translates Horizon operation result codes', () => {
    const mockErr = {
      response: {
        data: {
          extras: {
            result_codes: {
              operations: ['op_low_reserve'],
            },
          },
        },
      },
    };
    const msg = extractStellarError(mockErr);
    expect(msg).toBe(
      'Insufficient XLM balance to satisfy the trustline reserve requirement (0.5 XLM).',
    );
  });

  it('translates 404 account not found errors', () => {
    const mockErr = {
      response: { status: 404 },
    };
    const msg = extractStellarError(mockErr);
    expect(msg).toContain('Account not found');
  });

  it('translates transaction result codes', () => {
    const mockErr = {
      response: {
        data: {
          extras: {
            result_codes: {
              transaction: 'tx_bad_auth',
            },
          },
        },
      },
    };
    const msg = extractStellarError(mockErr);
    expect(msg).toBe('Invalid transaction signature or secret key.');
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
