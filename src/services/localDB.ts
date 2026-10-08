import * as SQLite from 'expo-sqlite';

import { encrypt, decrypt } from '../utils/encryption';

const db = SQLite.openDatabaseSync('cocohub.db');

/**
 * Helper to safely decrypt data, falling back to original data if decryption fails.
 * This handles transition from unencrypted to encrypted data.
 */
async function safeDecrypt<T = string>(
  data: string,
  purpose: string,
  parseJson: boolean = false,
): Promise<T> {
  try {
    return await decrypt<T>(data, purpose, parseJson);
  } catch {
    // If decryption fails, it might be unencrypted legacy data
    if (parseJson) {
      try {
        return JSON.parse(data) as T;
      } catch {
        // Not JSON either, return as is if T is string
        return data as unknown as T;
      }
    }
    return data as unknown as T;
  }
}

export async function executeSql(
  sql: string,
  params: SQLite.SQLiteBindParams = [],
): Promise<SQLite.SQLiteRunResult> {
  return db.runAsync(sql, params);
}

async function init(): Promise<void> {
  // Key-value store for misc JSON blobs
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY NOT NULL, value TEXT)`,
  );

  // Structured tables for medications and dose logs
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS medications (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL)`,
  );

  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS dose_logs (id TEXT PRIMARY KEY NOT NULL, medication_id TEXT, taken_at TEXT, skipped INTEGER, notes TEXT, data TEXT NOT NULL)`,
  );

  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS health_metrics (id TEXT PRIMARY KEY NOT NULL, pet_id TEXT NOT NULL, recorded_at TEXT NOT NULL, data TEXT NOT NULL)`,
  );

  // Appointments table – indexed by pet_id and scheduled_at for conflict lookups
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY NOT NULL,
      pet_id TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      data TEXT NOT NULL
    )`,
  );
  await db.execAsync(
    `CREATE INDEX IF NOT EXISTS idx_appointments_pet_scheduled ON appointments (pet_id, scheduled_at)`,
  );

  // SOAP note drafts – one draft per (petId, vetId) pair
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS soap_note_drafts (
      id TEXT PRIMARY KEY NOT NULL,
      pet_id TEXT NOT NULL,
      vet_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );
  await db.execAsync(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_soap_drafts_pet_vet ON soap_note_drafts (pet_id, vet_id)`,
  );
}

// Initialize DB on module import
init().catch(() => {});

// KV helpers (compat with AsyncStorage-like API)
export async function getItem(key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM kv_store WHERE key = ? LIMIT 1`,
    [key],
  );
  if (!row) return null;
  return await safeDecrypt(row.value, `localdb_kv_${key}`);
}

export async function setItem(key: string, value: string): Promise<void> {
  const encryptedValue = await encrypt(value, `localdb_kv_${key}`);
  await db.runAsync(`INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)`, [
    key,
    encryptedValue,
  ]);
}

export async function removeItem(key: string): Promise<void> {
  await db.runAsync(`DELETE FROM kv_store WHERE key = ?`, [key]);
}

export async function multiGet(keys: string[]): Promise<Array<[string, string | null]>> {
  if (keys.length === 0) return [];
  const placeholders = keys.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM kv_store WHERE key IN (${placeholders})`,
    keys,
  );
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }

  return await Promise.all(
    keys.map(async (k) => {
      const val = map[k];
      return [k, val ? await safeDecrypt(val, `localdb_kv_${k}`) : null] as [string, string | null];
    }),
  );
}

export async function multiSet(items: Array<[string, string]>): Promise<void> {
  const encryptedItems = await Promise.all(
    items.map(async ([k, v]) => {
      const encryptedValue = await encrypt(v, `localdb_kv_${k}`);
      return [k, encryptedValue] as [string, string];
    }),
  );

  await db.withTransactionAsync(async () => {
    for (const [k, v] of encryptedItems) {
      await db.runAsync(`INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)`, [k, v]);
    }
  });
}

// Medications CRUD
export async function getAllMedications<T = unknown>(): Promise<T[]> {
  const rows = await db.getAllAsync<{ data: string }>(`SELECT data FROM medications`);
  const out: T[] = [];
  for (const row of rows) {
    try {
      const decrypted = await safeDecrypt<T>(row.data, 'localdb_medications', true);
      out.push(decrypted);
    } catch {
      // ignore bad rows
    }
  }
  return out;
}

export async function upsertMedication<T extends { id: string }>(med: T): Promise<void> {
  const encryptedData = await encrypt(med, 'localdb_medications');
  await db.runAsync(`INSERT OR REPLACE INTO medications (id, data) VALUES (?, ?)`, [
    med.id,
    encryptedData,
  ]);
}

export async function deleteMedicationById(id: string): Promise<void> {
  await db.runAsync(`DELETE FROM medications WHERE id = ?`, [id]);
}

