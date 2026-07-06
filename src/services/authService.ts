import axios, { type AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';

import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenResponse,
} from '../../backend/types/api';
import { API_ENDPOINTS } from '../../backend/types/api';
import config from '../config';
import { hashPassword } from '../utils/encryption';
import {
  authenticateWithBiometricGate,
  clearSecureTokens,
  disableBiometricAuthentication as disableBiometricStorage,
  enableBiometricAuthentication as enableBiometricStorage,
  getBiometricAvailability,
  getSecureRefreshToken,
  getSecureToken,
  getSecureTokens,
  isBiometricAuthenticationEnabled as isBiometricStorageEnabled,
  storeSecureTokens,
} from '../utils/encryption/keychain';
import { logError } from '../utils/errorLogger';
import sessionMonitoringService from './sessionMonitoringService';

// ─── Custom error ─────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthSession {
  user: LoginResponse['user'];
  token: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface StoredSession {
  token: string;
  refreshToken?: string;
}

type OAuthProvider = 'google' | 'apple' | 'facebook';

const _OAUTH_ENDPOINTS: Record<OAuthProvider, string> = {
  google: '/auth/oauth/google',
  apple: '/auth/oauth/apple',
  facebook: '/auth/oauth/facebook',
} as const;

export const OAUTH_ENDPOINTS = _OAUTH_ENDPOINTS;

interface JwtPayload {
  sub: string;
  exp: number;
  iat: number;
  [key: string]: unknown;
}

interface AxiosLikeError {
  isAxiosError: true;
  response?: {
    status?: number;
    data?: { error?: { message?: string } };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    const error = new AuthError('Malformed JWT', 'INVALID_TOKEN');
    logError(error, { service: 'authService', action: 'decode_jwt' });
    throw error;
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    const bytes: number[] = [];
    for (let i = 0; i < padded.length; i += 4) {
      const c1 = chars.indexOf(padded[i]);
      const c2 = chars.indexOf(padded[i + 1]);
      const c3 = chars.indexOf(padded[i + 2]);
      const c4 = chars.indexOf(padded[i + 3]);
      if (c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0) {
        const error = new AuthError('Failed to decode JWT payload', 'INVALID_TOKEN');
        logError(error, { service: 'authService', action: 'decode_jwt' });
        throw error;
      }
      const chunk = (c1 << 18) | (c2 << 12) | ((c3 & 63) << 6) | (c4 & 63);
      bytes.push((chunk >> 16) & 255);
      if (padded[i + 2] !== '=') bytes.push((chunk >> 8) & 255);
      if (padded[i + 3] !== '=') bytes.push(chunk & 255);
    }
    const raw = decodeURIComponent(
      bytes.map((b) => '%' + b.toString(16).padStart(2, '0')).join(''),
    );
    return JSON.parse(raw) as JwtPayload;
  } catch {
    const error = new AuthError('Failed to decode JWT payload', 'INVALID_TOKEN');
    logError(error, { service: 'authService', action: 'decode_jwt' });
    throw error;
  }
}

function _isTokenExpired(token: string): boolean {
  try {
    const { exp } = decodeJwtPayload(token);
    return Date.now() / 1000 >= exp - 30;
  } catch {
    return true;
  }
}

// ─── API client ───────────────────────────────────────────────────────────────

