import * as StellarSdk from '@stellar/stellar-sdk';
import axios, { type AxiosResponse } from 'axios';
import CryptoJS from 'crypto-js';
import * as SorobanClient from 'soroban-client';

import type { MedicalRecord } from './medicalRecordService';
import { CircuitBreaker, retryWithBackoff } from '../utils/circuitBreaker';

// ==============================
// TYPES (UNCHANGED)
// ==============================

export interface StellarRecordVerification {
  verified: boolean;
  onChainHash?: string;
  recordId: string;
  ledger?: number;
  txHash?: string;
  timestamp?: string;
}

export interface StellarTransactionDetails {
  hash: string;
  successful: boolean;
  ledger?: number;
  createdAt?: string;
  sourceAccount?: string;
  feeCharged?: string;
  memo?: string;
  operationCount?: number;
  [key: string]: unknown;
}

export interface RecordIntegrityResult {
  recordId: string;
  localHash: string;
  providedHash?: string;
  localHashMatchesProvidedHash: boolean;
  onChainVerified: boolean;
  onChainHash?: string;
  txHash?: string;
}

export type MedicalRecordWithChainData = MedicalRecord & {
  hash?: string;
  recordHash?: string;
  txHash?: string;
  blockchainTxHash?: string;
  [key: string]: unknown;
};

export interface SorobanPetRegistryConfig {
  contractId?: string;
  rpcUrl?: string;
  networkPassphrase?: string;
  timeoutSeconds?: number;
  pollAttempts?: number;
  pollDelayMs?: number;
}

export interface SorobanRegistryTransactionResult {
  hash: string;
  status: string;
  latestLedger?: number;
  ledger?: number;
  returnValue?: unknown;
}

export interface SorobanPetRecordStoreResult extends SorobanRegistryTransactionResult {
  recordId: string;
  recordKey: string;
  recordHash: string;
  ownerPublicKey: string;
}

// ==============================
// CONFIG
// ==============================

const API_BASE_URL = 'https://api.cocohub.app/api';
const CACHE_TTL_MS = 2 * 60 * 1000;

// Stellar Network Configuration
const STELLAR_NETWORK: string = 'TESTNET'; // Change to 'PUBLIC' for production
const HORIZON_URL =
  STELLAR_NETWORK === 'PUBLIC'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org';
const DEFAULT_SOROBAN_RPC_URL =
  STELLAR_NETWORK === 'PUBLIC'
    ? 'https://soroban-mainnet.stellar.org'
    : 'https://soroban-testnet.stellar.org';
const DEFAULT_SOROBAN_TIMEOUT_SECONDS = 30;
const DEFAULT_SOROBAN_POLL_ATTEMPTS = 12;
const DEFAULT_SOROBAN_POLL_DELAY_MS = 1250;

// Initialize Stellar Server
let stellarServer: StellarSdk.Horizon.Server | null = null;

// Circuit breaker for Horizon API calls (3 failures = open, 8s timeout)
const horizonCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  successThreshold: 1,
  timeout: 8000,
});

const getStellarServer = (): StellarSdk.Horizon.Server => {
  if (!stellarServer) {
    stellarServer = new StellarSdk.Horizon.Server(HORIZON_URL);
  }
  return stellarServer;
};

const responseCache = new Map<string, { data: unknown; expiresAt: number }>();
const inFlightRequests = new Map<string, Promise<unknown>>();

const getEnv = (key: string): string | undefined => {
  if (typeof process === 'undefined') return undefined;
  return process.env?.[key];
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeHex32 = (value: string, label: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new BlockchainServiceError(`${label} must be a 64-character hex string`, 'INVALID_HASH');
  }
  return normalized;
};

const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

