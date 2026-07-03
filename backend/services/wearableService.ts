import { sendAlertNotification } from '../../src/services/notificationService';
import { query } from '../src/db';

type ProviderKey = string;

type ProviderClient = {
  sync: (token: string, petId: string) => Promise<any[]>;
};

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

// Provider clients stay credential-safe: configured providers skip sync until
// their API base URL, activity path, and stored access token are present.
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
    async sync(token: string, petId: string) {
      return fetchConfiguredProviderEvents('fitbark', token, petId);
    },
  },
  whistle: {
    async sync(token: string, petId: string) {
      return fetchConfiguredProviderEvents('whistle', token, petId);
    },
  },
};

function providerEnvName(providerKey: ProviderKey, suffix: string): string {
  return `${providerKey.replace(/[^a-z0-9]/gi, '_').toUpperCase()}_${suffix}`;
}

function resolveConfiguredProviderUrl(providerKey: ProviderKey, petId: string): string | null {
  const baseUrl = process.env[providerEnvName(providerKey, 'API_BASE_URL')]?.trim();
  const activityPath = process.env[providerEnvName(providerKey, 'ACTIVITY_PATH')]?.trim();

  if (!baseUrl || !activityPath) return null;

  const url = new URL(activityPath, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (!url.searchParams.has('petId') && !url.searchParams.has('pet_id')) {
    url.searchParams.set('petId', petId);
  }
  return url.toString();
}

async function fetchConfiguredProviderEvents(
  providerKey: ProviderKey,
  token: string,
  petId: string,
): Promise<any[]> {
  const url = resolveConfiguredProviderUrl(providerKey, petId);
  if (!url || !token) {
    console.warn(
      `[wearableService] ${providerKey} API config is absent; skipping wearable sync for ${petId}`,
    );
    return [];
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`${providerKey} sync failed with HTTP ${response.status}`);
  }

  return extractProviderEvents(await response.json());
}

function extractProviderEvents(payload: any): any[] {
  if (Array.isArray(payload)) return payload;

  const candidates = [
    payload?.data,
    payload?.events,
    payload?.activities,
    payload?.activity,
    payload?.records,
    payload?.daily,
    payload?.daily_activity,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return payload ? [payload] : [];
}

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

function readNumber(...values: any[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function readTimestamp(event: any): string {
  return String(
    event.ts ??
      event.timestamp ??
      event.recorded_at ??
      event.recordedAt ??
      event.date ??
      event.day ??
      new Date().toISOString(),
  );
}

function readBaseEventId(event: any): string | null {
  const id = event.id ?? event.eventId ?? event.event_id ?? event.uuid ?? event.date ?? event.day;
  return id === undefined || id === null ? null : String(id);
}

function createMetric(
  providerKey: ProviderKey,
  event: any,
  metricType: string,
  value: number | undefined,
  unit: string,
): NormalizedMetric | null {
  if (value === undefined || !Number.isFinite(value)) return null;

  const baseEventId = readBaseEventId(event);
  return {
    petId: String(event.petId ?? event.pet_id ?? 'unknown'),
    providerKey,
    providerEventId: baseEventId ? `${baseEventId}:${metricType}` : null,
    raw: event,
    metricType,
    value,
    unit,
    recordedAt: readTimestamp(event),
  };
}

function compactMetrics(metrics: Array<NormalizedMetric | null>): NormalizedMetric[] {
  return metrics.filter((metric): metric is NormalizedMetric => metric !== null);
}

export function normalizeProviderEvent(providerKey: ProviderKey, event: any): NormalizedMetric[] {
  // For each provider, map provider-specific fields to our normalized metrics.
  if (providerKey === 'mockfit') {
    return compactMetrics([
      createMetric(providerKey, event, 'steps', readNumber(event.steps), 'count'),
      createMetric(
        providerKey,
        event,
        'sleep_duration',
        readNumber(event.sleep_minutes),
        'minutes',
      ),
      createMetric(providerKey, event, 'sleep_quality', readNumber(event.sleep_quality), 'ratio'),
      createMetric(providerKey, event, 'activity_score', readNumber(event.activity_score), 'score'),
      createMetric(providerKey, event, 'heart_rate', readNumber(event.heart_rate), 'bpm'),
    ]);
  }

  if (providerKey === 'fitbark') {
    return compactMetrics([
      createMetric(
        providerKey,
        event,
        'steps',
        readNumber(event.steps, event.activity?.steps, event.daily_activity?.steps),
        'count',
      ),
      createMetric(
        providerKey,
        event,
        'sleep_duration',
        readNumber(
          event.sleep_minutes,
          event.sleep?.minutes,
          event.sleep?.duration_minutes,
          event.daily_activity?.sleep_minutes,
        ),
        'minutes',
      ),
      createMetric(
        providerKey,
        event,
        'sleep_quality',
        readNumber(event.sleep_quality, event.sleep_score, event.sleep?.score),
        'ratio',
      ),
      createMetric(
        providerKey,
        event,
        'activity_score',
        readNumber(
          event.activity_score,
          event.bark_points,
          event.barkpoints,
          event.health_index,
          event.activity?.score,
        ),
        'score',
      ),
    ]);
  }

  if (providerKey === 'whistle') {
    return compactMetrics([
      createMetric(
        providerKey,
        event,
        'steps',
        readNumber(event.steps, event.activity?.steps),
        'count',
      ),
      createMetric(
        providerKey,
        event,
        'activity_score',
        readNumber(event.activity_score, event.activity?.score, event.activity?.active_minutes),
        'score',
      ),
      createMetric(
        providerKey,
        event,
        'distance',
        readNumber(event.distance_meters, event.activity?.distance_meters),
        'meters',
      ),
      createMetric(
        providerKey,
        event,
        'gps_latitude',
        readNumber(event.latitude, event.location?.latitude, event.gps?.lat),
        'degrees',
      ),
      createMetric(
        providerKey,
        event,
        'gps_longitude',
        readNumber(event.longitude, event.location?.longitude, event.gps?.lon, event.gps?.lng),
        'degrees',
      ),
    ]);
  }

  // Default: attempt best-effort mappings
  return compactMetrics([
    createMetric(providerKey, event, 'steps', readNumber(event.steps), 'count'),
  ]);
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

  const events = await client.sync(refreshed.access_token, petId);

  const metrics: NormalizedMetric[] = [];
  for (const ev of events) {
    metrics.push(...normalizeProviderEvent(providerKey, ev));
  }

  if (metrics.length === 0) return { imported: 0 };

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