// Dose logs
export async function getDoseLogs<T = unknown>(): Promise<T[]> {
  const rows = await db.getAllAsync<{ data: string }>(
    `SELECT data FROM dose_logs ORDER BY taken_at ASC`,
  );
  const out: T[] = [];
  for (const row of rows) {
    try {
      const decrypted = await safeDecrypt<T>(row.data, 'localdb_dose_logs', true);
      out.push(decrypted);
    } catch {
      // ignore
    }
  }
  return out;
}

export async function addDoseLog<
  T extends {
    id: string;
    medicationId?: string;
    takenAt?: string;
    skipped?: boolean;
    notes?: string;
  },
>(log: T): Promise<void> {
  const encryptedData = await encrypt(log, 'localdb_dose_logs');
  await db.runAsync(
    `INSERT OR REPLACE INTO dose_logs (id, medication_id, taken_at, skipped, notes, data) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.medicationId ?? null,
      log.takenAt ?? null,
      log.skipped ? 1 : 0,
      log.notes ?? null,
      encryptedData,
    ],
  );
}

export async function clearDoseLogs(): Promise<void> {
  await db.runAsync(`DELETE FROM dose_logs`);
}

export async function getHealthMetricsByPetId(petId: string): Promise<unknown[]> {
  const rows = await db.getAllAsync<{ data: string }>(
    `SELECT data FROM health_metrics WHERE pet_id = ? ORDER BY recorded_at ASC`,
    [petId],
  );
  const out: unknown[] = [];
  for (const row of rows) {
    try {
      const decrypted = await safeDecrypt(row.data, 'localdb_health_metrics', true);
      out.push(decrypted);
    } catch {
      // ignore
    }
  }
  return out;
}

export async function upsertHealthMetric(entry: {
  id: string;
  petId: string;
  recordedAt: string;
  [k: string]: unknown;
}): Promise<void> {
  const encryptedData = await encrypt(entry, 'localdb_health_metrics');
  await db.runAsync(
    `INSERT OR REPLACE INTO health_metrics (id, pet_id, recorded_at, data) VALUES (?, ?, ?, ?)`,
    [entry.id, entry.petId, entry.recordedAt, encryptedData],
  );
}

export async function deleteHealthMetricById(id: string): Promise<void> {
  await db.runAsync(`DELETE FROM health_metrics WHERE id = ?`, [id]);
}

// ─── SOAP Note Drafts ────────────────────────────────────────────────────────
// Table is created in init() above (soap_note_drafts, unique on pet_id + vet_id).

export interface SoapNoteDraft {
  petId: string;
  vetId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  savedAt: string; // ISO string
}

export async function upsertSoapDraft(draft: SoapNoteDraft): Promise<void> {
  const encryptedData = await encrypt(draft, 'localdb_soap_drafts');
  await db.runAsync(
    `INSERT OR REPLACE INTO soap_note_drafts (id, pet_id, vet_id, data, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [`${draft.petId}::${draft.vetId}`, draft.petId, draft.vetId, encryptedData, draft.savedAt],
  );
}

export async function getSoapDraft(petId: string, vetId: string): Promise<SoapNoteDraft | null> {
  const row = await db.getFirstAsync<{ data: string }>(
    `SELECT data FROM soap_note_drafts WHERE pet_id = ? AND vet_id = ? LIMIT 1`,
    [petId, vetId],
  );
  if (!row) return null;
  try {
    return await safeDecrypt<SoapNoteDraft>(row.data, 'localdb_soap_drafts', true);
  } catch {
    return null;
  }
}

export async function deleteSoapDraft(petId: string, vetId: string): Promise<void> {
  await db.runAsync(`DELETE FROM soap_note_drafts WHERE pet_id = ? AND vet_id = ?`, [petId, vetId]);
}

// ─── Appointments CRUD ────────────────────────────────────────────────────────

export interface AppointmentSnapshot<T> {
  appointments: T[];
  unreadableRows: number;
}

/** Validate the fields actually consumed by the local conflict evaluator. */
export function isReadableAppointmentForConflicts(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const appointment = value as Record<string, unknown>;
  if (typeof appointment.id !== 'string' || typeof appointment.date !== 'string') return false;
  const durationMinutes = appointment.durationMinutes ?? 30;
  if (
    typeof durationMinutes !== 'number' ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes < 0
  ) {
    return false;
  }
  const recurrence = appointment.recurrence;
  if (recurrence !== undefined) {
    if (typeof recurrence !== 'object' || recurrence === null || Array.isArray(recurrence)) {
      return false;
    }
    const rule = recurrence as Record<string, unknown>;
    const supportedRecurrenceFrequencies = new Set(['daily', 'weekly', 'monthly']);
    if (
      typeof rule.frequency !== 'string' ||
      !supportedRecurrenceFrequencies.has(rule.frequency)
    ) {
      return false;
    }
    if (
      rule.interval !== undefined &&
      (typeof rule.interval !== 'number' ||
        !Number.isInteger(rule.interval) ||
        rule.interval <= 0)
    ) {
      return false;
    }
    if (
      rule.count !== undefined &&
      (typeof rule.count !== 'number' || !Number.isInteger(rule.count) || rule.count <= 0)
    ) {
      return false;
    }
    if (rule.until !== undefined) {
      if (typeof rule.until !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rule.until)) {
        return false;
      }
      if (!Number.isFinite(new Date(`${rule.until}T00:00:00`).getTime())) {
        return false;
      }
    }
  }

  let start: Date;
  if (appointment.date.includes('T')) {
    start = new Date(appointment.date);
  } else {
    const time = appointment.time ?? '00:00';
    if (typeof time !== 'string') return false;
    start = new Date(`${appointment.date}T${time}:00`);
  }
  return (
    Number.isFinite(start.getTime()) &&
    Number.isFinite(start.getTime() + durationMinutes * 60_000)
  );
}

