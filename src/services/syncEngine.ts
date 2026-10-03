import { Platform } from 'react-native';
import Storage from '../utils/storage';
import type { SyncRecord } from '../types/sync';
import { SyncStatus, type SyncResult } from '../types/sync';

const PENDING_SYNC_KEY = 'pending_sync_state';

export class SyncEngine {
  private static instance: SyncEngine;
  private isSyncing = false;
  private abortController: AbortController | null = null;
  private listeners: Set<() => void> = new Set();

  static getInstance(): SyncEngine {
    if (!SyncEngine.instance) {
      SyncEngine.instance = new SyncEngine();
    }
    return SyncEngine.instance;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(l => l());
  }

  async startSync(queueService: {
    getBatch: () => Promise<SyncRecord[]>;
    getRemainingAfter: (size: number) => Promise<SyncRecord[]>;
    removeSuccessfulRecords: (records: SyncRecord[]) => Promise<void>;
    clearAll: () => Promise<void>;
    getSize: () => Promise<number>;
  }, apiService: {
    syncRecords: (records: SyncRecord[]) => Promise<{ success: SyncRecord[]; failed: SyncRecord[]; errors: string[] }>;
  }, onProgress?: (progress: number, total: number) => void): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        status: SyncStatus.BUSY,
        message: 'Sync already in progress',
        recordsSynced: 0,
        errors: [],
      };
    }

    this.isSyncing = true;
    this.abortController = new AbortController();
    this.notify();

    try {
      const batch = await queueService.getBatch();
      if (batch.length === 0) {
        return {
          status: SyncStatus.IDLE,
          message: 'No records to sync',
          recordsSynced: 0,
          errors: [],
        };
      }

      onProgress?.(0, batch.length);

      const result = await apiService.syncRecords(batch);

      // Only clear successful records AFTER server confirmation
      if (result.success.length > 0) {
        await queueService.removeSuccessfulRecords(result.success);
      }

      const totalSynced = result.success.length;
      onProgress?.(totalSynced, batch.length);

      return {
        status: result.failed.length > 0 ? SyncStatus.PARTIAL : SyncStatus.COMPLETED,
        message: result.errors.join('; ') || (result.failed.length > 0 ? 'Some records failed' : 'Sync completed'),
        recordsSynced: totalSynced,
        errors: result.errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      return {
        status: SyncStatus.FAILED,
        message: errorMessage,
        recordsSynced: 0,
        errors: [errorMessage],
      };
    } finally {
      this.isSyncing = false;
      this.abortController = null;
      this.notify();
    }
  }

  cancelSync(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.isSyncing = false;
      this.notify();
    }
  }

  async getStatus(): Promise<{ isSyncing: boolean; queueSize: number }> {
    return { isSyncing: this.isSyncing, queueSize: 0 };
  }
}
