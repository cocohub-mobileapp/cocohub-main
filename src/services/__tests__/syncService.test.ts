import apiClient from '../apiClient';
import { getItem, setItem } from '../localDB';
import { SyncService } from '../syncService';
import { networkMonitor } from '../../utils/networkMonitor';

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn().mockResolvedValue('abc123'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { HEX: 'hex' },
}));

jest.mock('../../utils/networkMonitor', () => ({
  networkMonitor: {
    isOnline: jest.fn(),
  },
}));

jest.mock('../localDB', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../apiClient');
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('SyncService', () => {
  let syncService: SyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    (networkMonitor.isOnline as jest.Mock).mockResolvedValue(true);
    syncService = new SyncService();
  });

  describe('enqueue', () => {
    it('should add item to queue', async () => {
      (getItem as jest.Mock).mockResolvedValue('[]');

      await syncService.enqueue('pet', 'create', { id: 'pet-1', name: 'Buddy' });

      expect(setItem).toHaveBeenCalledWith('@sync_queue', expect.stringContaining('"type":"pet"'));
    });

    it('should deduplicate existing items', async () => {
      const existingItem = {
        id: 'q1',
        type: 'pet',
        action: 'update',
        data: { id: 'p1', name: 'Old' },
      };
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify([existingItem]));

      await syncService.enqueue('pet', 'update', { id: 'p1', name: 'New' });

      const setCall = (setItem as jest.Mock).mock.calls[0];
      const savedQueue = JSON.parse(setCall[1]);
      expect(savedQueue).toHaveLength(1);
      expect(savedQueue[0].data.name).toBe('New');
    });
  });

  describe('pull', () => {
    it('should fetch items from server', async () => {
      mockedApiClient.get.mockResolvedValue({ data: [{ id: 'p1', name: 'Server Pet' }] });
      (getItem as jest.Mock).mockResolvedValue('[]');

      await syncService.pull(['pet']);

      expect(mockedApiClient.get).toHaveBeenCalledWith('/pets');
      expect(setItem).toHaveBeenCalled();
    });
  });

  describe('push', () => {
    it('should remove successfully synced items from queue after server confirms receipt', async () => {
      const queueItem = {
        id: 'sync-1',
        type: 'pet',
        action: 'create',
        data: { id: 'pet-1', name: 'Buddy' },
        retries: 0,
      };
      (getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@sync_queue') return Promise.resolve(JSON.stringify([queueItem]));
        if (key === '@sync_status') return Promise.resolve(null);
        return Promise.resolve(null);
      });
      mockedApiClient.post.mockResolvedValueOnce({ data: { id: 'pet-1', name: 'Buddy' } });

      await syncService.push();

      expect(mockedApiClient.post).toHaveBeenCalledWith('/pets', { id: 'pet-1', name: 'Buddy' });
      expect(setItem).toHaveBeenCalledWith('@sync_queue', '[]');
      expect(setItem).toHaveBeenCalledWith(
        '@sync_status',
        expect.stringContaining('"pendingCount":0'),
      );
    });

    it('should retain failed items in the queue with incremented retries when server errors', async () => {
      const queueItem = {
        id: 'sync-1',
        type: 'pet',
        action: 'create',
        data: { id: 'pet-1', name: 'Buddy' },
        retries: 0,
      };
      (getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@sync_queue') return Promise.resolve(JSON.stringify([queueItem]));
        if (key === '@sync_status') return Promise.resolve(null);
        return Promise.resolve(null);
      });
      mockedApiClient.post.mockRejectedValueOnce(new Error('Server unavailable'));

      await syncService.push();

      expect(mockedApiClient.post).toHaveBeenCalledWith('/pets', { id: 'pet-1', name: 'Buddy' });
      const queueCall = (setItem as jest.Mock).mock.calls.find((c) => c[0] === '@sync_queue');
      expect(queueCall).toBeDefined();
      const savedQueue = JSON.parse(queueCall[1]);
      expect(savedQueue).toHaveLength(1);
      expect(savedQueue[0].retries).toBe(1);
      expect(setItem).toHaveBeenCalledWith(
        '@sync_status',
        expect.stringContaining('"pendingCount":1'),
      );
    });

    it('should not send requests or duplicate records when queue is empty on re-sync', async () => {
      (getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@sync_queue') return Promise.resolve('[]');
        if (key === '@sync_status') return Promise.resolve(null);
        return Promise.resolve(null);
      });

      await syncService.push();

      expect(mockedApiClient.post).not.toHaveBeenCalled();
      expect(mockedApiClient.put).not.toHaveBeenCalled();
      expect(mockedApiClient.delete).not.toHaveBeenCalled();
    });

    it('should route medical record to nested endpoint and strip temp id on create', async () => {
      const queueItem = {
        id: 'sync-2',
        type: 'medicalRecord',
        action: 'create',
        data: { id: 'temp_999', petId: 'pet-42', title: 'Rabies vaccine' },
        retries: 0,
      };
      (getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@sync_queue') return Promise.resolve(JSON.stringify([queueItem]));
        if (key === '@sync_status') return Promise.resolve(null);
        return Promise.resolve(null);
      });
      mockedApiClient.post.mockResolvedValueOnce({
        data: { id: 'rec-1', title: 'Rabies vaccine' },
      });

      await syncService.push();

      expect(mockedApiClient.post).toHaveBeenCalledWith('/pets/pet-42/medical-records', {
        petId: 'pet-42',
        title: 'Rabies vaccine',
      });
      expect(setItem).toHaveBeenCalledWith('@sync_queue', '[]');
    });
  });

  describe('status management', () => {
    it('should notify listeners on status change', async () => {
      const listener = jest.fn();
      syncService.subscribe(listener);

      (getItem as jest.Mock).mockResolvedValue('[]');
      await syncService.enqueue('pet', 'create', { id: '1' });

      expect(listener).toHaveBeenCalled();
      const status = listener.mock.calls[0][0];
      expect(status.pendingCount).toBe(1);
    });
  });
});
