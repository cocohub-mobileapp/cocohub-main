/**
 * Trustline Service
 * Issue #101 — Stellar Trustline Management UI
 *
 * Uses @stellar/stellar-sdk directly on the client for trustline operations
 * on Stellar testnet. Secret key is never sent to the backend.
 */

import * as StellarSdk from '@stellar/stellar-sdk';

import apiClient from './apiClient';
import type {
  TrustlineAsset,
  TrustlineState,
  TrustlineTransaction,
  AddTrustlineParams,
  RemoveTrustlineParams,
  CocohubAssetDefinition,
  CocohubAssetStatus,
  EarnedTokenBalances,
} from '../models/Trustline';

// ─── Network config ───────────────────────────────────────────────────────────

const STELLAR_NETWORK = (process.env.STELLAR_NETWORK ?? 'TESTNET').toUpperCase() as
  | 'TESTNET'
  | 'PUBLIC';
const HORIZON_URL =
  STELLAR_NETWORK === 'PUBLIC'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE =
  STELLAR_NETWORK === 'PUBLIC' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET;

/** Whether current configuration is running against Stellar testnet */
export function isTestnetMode(): boolean {
  return STELLAR_NETWORK !== 'PUBLIC';
}

/** Get configured Horizon server endpoint */
export function getHorizonUrl(): string {
  return HORIZON_URL;
}

/** Get configured Stellar network passphrase */
export function getNetworkPassphrase(): string {
  return NETWORK_PASSPHRASE;
}

/** XLM reserve locked per trustline on Stellar */
export const XLM_RESERVE_PER_TRUSTLINE = 0.5;

/** Base account reserve (2 XLM) */
const BASE_RESERVE_XLM = 2;

// ─── Cocohub asset registry ──────────────────────────────────────────────────

export const COCOHUB_ASSETS: CocohubAssetDefinition[] = [
  {
    assetCode: 'PETC',
    issuerPublicKey:
      process.env.COCOHUB_ISSUER_PUBLIC_KEY ??
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    name: 'Cocohub Token',
    description: 'Core utility token for the Cocohub ecosystem',
    iconEmoji: '🐾',
  },
  {
    assetCode: 'VETH',
    issuerPublicKey:
      process.env.COCOHUB_ISSUER_PUBLIC_KEY ??
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    name: 'Vet Health Credit',
    description: 'Redeemable credits for veterinary services',
    iconEmoji: '🏥',
  },
  {
    assetCode: 'PAWP',
    issuerPublicKey:
      process.env.COCOHUB_ISSUER_PUBLIC_KEY ??
      'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    name: 'PawPoints',
    description: 'Loyalty reward points earned through Cocohub activity',
    iconEmoji: '⭐',
  },
];

const COCOHUB_ASSET_CODES = new Set(COCOHUB_ASSETS.map((a) => a.assetCode));

// ─── Error class ──────────────────────────────────────────────────────────────

export class TrustlineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'TrustlineError';
  }
}

// ─── Horizon server (lazy singleton) ─────────────────────────────────────────

