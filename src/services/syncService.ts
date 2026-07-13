import apiClient from './apiClient';
import { getItem, setItem } from './localDB';
import { networkMonitor } from '../utils/networkMonitor';

// ==============================
// TYPES
// ==============================

export type SyncEntityType = 'pet' | 'appointment' | 'medication' | 'medicalRecord';
export type SyncAction = 'create' | 'update' | 'delete';
export type ConflictResolutionStrategy = 'last-write-wins' | 'manual';

export interface SyncItem {
  id: string;
  type: SyncEntityType;
  action: SyncAction;
  data: Record<string, unknown>;
  timestamp: number;
  retries: number;
}

export interface ConflictRecord {
  entityId: string;
  type: SyncEntityType;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  localTimestamp: number;
  serverTimestamp: number;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSync: number | null;
  pendingCount: number;
  failedCount: number;
  conflicts: ConflictRecord[];
}

// ==============================
// CONSTANTS
// ==============================

const SYNC_QUEUE_KEY = '@sync_queue';
const SYNC_STATUS_KEY = '@sync_status';
const _CONFLICTS_KEY = '@sync_conflicts';
const MAX_RETRIES = 3;

const DEFAULT_STATUS: SyncStatus = {
  isSyncing: false,
  lastSync: null,
  pendingCount: 0,
  failedCount: 0,
  conflicts: [],
};

// ==============================
// CLASS
// ==============================

export class SyncService {
  private statusListeners: Array<(status: SyncStatus) => void> = [];

  onStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  // ── Queue management ──
  /** Drop a queued mutation once it has been pushed successfully elsewhere. */
  async dropMatchingItem(
    type: SyncEntityType,
    action: SyncAction,
    data: Record<string, unknown>,
  ): Promise<void> {
    const entityId = data.id as string | undefined;
    const queue = await this.getQueue();
    const next = queue.filter((item) => {
      if (item.type !== type || item.action !== action) return true;
      if (entityId != null) return item.data.id !== entityId;
      return item.data !== data;
    });
    if (next.length === queue.length) return;

    await setItem(SYNC_QUEUE_KEY, JSON.stringify(next));
    await this.patchStatus({ pendingCount: next.length });
  }

  async enqueue(
    type: SyncEntityType,
    action: SyncAction,
    data: Record<string, unknown>,
  ): Promise<void> {
    const queue = await this.getQueue();

    const entityId = data.id as string | undefined;

    const existingIdx = entityId
      ? queue.findIndex((i) => i.data.id === entityId && i.type === type && i.action === action)
      : -1;

    const item: SyncItem = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type,
      action,
      data,
      timestamp: Date.now(),
      retries: 0,
    };

    if (existingIdx >= 0) queue[existingIdx] = item;
    else queue.push(item);

    await setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    await this.patchStatus({ pendingCount: queue.length });
  }

  // ── Pull from server ─────────────────────────────────────────────────────────

  async pull(
    types: SyncEntityType[] = ['pet', 'appointment', 'medication', 'medicalRecord'],
  ): Promise<void> {
    for (const type of types) {
      try {
        let endpoint = `/${type}s`;
        if (type === 'medicalRecord') {
          // For medical records, we might need a different pull strategy if they are nested.
          // Assuming there's a user-level endpoint or we pull per pet.
          // For now, let's try top-level /medical-records if available,
          // or skip if the API only supports nested.
          endpoint = '/medical-records';
        }

        const response = await apiClient.get<Record<string, unknown>[]>(endpoint);
        const serverItems = response.data;
        // Persist each item locally
        for (const item of serverItems) {
          const key = `@${type}_${item.id}`;
          const localRaw = await getItem(key);
          if (localRaw) {
            const local = JSON.parse(localRaw) as Record<string, unknown>;
            const resolved = await this.resolveConflict(type, local, item, 'last-write-wins');
            await setItem(key, JSON.stringify(resolved));
          } else {
            await setItem(key, JSON.stringify(item));
          }
        }
      } catch {
        // Non-fatal: continue with other types
      }
    }
  }

  // ── Push local changes ───────────────────────────────────────────────────────

  async push(): Promise<void> {
    const online = await networkMonitor.isOnline();
    if (!online) return;

    const status = await this.getStatus();
    if (status.isSyncing) return;

    await this.patchStatus({ isSyncing: true });

    const queue = await this.getQueue();
    const failed: SyncItem[] = [];

    for (const item of queue) {
      try {
        await this.syncItem(item);
      } catch {
        item.retries += 1;
        if (item.retries < MAX_RETRIES) failed.push(item);
      }
    }

    await setItem(SYNC_QUEUE_KEY, JSON.stringify(failed));

    await this.patchStatus({
      isSyncing: false,
      lastSync: Date.now(),
      pendingCount: failed.length,
      failedCount: failed.filter((i) => i.retries >= MAX_RETRIES).length,
    });
  }

  // ── Sync ──
  async sync(): Promise<void> {
    const online = await networkMonitor.isOnline();
    if (!online) return;

    await this.pull();
    await this.push();
  }

  // ── Conflict resolution ──
  async resolveConflict(
    type: SyncEntityType,
    localData: Record<string, unknown>,
    serverData: Record<string, unknown>,
    strategy: ConflictResolutionStrategy = 'last-write-wins',
  ): Promise<Record<string, unknown>> {
    const localTs = (localData.updatedAt as number) || 0;
    const serverTs = (serverData.updatedAt as number) || 0;

    if (strategy === 'last-write-wins') {
      return serverTs >= localTs ? serverData : localData;
    }

    return serverData;
  }

  // ── Helpers ──
  private async syncItem(item: SyncItem): Promise<void> {
    let endpoint = `/${item.type}s`;

    // Handle nested medical record endpoints
    if (item.type === 'medicalRecord') {
      const petId = item.data.petId as string;
      if (petId) {
        endpoint = `/pets/${petId}/medical-records`;
      } else {
        endpoint = '/medical-records';
      }
    }

    switch (item.action) {
      case 'create': {
        await apiClient.post(endpoint, item.data);
        break;
      }
      case 'update': {
        const id = item.data.id as string;
        await apiClient.put(`${endpoint}/${id}`, item.data);
        break;
      }
      case 'delete': {
        const delId = item.data.id as string;
        await apiClient.delete(`${endpoint}/${delId}`);
        break;
      }
    }
  }

  private async getQueue(): Promise<SyncItem[]> {
    const stored = await getItem(SYNC_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  async getStatus(): Promise<SyncStatus> {
    const stored = await getItem(SYNC_STATUS_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_STATUS;
  }

  private async patchStatus(updates: Partial<SyncStatus>): Promise<void> {
    const current = await this.getStatus();
    const next = { ...current, ...updates };

    await setItem(SYNC_STATUS_KEY, JSON.stringify(next));
    this.statusListeners.forEach((l) => l(next));
  }
}

// ==============================
// FIX FOR TESTS (IMPORTANT)
// ==============================

// 👉 THIS is what fixes:
// "SyncService is not a constructor"

export const createSyncService = () => new SyncService();

// Singleton for app usage
export const syncService = new SyncService();
export default syncService;
