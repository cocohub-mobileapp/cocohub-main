import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoSQLite from 'expo-sqlite';
import { AppState, type AppStateStatus } from 'react-native';

import apiClient from './apiClient';
import { executeSql } from './localDB';
import { networkMonitor } from '../utils/networkMonitor';

export type SyncEntityType = 'pet' | 'appointment' | 'medication' | 'medicalRecord';
export type SyncAction = 'create' | 'update' | 'delete';
export type ConflictResolutionStrategy = 'last-write-wins' | 'server-wins' | 'client-wins';
export type SyncEventType = 'queued' | 'started' | 'progress' | 'completed' | 'failed' | 'conflict';

export interface DirtyRecord {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  action: SyncAction;
  payload: Record<string, unknown>;
  updatedAt: string;
  syncVersion: number;
  attempts: number;
}

export interface SyncProgressEvent {
  type: SyncEventType;
  total: number;
  completed: number;
  failed: number;
  message?: string;
  record?: DirtyRecord;
}

export interface SyncEngineOptions {
  batchSize?: number;
  maxRetries?: number;
  strategy?: ConflictResolutionStrategy;
}

type SyncListener = (event: SyncProgressEvent) => void;

const DEFAULT_OPTIONS: Required<SyncEngineOptions> = {
  batchSize: 25,
  maxRetries: 5,
  strategy: 'last-write-wins',
};

// ── Exponential backoff constants ─────────────────────────────────────────────

/** Backoff steps in ms: 30s → 60s → 120s → 300s → 600s */
const BACKOFF_STEPS_MS = [30_000, 60_000, 120_000, 300_000, 600_000];

/** Non-retryable HTTP status codes — surface immediately, no backoff */
const NON_RETRYABLE_STATUSES = new Set([401, 403, 422]);

const BACKOFF_STORAGE_KEY = '@sync_engine:backoff';

interface BackoffState {
  /** Current step index into BACKOFF_STEPS_MS */
  stepIndex: number;
  /** Timestamp when the next retry is allowed */
  nextRetryAt: number;
}

export class SyncEngine {
  private listeners = new Set<SyncListener>();
  private isRunning = false;
  private readonly options: Required<SyncEngineOptions>;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private appStateSubscription: { remove: () => void } | null = null;

  constructor(options: SyncEngineOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this._subscribeAppState();
  }

  // ── Backoff helpers ───────────────────────────────────────────────────────

