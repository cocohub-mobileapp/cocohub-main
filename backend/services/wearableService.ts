import { sendAlertNotification } from '../../src/services/notificationService';
import { query } from '../src/db';

type ProviderKey = string;

interface ProviderTokenRecord {
  id?: number;
  pet_id: string;
  provider_key: ProviderKey;
  access_token: string;
  refresh_token?: string;
  expires_at?: string | null;
  raw?: any;
}

interface ProviderClient {
  sync: (token: string, petId: string) => Promise<any[]>;
  requiresApiKey?: string;
}

export interface NormalizedMetric {
  petId: string;
  metricType: string; // e.g. steps, sleep_duration, sleep_quality, activity_score
  value: number;
  unit?: string;
  recordedAt: string; // ISO
  providerKey: ProviderKey;
  providerEventId?: string | null;
  raw?: any;
}

// Minimal provider client interface — real integrations should be implemented
// separately. We include a mock provider here for tests and local development.
async function fetchProviderJson(url: string, token: string, apiKey?: string): Promise<any> {
  const fetchFn = globalThis.fetch as
    | ((
        input: string,
        init?: Record<string, unknown>,
      ) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>)
    | undefined;

  if (!fetchFn) return [];

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (apiKey) headers['X-API-Key'] = apiKey;

  const response = await fetchFn(url, { headers });
  if (!response.ok) {
    throw new Error(`Wearable provider request failed with ${response.status}`);
  }
  return response.json();
}

function rowsFromProviderPayload(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.activities)) return payload.activities;
  if (Array.isArray(payload?.records)) return payload.records;
  if (Array.isArray(payload?.daily_activity)) return payload.daily_activity;
  return payload ? [payload] : [];
}

const PROVIDER_CLIENTS: Record<ProviderKey, ProviderClient> = {
  mockfit: {
    async sync(_token: string, petId: string) {
      const events = [];
      const now = new Date();
      // Generate events for the last 7 days
      for (let i = 0; i < 7; i++) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        events.push({
          id: `mf_evt_${d.getTime()}`,
          ts: d.toISOString(),
          steps: Math.floor(4000 + Math.random() * 6000), // 4,000 to 10,000 steps
          sleep_minutes: Math.floor(360 + Math.random() * 180), // 6 to 9 hours of sleep
          sleep_quality: parseFloat((0.65 + Math.random() * 0.3).toFixed(2)),
          activity_score: Math.floor(30 + Math.random() * 70),
          heart_rate: Math.floor(65 + Math.random() * 55), // 65 to 120 bpm
          petId,
        });
      }
      return events;
    },
  },
  fitbark: {
    requiresApiKey: 'FITBARK_CLIENT_ID',
    async sync(token: string, petId: string) {
      const clientId = process.env.FITBARK_CLIENT_ID;
      if (!clientId) return [];
      const baseUrl = process.env.FITBARK_API_BASE_URL ?? 'https://app.fitbark.com/api/v2';
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const payload = await fetchProviderJson(
        `${baseUrl}/activity_series?from=${from}&to=${to}&pet_id=${encodeURIComponent(petId)}`,
        token,
        clientId,
      );
      return rowsFromProviderPayload(payload).map((row) => ({ ...row, petId }));
    },
  },
  whistle: {
    requiresApiKey: 'WHISTLE_API_KEY',
    async sync(token: string, petId: string) {
      const apiKey = process.env.WHISTLE_API_KEY;
      if (!apiKey) return [];
      const baseUrl = process.env.WHISTLE_API_BASE_URL ?? 'https://api.whistle.com/v1';
      const payload = await fetchProviderJson(
        `${baseUrl}/pets/${encodeURIComponent(petId)}/activity`,
        token,
        apiKey,
      );
      return rowsFromProviderPayload(payload).map((row) => ({ ...row, petId }));
    },
  },
};

export async function connectProviderOAuth(
  petId: string,
  providerKey: ProviderKey,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: string,
  raw?: any,
): Promise<void> {
  await query(
    `INSERT INTO wearable_tokens (pet_id, provider_key, access_token, refresh_token, expires_at, raw, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, now(), now())
     ON CONFLICT (provider_key, pet_id) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at, raw = EXCLUDED.raw, updated_at = now()`,
    [petId, providerKey, accessToken, refreshToken ?? null, expiresAt ?? null, raw ?? {}],
  );
}

export async function refreshTokenIfNeeded(
  record: ProviderTokenRecord,
): Promise<ProviderTokenRecord> {
  // caller should implement provider-specific refresh flows. Here we simply
  // return the record unchanged as a safe default.
  return record;
}