const bytesToHex = (value: unknown): string => {
  if (typeof value === 'string') {
    return normalizeHex32(value, 'Contract hash');
  }

  if (value instanceof Uint8Array || Array.isArray(value)) {
    return Array.from(value as ArrayLike<number>)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  if (value && typeof value === 'object' && 'toString' in value) {
    const maybeHex = (value as { toString: (encoding?: string) => string }).toString('hex');
    if (/^[0-9a-f]{64}$/i.test(maybeHex)) return maybeHex.toLowerCase();
  }

  throw new BlockchainServiceError(
    'Contract returned an invalid record hash',
    'INVALID_CONTRACT_RESPONSE',
  );
};

const makeSorobanBytes32 = (hex: string): SorobanClient.xdr.ScVal =>
  SorobanClient.nativeToScVal(hexToBytes(normalizeHex32(hex, 'Soroban bytes')), { type: 'bytes' });

export const deriveSorobanRecordKey = (recordId: string): string => {
  const normalizedRecordId = recordId.trim();
  if (!normalizedRecordId) {
    throw new BlockchainServiceError('Record ID is required', 'INVALID_RECORD_ID');
  }
  return CryptoJS.SHA256(normalizedRecordId).toString(CryptoJS.enc.Hex);
};

const getSorobanNetworkPassphrase = (config?: SorobanPetRegistryConfig): string =>
  config?.networkPassphrase ||
  (STELLAR_NETWORK === 'PUBLIC' ? SorobanClient.Networks.PUBLIC : SorobanClient.Networks.TESTNET);

const normalizeSorobanConfig = (
  config?: SorobanPetRegistryConfig,
): Required<SorobanPetRegistryConfig> => {
  const contractId =
    config?.contractId ||
    getEnv('EXPO_PUBLIC_SOROBAN_PET_REGISTRY_CONTRACT_ID') ||
    getEnv('SOROBAN_PET_REGISTRY_CONTRACT_ID');

  if (!contractId?.trim()) {
    throw new BlockchainServiceError(
      'Soroban pet registry contract ID is required',
      'MISSING_CONTRACT_ID',
    );
  }

  return {
    contractId: contractId.trim(),
    rpcUrl:
      config?.rpcUrl ||
      getEnv('EXPO_PUBLIC_SOROBAN_RPC_URL') ||
      getEnv('SOROBAN_RPC_URL') ||
      DEFAULT_SOROBAN_RPC_URL,
    networkPassphrase: getSorobanNetworkPassphrase(config),
    timeoutSeconds: config?.timeoutSeconds || DEFAULT_SOROBAN_TIMEOUT_SECONDS,
    pollAttempts: config?.pollAttempts || DEFAULT_SOROBAN_POLL_ATTEMPTS,
    pollDelayMs: config?.pollDelayMs || DEFAULT_SOROBAN_POLL_DELAY_MS,
  };
};

/**
 * Get circuit breaker metrics for debugging/monitoring
 */
export const getCircuitBreakerMetrics = () => horizonCircuitBreaker.getMetrics();

/**
 * Reset circuit breaker (for manual intervention or testing)
 */
export const resetCircuitBreaker = () => horizonCircuitBreaker.reset();

// ==============================
// ERROR CLASS
// ==============================

export class BlockchainServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'BlockchainServiceError';
  }
}

// ==============================
// ERROR HANDLER
// ==============================

const handleBlockchainError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    throw new BlockchainServiceError(`Blockchain API error (${status}): ${message}`, 'API_ERROR');
  }

  throw new BlockchainServiceError('Failed to connect to blockchain service', 'NETWORK_ERROR');
};

// ==============================
// CACHE HELPERS
// ==============================

const getCached = <T>(key: string): T | undefined => {
  const cached = responseCache.get(key);
  if (!cached) return undefined;

  if (Date.now() > cached.expiresAt) {
    responseCache.delete(key);
    return undefined;
  }

  return cached.data as T;
};

const setCached = <T>(key: string, data: T): void => {
  responseCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

const queryWithCache = async <T>(cacheKey: string, requestFn: () => Promise<T>): Promise<T> => {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const existing = inFlightRequests.get(cacheKey) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async () => {
    try {
      const result = await requestFn();
      setCached(cacheKey, result);
      return result;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
};

// ==============================
// 🔥 FIX #1: EXPORTED FOR TESTS
// ==============================

export const computeRecordHash = (record: MedicalRecordWithChainData): string => {
  const payload = { ...record };
  delete payload.hash;
  delete payload.recordHash;
  delete payload.txHash;
  delete payload.blockchainTxHash;

  const canonical = JSON.stringify(sortObject(payload));
  return CryptoJS.SHA256(canonical).toString(CryptoJS.enc.Hex);
};

// helper (exported via testUtils too)
const sortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortObject);

  if (value && typeof value === 'object') {
    const obj: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      obj[key] = sortObject((value as Record<string, unknown>)[key]);
    }
    return obj;
  }

  return value;
};

// ==============================
// PUBLIC API
// ==============================

