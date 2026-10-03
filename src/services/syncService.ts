import { AppState, type AppStateStatus } from 'react-native';
import { SyncEngine } from './syncEngine';
import { OfflineQueue } from './offlineQueue';
import { NetworkService } from './networkService';
import type { SyncRecord, SyncResult } from '../types/sync';
import { SyncStatus } from '../types/sync';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_SYNC_KEY = 'last_sync_timestamp';
const SYNC_DELAY_MS = 3000;

export class SyncService {
  private static instance: SyncService;
  private syncEngine: SyncEngine;
  private offlineQueue: OfflineQueue;
  private networkService: NetworkService;
  private isMonitoring = false;
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastSyncTime = 0;

  private constructor() {
    this.syncEngine = SyncEngine.getInstance();
    this.offlineQueue = OfflineQueue.getInstance();
    this.networkService = NetworkService.getInstance();
  }

  static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  async enqueueRecord(record: SyncRecord): Promise<void> {
    await this.offlineQueue.enqueue(record);
  }

  async sync(): Promise<SyncResult> {
    if (!this.networkService.isOnline()) {
      return {
        status: SyncStatus.OFFLINE,
        message: 'No network connection',
        recordsSynced: 0,
        errors: [],
      };
    }

    const result = await this.syncEngine.startSync(
      {
        getBatch: () => this.offlineQueue.getBatch(),
        getRemainingAfter: (size: number) => this.offlineQueue.getRemainingAfter(size),
        removeSuccessfulRecords: (records: SyncRecord[]) => this.offlineQueue.removeSuccessfulRecords(records),
        clearAll: () => this.offlineQueue.clearAll(),
        getSize: () => this.offlineQueue.getSize(),
      },
      {
        syncRecords: (records: SyncRecord[]) => this.networkService.syncRecords(records),
      },
      (progress, total) => {
        // Could emit progress event here
      }
    );

    if (result.status === SyncStatus.COMPLETED || result.status === SyncStatus.PARTIAL) {
      this.lastSyncTime = Date.now();
      await AsyncStorage.setItem(LAST_SYNC_KEY, this.lastSyncTime.toString());
    }

    return result;
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && this.networkService.isOnline()) {
        this.scheduleSync();
      }
    };

    AppState.addEventListener('change', handleAppStateChange);

    const networkListener = this.networkService.addListener(() => {
      if (this.networkService.isOnline()) {
        this.scheduleSync();
      }
    });

    // Check on init if online
    if (this.networkService.isOnline()) {
      this.scheduleSync();
    }
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
      this.syncTimeout = null;
    }
  }

  private scheduleSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    this.syncTimeout = setTimeout(() => {
      this.sync();
    }, SYNC_DELAY_MS);
  }

  async getLastSyncTime(): Promise<number> {
    try {
      const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  }

  async getQueueSize(): Promise<number> {
    return this.offlineQueue.getSize();
  }
}