/** Keep readable local appointments while reporting unusable stored rows. */
export async function getAppointmentSnapshotByPetId<T = unknown>(
  petId: string,
): Promise<AppointmentSnapshot<T>> {
  const rows = await db.getAllAsync<{ data: string }>(
    `SELECT data FROM appointments WHERE pet_id = ? ORDER BY scheduled_at ASC`,
    [petId],
  );
  const appointments: T[] = [];
  let unreadableRows = 0;
  for (const row of rows) {
    try {
      const value = await safeDecrypt<unknown>(row.data, 'localdb_appointments', true);
      if (!isReadableAppointmentForConflicts(value)) {
        unreadableRows++;
        continue;
      }
      appointments.push(value as T);
    } catch {
      unreadableRows++;
    }
  }
  return { appointments, unreadableRows };
}

export async function getAllAppointmentsByPetId<T = unknown>(petId: string): Promise<T[]> {
  const rows = await db.getAllAsync<{ data: string }>(
    `SELECT data FROM appointments WHERE pet_id = ? ORDER BY scheduled_at ASC`,
    [petId],
  );
  const out: T[] = [];
  for (const row of rows) {
    try {
      const decrypted = await safeDecrypt<T>(row.data, 'localdb_appointments', true);
      out.push(decrypted);
    } catch {
      // ignore bad rows
    }
  }
  return out;
}

export async function getAllLocalAppointments<T = unknown>(): Promise<T[]> {
  const rows = await db.getAllAsync<{ data: string }>(
    `SELECT data FROM appointments ORDER BY scheduled_at ASC`,
  );
  const out: T[] = [];
  for (const row of rows) {
    try {
      const decrypted = await safeDecrypt<T>(row.data, 'localdb_appointments', true);
      out.push(decrypted);
    } catch {
      // ignore bad rows
    }
  }
  return out;
}

/**
 * Fetch appointments for a pet within a specific time window (for conflict detection).
 * windowStart / windowEnd are ISO strings.
 */
export async function getAppointmentsInWindow<T = unknown>(
  petId: string,
  windowStart: string,
  windowEnd: string,
): Promise<T[]> {
  const rows = await db.getAllAsync<{ data: string }>(
    `SELECT data FROM appointments
     WHERE pet_id = ? AND scheduled_at >= ? AND scheduled_at <= ?
     AND status != 'CANCELLED'
     ORDER BY scheduled_at ASC`,
    [petId, windowStart, windowEnd],
  );
  const out: T[] = [];
  for (const row of rows) {
    try {
      const decrypted = await safeDecrypt<T>(row.data, 'localdb_appointments', true);
      out.push(decrypted);
    } catch {
      // ignore bad rows
    }
  }
  return out;
}

export async function upsertAppointment<
  T extends { id: string; petId: string; date: string; status?: string },
>(appt: T): Promise<void> {
  const encryptedData = await encrypt(appt, 'localdb_appointments');
  await db.runAsync(
    `INSERT OR REPLACE INTO appointments (id, pet_id, scheduled_at, status, data) VALUES (?, ?, ?, ?, ?)`,
    [appt.id, appt.petId, appt.date, appt.status ?? 'PENDING', encryptedData],
  );
}

export async function deleteAppointmentById(id: string): Promise<void> {
  await db.runAsync(`DELETE FROM appointments WHERE id = ?`, [id]);
}

export default {
  getItem,
  setItem,
  removeItem,
  multiGet,
  multiSet,
  getAllMedications,
  upsertMedication,
  deleteMedicationById,
  getDoseLogs,
  addDoseLog,
  getHealthMetricsByPetId,
  upsertHealthMetric,
  deleteHealthMetricById,
  upsertSoapDraft,
  getSoapDraft,
  deleteSoapDraft,
  getAllAppointmentsByPetId,
  getAllLocalAppointments,
  getAppointmentsInWindow,
  upsertAppointment,
  deleteAppointmentById,
};
