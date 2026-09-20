/**
 * syncEngine.ts
 *
 * Core synchronization engine that pulls pending actions from the offline queue,
 * sends them to the server via `syncService`, and only clears the queue after the
 * server confirms a successful write.
 *
 * The previous implementation cleared the queue immediately after the request was
 * dispatched, which caused items to remain in the queue on failure and be
 * re‑sent, creating duplicate records.  The engine now:
 *   1. Retrieves all pending items from the offline queue.
 *   2. Calls `syncService.pushBatch` (or similar) and **awaits** the response.
 *   3. Clears the queue **only** when the server responds with a success status.
 *
 * This file is deliberately small – the heavy lifting lives in `syncService`
 * and `offlineQueue`.  The changes are limited to the control flow and error
 * handling.
 */

import { OfflineQueue } from './offlineQueue';
import { SyncService } from './syncService';

/**
 * Runs a full sync cycle.
 *
 * @returns {Promise<boolean>} `true` if the sync succeeded and the queue was cleared,
 *                             `false` otherwise.
 */
export async function runSync(): Promise<boolean> {
  const queue = OfflineQueue.getInstance();
  const pendingItems = queue.peekAll(); // non‑destructive read

  // Nothing to do
  if (pendingItems.length === 0) {
    return true;
  }

  try {
    // `pushBatch` should return a promise that resolves only when the server
    // acknowledges the write (e.g., HTTP 200/201).  If the server returns an
    // error, the promise rejects.
    await SyncService.getInstance().pushBatch(pendingItems);

    // SUCCESS – clear the queue now that the server has confirmed receipt.
    queue.clear();
    return true;
  } catch (error) {
    // Log the error (the logger is a thin wrapper around console for now)
    // but **do not** clear the queue – items will be retried on the next sync.
    // eslint-disable-next-line no-console
    console.error('[SyncEngine] Sync failed:', error);
    return false;
  }
}
