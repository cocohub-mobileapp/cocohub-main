import apiClient from '../apiClient';
import { getItem, setItem } from '../localDB';
import { networkMonitor } from '../utils/networkMonitor';
import { SyncService } from '../syncService';

jest.mock('../localDB', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../apiClient');
jest.mock('../utils/networkMonitor', () => ({
  networkMonitor: { isOnline: jest.fn().mockResolvedValue(true) },
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('SyncService clear-on-success', () => {
  let syncService: SyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    syncService = new SyncService();
    (getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === '@sync_status') return JSON.stringify({ isSyncing: false, lastSync: null, pendingCount: 0, failedCount: 0, conflicts: [] });
      return '[]';
    });
  });

  it('clears queue after successful server-confirmed push', async () => {
    const item = {
      id: 'medicalRecord_1',
      type: 'medicalRecord' as const,
      action: 'create' as const,
      data: { id: 'rec-1', petId: 'pet-1', note: 'test' },
      timestamp: Date.now(),
      retries: 0,
    };
    (getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === '@sync_queue') return JSON.stringify([item]);
      if (key === '@sync_status') return JSON.stringify({ isSyncing: false, lastSync: null, pendingCount: 1, failedCount: 0, conflicts: [] });
      return null;
    });
    mockedApiClient.post.mockResolvedValue({ data: {} });

    await syncService.push();

    const queueCall = (setItem as jest.Mock).mock.calls.find((c) => c[0] === '@sync_queue');
    expect(queueCall).toBeDefined();
    expect(JSON.parse(queueCall![1])).toEqual([]);
  });

  it('keeps failed items in queue when server rejects', async () => {
    const item = {
      id: 'medicalRecord_2',
      type: 'medicalRecord' as const,
      action: 'update' as const,
      data: { id: 'rec-2' },
      timestamp: Date.now(),
      retries: 0,
    };
    (getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === '@sync_queue') return JSON.stringify([item]);
      if (key === '@sync_status') return JSON.stringify({ isSyncing: false, lastSync: null, pendingCount: 1, failedCount: 0, conflicts: [] });
      return null;
    });
    mockedApiClient.put.mockRejectedValue(new Error('network'));

    await syncService.push();

    const queueCall = (setItem as jest.Mock).mock.calls.find((c) => c[0] === '@sync_queue');
    const saved = JSON.parse(queueCall![1]);
    expect(saved).toHaveLength(1);
    expect(saved[0].retries).toBe(1);
  });
});
