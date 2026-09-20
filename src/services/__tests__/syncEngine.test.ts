/**
 * syncEngine.test.ts
 *
 * Tests that the offline queue is cleared only after a successful server response.
 */

import { runSync } from '../syncEngine';
import { OfflineQueue } from '../offlineQueue';
import { SyncService } from '../syncService';

// ---------------------------------------------------------------------------
// Mock implementations
// ---------------------------------------------------------------------------

jest.mock('../offlineQueue', () => {
  const items: any[] = [];
  return {
    OfflineQueue: {
      getInstance: () => ({
        // Returns a shallow copy so the engine cannot mutate the original array.
        peekAll: jest.fn(() => [...items]),
        clear: jest.fn(() => {
          items.length = 0;
        }),
        // Helper used only inside the test to set up state.
        __setItems: (newItems: any[]) => {
          items.splice(0, items.length, ...newItems);
        },
      }),
    },
  };
});

jest.mock('../syncService', () => {
  return {
    SyncService: {
      getInstance: () => ({
        // The real implementation will be replaced per‑test.
        pushBatch: jest.fn(),
      }),
    },
  };
});

const mockedQueue = OfflineQueue.getInstance() as any;
const mockedService = SyncService.getInstance() as any;

describe('runSync', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('clears the queue after a successful push', async () => {
    // Arrange – queue contains two dummy items.
    mockedQueue.__setItems([{ id: 1 }, { id: 2 }]);
    mockedService.pushBatch.mockResolvedValueOnce(undefined); // success

    // Act
    const result = await runSync();

    // Assert
    expect(result).toBe(true);
    expect(mockedService.pushBatch).toHaveBeenCalledWith([
      { id: 1 },
      { id: 2 },
    ]);
    expect(mockedQueue.clear).toHaveBeenCalledTimes(1);
  });

  it('does NOT clear the queue when the server rejects', async () => {
    // Arrange – queue contains one dummy item.
    mockedQueue.__setItems([{ id: 99 }]);
    mockedService.pushBatch.mockRejectedValueOnce(new Error('Network error'));

    // Act
    const result = await runSync();

    // Assert
    expect(result).toBe(false);
    expect(mockedService.pushBatch).toHaveBeenCalledWith([{ id: 99 }]);
    expect(mockedQueue.clear).not.toHaveBeenCalled();
  });

  it('returns true when there is nothing to sync', async () => {
    // Arrange – empty queue.
    mockedQueue.__setItems([]);
    // No need to mock pushBatch; it should never be called.

    // Act
    const result = await runSync();

    // Assert
    expect(result).toBe(true);
    expect(mockedService.pushBatch).not.toHaveBeenCalled();
    expect(mockedQueue.clear).not.toHaveBeenCalled();
  });
});