function createAuthClient(): AxiosInstance {
  return axios.create({
    baseURL: config.api.baseUrl,
    timeout: config.api.timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
}

const authClient = createAuthClient();

// ─── Public API ───────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthSession> {
  if (!email || !password) {
    const error = new AuthError('Email and password are required', 'MISSING_CREDENTIALS');
    logError(error, { service: 'authService', action: 'login_validation' });
    throw error;
  }

  try {
    const payload: LoginRequest = { email, password };
    const { data } = await authClient.post<LoginResponse>(API_ENDPOINTS.AUTH_LOGIN, payload);

    await storeSecureTokens({
      token: data.token,
      refreshToken: data.refreshToken,
    });

    return {
      user: data.user,
      token: data.token,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
    };
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      logError(err, { service: 'authService', action: 'login_auth_error' });
      throw err;
    }

    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosLikeError;
      const status = axiosErr.response?.status;

      logError(err as Error, {
        service: 'authService',
        action: 'login_request',
        email,
        status,
      });

      if (status === 401) throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');
      if (status === 429)
        throw new AuthError('Too many attempts, please try again later', 'RATE_LIMITED');

      const msg = axiosErr.response?.data?.error?.message;
      throw new AuthError(msg ?? 'Login failed', 'LOGIN_FAILED');
    }

    logError(err as Error, { service: 'authService', action: 'login_unknown' });
    throw new AuthError('Network error during login', 'NETWORK_ERROR');
  }
}

export async function register(payload: RegisterRequest): Promise<AuthSession> {
  if (!payload.email || !payload.password || !payload.name) {
    const error = new AuthError('Missing registration fields', 'MISSING_REGISTRATION_FIELDS');
    logError(error, { service: 'authService', action: 'register_validation' });
    throw error;
  }

  try {
    const { data } = await authClient.post<RegisterResponse>(API_ENDPOINTS.AUTH_REGISTER, payload);

    await storeSecureTokens({
      token: data.token,
      refreshToken: data.refreshToken,
    });

    return {
      user: data.user,
      token: data.token,
      refreshToken: data.refreshToken,
    };
  } catch (err: unknown) {
    logError(err as Error, { service: 'authService', action: 'register' });

    if (axios.isAxiosError(err)) {
      const msg = (err as AxiosLikeError).response?.data?.error?.message;
      throw new AuthError(msg ?? 'Registration failed', 'REGISTRATION_FAILED');
    }

    throw new AuthError('Network error during registration', 'NETWORK_ERROR');
  }
}

export async function refreshToken(): Promise<string> {
  try {
    const storedRefresh = await getSecureRefreshToken();
    if (!storedRefresh) {
      await clearSecureTokens();
      const error = new AuthError('No refresh token available', 'NO_REFRESH_TOKEN');
      logError(error, { service: 'authService', action: 'refresh_missing_token' });
      throw error;
    }

    const { data } = await authClient.post<RefreshTokenResponse>(API_ENDPOINTS.AUTH_REFRESH, {
      refreshToken: storedRefresh,
    });

    await storeSecureTokens({
      token: data.token,
      refreshToken: data.refreshToken ?? storedRefresh,
    });

    return data.token;
  } catch (err: unknown) {
    await clearSecureTokens();

    logError(err as Error, { service: 'authService', action: 'refresh_token' });

    throw new AuthError('Token refresh failed', 'REFRESH_FAILED');
  }
}

export async function logout(): Promise<void> {
  await clearSecureTokens();
}

export async function verifyEmail(token: string): Promise<void> {
  try {
    await authClient.post('/auth/verify-email', { token });
  } catch (err) {
    logError(err as Error, { service: 'authService', action: 'verify_email' });
    if (axios.isAxiosError(err)) {
      const msg = (err as AxiosLikeError).response?.data?.error?.message;
      throw new AuthError(msg ?? 'Email verification failed', 'VERIFICATION_FAILED');
    }
    throw new AuthError('Email verification failed', 'VERIFICATION_FAILED');
  }
}

