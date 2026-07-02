// ── In-memory store shared across all mocks ──────────────────────────────────
const mockStore = new Map<string, string>();

jest.mock('../../src/services/localDB', () => ({
  getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
  executeSql: jest.fn(async () => {}),
}));

jest.mock('../../src/utils/networkMonitor', () => ({
  networkMonitor: {
    isOnline: jest.fn(async () => true),
    onNetworkChange: jest.fn(),
    startNetworkMonitoring: jest.fn(),
    setSyncCallback: jest.fn(),
  },
}));

jest.mock('../../src/services/apiClient', () => ({
  __esModule: true,
  default: {
    put: jest.fn(async () => ({ data: {}, headers: {} })),
    post: jest.fn(async () => ({ data: {} })),
    get: jest.fn(async () => ({ data: [] })),
    delete: jest.fn(async () => ({})),
    head: jest.fn(async () => ({ headers: {} })),
  },
}));

jest.mock('../../src/services/notificationService', () => ({
  sendAlertNotification: jest.fn(async () => {}),
}));

import { SyncService } from '../../src/services/syncService';

describe('SyncService.removeFromQueue', () => {
  let syncService: SyncService;

  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
    syncService = new SyncService();
  });

  it('removes a specific item from the sync queue', async () => {
    await syncService.enqueue('pet', 'create', { id: 'pet-1', name: 'Buddy' });
    await syncService.enqueue('pet', 'update', { id: 'pet-2', name: 'Max' });

    let status = await syncService.getStatus();
    expect(status.pendingCount).toBe(2);

    await syncService.removeFromQueue('pet-1', 'pet', 'create');

    status = await syncService.getStatus();
    expect(status.pendingCount).toBe(1);
  });

  it('does nothing if item does not exist in queue', async () => {
    await syncService.enqueue('pet', 'create', { id: 'pet-1', name: 'Buddy' });

    await syncService.removeFromQueue('pet-999', 'pet', 'create');

    const status = await syncService.getStatus();
    expect(status.pendingCount).toBe(1);
  });
});

describe('OfflineQueue clears syncService queue after successful sync', () => {
  beforeEach(() => {
    mockStore.clear();
    jest.clearAllMocks();
  });

  it('removes synced items from syncService queue to prevent duplicates', async () => {
    const svc = new SyncService();

    await svc.enqueue('pet', 'create', { id: 'pet-1', name: 'Buddy' });
    await svc.enqueue('pet', 'update', { id: 'pet-2', name: 'Max' });

    let status = await svc.getStatus();
    expect(status.pendingCount).toBe(2);

    // Simulate what offlineQueue.processQueue does after successful API call:
    await svc.removeFromQueue('pet-1', 'pet', 'create');
    await svc.removeFromQueue('pet-2', 'pet', 'update');

    status = await svc.getStatus();
    expect(status.pendingCount).toBe(0);
  });
});
