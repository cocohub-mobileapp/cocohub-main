/**
 * Frontend wearable service — wraps the /api/activity backend endpoints.
 * Provides typed helpers for device status, synchronization, and historical
 * metric retrieval used by the wearable dashboard in PetHealthMetricsScreen.
 */
import apiClient from './apiClient';

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

export interface WearableProviderInfo {
  key: WearableProviderKey;
  name: string;
  description: string;
  supportsOAuth: boolean;
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
  | 'heart_rate'
  | 'sleep_duration'
  | 'sleep_quality'
  | 'activity_score'
  | 'gps_distance';

export const WEARABLE_PROVIDERS: WearableProviderInfo[] = [
  {
    key: 'fitbark',
    name: 'FitBark',
    description: 'Daily activity and sleep sync',
    supportsOAuth: true,
  },
  {
    key: 'whistle',
    name: 'Whistle',
    description: 'GPS distance and activity sync',
    supportsOAuth: false,
  },
  {
    key: 'mockfit',
    name: 'MockFit',
    description: 'Demo wearable provider',
    supportsOAuth: false,
  },
];

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

/**
 * Trigger an on-demand sync for the given pet + provider.
 * Defaults to the 'mockfit' mock provider used in development.
 */
export async function syncWearable(
  petId: string,
  providerKey: WearableProviderKey = 'mockfit',
): Promise<{ imported: number }> {
  const res = await apiClient.post<{ data: { imported: number } }>('/activity/sync', {
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
  WEARABLE_PROVIDERS,
  getWearableStatus,
  syncWearable,
  connectWearable,
  getHistoricalMetrics,
  getActivitySummary,
};

export default wearableService;