export async function resendVerificationEmail(): Promise<void> {
  try {
    const token = await getSecureToken();
    await authClient.post(
      '/auth/resend-verification',
      {},
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
  } catch (err) {
    logError(err as Error, { service: 'authService', action: 'resend_verification' });
    throw new AuthError('Failed to resend verification email', 'RESEND_FAILED');
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await authClient.post('/auth/forgot-password', { email });
  } catch (err) {
    logError(err as Error, { service: 'authService', action: 'request_password_reset' });
    throw new AuthError('Failed to send password reset email', 'RESET_FAILED');
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  try {
    await authClient.post('/auth/reset-password', { token, newPassword });
  } catch (err) {
    logError(err as Error, { service: 'authService', action: 'reset_password' });
    if (axios.isAxiosError(err)) {
      const msg = (err as AxiosLikeError).response?.data?.error?.message;
      throw new AuthError(msg ?? 'Password reset failed', 'RESET_FAILED');
    }
    throw new AuthError('Password reset failed. Please request a new link.', 'RESET_FAILED');
  }
}

export async function isBiometricAuthenticationAvailable(): Promise<boolean> {
  const availability = await getBiometricAvailability();
  return availability.isAvailable;
}

export async function isBiometricAuthenticationEnabled(): Promise<boolean> {
  return isBiometricStorageEnabled();
}

export async function disableBiometricAuthentication(): Promise<void> {
  await disableBiometricStorage();
}

export async function promptForBiometricSetup(): Promise<boolean> {
  try {
    await enableBiometricStorage();
    return true;
  } catch {
    return false;
  }
}

export async function getStoredToken(): Promise<string | null> {
  return getSecureToken();
}

export async function getStoredTokens(): Promise<StoredSession | null> {
  return getSecureTokens();
}

export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    return await authenticateWithBiometricGate('Authenticate to access Cocohub');
  } catch {
    return false;
  }
}

export async function getToken(): Promise<string | null> {
  const token = await getSecureToken();
  if (!token) return null;
  if (_isTokenExpired(token)) return refreshToken();
  return token;
}

export async function getSession(): Promise<StoredSession | null> {
  const tokens = await getSecureTokens();
  if (!tokens) return null;
  if (_isTokenExpired(tokens.token)) {
    const token = await refreshToken();
    return { token, refreshToken: tokens.refreshToken };
  }
  return tokens;
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getToken()) !== null;
}

export async function authenticateWithBiometrics(): Promise<StoredSession> {
  const available = await isBiometricAuthenticationAvailable();
  const enabled = await isBiometricAuthenticationEnabled();
  if (!available || !enabled)
    throw new AuthError('Biometric authentication is unavailable', 'BIOMETRIC_UNAVAILABLE');
  const ok = await authenticateWithBiometric();
  if (!ok) throw new AuthError('Biometric authentication failed', 'BIOMETRIC_AUTH_FAILED');
  const session = await getSession();
  if (!session) throw new AuthError('No stored session available', 'NO_SESSION');
  return session;
}

/**
 * Require biometric re-authentication if the last check was more than 5 minutes ago.
 * If biometrics fail or are unavailable, falls back to PIN entry.
 * If both fail, returns false — the caller should navigate back.
 */
export async function requireBiometric(): Promise<'authenticated' | 'pin_fallback' | 'failed'> {
  const isExpired = await sessionMonitoringService.isBiometricCheckExpired();
  if (!isExpired) {
    // Recent check still valid — no need to re-auth
    return 'authenticated';
  }

  // Attempt biometric authentication
  const biometricOk = await authenticateWithBiometric();
  if (biometricOk) {
    await sessionMonitoringService.setLastBiometricCheck();
    return 'authenticated';
  }

  // Biometric failed or unavailable — fall back to PIN
  const available = await isBiometricAuthenticationAvailable();
  if (!available) {
    // Biometrics not available at all — try PIN if set
    return 'pin_fallback';
  }

  return 'pin_fallback';
}

/**
 * Attempt PIN-based authentication as fallback.
 * Returns true if PIN is verified, false otherwise.
 */
export async function authenticateWithPin(): Promise<boolean> {
  // The caller will prompt the user for their PIN and pass it here
  // This returns a promise that resolves when the PIN modal is done
  return false; // Placeholder — actual PIN prompting is handled in the UI
}

const PIN_HASH_KEY = 'com.cocohub.auth.pin.hash';
let pinFailures = 0;
let biometricFailures = 0;
let lastForegroundAt = Date.now();
let inMemorySecret: string | null = null;