function normalizeProviderEvent(providerKey: ProviderKey, event: any): NormalizedMetric[] {
  // For each provider, map provider-specific fields to our normalized metrics.
  if (providerKey === 'mockfit') {
    const base = {
      petId: String(event.petId ?? event.pet_id ?? 'unknown'),
      providerKey,
      providerEventId: event.id ?? event.eventId ?? null,
      raw: event,
    };

    const metrics: NormalizedMetric[] = [];
    if (typeof event.steps === 'number') {
      metrics.push({
        ...base,
        metricType: 'steps',
        value: event.steps,
        unit: 'count',
        recordedAt: event.ts,
      });
    }
    if (typeof event.sleep_minutes === 'number') {
      metrics.push({
        ...base,
        metricType: 'sleep_duration',
        value: event.sleep_minutes,
        unit: 'minutes',
        recordedAt: event.ts,
      });
    }
    if (typeof event.sleep_quality === 'number') {
      metrics.push({
        ...base,
        metricType: 'sleep_quality',
        value: event.sleep_quality,
        unit: 'ratio',
        recordedAt: event.ts,
      });
    }
    if (typeof event.activity_score === 'number') {
      metrics.push({
        ...base,
        metricType: 'activity_score',
        value: event.activity_score,
        unit: 'score',
        recordedAt: event.ts,
      });
    }
    if (typeof event.heart_rate === 'number') {
      metrics.push({
        ...base,
        metricType: 'heart_rate',
        value: event.heart_rate,
        unit: 'bpm',
        recordedAt: event.ts,
      });
    }
    return metrics;
  }

  if (providerKey === 'fitbark') {
    const recordedAt =
      event.date ??
      event.recorded_at ??
      event.recordedAt ??
      event.timestamp ??
      new Date().toISOString();
    const base = {
      petId: String(event.petId ?? event.pet_id ?? 'unknown'),
      providerKey,
      providerEventId: event.id ?? event.event_id ?? `fitbark_${recordedAt}`,
      raw: event,
    };
    const metrics: NormalizedMetric[] = [];
    const activityScore = event.activity_score ?? event.bark_points ?? event.points;
    const steps = event.steps ?? event.step_count;
    const sleepMinutes = event.sleep_minutes ?? event.sleep_duration_minutes;

    if (activityScore != null) {
      metrics.push({
        ...base,
        metricType: 'activity_score',
        value: Number(activityScore),
        unit: 'score',
        recordedAt,
      });
    }
    if (steps != null) {
      metrics.push({
        ...base,
        metricType: 'steps',
        value: Number(steps),
        unit: 'count',
        recordedAt,
      });
    }
    if (sleepMinutes != null) {
      metrics.push({
        ...base,
        metricType: 'sleep_duration',
        value: Number(sleepMinutes),
        unit: 'minutes',
        recordedAt,
      });
    }
    return metrics.filter((metric) => Number.isFinite(metric.value));
  }

  if (providerKey === 'whistle') {
    const recordedAt =
      event.recorded_at ??
      event.recordedAt ??
      event.timestamp ??
      event.date ??
      new Date().toISOString();
    const base = {
      petId: String(event.petId ?? event.pet_id ?? 'unknown'),
      providerKey,
      providerEventId: event.id ?? event.event_id ?? `whistle_${recordedAt}`,
      raw: event,
    };
    const metrics: NormalizedMetric[] = [];
    const activityMinutes = event.active_minutes ?? event.activity_minutes;
    const steps = event.steps ?? event.step_count;
    const distance = event.distance_meters ?? event.distance;

    if (activityMinutes != null) {
      metrics.push({
        ...base,
        metricType: 'activity_score',
        value: Number(activityMinutes),
        unit: 'minutes',
        recordedAt,
      });
    }
    if (steps != null) {
      metrics.push({
        ...base,
        metricType: 'steps',
        value: Number(steps),
        unit: 'count',
        recordedAt,
      });
    }
    if (distance != null) {
      metrics.push({
        ...base,
        metricType: 'gps_distance',
        value: Number(distance),
        unit: 'meters',
        recordedAt,
      });
    }
    return metrics.filter((metric) => Number.isFinite(metric.value));
  }

  // Default: attempt best-effort mappings
  const recordedAt = event.timestamp ?? event.ts ?? new Date().toISOString();
  const entries: NormalizedMetric[] = [];
  if (event.steps)
    entries.push({
      petId: String(event.petId ?? 'unknown'),
      metricType: 'steps',
      value: Number(event.steps),
      unit: 'count',
      recordedAt,
      providerKey,
      providerEventId: event.id ?? null,
      raw: event,
    });
  return entries;
}

