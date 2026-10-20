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
  | 'activity_score';

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
  providerKey = 'mockfit',
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
  providerKey: string,
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


// ==============================
// FITBARK & WHISTLE INTEGRATION (#29)
// ==============================

export interface FitBarkActivity {
  petId: string;
  date: string;
  barkPoints: number;
  activeMinutes: number;
  restMinutes: number;
  playMinutes: number;
}

export interface WhistleTelemetry {
  petId: string;
  latitude: number;
  longitude: number;
  batteryPercent: number;
  distanceMeters: number;
  lastUpdated: string;
}

export interface ConnectedDevice {
  providerId: 'fitbark' | 'whistle';
  deviceName: string;
  connected: boolean;
  lastSync?: string;
}

/**
 * Connect & pull daily activity from FitBark OAuth API (#29)
 */
export async function fetchFitBarkDailyActivity(
  petId: string,
  apiKey = process.env.FITBARK_API_KEY,
  date?: string,
): Promise<{ success: boolean; data?: FitBarkActivity; error?: string }> {
  if (!apiKey) {
    return { success: false, error: 'FitBark API key not configured' };
  }
  try {
    const targetDate = date ?? new Date().toISOString().slice(0, 10);
    const res = await apiClient.get<{ data: FitBarkActivity }>('/activity/fitbark/' + petId, {
      params: { date: targetDate },
      headers: { Authorization: 'Bearer ' + apiKey },
    });
    return { success: true, data: unwrap(res.data) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to fetch FitBark activity' };
  }
}

/**
 * Connect & pull telemetry from Whistle REST API (#29)
 */
export async function fetchWhistleGpsAndActivity(
  petId: string,
  apiToken = process.env.WHISTLE_API_TOKEN,
): Promise<{ success: boolean; data?: WhistleTelemetry; error?: string }> {
  if (!apiToken) {
    return { success: false, error: 'Whistle API credentials not configured' };
  }
  try {
    const res = await apiClient.get<{ data: WhistleTelemetry }>('/activity/whistle/' + petId, {
      headers: { Authorization: 'Bearer ' + apiToken },
    });
    return { success: true, data: unwrap(res.data) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to fetch Whistle telemetry' };
  }
}

/**
 * Retrieve connected wearable devices for settings UI (#29)
 */
export async function getConnectedDevices(petId: string): Promise<ConnectedDevice[]> {
  try {
    const res = await apiClient.get<{ data: ConnectedDevice[] }>('/activity/devices/' + petId);
    return unwrap(res.data) ?? [];
  } catch {
    return [
      { providerId: 'fitbark', deviceName: 'FitBark Activity Monitor', connected: false },
      { providerId: 'whistle', deviceName: 'Whistle Health & GPS Collar', connected: false },
    ];
  }
}

const wearableService = {
  fetchFitBarkDailyActivity,
  fetchWhistleGpsAndActivity,
  getConnectedDevices,
  getWearableStatus,
  syncWearable,
  connectWearable,
  getHistoricalMetrics,
  getActivitySummary,
};

export default wearableService;
