/**
 * Frontend wearable service — wraps the /api/activity backend endpoints.
 * Provides typed helpers for device status, synchronization, and historical
 * metric retrieval used by the wearable dashboard in PetHealthMetricsScreen.
 */
import apiClient from './apiClient';
import { getItem, setItem } from './localDB';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WearableStatus {
  connected: boolean;
  providerKey?: string;
  /** ISO date string of last successful sync */
  lastSync?: string;
}

export type WearableProviderKey = 'fitbark' | 'whistle' | 'mockfit';

export interface WearableProvider {
  key: WearableProviderKey;
  name: string;
  scopes: string[];
  configured: boolean;
}

export interface ConnectedWearable {
  petId: string;
  providerKey: WearableProviderKey;
  connectedAt: string;
}

export interface ActivitySummaryRow {
  metric_type: string;
  avg: string;
  sum: string;
}

export interface HistoricalPoint {
  recorded_at: string;
  value: number;
}

export type MetricType =
  | 'steps'
  | 'calories'
  | 'heart_rate'
  | 'sleep_duration'
  | 'sleep_quality'
  | 'activity_score';

const CONNECTED_WEARABLES_KEY = '@connected_wearables_v1';

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

function unwrap<T>(data: { success?: boolean; data?: T } | T): T {
  if (
    data !== null &&
    typeof data === 'object' &&
    'success' in (data as object) &&
    'data' in (data as object)
  ) {
    return (data as { success: boolean; data: T }).data;
  }
  return data as T;
}

/**
 * Check whether a wearable provider is connected for the given pet.
 */
export async function getWearableStatus(petId: string): Promise<WearableStatus> {
  try {
    const res = await apiClient.get<{ data: WearableStatus }>(`/activity/status/${petId}`);
    return unwrap(res.data);
  } catch {
    return { connected: false };
  }
}

export async function getWearableProviders(): Promise<WearableProvider[]> {
  try {
    const res = await apiClient.get<{ data: WearableProvider[] }>('/activity/providers');
    return unwrap(res.data) ?? [];
  } catch {
    return [
      { key: 'fitbark', name: 'FitBark', scopes: ['activity', 'sleep'], configured: false },
      { key: 'whistle', name: 'Whistle', scopes: ['activity', 'sleep'], configured: false },
    ];
  }
}

export async function startWearableOAuth(
  petId: string,
  providerKey: WearableProviderKey,
  redirectUri?: string,
): Promise<string | null> {
  try {
    const res = await apiClient.get<{ data: { authUrl: string } }>(
      `/activity/oauth/${providerKey}/start`,
      { params: { petId, redirectUri } },
    );
    return unwrap(res.data)?.authUrl ?? null;
  } catch {
    return null;
  }
}

/**
 * Trigger an on-demand sync for the given pet + provider.
 * Defaults to the 'mockfit' mock provider used in development.
 */
export async function syncWearable(
  petId: string,
  providerKey: WearableProviderKey = 'mockfit',
): Promise<{ imported: number; unavailable?: boolean; reason?: string }> {
  const res = await apiClient.post<{
    data: { imported: number; unavailable?: boolean; reason?: string };
  }>('/activity/sync', {
    petId,
    providerKey,
  });
  return unwrap(res.data);
}

/**
 * Connect a wearable provider for a pet (OAuth or direct token exchange).
 */
export async function connectWearable(
  petId: string,
  providerKey: WearableProviderKey,
  accessToken: string,
): Promise<void> {
  await apiClient.post('/activity/connect', { petId, providerKey, accessToken });
  await rememberConnectedWearable(petId, providerKey);
}

export async function rememberConnectedWearable(
  petId: string,
  providerKey: WearableProviderKey,
): Promise<void> {
  const existing = await getConnectedWearables();
  const next = [
    ...existing.filter((entry) => !(entry.petId === petId && entry.providerKey === providerKey)),
    { petId, providerKey, connectedAt: new Date().toISOString() },
  ];
  await setItem(CONNECTED_WEARABLES_KEY, JSON.stringify(next));
}

export async function getConnectedWearables(): Promise<ConnectedWearable[]> {
  const raw = await getItem(CONNECTED_WEARABLES_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function syncConnectedWearables(): Promise<number> {
  const connected = await getConnectedWearables();
  let imported = 0;
  for (const entry of connected) {
    try {
      const result = await syncWearable(entry.petId, entry.providerKey);
      imported += result.imported;
    } catch {
      // Individual provider failures are non-fatal; background fetch will retry later.
    }
  }
  return imported;
}

/**
 * Fetch historical metric data for a pet over the last 7 days.
 */
export async function getHistoricalMetrics(
  petId: string,
  metricType: MetricType,
  days = 7,
): Promise<HistoricalPoint[]> {
  const to = new Date().toISOString();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  try {
    const res = await apiClient.get<{ data: HistoricalPoint[] }>(`/activity/historical/${petId}`, {
      params: { metricType, from, to },
    });
    return unwrap(res.data) ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetch the 24-hour activity summary for a pet (steps, sleep, etc.)
 */
export async function getActivitySummary(petId: string): Promise<ActivitySummaryRow[]> {
  try {
    const res = await apiClient.get<{ data: ActivitySummaryRow[] }>(`/activity/summary/${petId}`);
    return unwrap(res.data) ?? [];
  } catch {
    return [];
  }
}

const wearableService = {
  getWearableStatus,
  getWearableProviders,
  startWearableOAuth,
  syncWearable,
  connectWearable,
  rememberConnectedWearable,
  getConnectedWearables,
  syncConnectedWearables,
  getHistoricalMetrics,
  getActivitySummary,
};

export default wearableService;
