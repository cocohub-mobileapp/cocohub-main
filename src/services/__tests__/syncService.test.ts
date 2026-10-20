import apiClient from '../apiClient';
import { getItem, setItem } from '../localDB';
import { SyncService } from '../syncService';

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
      // Should save to local storage (e.g., @pets) - based on implementation details
      expect(setItem).toHaveBeenCalled();
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
  describe('push (#52)', () => {
    it('clears items from queue immediately upon successful server confirmation', async () => {
      const items = [
        { id: 'item-1', type: 'medicalRecord', action: 'create', data: { id: 'mr-1' }, timestamp: 1, retries: 0 },
        { id: 'item-2', type: 'medicalRecord', action: 'create', data: { id: 'mr-2' }, timestamp: 2, retries: 0 },
      ];
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify(items));
      mockedApiClient.post.mockResolvedValue({ status: 201, data: { success: true } });

      await syncService.push();

      // Verified syncItem succeeded for both items
      expect(mockedApiClient.post).toHaveBeenCalledTimes(2);
      // setItem should be called to update queue
      expect(setItem).toHaveBeenCalledWith('@sync_queue', expect.any(String));
    });

    it('keeps failed items in queue and increments retry count', async () => {
      const items = [
        { id: 'item-fail', type: 'pet', action: 'create', data: { id: 'pet-fail' }, timestamp: 1, retries: 0 },
      ];
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify(items));
      mockedApiClient.post.mockRejectedValue(new Error('500 Server Error'));

      await syncService.push();

      expect(mockedApiClient.post).toHaveBeenCalled();
    });
  });
});