export async function setPin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(PIN_HASH_KEY, hashPassword(pin));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const expected = await SecureStore.getItemAsync(PIN_HASH_KEY);
  const valid = !!expected && expected === hashPassword(pin);
  if (valid) {
    pinFailures = 0;
    return true;
  }
  pinFailures += 1;
  if (pinFailures >= 5) {
    inMemorySecret = null;
    await clearSecureTokens();
  }
  return false;
}

export async function shouldPromptOnForeground(idleTimeoutMs = 5 * 60 * 1000): Promise<boolean> {
  const elapsed = Date.now() - lastForegroundAt;
  lastForegroundAt = Date.now();
  return elapsed >= idleTimeoutMs && (await isAuthenticated());
}

export async function authenticateOnForeground(
  idleTimeoutMs?: number,
): Promise<'unlocked' | 'pin_required' | 'not_required'> {
  if (!(await shouldPromptOnForeground(idleTimeoutMs))) return 'not_required';
  if (!(await isBiometricAuthenticationEnabled())) return 'pin_required';
  const ok = await authenticateWithBiometric();
  if (ok) {
    biometricFailures = 0;
    return 'unlocked';
  }
  biometricFailures += 1;
  return biometricFailures >= 3 ? 'pin_required' : 'not_required';
}

// ─── Biometric fallback (Issue #404) ─────────────────────────────────────────

const FALLBACK_PREF_KEY = 'com.cocohub.auth.biometric.fallback.pref';
const MAX_BIOMETRIC_ATTEMPTS = 3;

export type BiometricFallbackReason = 'unavailable' | 'max_attempts_reached' | 'user_preference';

export interface BiometricLoginResult {
  success: boolean;
  fallbackRequired: boolean;
  fallbackReason?: BiometricFallbackReason;
  session?: StoredSession;
}

/**
 * Attempt biometric login with automatic fallback after 3 failures.
 * Persists fallback preference in SecureStore.
 */
export async function loginWithBiometricOrFallback(): Promise<BiometricLoginResult> {
  const available = await isBiometricAuthenticationAvailable();
  if (!available) {
    return { success: false, fallbackRequired: true, fallbackReason: 'unavailable' };
  }

  const enabled = await isBiometricAuthenticationEnabled();
  if (!enabled) {
    return { success: false, fallbackRequired: true, fallbackReason: 'user_preference' };
  }

  // Check if user previously chose fallback
  const pref = await SecureStore.getItemAsync(FALLBACK_PREF_KEY);
  if (pref === 'pin') {
    return { success: false, fallbackRequired: true, fallbackReason: 'user_preference' };
  }

  let attempts = 0;
  while (attempts < MAX_BIOMETRIC_ATTEMPTS) {
    const ok = await authenticateWithBiometric();
    if (ok) {
      biometricFailures = 0;
      const session = await getSession();
      if (!session) {
        return { success: false, fallbackRequired: true, fallbackReason: 'unavailable' };
      }
      return { success: true, fallbackRequired: false, session };
    }
    attempts += 1;
    biometricFailures += 1;
  }

  // Max attempts reached — switch to fallback
  await SecureStore.setItemAsync(FALLBACK_PREF_KEY, 'pin');
  return { success: false, fallbackRequired: true, fallbackReason: 'max_attempts_reached' };
}

/**
 * Clear the fallback preference so biometrics are re-prompted on next login.
 */
export async function clearBiometricFallbackPreference(): Promise<void> {
  await SecureStore.deleteItemAsync(FALLBACK_PREF_KEY);
  biometricFailures = 0;
}

/**
 * After a successful fallback login, offer to re-enable biometrics.
 */
export async function shouldPromptBiometricSetup(): Promise<boolean> {
  const available = await isBiometricAuthenticationAvailable();
  if (!available) return false;
  const pref = await SecureStore.getItemAsync(FALLBACK_PREF_KEY);
  return pref === 'pin';
}

export function setInMemorySecret(secret: string | null): void {
  inMemorySecret = secret;
}

export function getInMemorySecret(): string | null {
  return inMemorySecret;
}

// ─── OAuth 2.0 / PKCE ────────────────────────────────────────────────────────

export interface OAuthSession extends AuthSession {
  refreshToken: string;
}

