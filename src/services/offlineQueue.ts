import { Platform } from 'react-native';
import Storage from '../utils/storage';
import type { SyncRecord } from '../types/sync';

const QUEUE_KEY = 'offline_sync_queue';
const BATCH_SIZE = 50;

export class OfflineQueue {
  private static instance: OfflineQueue;

  private constructor() {}

  static getInstance(): OfflineQueue {
    if (!OfflineQueue.instance) {
      OfflineQueue.instance = new OfflineQueue();
    }
    return OfflineQueue.instance;
  }

  async enqueue(record: SyncRecord): Promise<void> {
    const queue = await this.getQueue();
    queue.push(record);
    await this.saveQueue(queue);
  }

  async getQueue(): Promise<SyncRecord[]> {
    try {
      const data = await Storage.getItem<string>(QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async getBatch(): Promise<SyncRecord[]> {
    const queue = await this.getQueue();
    return queue.slice(0, BATCH_SIZE);
  }

  async getRemainingAfter(batchSize: number): Promise<SyncRecord[]> {
    const queue = await this.getQueue();
    return queue.slice(batchSize);
  }

  async removeSuccessfulRecords(records: SyncRecord[]): Promise<void> {
    const queue = await this.getQueue();
    const recordIds = new Set(records.map(r => r.id));
    const filtered = queue.filter(r => !recordIds.has(r.id));
    await this.saveQueue(filtered);
  }

  async clearAll(): Promise<void> {
    await Storage.removeItem(QUEUE_KEY);
  }

  async getSize(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }

  private async saveQueue(queue: SyncRecord[]): Promise<void> {
    await Storage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}
