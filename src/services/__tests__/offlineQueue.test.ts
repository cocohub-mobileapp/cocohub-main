import apiClient from '../apiClient';
import { getItem, setItem } from '../localDB';
import offlineQueue from '../offlineQueue';
import syncService from '../syncService';
import { networkMonitor } from '../../utils/networkMonitor';

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn().mockResolvedValue('hash123'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
}));

jest.mock('../../utils/networkMonitor', () => ({
  networkMonitor: {
    isOnline: jest.fn(),
    onNetworkChange: jest.fn(),
    setSyncCallback: jest.fn(),
    startNetworkMonitoring: jest.fn(),
  },
}));

jest.mock('../localDB', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  executeSql: jest.fn().mockResolvedValue([]),
}));

jest.mock('../notificationService', () => ({
  sendAlertNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../apiClient');
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('OfflineQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (networkMonitor.isOnline as jest.Mock).mockResolvedValue(true);
  });

  describe('enqueue', () => {
    it('persists mutation to @offline_queue without double-booking into syncService', async () => {
      (getItem as jest.Mock).mockResolvedValue('[]');
      const syncServiceSpy = jest.spyOn(syncService, 'enqueue');

      await offlineQueue.enqueue('medicalRecord', 'create', {
        id: 'temp_1',
        petId: 'pet-1',
        title: 'Checkup',
      });

      const setQueueCall = (setItem as jest.Mock).mock.calls.find((c) => c[0] === '@offline_queue');
      expect(setQueueCall).toBeDefined();
      const savedQueue = JSON.parse(setQueueCall[1]);
      expect(savedQueue).toHaveLength(1);
      expect(savedQueue[0].type).toBe('medicalRecord');
      expect(savedQueue[0].action).toBe('create');
      expect(syncServiceSpy).not.toHaveBeenCalled();
    });
  });

  describe('processQueue', () => {
    it('clears mutation from queue only after server confirms receipt', async () => {
      const queuedMutation = {
        id: 'mut_1',
        type: 'medicalRecord',
        action: 'create',
        data: { id: 'temp_100', petId: 'pet-1', title: 'Vaccine' },
        timestamp: Date.now(),
        retries: 0,
      };

      (getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@offline_queue') return Promise.resolve(JSON.stringify([queuedMutation]));
        if (key === '@offline_conflicts') return Promise.resolve('[]');
        return Promise.resolve(null);
      });

      mockedApiClient.post.mockResolvedValueOnce({
        data: { id: 'rec-real-1', title: 'Vaccine' },
        headers: {},
      });

      await offlineQueue.processQueue();

      expect(mockedApiClient.post).toHaveBeenCalledWith(
        '/pets/pet-1/medical-records',
        { petId: 'pet-1', title: 'Vaccine' },
        { headers: {} },
      );

      const setQueueCall = (setItem as jest.Mock).mock.calls.find((c) => c[0] === '@offline_queue');
      expect(setQueueCall).toBeDefined();
      expect(JSON.parse(setQueueCall[1])).toEqual([]);
    });

    it('retains mutation in queue when server request fails', async () => {
      const queuedMutation = {
        id: 'mut_2',
        type: 'pet',
        action: 'update',
        data: { id: 'pet-99', name: 'Max' },
        timestamp: Date.now(),
        retries: 0,
      };

      (getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@offline_queue') return Promise.resolve(JSON.stringify([queuedMutation]));
        if (key === '@offline_conflicts') return Promise.resolve('[]');
        return Promise.resolve(null);
      });

      mockedApiClient.put.mockRejectedValueOnce(new Error('Network failure'));

      await offlineQueue.processQueue();

      expect(mockedApiClient.put).toHaveBeenCalledWith(
        '/pets/pet-99',
        { id: 'pet-99', name: 'Max' },
        { headers: {} },
      );

      const setQueueCall = (setItem as jest.Mock).mock.calls.find((c) => c[0] === '@offline_queue');
      expect(setQueueCall).toBeDefined();
      const saved = JSON.parse(setQueueCall[1]);
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe('mut_2');
    });

    it('does not send requests or duplicate records when queue is already cleared', async () => {
      (getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@offline_queue') return Promise.resolve('[]');
        if (key === '@offline_conflicts') return Promise.resolve('[]');
        return Promise.resolve(null);
      });

      await offlineQueue.processQueue();

      expect(mockedApiClient.post).not.toHaveBeenCalled();
      expect(mockedApiClient.put).not.toHaveBeenCalled();
      expect(mockedApiClient.delete).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('reports pendingCount as 0 when queues are empty', async () => {
      (getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@offline_queue') return Promise.resolve('[]');
        if (key === '@sync_queue') return Promise.resolve('[]');
        if (key === '@offline_conflicts') return Promise.resolve('[]');
        return Promise.resolve(null);
      });

      const status = await offlineQueue.getStatus();
      expect(status.pendingCount).toBe(0);
    });

    it('reports accurate pendingCount when mutations are queued', async () => {
      const item = { id: 'm1', type: 'pet', action: 'create', data: {} };
      (getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@offline_queue') return Promise.resolve(JSON.stringify([item]));
        if (key === '@sync_queue') return Promise.resolve('[]');
        if (key === '@offline_conflicts') return Promise.resolve('[]');
        return Promise.resolve(null);
      });

      const status = await offlineQueue.getStatus();
      expect(status.pendingCount).toBe(1);
    });
  });
});
