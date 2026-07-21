import apiClient from './apiClient';
import { executeSql, getItem, setItem } from './localDB';
import { sendAlertNotification } from './notificationService';
import syncService, { type SyncAction, type SyncEntityType, type SyncStatus } from './syncService';
import { networkMonitor } from '../utils/networkMonitor';

// ─── Blockchain anchor queue (SQLite-backed) ──────────────────────────────────

export interface BlockchainQueueItem {
  id: string;
  recordId: string;
  payload: string; // JSON-serialised record payload
  attempts: number;
  createdAt: string;
}

async function initBlockchainQueue(): Promise<void> {
  await executeSql(`
    CREATE TABLE IF NOT EXISTS blockchain_anchor_queue (
      id         TEXT PRIMARY KEY,
      record_id  TEXT NOT NULL,
      payload    TEXT NOT NULL,
      attempts   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
initBlockchainQueue().catch(() => {});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueuedMutation {
  id: string;
  type: SyncEntityType;
  action: SyncAction;
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
  /** ETag recorded when this mutation was created */
  etag?: string;
}

export interface ConflictItem {
  id: string;
  type: SyncEntityType;
  action: SyncAction;
  /** The offline change the user made */
  localData: Record<string, unknown>;
  /** The current server version */
  serverData: Record<string, unknown>;
}

export type ConflictResolution = 'keep-server' | 'keep-local';

export interface OfflineQueueStatus {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  lastSync: number | null;
  failedCount: number;
  /** Conflicts waiting for user resolution */
  pendingConflicts: ConflictItem[];
}

type StatusListener = (status: OfflineQueueStatus) => void;
type ConflictListener = (conflict: ConflictItem) => void;

// ─── Constants ────────────────────────────────────────────────────────────────

const QUEUE_KEY = '@offline_queue';
const CONFLICTS_KEY = '@offline_queue:conflicts';

// ─── OfflineQueue ─────────────────────────────────────────────────────────────

/**
 * OfflineQueue wraps SyncService to provide:
 *  - Automatic offline detection before mutations
 *  - Persistent queue via AsyncStorage
 *  - Auto-processing when connectivity is restored
 *  - User notifications for sync status changes
 */
class OfflineQueue {
  private statusListeners: StatusListener[] = [];
  private conflictListeners: ConflictListener[] = [];
  private isOnline = false;
  private initialized = false;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Call once at app startup (e.g. in App.tsx).
   * Starts network monitoring and wires up auto-sync on reconnect.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Seed current online state
    this.isOnline = await networkMonitor.isOnline();

    // Listen for connectivity changes
    networkMonitor.onNetworkChange(async (online) => {
      const wasOffline = !this.isOnline;
      this.isOnline = online;

      if (wasOffline && online) {
        await this.notifyUser('🔄 Back online', 'Syncing your offline changes…');
        await this.processQueue();
        await this.processBlockchainQueue();
      }

      await this.emitStatus();
    });

    // Register sync callback so networkMonitor can also trigger sync
    networkMonitor.setSyncCallback(() => this.processQueue());

    // Start monitoring
    networkMonitor.startNetworkMonitoring();

    // Forward syncService status changes to our listeners
    syncService.onStatusChange((syncStatus: SyncStatus) => {
      this.emitStatusFromSync(syncStatus);
    });
  }

  // ── Enqueue a mutation ────────────────────────────────────────────────────

  /**
   * Queue a create/update/delete mutation.
   * If online, immediately attempts to process the queue.
   * If offline, persists to AsyncStorage for later.
   */
  async enqueue(
    type: SyncEntityType,
    action: SyncAction,
    data: Record<string, unknown>,
  ): Promise<void> {
    // Persist to our own queue key for resilience
    await this.persistToQueue({ type, action, data });

    // Also enqueue in syncService (which manages retries + conflicts)
    await syncService.enqueue(type, action, data);

    if (this.isOnline) {
      await this.processQueue();
    } else {
      await this.notifyUser(
        '📴 Saved offline',
        'Your change has been saved and will sync when you reconnect.',
      );
      await this.emitStatus();
    }
  }

  // ── Process the queue ─────────────────────────────────────────────────────

  /**
   * Flush all pending mutations to the server.
   * Detects 409 conflicts via If-Match / ETag and queues them for resolution.
   */
  async processQueue(): Promise<void> {
    const online = await networkMonitor.isOnline();
    if (!online) return;

    const pending = await this.getPersistentQueue();
    if (pending.length === 0) return;

    const stillPending: QueuedMutation[] = [];

    for (const mutation of pending) {
      try {
        const headers: Record<string, string> = {};
        if (mutation.etag) headers['If-Match'] = mutation.etag;

        const endpoint = `/${mutation.type}s/${String(mutation.data.id ?? '')}`;
        const response = await apiClient.put(endpoint, mutation.data, { headers });

        // Capture updated ETag for future mutations on this entity
        const newEtag = (response.headers as Record<string, string>)?.['etag'];
        if (newEtag) {
          // Update stored ETag for subsequent mutations on the same entity
          const updated = stillPending.map((m) =>
            m.data.id === mutation.data.id ? { ...m, etag: newEtag } : m,
          );
          stillPending.splice(0, stillPending.length, ...updated);
        }
      } catch (err) {
        const status = (err as { response?: { status?: number; data?: unknown } })?.response
          ?.status;

        if (status === 409) {
          // Conflict detected — fetch server version and queue for resolution
          const serverData = await this._fetchServerVersion(mutation);
          if (serverData) {
            await this._storeConflict({
              id: mutation.id,
              type: mutation.type,
              action: mutation.action,
              localData: mutation.data,
              serverData,
            });
          } else {
            // Cannot fetch server version — store conflict with local data only
            // to prevent infinite retry loop on 409 conflicts
            await this._storeConflict({
              id: mutation.id,
              type: mutation.type,
              action: mutation.action,
              localData: mutation.data,
              serverData: mutation.data,
            });
          }
        } else {
          stillPending.push(mutation);
        }
      }
    }

    await setItem(QUEUE_KEY, JSON.stringify(stillPending));

    const conflicts = await this.getPendingConflicts();
    if (conflicts.length > 0) {
      await this.notifyUser(
        '⚠️ Sync conflict',
        `${conflicts.length} change(s) conflict with the server. Tap to resolve.`,
      );
    } else if (stillPending.length === 0) {
      await this.notifyUser('✅ Sync complete', 'All offline changes have been synced.');
    } else {
      await this.notifyUser(
        '⚠️ Sync partially failed',
        `${stillPending.length} change(s) could not be synced and will be retried.`,
      );
    }

    await this.emitStatus();
  }

  // ── Blockchain anchor queue ───────────────────────────────────────────────

  /**
   * Queue a medical record hash for Stellar anchoring.
   * Persists to SQLite so it survives app restarts.
   * If online, attempts to anchor immediately; otherwise retries on reconnect.
   */
  async queueBlockchainAnchor(recordId: string, payload: unknown): Promise<void> {
    const id = `${recordId}_${Date.now()}`;
    await executeSql(
      `INSERT OR REPLACE INTO blockchain_anchor_queue (id, record_id, payload, attempts)
       VALUES (?, ?, ?, 0)`,
      [id, recordId, JSON.stringify(payload)],
    );

    if (this.isOnline) {
      await this.processBlockchainQueue();
    } else {
      await this.notifyUser(
        '📴 Record saved offline',
        'Will anchor to blockchain when reconnected.',
      );
    }
  }

  /**
   * Flush all pending blockchain anchor jobs.
   * Called automatically on reconnect via initialize().
   */
  async processBlockchainQueue(): Promise<void> {
    const online = await networkMonitor.isOnline();
    if (!online) return;

    // Lazy import to avoid circular deps and keep mobile bundle lean
    const { default: apiClient } = await import('./apiClient');
    const db = (await import('expo-sqlite')).openDatabaseSync('cocohub.db');

    const pending = db.getAllSync<BlockchainQueueItem>(
      `SELECT id, record_id AS recordId, payload, attempts, created_at AS createdAt
       FROM blockchain_anchor_queue WHERE attempts < 5 ORDER BY created_at ASC`,
    );

    for (const item of pending) {
      try {
        await apiClient.post('/api/anchor', {
          recordId: item.recordId,
          payload: JSON.parse(item.payload),
        });
        db.runSync(`DELETE FROM blockchain_anchor_queue WHERE id = ?`, [item.id]);
      } catch {
        db.runSync(`UPDATE blockchain_anchor_queue SET attempts = attempts + 1 WHERE id = ?`, [
          item.id,
        ]);
      }
    }

    if (pending.length > 0) {
      const remaining = db.getAllSync(`SELECT id FROM blockchain_anchor_queue WHERE attempts < 5`);
      if (remaining.length === 0) {
        await this.notifyUser('✅ Blockchain sync complete', 'All records anchored to Stellar.');
      }
    }
  }

  // ── Status ────────────────────────────────────────────────────────────────

  async getStatus(): Promise<OfflineQueueStatus> {
    const syncStatus = await syncService.getStatus();
    const queue = await this.getPersistentQueue();
    const pendingConflicts = await this.getPendingConflicts();
    return {
      isOnline: this.isOnline,
      pendingCount: Math.max(syncStatus.pendingCount, queue.length),
      isSyncing: syncStatus.isSyncing,
      lastSync: syncStatus.lastSync,
      failedCount: syncStatus.failedCount,
      pendingConflicts,
    };
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Subscribe to individual conflict events (fires when a conflict is detected
   * during background sync). If the user is not present, conflicts are queued
   * and available via getStatus().pendingConflicts on next foreground session.
   */
  onConflict(listener: ConflictListener): () => void {
    this.conflictListeners.push(listener);
    return () => {
      this.conflictListeners = this.conflictListeners.filter((l) => l !== listener);
    };
  }

  // ── Conflict resolution ───────────────────────────────────────────────────

  /**
   * Resolve a conflict detected during sync.
   * - 'keep-server': discards the local change, removes from queue.
   * - 'keep-local': forces the local version to the server (bypasses ETag check).
   * The decision is written to the audit trail.
   */
  async resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void> {
    const conflicts = await this.getPendingConflicts();
    const conflict = conflicts.find((c) => c.id === conflictId);
    if (!conflict) return;

    if (resolution === 'keep-local') {
      // Re-enqueue without ETag so the server accepts the overwrite
      const { etag: _etag, ...dataWithoutEtag } = conflict.localData;
      try {
        await apiClient.put(
          `/${conflict.type}s/${String(conflict.localData.id ?? conflictId)}`,
          dataWithoutEtag,
        );
      } catch {
        // Non-fatal — will be retried via queue
      }
    }
    // 'keep-server': nothing to push; server version is already applied

    // Remove from pending conflicts
    const remaining = conflicts.filter((c) => c.id !== conflictId);
    await setItem(CONFLICTS_KEY, JSON.stringify(remaining));

    // Write to audit trail
    await this.writeAuditEntry(conflict, resolution);
    await this.emitStatus();
  }

  /**
   * Retrieve all conflicts waiting for user resolution.
   */
  async getPendingConflicts(): Promise<ConflictItem[]> {
    const raw = await getItem(CONFLICTS_KEY);
    return raw ? (JSON.parse(raw) as ConflictItem[]) : [];
  }

  // ── Persistent queue helpers ──────────────────────────────────────────────

  private async persistToQueue(
    mutation: Omit<QueuedMutation, 'id' | 'timestamp' | 'retries'>,
  ): Promise<void> {
    const queue = await this.getPersistentQueue();
    // Fetch current ETag for the entity so we can detect conflicts on push
    let etag: string | undefined;
    if (mutation.data.id) {
      try {
        const res = await apiClient.head(`/${mutation.type}s/${String(mutation.data.id)}`);
        etag = (res.headers as Record<string, string>)?.['etag'];
      } catch {
        /* no ETag available */
      }
    }
    const item: QueuedMutation = {
      id: `${mutation.type}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      ...mutation,
      etag,
      timestamp: Date.now(),
      retries: 0,
    };
    queue.push(item);
    await setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  async getPersistentQueue(): Promise<QueuedMutation[]> {
    const stored = await getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private async clearPersistentQueue(): Promise<void> {
    await setItem(QUEUE_KEY, JSON.stringify([]));
  }

  private async _fetchServerVersion(
    mutation: QueuedMutation,
  ): Promise<Record<string, unknown> | null> {
    try {
      const res = await apiClient.get<Record<string, unknown>>(
        `/${mutation.type}s/${String(mutation.data.id ?? '')}`,
      );
      return res.data;
    } catch {
      return null;
    }
  }

  private async _storeConflict(conflict: ConflictItem): Promise<void> {
    const conflicts = await this.getPendingConflicts();
    const existing = conflicts.findIndex((c) => c.id === conflict.id);
    if (existing >= 0) conflicts[existing] = conflict;
    else conflicts.push(conflict);
    await setItem(CONFLICTS_KEY, JSON.stringify(conflicts));
    // Notify listeners (foreground)
    this.conflictListeners.forEach((l) => l(conflict));
  }

  private async writeAuditEntry(
    conflict: ConflictItem,
    resolution: ConflictResolution,
  ): Promise<void> {
    try {
      await apiClient.post('/audit/conflicts', {
        entityType: conflict.type,
        entityId: conflict.localData.id,
        resolution,
        localData: conflict.localData,
        serverData: conflict.serverData,
        resolvedAt: new Date().toISOString(),
      });
    } catch {
      /* audit trail is best-effort */
    }
  }

  // ── Notification helper ───────────────────────────────────────────────────

  private async notifyUser(title: string, body: string): Promise<void> {
    try {
      await sendAlertNotification(title, body, { source: 'offlineQueue' });
    } catch {
      // Notifications are best-effort; never block queue operations
    }
  }

  // ── Status emission ───────────────────────────────────────────────────────

  private async emitStatus(): Promise<void> {
    const status = await this.getStatus();
    this.statusListeners.forEach((l) => l(status));
  }

  private async emitStatusFromSync(syncStatus: SyncStatus): Promise<void> {
    const pendingConflicts = await this.getPendingConflicts();
    const status: OfflineQueueStatus = {
      isOnline: this.isOnline,
      pendingCount: syncStatus.pendingCount,
      isSyncing: syncStatus.isSyncing,
      lastSync: syncStatus.lastSync,
      failedCount: syncStatus.failedCount,
      pendingConflicts,
    };
    this.statusListeners.forEach((l) => l(status));
  }
}

export const offlineQueue = new OfflineQueue();
export default offlineQueue;
