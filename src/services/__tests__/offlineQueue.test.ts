jest.mock('../apiClient', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    head: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('../localDB', () => ({
  executeSql: jest.fn().mockResolvedValue(undefined),
  getItem: jest.fn(),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../notificationService', () => ({
  sendAlertNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../syncService', () => ({
  __esModule: true,
  default: {
    getStatus: jest.fn().mockResolvedValue({
      isSyncing: false,
      lastSync: null,
      pendingCount: 0,
      failedCount: 0,
      conflicts: [],
    }),
    onStatusChange: jest.fn(),
  },
}));

jest.mock('../../utils/networkMonitor', () => ({
  networkMonitor: {
    isOnline: jest.fn().mockResolvedValue(true),
  },
}));

import apiClient from '../apiClient';
import { getItem, setItem } from '../localDB';
import offlineQueue, { type QueuedMutation } from '../offlineQueue';

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
const mockGetItem = getItem as jest.Mock;
const mockSetItem = setItem as jest.Mock;

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('OfflineQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends a queued create once during concurrent reconnect syncs and clears it', async () => {
    const queuedPet: QueuedMutation = {
      id: 'pet_1',
      type: 'pet',
      action: 'create',
      data: { id: 'temp-1', name: 'Buddy' },
      timestamp: 1,
      retries: 0,
    };

    let resolvePost: (value: unknown) => void;
    mockApiClient.post.mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }) as ReturnType<typeof mockApiClient.post>,
    );

    mockGetItem.mockImplementation(async (key: string) => {
      if (key === '@offline_queue') return JSON.stringify([queuedPet]);
      if (key === '@offline_queue:conflicts') return '[]';
      return null;
    });

    const firstSync = offlineQueue.processQueue();
    const secondSync = offlineQueue.processQueue();
    await flushPromises();

    expect(mockApiClient.post).toHaveBeenCalledTimes(1);
    expect(mockApiClient.post).toHaveBeenCalledWith('/pets', queuedPet.data, { headers: {} });

    expect(resolvePost).toBeDefined();
    resolvePost({ headers: {} });
    await Promise.all([firstSync, secondSync]);

    const queueWrites = mockSetItem.mock.calls.filter(([key]) => key === '@offline_queue');
    expect(queueWrites.at(-1)).toEqual(['@offline_queue', '[]']);

    mockGetItem.mockImplementation(async (key: string) => {
      if (key === '@offline_queue') return '[]';
      if (key === '@offline_queue:conflicts') return '[]';
      return null;
    });

    await offlineQueue.processQueue();

    expect(mockApiClient.post).toHaveBeenCalledTimes(1);
  });
});