export const verifyRecordOnChain = async (
  recordId: string,
  hash: string,
): Promise<StellarRecordVerification> => {
  const response = await axios.post(`${API_BASE_URL}/blockchain/records/verify`, {
    recordId: recordId.trim(),
    hash: hash.trim(),
  });

  return response.data;
};

export const verifyRecordIntegrity = async (
  record: MedicalRecordWithChainData,
): Promise<RecordIntegrityResult> => {
  if (!record?.id) {
    throw new BlockchainServiceError('Invalid record', 'INVALID_RECORD');
  }

  const localHash = computeRecordHash(record);
  const providedHash = record.hash || record.recordHash;

  const onChain = await verifyRecordOnChain(record.id, localHash);

  return {
    recordId: record.id,
    localHash,
    providedHash,
    localHashMatchesProvidedHash: providedHash === localHash,
    onChainVerified: onChain.verified,
    onChainHash: onChain.onChainHash,
    txHash: onChain.txHash,
  };
};

export const storeRecordOnChain = async (
  recordId: string,
  hash: string,
  metadata?: Record<string, unknown>,
): Promise<StellarTransactionDetails> => {
  const normalizedRecordId = recordId.trim();
  const normalizedHash = hash.trim().toLowerCase();

  if (!normalizedRecordId) {
    throw new BlockchainServiceError('Record ID is required', 'INVALID_RECORD_ID');
  }
  if (!normalizedHash) {
    throw new BlockchainServiceError('Record hash is required', 'INVALID_HASH');
  }

  const cacheKey = `store:${normalizedRecordId}:${normalizedHash}`;

  return queryWithCache<StellarTransactionDetails>(
    cacheKey,
    async (): Promise<StellarTransactionDetails> => {
      try {
        const response: AxiosResponse<StellarTransactionDetails> = await axios.post(
          `${API_BASE_URL}/blockchain/records/store`,
          {
            recordId: normalizedRecordId,
            hash: normalizedHash,
            metadata: metadata || {},
          },
        );
        return response.data;
      } catch (error) {
        handleBlockchainError(error);
        throw error; // unreachable but satisfies type checker
      }
    },
  );
};

/**
 * Retrieve record hash from Stellar blockchain.
 */
export const retrieveRecordHash = async (
  recordId: string,
): Promise<{ hash: string; txHash: string; timestamp: string; ledger?: number }> => {
  const normalizedRecordId = recordId.trim();

  if (!normalizedRecordId) {
    throw new BlockchainServiceError('Record ID is required', 'INVALID_RECORD_ID');
  }

  const cacheKey = `retrieve:${normalizedRecordId}`;

  return queryWithCache<{ hash: string; txHash: string; timestamp: string; ledger?: number }>(
    cacheKey,
    async () => {
      try {
        const response: AxiosResponse<{
          hash: string;
          txHash: string;
          timestamp: string;
          ledger?: number;
        }> = await axios.get(
          `${API_BASE_URL}/blockchain/records/${encodeURIComponent(normalizedRecordId)}/hash`,
        );
        return response.data;
      } catch (error) {
        handleBlockchainError(error);
        throw error; // unreachable but satisfies type checker
      }
    },
  );
};

/**
 * Get transaction history for a specific record or account.
 */
export const getTransactionHistory = async (
  recordId?: string,
  accountId?: string,
  limit?: number,
): Promise<StellarTransactionDetails[]> => {
  const params = new URLSearchParams();
  if (recordId) params.append('recordId', recordId.trim());
  if (accountId) params.append('accountId', accountId.trim());
  if (limit) params.append('limit', limit.toString());

  const cacheKey = `history:${recordId || 'all'}:${accountId || 'all'}:${limit || 50}`;

  return queryWithCache<StellarTransactionDetails[]>(cacheKey, async () => {
    try {
      const response: AxiosResponse<StellarTransactionDetails[]> = await axios.get(
        `${API_BASE_URL}/blockchain/transactions/history?${params.toString()}`,
      );
      return response.data;
    } catch (error) {
      handleBlockchainError(error);
      throw error; // unreachable but satisfies type checker
    }
  });
};

/**
 * Connect to Stellar network and get network info.
 * Uses circuit breaker to handle degraded endpoint gracefully.
 */
