/**
 * Generic API response wrapper for successful responses
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * Generic API error response
 */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    stack?: string;
  };
  timestamp: string;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T = unknown> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
  timestamp: string;
}

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Authentication - Login Request
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Authentication - Login Response
 */
export interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  token: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * Authentication - Register Request
 */
export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
  phone?: string;
  role?: string;
  referralCode?: string;
}

/**
 * Authentication - Register Response
 */
export interface RegisterResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  token: string;
  refreshToken?: string;
}

/**
 * Authentication - Refresh Token Request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Authentication - Refresh Token Response
 */
export interface RefreshTokenResponse {
  token: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * User - Get User Response
 */
export interface GetUserResponse {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  pets: Array<{
    id: string;
    name?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  isEmailVerified: boolean;
  lastLoginAt?: string;
}

/**
 * User - Update User Request
 */
export interface UpdateUserRequest {
  name?: string;
  phone?: string;
  role?: string;
}

/**
 * User - Update User Response
 */
export interface UpdateUserResponse {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  updatedAt: string;
}

/**
 * User - List Users Request
 */
export interface ListUsersRequest extends PaginationParams {
  role?: string;
  search?: string;
}

/**
 * Pet - Create Pet Request
 */
export interface CreatePetRequest {
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  microchipId?: string;
  photoUrl?: string;
  ownerId: string;
}

/**
 * Pet - Create Pet Response
 */
export interface CreatePetResponse {
  id: string;
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  microchipId?: string;
  photoUrl?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Pet - Get Pet Response
 */
export interface GetPetResponse {
  id: string;
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  microchipId?: string;
  photoUrl?: string;
  ownerId: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Pet - Update Pet Request
 */
export interface UpdatePetRequest {
  name?: string;
  species?: string;
  breed?: string;
  dateOfBirth?: string;
  microchipId?: string;
  photoUrl?: string;
}

/**
 * Pet - List Pets Request
 */
export interface ListPetsRequest extends PaginationParams {
  ownerId?: string;
  species?: string;
  search?: string;
}

/**
 * Medical Record - Create Medical Record Request
 */
export interface CreateMedicalRecordRequest {
  petId: string;
  vetId: string;
  type: 'checkup' | 'vaccination' | 'surgery' | 'treatment' | 'other';
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  visitDate: string;
  nextVisitDate?: string;
}

/**
 * Medical Record - Create Medical Record Response
 */
export interface CreateMedicalRecordResponse {
  id: string;
  petId: string;
  vetId: string;
  type: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  visitDate: string;
  nextVisitDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Medical Record - Get Medical Record Response
 */
export interface GetMedicalRecordResponse {
  id: string;
  petId: string;
  vetId: string;
  vet?: {
    id: string;
    name: string;
    email: string;
  };
  type: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  visitDate: string;
  nextVisitDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Medical Record - List Medical Records Request
 */
export interface ListMedicalRecordsRequest extends PaginationParams {
  petId?: string;
  vetId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  diagnosis?: string;
}

/**
 * Waitlist - Join Waitlist Request
 */
export interface JoinWaitlistRequest {
  vetId: string;
  petId: string;
  preferredDateStart: string;
  preferredDateEnd: string;
}

/**
 * Waitlist - Waitlist Entry (API shape)
 */
export interface WaitlistEntryDto {
  id: string;
  userId: string;
  vetId: string;
  petId: string;
  preferredDateStart: string;
  preferredDateEnd: string;
  status: 'WAITING' | 'NOTIFIED' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  position: number;
  estimatedWaitMinutes: number;
  notifiedAt: string | null;
  acceptanceDeadline: string | null;
  appointmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Waitlist - Accept Slot Request
 */
export interface AcceptWaitlistSlotRequest {
  appointmentId: string;
}

/**
 * Waitlist - Position Info Response
 */
export interface WaitlistPositionResponse {
  entryId: string;
  position: number;
  estimatedWaitMinutes: number;
  status: string;
}

/**
 * Blockchain - Store Record Request
 */
export interface StoreRecordRequest {
  recordId: string;
  hash: string;
  metadata?: Record<string, unknown>;
}

/**
 * Blockchain - Store Record Response
 */
export interface StoreRecordResponse {
  hash: string;
  txHash: string;
  successful: boolean;
  ledger?: number;
  createdAt?: string;
  sourceAccount?: string;
  feeCharged?: string;
  memo?: string;
  operationCount?: number;
}

/**
 * Blockchain - Verify Record Request
 */
export interface VerifyRecordRequest {
  recordId: string;
  hash: string;
}

/**
 * Blockchain - Verify Record Response
 */
export interface VerifyRecordResponse {
  verified: boolean;
  onChainHash?: string;
  recordId: string;
  ledger?: number;
  txHash?: string;
  timestamp?: string;
}

/**
 * Blockchain - Retrieve Record Hash Response
 */
export interface RetrieveRecordHashResponse {
  hash: string;
  txHash: string;
  timestamp: string;
  ledger?: number;
}

/**
 * Blockchain - Transaction History Request
 */
export interface TransactionHistoryRequest {
  recordId?: string;
  accountId?: string;
  limit?: number;
}

/**
 * Blockchain - Transaction History Response
 */
export interface TransactionHistoryResponse {
  hash: string;
  successful: boolean;
  ledger?: number;
  createdAt?: string;
  sourceAccount?: string;
  feeCharged?: string;
  memo?: string;
  operationCount?: number;
}

/**
 * Blockchain - Network Info Response
 */
export interface NetworkInfoResponse {
  network: string;
  horizonUrl: string;
  passphrase: string;
  currentLedger: number;
  latestLedger: number;
}

/**
 * Blockchain - Batch Verify Request
 */
export interface BatchVerifyRequest {
  records: Array<{
    recordId: string;
    hash: string;
  }>;
}

/**
 * Blockchain - Batch Verify Response
 */
export interface BatchVerifyResponse {
  verified: boolean;
  onChainHash?: string;
  recordId: string;
  ledger?: number;
  txHash?: string;
  timestamp?: string;
}

/**
 * API Endpoint paths
 */
export const API_ENDPOINTS = {
  // Authentication
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_REFRESH: '/auth/refresh',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_VERIFY_EMAIL: '/auth/verify-email',
  AUTH_FORGOT_PASSWORD: '/auth/forgot-password',
  AUTH_RESET_PASSWORD: '/auth/reset-password',

  // Users
  USERS_LIST: '/users',
  USERS_GET: '/users/:id',
  USERS_CREATE: '/users',
  USERS_UPDATE: '/users/:id',
  USERS_DELETE: '/users/:id',
  USERS_ME: '/users/me',

  // Pets
  PETS_LIST: '/pets',
  PETS_GET: '/pets/:id',
  PETS_CREATE: '/pets',
  PETS_UPDATE: '/pets/:id',
  PETS_DELETE: '/pets/:id',
  PETS_BY_OWNER: '/pets/owner/:ownerId',

  // Medical Records
  MEDICAL_RECORDS_LIST: '/medical-records',
  MEDICAL_RECORDS_GET: '/medical-records/:id',
  MEDICAL_RECORDS_CREATE: '/medical-records',
  MEDICAL_RECORDS_UPDATE: '/medical-records/:id',
  MEDICAL_RECORDS_DELETE: '/medical-records/:id',
  MEDICAL_RECORDS_BY_PET: '/medical-records/pet/:petId',

  // Appointments
  APPOINTMENTS_LIST: '/appointments',
  APPOINTMENTS_GET: '/appointments/:id',
  APPOINTMENTS_CREATE: '/appointments',
  APPOINTMENTS_UPDATE: '/appointments/:id',
  APPOINTMENTS_DELETE: '/appointments/:id',

  // Medications
  MEDICATIONS_LIST: '/medications',
  MEDICATIONS_GET: '/medications/:id',
  MEDICATIONS_CREATE: '/medications',
  MEDICATIONS_UPDATE: '/medications/:id',
  MEDICATIONS_DELETE: '/medications/:id',

  // Blockchain
  BLOCKCHAIN_RECORDS_VERIFY: '/blockchain/records/verify',
  BLOCKCHAIN_RECORDS_STORE: '/blockchain/records/store',
  BLOCKCHAIN_RECORDS_RETRIEVE: '/blockchain/records/:id/hash',
  BLOCKCHAIN_RECORDS_BATCH_VERIFY: '/blockchain/records/batch-verify',
  BLOCKCHAIN_TRANSACTIONS_GET: '/blockchain/transactions/:txHash',
  BLOCKCHAIN_TRANSACTIONS_HISTORY: '/blockchain/transactions/history',
  BLOCKCHAIN_NETWORK_INFO: '/blockchain/network/info',

  // AI Predictions & Symptom Checker
  PREDICTIONS_SYMPTOMS: '/predictions/symptoms',

  // Session Monitoring
  MONITORING_SESSION_START: '/monitoring/sessions/start',
  MONITORING_SESSION_END: '/monitoring/sessions/end',
  MONITORING_CRASHES: '/monitoring/crashes',
  MONITORING_EVENTS: '/monitoring/events',
  MONITORING_ANALYTICS_CRASH_FREE: '/monitoring/analytics/crash-free',
  MONITORING_ANALYTICS_CRASH_FLOWS: '/monitoring/analytics/crash-flows',
  MONITORING_ANALYTICS_DEVICE_BREAKDOWN: '/monitoring/analytics/device-breakdown',
  MONITORING_ALERTS: '/monitoring/alerts',
} as const;

/**
 * HTTP Methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * API Request configuration
 */
export interface ApiRequestConfig {
  method: HttpMethod;
  endpoint: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
}

/**
 * Type guard to check if response is an error
 */
export function isApiError(response: ApiResponse | ApiError): response is ApiError {
  return response.success === false;
}

/**
 * Type guard to check if response is paginated
 */
export function isPaginatedResponse<T>(
  response: ApiResponse<T> | PaginatedResponse<T>,
): response is PaginatedResponse<T> {
  return 'pagination' in response;
}

// ─── Multisig / Joint Ownership Types ────────────────────────────────────────

/**
 * Multisig - Create Joint Ownership Request
 */
export interface CreateJointOwnershipRequest {
  petId: string;
  initiatorPublicKey: string;
  coOwners: Array<{
    userId: string;
    name: string;
    email: string;
    publicKey: string;
    weight: number;
  }>;
  /** Minimum total weight required for critical operations (M-of-N) */
  requiredWeight: number;
}

/**
 * Multisig - Co-owner summary in responses
 */
export interface CoOwnerResponse {
  userId: string;
  name: string;
  email: string;
  publicKey: string;
  weight: number;
  status: 'pending' | 'active' | 'revoked';
  invitedAt: string;
  acceptedAt?: string;
}

/**
 * Multisig - Joint Ownership Response
 */
export interface JointOwnershipResponse {
  id: string;
  petId: string;
  multisigAccountId: string;
  multisigPublicKey: string;
  coOwners: CoOwnerResponse[];
  thresholds: { low: number; medium: number; high: number };
  requiredWeight: number;
  totalWeight: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Multisig - Pending Transaction Response
 */
export interface PendingTransactionResponse {
  id: string;
  multisigAccountId: string;
  operationType: 'ownership_transfer' | 'record_deletion' | 'signer_management';
  description: string;
  requiredSignatures: number;
  currentSignatureCount: number;
  signers: Array<{
    publicKey: string;
    userId?: string;
    name?: string;
    hasSigned: boolean;
    signedAt?: string;
  }>;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdBy: string;
  expiresAt: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Multisig - Sign Transaction Request
 */
export interface SignTransactionRequest {
  transactionId: string;
  /** Base64-encoded signed transaction XDR */
  signedTransactionXdr: string;
  signerPublicKey: string;
}

/**
 * Multisig - Initiate Ownership Transfer Request
 */
export interface InitiateOwnershipTransferRequest {
  petId: string;
  jointOwnershipId: string;
  newOwnerPublicKey: string;
  newOwnerUserId: string;
  reason?: string;
}

/**
 * Multisig - Initiate Record Deletion Request
 */
export interface InitiateRecordDeletionRequest {
  petId: string;
  jointOwnershipId: string;
  recordId: string;
  recordType: 'medical_record' | 'vaccination' | 'medication';
  reason: string;
}

/**
 * Multisig - Invite Co-owner Request
 */
export interface InviteCoOwnerRequest {
  petId: string;
  jointOwnershipId: string;
  invitedEmail: string;
  invitedUserId?: string;
  weight: number;
}

/**
 * Multisig - Key Rotation Request
 */
export interface KeyRotationRequest {
  jointOwnershipId: string;
  oldPublicKey: string;
  newPublicKey: string;
  reason?: string;
}

// Extend API_ENDPOINTS with multisig routes
export const MULTISIG_ENDPOINTS = {
  JOINT_OWNERSHIP_CREATE: '/joint-ownership',
  JOINT_OWNERSHIP_GET: '/joint-ownership/:id',
  JOINT_OWNERSHIP_BY_PET: '/joint-ownership/pet/:petId',
  JOINT_OWNERSHIP_INVITE: '/joint-ownership/:id/invite',
  JOINT_OWNERSHIP_ACCEPT_INVITE: '/joint-ownership/invites/:inviteId/accept',
  JOINT_OWNERSHIP_DECLINE_INVITE: '/joint-ownership/invites/:inviteId/decline',
  JOINT_OWNERSHIP_PENDING_INVITES: '/joint-ownership/invites/pending',
  MULTISIG_TRANSACTIONS_LIST: '/multisig/transactions',
  MULTISIG_TRANSACTIONS_PENDING: '/multisig/transactions/pending',
  MULTISIG_TRANSACTION_SIGN: '/multisig/transactions/:id/sign',
  MULTISIG_TRANSACTION_REJECT: '/multisig/transactions/:id/reject',
  MULTISIG_OWNERSHIP_TRANSFER: '/multisig/ownership-transfer',
  MULTISIG_RECORD_DELETION: '/multisig/record-deletion',
  MULTISIG_KEY_ROTATION: '/multisig/key-rotation',
  MULTISIG_ACCOUNT_STATUS: '/multisig/accounts/:multisigAccountId/status',
} as const;
// ─── Session Monitoring Types ─────────────────────────────────────────────────

/**
 * Device metadata captured at session start
 */
export interface SessionDeviceMetadata {
  model: string;
  os: string;
  osVersion: string;
  appVersion: string;
  platform: string;
}

/**
 * Monitoring - Start Session Request
 */
export interface StartSessionRequest {
  sessionId: string;
  startedAt: string;
  device: SessionDeviceMetadata;
  appVersion: string;
}

/**
 * Monitoring - Start Session Response
 */
export interface StartSessionResponse {
  sessionId: string;
  recorded: boolean;
}

/**
 * Monitoring - End Session Request
 */
export interface EndSessionRequest {
  sessionId: string;
  endedAt: string;
  status: 'ended' | 'abnormal';
  durationMs: number;
  flowPath: string[];
  errorCount: number;
  hasCrash: boolean;
  recoveredFromInterruption?: boolean;
}

/**
 * Monitoring - End Session Response
 */
export interface EndSessionResponse {
  sessionId: string;
  recorded: boolean;
}

/**
 * Monitoring - Crash Report Request
 */
export interface CrashReportRequest {
  sessionId: string;
  error: string;
  stack?: string;
  timestamp: number;
  appVersion: string;
  device: SessionDeviceMetadata;
  activeFlow: string;
  flowPath: string[];
}

/**
 * Monitoring - Crash Report Response
 */
export interface CrashReportResponse {
  crashId: string;
  recorded: boolean;
}

/**
 * Monitoring - Session Event (single event in a batch)
 */
export interface SessionEventPayload {
  id: string;
  sessionId: string;
  type:
    | 'session_start'
    | 'session_end'
    | 'navigation'
    | 'error'
    | 'crash'
    | 'user_action'
    | 'network_error'
    | 'api_error';
  flow: string;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Monitoring - Batch Events Request
 */
export interface BatchEventsRequest {
  events: SessionEventPayload[];
}

/**
 * Monitoring - Batch Events Response
 */
export interface BatchEventsResponse {
  accepted: number;
  rejected: number;
  total: number;
}

/**
 * Monitoring - Crash-Free Stats Response
 */
export interface CrashFreeStatsResponse {
  appVersion: string;
  totalSessions: number;
  crashedSessions: number;
  crashFreeRate: number;
  isBelowThreshold: boolean;
  topCrashFlows: Array<{
    flow: string;
    crashCount: number;
    percentage: number;
  }>;
  byDevice: Array<{
    model: string;
    crashCount: number;
    crashFreeRate: number;
  }>;
  byOsVersion: Array<{
    os: string;
    osVersion: string;
    crashCount: number;
    crashFreeRate: number;
  }>;
  calculatedAt: string;
}

/**
 * Monitoring - Alert Request
 */
export interface MonitoringAlertRequest {
  type: 'crash_free_rate_below_threshold';
  appVersion: string;
  currentRate: number;
  threshold: number;
  timestamp: string;
}

/**
 * Monitoring - Alert Response
 */
export interface MonitoringAlertResponse {
  recorded: boolean;
}