export async function syncProviderForPet(
  providerKey: ProviderKey,
  petId: string,
): Promise<{ imported: number }> {
  // Load token
  const res = await query('SELECT * FROM wearable_tokens WHERE provider_key = $1 AND pet_id = $2', [
    providerKey,
    petId,
  ]);
  const tokenRecord = res.rows[0];
  if (!tokenRecord) return { imported: 0 };

  // Refresh token if provider requires it
  const refreshed = await refreshTokenIfNeeded(tokenRecord as ProviderTokenRecord);

  const client = PROVIDER_CLIENTS[providerKey];
  if (!client) return { imported: 0 };

  if (client.requiresApiKey && !process.env[client.requiresApiKey]) return { imported: 0 };

  const events = await client.sync(refreshed.access_token, petId);

  const metrics: NormalizedMetric[] = [];
  for (const ev of events) {
    metrics.push(...normalizeProviderEvent(providerKey, ev));
  }

  // Upsert metrics
  let imported = 0;
  for (const m of metrics) {
    const text = `INSERT INTO activity_metrics (pet_id, metric_type, value, unit, recorded_at, provider_key, provider_event_id, raw, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now())
      ON CONFLICT (provider_key, provider_event_id) DO UPDATE SET value = EXCLUDED.value, raw = EXCLUDED.raw, recorded_at = EXCLUDED.recorded_at`;
    const params = [
      m.petId,
      m.metricType,
      m.value,
      m.unit ?? null,
      m.recordedAt,
      m.providerKey,
      m.providerEventId ?? null,
      m.raw ?? {},
    ];
    await query(text, params);
    imported += 1;
  }

  // Detect anomalies after import
  try {
    await detectAnomaliesForPet(petId);
  } catch (err) {
    console.error('Anomaly detection failed', err);
  }

  return { imported };
}

export async function getActivitySummary(petId: string) {
  const text = `SELECT metric_type, AVG(value) as avg, SUM(value) as sum FROM activity_metrics WHERE pet_id = $1 AND recorded_at > now() - interval '24 hours' GROUP BY metric_type`;
  const res = await query(text, [petId]);
  return res.rows;
}

export async function getHistoricalActivity(
  petId: string,
  metricType: string,
  fromIso: string,
  toIso: string,
) {
  const text = `SELECT recorded_at, value FROM activity_metrics WHERE pet_id = $1 AND metric_type = $2 AND recorded_at >= $3 AND recorded_at <= $4 ORDER BY recorded_at ASC`;
  const res = await query(text, [petId, metricType, fromIso, toIso]);
  return res.rows;
}

export async function detectAnomaliesForPet(
  petId: string,
  options?: { windowDays?: number; thresholdPct?: number },
) {
  const windowDays = options?.windowDays ?? 14;
  const thresholdPct = options?.thresholdPct ?? 0.5; // 50% drop triggers

  // Compute baseline (rolling average over historical window) for steps
  const baselineRes = await query(
    `SELECT AVG(value) as baseline FROM activity_metrics WHERE pet_id = $1 AND metric_type = 'steps' AND recorded_at > now() - ($2::int || ' days')::interval`,
    [petId, windowDays],
  );
  const baseline = Number(baselineRes.rows[0]?.baseline ?? 0);

  if (!baseline || baseline <= 0) return null;

  // Compute recent average (last 24h)
  const recentRes = await query(
    `SELECT AVG(value) as recent FROM activity_metrics WHERE pet_id = $1 AND metric_type = 'steps' AND recorded_at > now() - interval '24 hours'`,
    [petId],
  );
  const recent = Number(recentRes.rows[0]?.recent ?? 0);

  if (recent / baseline < 1 - thresholdPct) {
    // Trigger alert
    const percentDrop = Math.round((1 - recent / baseline) * 100);
    const title = 'Unusual activity drop detected';
    const body = `Pet has ${percentDrop}% fewer steps compared to the ${windowDays}-day baseline.`;
    await sendAlertNotification(title, body, { source: 'wearable-anomaly', petId });
    return { alerted: true, percentDrop };
  }

  return { alerted: false };
}

export async function syncAllPetsDaily(): Promise<void> {
  // Find all distinct pet/provider token pairs
  const res = await query('SELECT pet_id, provider_key FROM wearable_tokens');
  for (const row of res.rows) {
    try {
      await syncProviderForPet(row.provider_key, row.pet_id);
    } catch (err) {
      console.error('sync failed for', row, err);
    }
  }
}

export default {
  connectProviderOAuth,
  syncProviderForPet,
  getActivitySummary,
  getHistoricalActivity,
  detectAnomaliesForPet,
  syncAllPetsDaily,
};