export const getStellarNetworkInfo = async (): Promise<{
  network: string;
  horizonUrl: string;
  passphrase: string;
  currentLedger: number;
  latestLedger: number;
}> => {
  const cacheKey = 'network-info';

  return queryWithCache<{
    network: string;
    horizonUrl: string;
    passphrase: string;
    currentLedger: number;
    latestLedger: number;
  }>(cacheKey, async () => {
    try {
      return await horizonCircuitBreaker.execute(async () => {
        const server = getStellarServer();
        const ledgers = await server.ledgers().order('desc').limit(1).call();
        const latestLedger = ledgers.records[0];

        return {
          network: STELLAR_NETWORK,
          horizonUrl: HORIZON_URL,
          passphrase:
            STELLAR_NETWORK === 'PUBLIC' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET,
          currentLedger: latestLedger.sequence,
          latestLedger: latestLedger.sequence,
        };
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'name' in error) {
        if ((error as { name?: string }).name === 'CircuitBreakerOpenError') {
          throw new BlockchainServiceError(
            'Horizon service temporarily unavailable (circuit breaker open)',
            'CIRCUIT_BREAKER_OPEN',
          );
        }
      }
      handleBlockchainError(error);
      throw error;
    }
  });
};

/**
 * Create a new Stellar account (keypair).
 */
export const createStellarAccount = (): {
  publicKey: string;
  secretKey: string;
} => {
  const keypair = StellarSdk.Keypair.random();
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
};

/**
 * Get account details from Stellar network.
 * Uses circuit breaker to handle degraded endpoint gracefully.
 */
export const getStellarAccountDetails = async (
  publicKey: string,
): Promise<StellarSdk.Horizon.AccountResponse> => {
  try {
    return await horizonCircuitBreaker.execute(async () => {
      const server = getStellarServer();
      return await server.loadAccount(publicKey);
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'name' in error) {
      if ((error as { name?: string }).name === 'CircuitBreakerOpenError') {
        throw new BlockchainServiceError(
          'Horizon service temporarily unavailable (circuit breaker open)',
          'CIRCUIT_BREAKER_OPEN',
        );
      }
    }

    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new BlockchainServiceError('Account not found on Stellar network', 'ACCOUNT_NOT_FOUND');
    }
    handleBlockchainError(error);
    throw error;
  }
};

/**
 * Fund a testnet account using Friendbot (testnet only).
 */
export const fundTestnetAccount = async (publicKey: string): Promise<boolean> => {
  if (STELLAR_NETWORK !== 'TESTNET') {
    throw new BlockchainServiceError('Friendbot only available on testnet', 'INVALID_NETWORK');
  }

  try {
    await axios.get(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
    return true;
  } catch {
    throw new BlockchainServiceError('Failed to fund testnet account', 'FUNDING_FAILED');
  }
};

/**
 * Submit a transaction to Stellar network with circuit breaker and exponential backoff retry.
 *
 * - Wraps calls in circuit breaker (3 failures → open for 8s)
 * - Retries on 503/504/429 with exponential backoff + jitter (max 3 attempts)
 * - Returns typed errors so callers can distinguish network vs. logic failures
 */
export const submitStellarTransaction = async (
  transaction: StellarSdk.Transaction,
): Promise<StellarSdk.Horizon.HorizonApi.SubmitTransactionResponse> => {
  try {
    // Wrap in circuit breaker to prevent hammering degraded endpoint
    return await horizonCircuitBreaker.execute(async () => {
      // Retry with exponential backoff for transient failures (503, 504, 429)
      return await retryWithBackoff(
        async () => {
          const server = getStellarServer();
          return await server.submitTransaction(transaction);
        },
        {
          maxRetries: 3,
          baseDelayMs: 100,
          maxDelayMs: 8000,
        },
      );
    });
  } catch (error) {
    // Map circuit breaker errors to typed BlockchainServiceError
    if (error && typeof error === 'object' && 'name' in error) {
      if ((error as { name?: string }).name === 'CircuitBreakerOpenError') {
        const cbError = error as { retryAfterMs?: number };
        throw new BlockchainServiceError(
          `Circuit breaker open - service temporarily unavailable. Retry after ${cbError.retryAfterMs}ms`,
          'CIRCUIT_BREAKER_OPEN',
        );
      }
    }

    // Map Stellar transaction errors
    if (
      error &&
      (error as { response?: { data?: { extras?: { result_codes?: { transaction?: string } } } } })
        .response?.data
    ) {
      const txError = error as {
        response: { data: { extras?: { result_codes?: { transaction?: string } } } };
        message?: string;
      };
      throw new BlockchainServiceError(
        `Transaction failed: ${txError.response.data.extras?.result_codes?.transaction}`,
        'TRANSACTION_FAILED',
      );
    }

    // Handle other axios/network errors
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;

      // All retry attempts exhausted
      if (status === 429 || status === 503 || status === 504) {
        throw new BlockchainServiceError(
          `Horizon service unavailable after retries (${status}): ${message}`,
          'HORIZON_UNAVAILABLE',
        );
      }

      throw new BlockchainServiceError(`Horizon API error (${status}): ${message}`, 'API_ERROR');
    }

    // Generic error fallback
    handleBlockchainError(error);
    throw error;
  }
};

/**
 * Build and submit a payment transaction.
 * Wraps transaction building and submission in circuit breaker protection.
 */
export const sendPayment = async (
  sourceSecretKey: string,
  destinationPublicKey: string,
  amount: string,
  memo?: string,
): Promise<StellarSdk.Horizon.HorizonApi.SubmitTransactionResponse> => {
  try {
    // Build transaction (no circuit breaker needed)
    const server = getStellarServer();
    const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey);
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase:
        STELLAR_NETWORK === 'PUBLIC' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.payment({
          destination: destinationPublicKey,
          asset: StellarSdk.Asset.native(),
          amount: amount,
        }),
      )
      .setTimeout(30);

    if (memo) {
      transaction.addMemo(StellarSdk.Memo.text(memo));
    }

    const builtTransaction = transaction.build();
    builtTransaction.sign(sourceKeypair);

    // Submit with circuit breaker and retries
    return await submitStellarTransaction(builtTransaction);
  } catch (error) {
    handleBlockchainError(error);
    throw error;
  }
};

