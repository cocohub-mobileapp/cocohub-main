import { sendAlertNotification } from '../../src/services/notificationService';
import { query } from '../src/db';

type ProviderKey = string;

interface WearableProviderDefinition {
  key: ProviderKey;
  name: string;
  scopes: string[];
  authUrl: string;
  tokenUrl?: string;
  apiBaseUrl: string;
  clientId?: string;
}

const PROVIDERS: Record<ProviderKey, WearableProviderDefinition> = {
  fitbark: {
    key: 'fitbark',
    name: 'FitBark',
    scopes: ['activity', 'sleep'],
    authUrl: process.env.FITBARK_AUTH_URL ?? 'https://app.fitbark.com/oauth/authorize',
    tokenUrl: process.env.FITBARK_TOKEN_URL ?? 'https://app.fitbark.com/oauth/token',
    apiBaseUrl: process.env.FITBARK_API_BASE_URL ?? 'https://app.fitbark.com/api/v2',
    clientId: process.env.FITBARK_CLIENT_ID,
  },
  whistle: {
    key: 'whistle',
    name: 'Whistle',
    scopes: ['activity', 'sleep'],
    authUrl: process.env.WHISTLE_AUTH_URL ?? 'https://app.whistle.com/oauth/authorize',
    tokenUrl: process.env.WHISTLE_TOKEN_URL,
    apiBaseUrl: process.env.WHISTLE_API_BASE_URL ?? 'https://app.whistle.com/api/v1',
    clientId: process.env.WHISTLE_CLIENT_ID,
  },
};

export function getSupportedProviders() {
  return Object.values(PROVIDERS).map((provider) => ({
    key: provider.key,
    name: provider.name,
    scopes: provider.scopes,
    configured: Boolean(provider.clientId),
  }));
}

export function buildOAuthAuthorizationUrl(
  providerKey: ProviderKey,
  petId: string,
  redirectUri: string,
): string | null {
  const provider = PROVIDERS[providerKey];
  const clientId =
    provider?.clientId ??
    (providerKey === 'fitbark' ? process.env.FITBARK_CLIENT_ID : undefined) ??
    (providerKey === 'whistle' ? process.env.WHISTLE_CLIENT_ID : undefined);
  if (!provider || !clientId) return null;

  const url = new URL(provider.authUrl);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', provider.scopes.join(' '));
  url.searchParams.set(
    'state',
    Buffer.from(JSON.stringify({ petId, providerKey })).toString('base64url'),
  );
  return url.toString();
}

async function fetchProviderJson(url: string, accessToken: string): Promise<any[]> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Wearable provider unavailable (${response.status})`);
  }

  const payload = await response.json();
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.activities)) return payload.activities;
  if (Array.isArray(payload.records)) return payload.records;
  return [];
}

interface ProviderTokenRecord {
  id?: number;
  pet_id: string;
  provider_key: ProviderKey;
  access_token: string;
  refresh_token?: string;
  expires_at?: string | null;
  raw?: any;
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
const PROVIDER_CLIENTS: Record<
  ProviderKey,
  { sync: (token: string, petId: string) => Promise<any[]> }
> = {
  fitbark: {
    async sync(token: string, petId: string) {
      const provider = PROVIDERS.fitbark;
      const today = new Date().toISOString().slice(0, 10);
      const baseUrl = provider.apiBaseUrl.replace(/\/$/, '');
      return fetchProviderJson(
        `${baseUrl}/pets/${encodeURIComponent(petId)}/activity?date=${today}`,
        token,
      );
    },
  },
  whistle: {
    async sync(token: string, petId: string) {
      const provider = PROVIDERS.whistle;
      const baseUrl = provider.apiBaseUrl.replace(/\/$/, '');
      return fetchProviderJson(`${baseUrl}/pets/${encodeURIComponent(petId)}/metrics`, token);
    },
  },
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
          calories: Math.floor(180 + Math.random() * 220),
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

export function normalizeProviderEvent(providerKey: ProviderKey, event: any): NormalizedMetric[] {
  // For each provider, map provider-specific fields to our normalized metrics.
  if (providerKey === 'mockfit' || providerKey === 'fitbark' || providerKey === 'whistle') {
    const recordedAt =
      event.ts ??
      event.timestamp ??
      event.recorded_at ??
      event.date ??
      event.start_time ??
      new Date().toISOString();
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
        value: Number(event.steps),
        unit: 'count',
        recordedAt,
      });
    }
    if (typeof event.calories === 'number' || typeof event.calories_burned === 'number') {
      metrics.push({
        ...base,
        metricType: 'calories',
        value: Number(event.calories ?? event.calories_burned),
        unit: 'kcal',
        recordedAt,
      });
    }
    if (typeof event.sleep_minutes === 'number') {
      metrics.push({
        ...base,
        metricType: 'sleep_duration',
        value: event.sleep_minutes,
        unit: 'minutes',
        recordedAt,
      });
    }
    if (typeof event.sleep === 'number') {
      metrics.push({
        ...base,
        metricType: 'sleep_duration',
        value: event.sleep,
        unit: 'minutes',
        recordedAt,
      });
    }
    if (typeof event.sleep_quality === 'number') {
      metrics.push({
        ...base,
        metricType: 'sleep_quality',
        value: event.sleep_quality,
        unit: 'ratio',
        recordedAt,
      });
    }
    if (typeof event.activity_score === 'number') {
      metrics.push({
        ...base,
        metricType: 'activity_score',
        value: event.activity_score,
        unit: 'score',
        recordedAt,
      });
    }
    if (typeof event.heart_rate === 'number') {
      metrics.push({
        ...base,
        metricType: 'heart_rate',
        value: event.heart_rate,
        unit: 'bpm',
        recordedAt,
      });
    }
    return metrics;
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
): Promise<{ imported: number; unavailable?: boolean; reason?: string }> {
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
  if (!client) return { imported: 0, unavailable: true, reason: 'unsupported_provider' };

  let events: any[] = [];
  try {
    events = await client.sync(refreshed.access_token, petId);
  } catch (err) {
    console.warn('wearable provider sync unavailable', { providerKey, petId, err });
    return { imported: 0, unavailable: true, reason: 'provider_unavailable' };
  }

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
  getSupportedProviders,
  buildOAuthAuthorizationUrl,
  connectProviderOAuth,
  syncProviderForPet,
  getActivitySummary,
  getHistoricalActivity,
  detectAnomaliesForPet,
  syncAllPetsDaily,
};
