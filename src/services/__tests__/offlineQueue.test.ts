jest.mock('../apiClient', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    get: jest.fn(),
    head: jest.fn(),
  },
}));
jest.mock('../localDB', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  executeSql: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../notificationService', () => ({
  sendAlertNotification: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../syncService', () => ({
  __esModule: true,
  default: {
    enqueue: jest.fn().mockResolvedValue(undefined),
    dropMatchingItem: jest.fn().mockResolvedValue(undefined),
    onStatusChange: jest.fn(() => () => {}),
    getStatus: jest.fn().mockResolvedValue({
      pendingCount: 0,
      isSyncing: false,
      lastSync: null,
      failedCount: 0,
    }),
  },
}));
jest.mock('../../utils/networkMonitor', () => ({
  networkMonitor: {
    isOnline: jest.fn(),
    onNetworkChange: jest.fn(),
    setSyncCallback: jest.fn(),
    startNetworkMonitoring: jest.fn(),
  },
}));

import { getItem, setItem } from '../localDB';
import syncService from '../syncService';
import { networkMonitor } from '../../utils/networkMonitor';
import offlineQueue from '../offlineQueue';

const apiClient = jest.requireMock('../apiClient').default as {
  post: jest.Mock;
  put: jest.Mock;
  delete: jest.Mock;
};
const mockedSync = syncService as jest.Mocked<typeof syncService>;

describe('offlineQueue processQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (networkMonitor.isOnline as jest.Mock).mockResolvedValue(true);
    (getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === '@offline_queue:conflicts') return '[]';
      if (key === '@offline_queue') {
        return JSON.stringify([
          {
            id: 'pet_create_1',
            type: 'pet',
            action: 'create',
            data: { id: 'pet-99', name: 'Mochi' },
            timestamp: Date.now(),
            retries: 0,
          },
        ]);
      }
      return null;
    });
    apiClient.post.mockResolvedValue({ data: {}, headers: {} });
  });

  it('posts creates to the collection endpoint and clears the queue entry', async () => {
    await offlineQueue.processQueue();

    expect(apiClient.post).toHaveBeenCalledWith(
      '/pets',
      { id: 'pet-99', name: 'Mochi' },
      { headers: {} },
    );
    expect(mockedSync.dropMatchingItem).toHaveBeenCalledWith('pet', 'create', {
      id: 'pet-99',
      name: 'Mochi',
    });

    const savedQueue = JSON.parse((setItem as jest.Mock).mock.calls.at(-1)[1]);
    expect(savedQueue).toEqual([]);
  });

  it('keeps failed mutations in the queue for another attempt', async () => {
    apiClient.post.mockRejectedValueOnce(new Error('network down'));

    await offlineQueue.processQueue();

    const savedQueue = JSON.parse((setItem as jest.Mock).mock.calls.at(-1)[1]);
    expect(savedQueue).toHaveLength(1);
    expect(savedQueue[0].data.name).toBe('Mochi');
    expect(mockedSync.dropMatchingItem).not.toHaveBeenCalled();
  });

  it('routes medical record creates through the pet-scoped endpoint', async () => {
    (getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === '@offline_queue:conflicts') return '[]';
      if (key === '@offline_queue') {
        return JSON.stringify([
          {
            id: 'record_create_1',
            type: 'medicalRecord',
            action: 'create',
            data: { id: 'rec-1', petId: 'pet-7', notes: 'Annual checkup' },
            timestamp: Date.now(),
            retries: 0,
          },
        ]);
      }
      return null;
    });

    await offlineQueue.processQueue();

    expect(apiClient.post).toHaveBeenCalledWith(
      '/pets/pet-7/medical-records',
      { id: 'rec-1', petId: 'pet-7', notes: 'Annual checkup' },
      { headers: {} },
    );
  });
});