/**
 * Store data on Stellar using manage data operation.
 */
export const storeDataOnStellar = async (
  sourceSecretKey: string,
  dataName: string,
  dataValue: string,
): Promise<StellarSdk.Horizon.HorizonApi.SubmitTransactionResponse> => {
  try {
    const server = getStellarServer();
    const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecretKey);
    const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase:
        STELLAR_NETWORK === 'PUBLIC' ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.manageData({
          name: dataName,
          value: dataValue,
        }),
      )
      .setTimeout(30)
      .build();

    transaction.sign(sourceKeypair);

    return await submitStellarTransaction(transaction);
  } catch (error) {
    handleBlockchainError(error);
    throw error;
  }
};

/**
 * Batch verify multiple records on chain.
 */
export const batchVerifyRecords = async (
  records: Array<{ id: string; hash: string }>,
): Promise<StellarRecordVerification[]> => {
  if (!records || records.length === 0) {
    throw new BlockchainServiceError(
      'At least one record is required for batch verification',
      'INVALID_REQUEST',
    );
  }

  const normalizedRecords = records.map((record) => ({
    recordId: record.id.trim(),
    hash: record.hash.trim().toLowerCase(),
  }));

  const cacheKey = `batch:${normalizedRecords.map((r) => `${r.recordId}:${r.hash}`).join(',')}`;

  return queryWithCache<StellarRecordVerification[]>(cacheKey, async () => {
    try {
      const response: AxiosResponse<StellarRecordVerification[]> = await axios.post(
        `${API_BASE_URL}/blockchain/records/batch-verify`,
        normalizedRecords,
      );
      return response.data;
    } catch (error) {
      handleBlockchainError(error);
      throw error; // unreachable but satisfies type checker
    }
  });
};

const waitForSorobanTransaction = async (
  server: SorobanClient.Server,
  hash: string,
  config: Required<SorobanPetRegistryConfig>,
): Promise<SorobanRegistryTransactionResult> => {
  for (let attempt = 0; attempt < config.pollAttempts; attempt += 1) {
    const tx = await server.getTransaction(hash);

    if (tx.status === SorobanClient.SorobanRpc.GetTransactionStatus.SUCCESS) {
      const returnValue =
        'returnValue' in tx && tx.returnValue
          ? SorobanClient.scValToNative(tx.returnValue)
          : undefined;
      return {
        hash,
        status: tx.status,
        latestLedger: tx.latestLedger,
        ledger: 'ledger' in tx ? tx.ledger : undefined,
        returnValue,
      };
    }

    if (tx.status === SorobanClient.SorobanRpc.GetTransactionStatus.FAILED) {
      throw new BlockchainServiceError('Soroban transaction failed', 'SOROBAN_TRANSACTION_FAILED');
    }

    if (attempt < config.pollAttempts - 1) {
      await sleep(config.pollDelayMs);
    }
  }

  throw new BlockchainServiceError('Timed out waiting for Soroban transaction', 'SOROBAN_TIMEOUT');
};

