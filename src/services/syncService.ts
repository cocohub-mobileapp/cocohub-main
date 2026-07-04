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

  // ─── Queue management ───
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

  // ─── Pull from server ───
  async pull(
    types: SyncEntityType[] = ['pet', 'appointment', 'medication', 'medicalRecord'],
  ): Promise<void> {
    for (const type of types) {
      try {
        let endpoint = `/${type}s`;
        if (type === 'medicalRecord') {
          endpoint = '/medical-records';
        }

        const response = await apiClient.get<Record<string, unknown>[]>(endpoint);
        const serverItems = response.data;
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

  // ─── Push local changes ───
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
        const result = await this.syncItem(item);
        // Only remove from queue after server confirms success
        if (!result?.confirmed) {
          item.retries += 1;
          if (item.retries < MAX_RETRIES) failed.push(item);
        }
      } catch {
        item.retries += 1;
        if (item.retries < MAX_RETRIES) failed.push(item);
      }
    }

    // Save only failed items — successful ones are cleared from queue
    await setItem(SYNC_QUEUE_KEY, JSON.stringify(failed));

    await this.patchStatus({
      isSyncing: false,
      lastSync: Date.now(),
      pendingCount: failed.length,
      failedCount: failed.filter((i) => i.retries >= MAX_RETRIES).length,
    });
  }

  // ─── Sync ───
  async sync(): Promise<void> {
    const online = await networkMonitor.isOnline();
    if (!online) return;

    await this.pull();
    await this.push();
  }

  // ─── Conflict resolution ───
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

  // ─── Helpers ───
  async syncItem(item: SyncItem): Promise<{ confirmed: boolean }> {
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

    let response;
    switch (item.action) {
      case 'create': {
        response = await apiClient.post(endpoint, item.data);
        break;
      }
      case 'update': {
        const id = item.data.id as string;
        response = await apiClient.put(`${endpoint}/${id}`, item.data);
        break;
      }
      case 'delete': {
        const delId = item.data.id as string;
        response = await apiClient.delete(`${endpoint}/${delId}`);
        break;
      }
    }

    // Only confirm after server returns success status (2xx)
    const status = (response as any)?.status;
    return { confirmed: status >= 200 && status < 300 };
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

export const createSyncService = () => new SyncService();

// Singleton for app usage
export const syncService = new SyncService();
export default syncService;