/**
 * Step 1: Get a PKCE challenge from the backend.
 * The code_verifier is stored server-side; the client only holds state + code_challenge.
 */
export async function initOAuthPKCE(): Promise<{
  state: string;
  code_challenge: string;
  code_challenge_method: string;
}> {
  const { data } = await authClient.post<{
    success: boolean;
    data: { state: string; code_challenge: string; code_challenge_method: string };
  }>('/auth/oauth/pkce-init');
  return data.data;
}

/**
 * Step 2: After the user completes the provider's auth flow, send the
 * authorization code + state to the backend for server-side token exchange.
 * Client secrets are NEVER in the app.
 */
export async function loginWithOAuth(
  provider: OAuthProvider,
  code: string,
  state: string,
  name?: string, // Apple sends name only on first login
): Promise<OAuthSession> {
  try {
    const { data } = await authClient.post<{
      success: boolean;
      data: { user: AuthSession['user']; token: string; refreshToken: string; expiresIn: number };
    }>(`/auth/oauth/${provider}`, { code, state, name });

    await storeSecureTokens({ token: data.data.token, refreshToken: data.data.refreshToken });

    return {
      user: data.data.user,
      token: data.data.token,
      refreshToken: data.data.refreshToken,
      expiresIn: data.data.expiresIn,
    };
  } catch (err) {
    logError(err as Error, { service: 'authService', action: 'oauth_login', provider });
    if (axios.isAxiosError(err)) {
      const msg = (err as AxiosLikeError).response?.data?.error?.message;
      throw new AuthError(msg ?? `${provider} login failed`, 'OAUTH_FAILED');
    }
    throw new AuthError(`${provider} login failed`, 'OAUTH_FAILED');
  }
}

/** Refresh an OAuth access token using the stored refresh token. */
export async function refreshOAuthToken(): Promise<string> {
  const storedRefresh = await getSecureRefreshToken();
  if (!storedRefresh) throw new AuthError('No refresh token', 'NO_REFRESH_TOKEN');

  try {
    const { data } = await authClient.post<{
      success: boolean;
      data: { token: string; refreshToken: string; expiresIn: number };
    }>('/auth/oauth/refresh', { refreshToken: storedRefresh });

    await storeSecureTokens({ token: data.data.token, refreshToken: data.data.refreshToken });
    return data.data.token;
  } catch (err) {
    await clearSecureTokens();
    logError(err as Error, { service: 'authService', action: 'oauth_refresh' });
    throw new AuthError('Token refresh failed', 'REFRESH_FAILED');
  }
}

/** Revoke the current refresh token (logout). */
export async function revokeOAuthToken(): Promise<void> {
  const storedRefresh = await getSecureRefreshToken();
  if (!storedRefresh) return;
  try {
    const token = await getSecureToken();
    await authClient.post(
      '/auth/oauth/revoke',
      { refreshToken: storedRefresh },
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch {
    // Best-effort — always clear local tokens
  } finally {
    await clearSecureTokens();
  }
}

/** Get linked OAuth providers for the current user. */
export async function getLinkedProviders(): Promise<
  { provider: OAuthProvider; linkedAt: string }[]
> {
  const token = await getSecureToken();
  const { data } = await authClient.get<{
    success: boolean;
    data: { linked: { provider: OAuthProvider; linkedAt: string }[] };
  }>('/auth/oauth/providers', { headers: { Authorization: `Bearer ${token}` } });
  return data.data.linked;
}

/** Link an additional OAuth provider to the current account. */
export async function linkOAuthProvider(
  provider: OAuthProvider,
  code: string,
  state: string,
): Promise<void> {
  const token = await getSecureToken();
  await authClient.post(
    '/auth/oauth/link',
    { provider, code, state },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

/** Unlink an OAuth provider from the current account. */
export async function unlinkOAuthProvider(provider: OAuthProvider): Promise<void> {
  const token = await getSecureToken();
  await authClient.delete(`/auth/oauth/unlink/${provider}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