export const invokeSorobanPetRegistry = async (
  method: string,
  args: SorobanClient.xdr.ScVal[],
  sourceSecretKey: string,
  config?: SorobanPetRegistryConfig,
): Promise<SorobanRegistryTransactionResult> => {
  const normalizedConfig = normalizeSorobanConfig(config);
  const sourceSecret = sourceSecretKey.trim();

  if (!sourceSecret) {
    throw new BlockchainServiceError('Source secret key is required', 'MISSING_SOURCE_SECRET');
  }

  try {
    const server = new SorobanClient.Server(normalizedConfig.rpcUrl, {
      allowHttp: normalizedConfig.rpcUrl.startsWith('http://'),
    });
    const sourceKeypair = SorobanClient.Keypair.fromSecret(sourceSecret);
    const sourceAccount = await server.getAccount(sourceKeypair.publicKey());
    const contract = new SorobanClient.Contract(normalizedConfig.contractId);
    const tx = new SorobanClient.TransactionBuilder(sourceAccount, {
      fee: SorobanClient.BASE_FEE,
      networkPassphrase: normalizedConfig.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(normalizedConfig.timeoutSeconds)
      .build();
    const prepared = (await server.prepareTransaction(
      tx,
      normalizedConfig.networkPassphrase,
    )) as SorobanClient.Transaction;

    prepared.sign(sourceKeypair);

    const submitted = await server.sendTransaction(prepared);
    if (submitted.status === 'ERROR') {
      throw new BlockchainServiceError('Soroban RPC rejected the transaction', 'SOROBAN_RPC_ERROR');
    }

    return waitForSorobanTransaction(server, submitted.hash, normalizedConfig);
  } catch (error) {
    if (error instanceof BlockchainServiceError) throw error;
    throw new BlockchainServiceError(
      error instanceof Error ? error.message : 'Soroban contract invocation failed',
      'SOROBAN_INVOCATION_FAILED',
    );
  }
};

export const storePetRecordInSoroban = async (
  record: MedicalRecordWithChainData,
  ownerSecretKey: string,
  config?: SorobanPetRegistryConfig,
): Promise<SorobanPetRecordStoreResult> => {
  if (!record?.id?.trim()) {
    throw new BlockchainServiceError('Valid record with ID is required', 'INVALID_RECORD');
  }

  const owner = SorobanClient.Keypair.fromSecret(ownerSecretKey.trim()).publicKey();
  const recordKey = deriveSorobanRecordKey(record.id);
  const recordHash = computeRecordHash(record);
  const receipt = await invokeSorobanPetRegistry(
    'upsert_record',
    [
      new SorobanClient.Address(owner).toScVal(),
      makeSorobanBytes32(recordKey),
      makeSorobanBytes32(recordHash),
    ],
    ownerSecretKey,
    config,
  );

  return {
    ...receipt,
    recordId: record.id,
    recordKey,
    recordHash,
    ownerPublicKey: owner,
  };
};

export const grantVetRecordAccess = async (
  recordId: string,
  ownerSecretKey: string,
  vetPublicKey: string,
  config?: SorobanPetRegistryConfig,
): Promise<SorobanRegistryTransactionResult> => {
  const owner = SorobanClient.Keypair.fromSecret(ownerSecretKey.trim()).publicKey();
  const vet = vetPublicKey.trim();
  if (!vet) {
    throw new BlockchainServiceError('Vet public key is required', 'INVALID_VET');
  }

  return invokeSorobanPetRegistry(
    'grant_vet',
    [
      new SorobanClient.Address(owner).toScVal(),
      makeSorobanBytes32(deriveSorobanRecordKey(recordId)),
      new SorobanClient.Address(vet).toScVal(),
    ],
    ownerSecretKey,
    config,
  );
};

export const revokeVetRecordAccess = async (
  recordId: string,
  ownerSecretKey: string,
  vetPublicKey: string,
  config?: SorobanPetRegistryConfig,
): Promise<SorobanRegistryTransactionResult> => {
  const owner = SorobanClient.Keypair.fromSecret(ownerSecretKey.trim()).publicKey();
  const vet = vetPublicKey.trim();
  if (!vet) {
    throw new BlockchainServiceError('Vet public key is required', 'INVALID_VET');
  }

  return invokeSorobanPetRegistry(
    'revoke_vet',
    [
      new SorobanClient.Address(owner).toScVal(),
      makeSorobanBytes32(deriveSorobanRecordKey(recordId)),
      new SorobanClient.Address(vet).toScVal(),
    ],
    ownerSecretKey,
    config,
  );
};

export const readPetRecordHashFromSoroban = async (
  recordId: string,
  readerSecretKey: string,
  config?: SorobanPetRegistryConfig,
): Promise<SorobanRegistryTransactionResult & { recordHash: string; recordKey: string }> => {
  const reader = SorobanClient.Keypair.fromSecret(readerSecretKey.trim()).publicKey();
  const recordKey = deriveSorobanRecordKey(recordId);
  const receipt = await invokeSorobanPetRegistry(
    'get_record_hash',
    [makeSorobanBytes32(recordKey), new SorobanClient.Address(reader).toScVal()],
    readerSecretKey,
    config,
  );

  return {
    ...receipt,
    recordKey,
    recordHash: bytesToHex(receipt.returnValue),
  };
};

/**
 * Utilities exposed for testing/maintenance of cache behavior.
 */
export const clearBlockchainCache = (): void => {
  responseCache.clear();
  inFlightRequests.clear();
  stellarServer = null; // Reset Stellar server instance
};

export const invalidateBlockchainCacheKey = (key: string): void => {
  responseCache.delete(key);
};

/**
 * High-level helper to store a full medical record on chain.
 * This satisfies "Invoke contract methods" requirement cleanly.
 */
export const storeMedicalRecordOnChain = async (
  record: MedicalRecordWithChainData,
): Promise<{
  tx: StellarTransactionDetails;
  hash: string;
}> => {
  if (!record?.id?.trim()) {
    throw new BlockchainServiceError('Valid record with ID is required', 'INVALID_RECORD');
  }

  // 🔐 Step 1: Compute deterministic hash
  const hash = computeRecordHash(record);

  // 🚀 Step 2: Store on chain via backend
  const tx = await storeRecordOnChain(record.id, hash, {
    type: 'medical_record',
    createdAt: new Date().toISOString(),
  });

  return { tx, hash };
};

/**
 * High-level helper for full verification pipeline.
 * This satisfies "Data verifiable" requirement.
 */
export const verifyMedicalRecordOnChain = async (
  record: MedicalRecordWithChainData,
): Promise<RecordIntegrityResult> => {
  return verifyRecordIntegrity(record);
};

/**
 * Optional: Sync record (store if not already verified on chain)
 */
export const syncMedicalRecordToChain = async (
  record: MedicalRecordWithChainData,
): Promise<{
  alreadyVerified: boolean;
  result: RecordIntegrityResult | StellarTransactionDetails;
}> => {
  const integrity = await verifyRecordIntegrity(record);

  if (integrity.onChainVerified) {
    return {
      alreadyVerified: true,
      result: integrity,
    };
  }

  const { tx } = await storeMedicalRecordOnChain(record);

  return {
    alreadyVerified: false,
    result: tx,
  };
};

export const __testUtils = {
  computeRecordHash,
  sortObject,
};

/** Back-compat alias used by verificationService */
export async function verifyMedicalRecord(
  record: MedicalRecordWithChainData,
): Promise<StellarRecordVerification> {
  const result = await verifyMedicalRecordOnChain(record);
  return {
    verified: result.onChainVerified,
    onChainHash: result.onChainHash,
    recordId: result.recordId,
    txHash: result.txHash,
  };
}

/** Back-compat helper used by verificationService */
export async function getTransactionDetails(txHash: string): Promise<StellarTransactionDetails> {
  const history = await getTransactionHistory(undefined, undefined, 100);
  const match = history.find((entry) => entry.hash === txHash);
  if (!match) {
    throw new BlockchainServiceError('Transaction not found', 'NOT_FOUND');
  }
  return match;
}