let _server: StellarSdk.Horizon.Server | null = null;
function getServer(): StellarSdk.Horizon.Server {
  if (!_server) _server = new StellarSdk.Horizon.Server(HORIZON_URL);
  return _server;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseBalance(balances: StellarSdk.Horizon.HorizonApi.BalanceLine[]): {
  xlm: string;
  trustlines: TrustlineAsset[];
} {
  let xlm = '0';
  const trustlines: TrustlineAsset[] = [];

  for (const b of balances) {
    if (b.asset_type === 'native') {
      xlm = b.balance;
    } else if (b.asset_type === 'credit_alphanum4' || b.asset_type === 'credit_alphanum12') {
      const code = b.asset_code;
      const issuer = b.asset_issuer;
      trustlines.push({
        assetCode: code,
        issuerPublicKey: issuer,
        issuerLabel: COCOHUB_ASSETS.find((a) => a.assetCode === code)?.name,
        balance: b.balance,
        limit: b.limit,
        isCocohubAsset: COCOHUB_ASSET_CODES.has(code),
      });
    }
  }

  return { xlm, trustlines };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Load full trustline state for an account */
export async function loadTrustlineState(publicKey: string): Promise<TrustlineState> {
  try {
    const account = await getServer().loadAccount(publicKey);
    const { xlm, trustlines } = parseBalance(
      account.balances as StellarSdk.Horizon.HorizonApi.BalanceLine[],
    );

    const totalReservedXlm = BASE_RESERVE_XLM + trustlines.length * XLM_RESERVE_PER_TRUSTLINE;
    const available = Math.max(0, parseFloat(xlm) - totalReservedXlm).toFixed(7);

    return {
      accountPublicKey: publicKey,
      xlmBalance: xlm,
      xlmReservePerTrustline: XLM_RESERVE_PER_TRUSTLINE,
      trustlines,
      totalReservedXlm,
      availableXlm: available,
    };
  } catch (err) {
    if (err instanceof StellarSdk.NotFoundError) {
      throw new TrustlineError('Account not found on Stellar network', 'ACCOUNT_NOT_FOUND');
    }
    throw new TrustlineError(
      err instanceof Error ? err.message : 'Failed to load account',
      'LOAD_FAILED',
    );
  }
}

/** Add a trustline for an asset */
export async function addTrustline(params: AddTrustlineParams): Promise<string> {
  const { accountSecretKey, assetCode, issuerPublicKey, limit } = params;

  try {
    const keypair = StellarSdk.Keypair.fromSecret(accountSecretKey);
    const server = getServer();
    const account = await server.loadAccount(keypair.publicKey());

    const asset = new StellarSdk.Asset(assetCode, issuerPublicKey);
    const op = StellarSdk.Operation.changeTrust({
      asset,
      ...(limit ? { limit } : {}),
    });

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: String(await server.fetchBaseFee()),
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    const result = await server.submitTransaction(tx);
    return result.hash;
  } catch (err) {
    if (err instanceof TrustlineError) throw err;
    const msg = extractStellarError(err) ?? (err instanceof Error ? err.message : 'Unknown error');
    throw new TrustlineError(`Failed to add trustline: ${msg}`, 'ADD_FAILED');
  }
}

/** Remove a trustline (only allowed when balance is zero) */
export async function removeTrustline(params: RemoveTrustlineParams): Promise<string> {
  const { accountSecretKey, assetCode, issuerPublicKey } = params;

  try {
    const keypair = StellarSdk.Keypair.fromSecret(accountSecretKey);
    const server = getServer();
    const account = await server.loadAccount(keypair.publicKey());

    // Verify balance is zero before attempting removal
    const balances = account.balances as StellarSdk.Horizon.HorizonApi.BalanceLine[];
    const existing = balances.find(
      (b) =>
        (b.asset_type === 'credit_alphanum4' || b.asset_type === 'credit_alphanum12') &&
        b.asset_code === assetCode &&
        b.asset_issuer === issuerPublicKey,
    );

    if (!existing) {
      throw new TrustlineError('Trustline does not exist', 'NOT_FOUND');
    }
    if (parseFloat(existing.balance) > 0) {
      throw new TrustlineError(
        `Cannot remove trustline: balance is ${existing.balance} ${assetCode}. Transfer or burn the balance first.`,
        'NON_ZERO_BALANCE',
      );
    }

    const asset = new StellarSdk.Asset(assetCode, issuerPublicKey);
    // Setting limit to '0' removes the trustline
    const op = StellarSdk.Operation.changeTrust({ asset, limit: '0' });

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: String(await server.fetchBaseFee()),
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    const result = await server.submitTransaction(tx);
    return result.hash;
  } catch (err) {
    if (err instanceof TrustlineError) throw err;
    const msg = extractStellarError(err) ?? (err instanceof Error ? err.message : 'Unknown error');
    throw new TrustlineError(`Failed to remove trustline: ${msg}`, 'REMOVE_FAILED');
  }
}

/** Fetch trustline-related transaction history for an account */
export async function loadTrustlineHistory(
  publicKey: string,
  limit = 20,
): Promise<TrustlineTransaction[]> {
  try {
    const server = getServer();
    const ops = await server.operations().forAccount(publicKey).limit(limit).order('desc').call();

    const results: TrustlineTransaction[] = [];

    for (const op of ops.records) {
      if (op.type === 'change_trust') {
        const ct = op as StellarSdk.Horizon.HorizonApi.ChangeTrustOperationResponse;
        const isRemove = ct.limit === '0';
        results.push({
          id: op.id,
          type: isRemove ? 'remove_trustline' : 'add_trustline',
          assetCode: ct.asset_code ?? '',
          issuerPublicKey: ct.asset_issuer ?? '',
          txHash: ct.transaction_hash,
          createdAt: op.created_at,
          successful: op.transaction_successful ?? true,
        });
      } else if (op.type === 'payment') {
        const p = op as StellarSdk.Horizon.HorizonApi.PaymentOperationResponse;
        if (p.asset_type !== 'native') {
          results.push({
            id: op.id,
            type: 'payment',
            assetCode: p.asset_code ?? '',
            issuerPublicKey: p.asset_issuer ?? '',
            amount: p.amount,
            txHash: p.transaction_hash,
            createdAt: op.created_at,
            successful: op.transaction_successful ?? true,
          });
        }
      }
    }

    return results;
  } catch {
    throw new TrustlineError('Failed to load transaction history', 'HISTORY_FAILED');
  }
}

/** Derive public key from secret key (for display only — never store secret) */
export function publicKeyFromSecret(secretKey: string): string {
  try {
    return StellarSdk.Keypair.fromSecret(secretKey).publicKey();
  } catch {
    throw new TrustlineError('Invalid secret key', 'INVALID_SECRET');
  }
}

/** Validate a Stellar public key */
export function isValidPublicKey(key: string): boolean {
  return StellarSdk.StrKey.isValidEd25519PublicKey(key);
}

/** Validate a Stellar secret key */
export function isValidSecretKey(key: string): boolean {
  try {
    StellarSdk.Keypair.fromSecret(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Maps known Cocohub assets (PETC, VETH, PAWP) against an account's trustlines
 * and backend earned balances to produce a unified status list.
 */
export function buildCocohubAssetStatuses(
  trustlines: TrustlineAsset[],
  earnedBalances?: Record<string, string>,
): CocohubAssetStatus[] {
  return COCOHUB_ASSETS.map((asset) => {
    const tl = trustlines.find(
      (t) =>
        t.assetCode.toUpperCase() === asset.assetCode.toUpperCase() &&
        (!t.issuerPublicKey || t.issuerPublicKey === asset.issuerPublicKey),
    );

    return {
      ...asset,
      hasTrustline: Boolean(tl),
      walletBalance: tl ? tl.balance : '0.00',
      earnedBalance: earnedBalances?.[asset.assetCode] ?? '0.00',
      limit: tl?.limit,
    };
  });
}

/**
 * Fetches token balances earned through in-app activities and rewards from the backend.
 * Gracefully falls back to zero balances if the endpoint or network is unreachable.
 */
export async function getEarnedBalances(): Promise<EarnedTokenBalances> {
  try {
    const res = await apiClient.get<{
      data?: {
        earnedBalances?: Record<string, string>;
        totalPoints?: number;
        earnedPremiumDays?: number;
      };
    }>('/referrals/me');

    const data = res.data?.data;
    if (data?.earnedBalances) {
      return {
        PETC: data.earnedBalances.PETC ?? '0.00',
        VETH: data.earnedBalances.VETH ?? '0.00',
        PAWP: data.earnedBalances.PAWP ?? String(data.totalPoints ?? '0.00'),
      };
    }
    const points = data?.totalPoints ?? (data?.earnedPremiumDays ? data.earnedPremiumDays * 10 : 0);
    return {
      PETC: '0.00',
      VETH: '0.00',
      PAWP: points > 0 ? points.toFixed(2) : '0.00',
    };
  } catch {
    return {
      PETC: '0.00',
      VETH: '0.00',
      PAWP: '0.00',
    };
  }
}

// ─── Internal helpers & Stellar error mapping ───────────────────────────────

const STELLAR_HORIZON_ERROR_MESSAGES: Record<string, string> = {
  op_underfunded: 'Account has insufficient XLM for transaction fees and reserves.',
  op_low_reserve:
    'Insufficient XLM balance to satisfy the trustline reserve requirement (0.5 XLM).',
  op_no_issuer: 'The asset issuer account does not exist on the Stellar network.',
  op_invalid_limit: 'The specified trustline limit is invalid.',
  op_already_exists: 'A trustline for this asset already exists.',
  op_not_authorized: 'Account is not authorized by the issuer to establish this trustline.',
  op_not_authorized_to_maintain_liabilities:
    'Account is not authorized to maintain liabilities for this asset.',
  op_src_no_trust: 'Source account does not have a trustline for the asset.',
  op_line_full: 'The trustline limit has been reached.',
  tx_bad_auth: 'Invalid transaction signature or secret key.',
  tx_insufficient_fee: 'Transaction fee is too low for current network conditions.',
  tx_insufficient_balance: 'Insufficient XLM balance to cover transaction fees.',
  tx_too_early: 'Transaction submitted before valid time window.',
  tx_too_late: 'Transaction expired before it could be included in a ledger.',
  tx_missing_operation: 'Transaction contains no operations.',
  tx_bad_seq: 'Invalid transaction sequence number. Please refresh and try again.',
  tx_internal_error: 'Stellar Horizon internal error. Please retry in a moment.',
};

/**
 * Extracts and translates Stellar Horizon error responses into clear,
 * human-readable error messages.
 */
export function extractStellarError(err: unknown): string | null {
  if (!err) return null;

  try {
    const e = err as {
      message?: string;
      name?: string;
      response?: {
        status?: number;
        data?: {
          title?: string;
          detail?: string;
          extras?: {
            result_codes?: {
              transaction?: string;
              operations?: string[];
            };
          };
        };
      };
    };

    if (err instanceof StellarSdk.NotFoundError || e.response?.status === 404) {
      return 'Account not found on the Stellar network. Please fund it with testnet XLM first.';
    }

    const opCodes = e?.response?.data?.extras?.result_codes?.operations;
    const txCode = e?.response?.data?.extras?.result_codes?.transaction;

    if (opCodes?.length) {
      const translated = opCodes
        .map((code) => STELLAR_HORIZON_ERROR_MESSAGES[code] ?? code)
        .join('; ');
      return translated;
    }

    if (txCode && STELLAR_HORIZON_ERROR_MESSAGES[txCode]) {
      return STELLAR_HORIZON_ERROR_MESSAGES[txCode];
    }

    if (e.response?.data?.detail) {
      return e.response.data.detail;
    }

    if (e.response?.data?.title) {
      return e.response.data.title;
    }

    if (e.message) {
      return e.message;
    }
  } catch {
    // ignore
  }
  return null;
}