  private async _getBackoffState(): Promise<BackoffState> {
    try {
      const raw = await AsyncStorage.getItem(BACKOFF_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as BackoffState;
    } catch {
      /* ignore */
    }
    return { stepIndex: 0, nextRetryAt: 0 };
  }

  private async _advanceBackoff(): Promise<void> {
    const state = await this._getBackoffState();
    const nextStep = Math.min(state.stepIndex + 1, BACKOFF_STEPS_MS.length - 1);
    const delay = BACKOFF_STEPS_MS[nextStep];
    const next: BackoffState = { stepIndex: nextStep, nextRetryAt: Date.now() + delay };
    await AsyncStorage.setItem(BACKOFF_STORAGE_KEY, JSON.stringify(next));
    this._scheduleRetry(delay);
  }

  private async _resetBackoff(): Promise<void> {
    await AsyncStorage.removeItem(BACKOFF_STORAGE_KEY);
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private _scheduleRetry(delayMs: number): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.syncNow().catch(() => {});
    }, delayMs);
  }

  private _subscribeAppState(): void {
    this.appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      // On foreground, attempt one sync immediately regardless of backoff
      if (state === 'active') {
        this.syncNow().catch(() => {});
      }
    });
  }

  /** Release resources (call on teardown) */
  destroy(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.appStateSubscription?.remove();
  }

  async initialize(): Promise<void> {
    await executeSql(
      `CREATE TABLE IF NOT EXISTS dirty_records (
        id TEXT PRIMARY KEY NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_version INTEGER NOT NULL DEFAULT 1,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      )`,
    );
    await executeSql(
      `CREATE INDEX IF NOT EXISTS idx_dirty_records_updated_at ON dirty_records(updated_at ASC)`,
    );
  }

  onProgress(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async markDirty(
    entityType: SyncEntityType,
    entityId: string,
    action: SyncAction,
    payload: Record<string, unknown>,
  ): Promise<DirtyRecord> {
    await this.initialize();
    const updatedAt = new Date().toISOString();
    const id = `${entityType}:${entityId}`;
    const existing = await this.getDirtyRecord(id);
    const record: DirtyRecord = {
      id,
      entityType,
      entityId,
      action,
      payload: { ...payload, id: entityId, updated_at: updatedAt, updatedAt },
      updatedAt,
      syncVersion: (existing?.syncVersion ?? 0) + 1,
      attempts: existing?.attempts ?? 0,
    };

    await executeSql(
      `INSERT OR REPLACE INTO dirty_records
        (id, entity_type, entity_id, action, payload, updated_at, sync_version, attempts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.entityType,
        record.entityId,
        record.action,
        JSON.stringify(record.payload),
        record.updatedAt,
        record.syncVersion,
        record.attempts,
      ],
    );
    this.emit({ type: 'queued', total: 1, completed: 0, failed: 0, record });
    return record;
  }

  async syncNow(): Promise<SyncProgressEvent> {
    await this.initialize();
    if (this.isRunning) return { type: 'started', total: 0, completed: 0, failed: 0 };
    if (!(await networkMonitor.isOnline())) {
      return { type: 'failed', total: 0, completed: 0, failed: 0, message: 'Device is offline' };
    }

    this.isRunning = true;
    const batch = await this.getBatch();
    const total = batch.length;
    let completed = 0;
    let failed = 0;
    this.emit({ type: 'started', total, completed, failed });

    for (const record of batch) {
      try {
        await this.pushRecord(record);
        await this.clearRecord(record.id);
        completed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown sync failure';
        const status = (error as { response?: { status?: number } })?.response?.status;

        if (status != null && NON_RETRYABLE_STATUSES.has(status)) {
          // Non-retryable: surface immediately, do not schedule backoff retry
          await this.clearRecord(record.id);
          this.emit({
            type: 'failed',
            total,
            completed,
            failed: failed + 1,
            message: `Non-retryable error ${status}: ${message}`,
            record,
          });
        } else {
          await this.recordFailure(record, message);
        }
        failed += 1;
      }
      this.emit({ type: 'progress', total, completed, failed, record });
    }

    this.isRunning = false;
    const event: SyncProgressEvent = {
      type: failed > 0 ? 'failed' : 'completed',
      total,
      completed,
      failed,
    };
    this.emit(event);

    if (failed > 0) {
      await this._advanceBackoff();
    } else {
      await this._resetBackoff();
    }

    return event;
  }

  resolveConflict(
    localData: Record<string, unknown>,
    serverData: Record<string, unknown>,
    strategy: ConflictResolutionStrategy = this.options.strategy,
  ): Record<string, unknown> {
    if (strategy === 'server-wins') return serverData;
    if (strategy === 'client-wins') return localData;

    const localUpdatedAt = Date.parse(String(localData.updated_at ?? localData.updatedAt ?? 0));
    const serverUpdatedAt = Date.parse(String(serverData.updated_at ?? serverData.updatedAt ?? 0));
    const base = serverUpdatedAt >= localUpdatedAt ? serverData : localData;
    const merged: Record<string, unknown> = { ...base };
    const keys = new Set([...Object.keys(localData), ...Object.keys(serverData)]);

    for (const key of keys) {
      const localValue = localData[key];
      const serverValue = serverData[key];
      if (localValue === undefined) merged[key] = serverValue;
      else if (serverValue === undefined) merged[key] = localValue;
      else merged[key] = serverUpdatedAt >= localUpdatedAt ? serverValue : localValue;
    }

    return merged;
  }

  private async getDirtyRecord(id: string): Promise<DirtyRecord | null> {
    const conn = ExpoSQLite.openDatabaseSync('cocohub.db');
    const row = (await conn.getFirstAsync(`SELECT * FROM dirty_records WHERE id = ? LIMIT 1`, [
      id,
    ])) as {
      id: string;
      entity_type: SyncEntityType;
      entity_id: string;
      action: SyncAction;
      payload: string;
      updated_at: string;
      sync_version: number;
      attempts: number;
    } | null;

    if (!row) return null;
    return this.fromRow(row);
  }

  private async getBatch(): Promise<DirtyRecord[]> {
    const conn = ExpoSQLite.openDatabaseSync('cocohub.db');
    const rows = (await conn.getAllAsync(
      `SELECT * FROM dirty_records WHERE attempts < ? ORDER BY updated_at ASC LIMIT ?`,
      [this.options.maxRetries, this.options.batchSize],
    )) as Array<{
      id: string;
      entity_type: SyncEntityType;
      entity_id: string;
      action: SyncAction;
      payload: string;
      updated_at: string;
      sync_version: number;
      attempts: number;
    }>;
    return rows.map((row) => this.fromRow(row));
  }

  private async pushRecord(record: DirtyRecord): Promise<void> {
    const response = await apiClient.post('/sync/push', {
      records: [record],
      strategy: this.options.strategy,
    });
    const result = response.data as {
      results?: Array<{ status: string; serverRecord?: Record<string, unknown> }>;
      data?: {
        results?: Array<{ status: string; serverRecord?: Record<string, unknown> }>;
      };
    };
    const results = result.results ?? result.data?.results;
    const confirmedStatuses = new Set(['created', 'updated', 'deleted']);
    const first = results?.[0];
    if (!first) throw new Error('Server did not confirm sync record');
    if (first.status === 'conflict' && first.serverRecord) {
      this.emit({ type: 'conflict', total: 1, completed: 0, failed: 0, record });
    }
    if (!confirmedStatuses.has(first.status)) throw new Error('Server rejected sync record');
  }

  private async clearRecord(id: string): Promise<void> {
    await executeSql(`DELETE FROM dirty_records WHERE id = ?`, [id]);
  }

  private async recordFailure(record: DirtyRecord, message: string): Promise<void> {
    await executeSql(
      `UPDATE dirty_records SET attempts = attempts + 1, last_error = ? WHERE id = ?`,
      [message, record.id],
    );
  }

  private fromRow(row: {
    id: string;
    entity_type: SyncEntityType;
    entity_id: string;
    action: SyncAction;
    payload: string;
    updated_at: string;
    sync_version: number;
    attempts: number;
  }): DirtyRecord {
    return {
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      action: row.action,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      updatedAt: row.updated_at,
      syncVersion: row.sync_version,
      attempts: row.attempts,
    };
  }

  private emit(event: SyncProgressEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}

export const syncEngine = new SyncEngine();
export default syncEngine;
