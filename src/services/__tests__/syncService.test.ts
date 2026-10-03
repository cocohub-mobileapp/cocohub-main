import { SyncService } from '../syncService';
import { SyncEngine } from '../syncEngine';
import { OfflineQueue } from '../offlineQueue';
import { NetworkService } from '../networkService';
import type { SyncRecord } from '../../types/sync';
import { SyncStatus } from '../../types/sync';

describe('SyncService', () => {
  let service: SyncService;
  let mockEngine: jest.Mocked<SyncEngine>;
  let mockQueue: jest.Mocked<OfflineQueue>;
  let mockNetwork: jest.Mocked<NetworkService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockQueue = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      getBatch: jest.fn().mockResolvedValue([]),
      getRemainingAfter: jest.fn().mockResolvedValue([]),
      removeSuccessfulRecords: jest.fn().mockResolvedValue(undefined),
      clearAll: jest.fn().mockResolvedValue(undefined),
      getSize: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<OfflineQueue>;

    mockNetwork = {
      isOnline: jest.fn().mockReturnValue(true),
      syncRecords: jest.fn().mockResolvedValue({
        success: [],
        failed: [],
        errors: [],
      }),
      addListener: jest.fn().mockReturnValue(() => {}),
    } as unknown as jest.Mocked<NetworkService>;

    mockEngine = {
      getInstance: jest.fn().mockReturnValue(mockEngine),
      startSync: jest.fn().mockResolvedValue({
        status: SyncStatus.COMPLETED,
        message: 'Sync completed',
        recordsSynced: 0,
        errors: [],
      }),
      subscribe: jest.fn().mockReturnValue(() => {}),
      cancelSync: jest.fn(),
      getStatus: jest.fn().mockResolvedValue({ isSyncing: false, queueSize: 0 }),
    } as unknown as jest.Mocked<SyncEngine>;

    // Override singletons for tests
    jest.spyOn(SyncEngine, 'getInstance').mockReturnValue(mockEngine);
    jest.spyOn(OfflineQueue, 'getInstance').mockReturnValue(mockQueue);
    jest.spyOn(NetworkService, 'getInstance').mockReturnValue(mockNetwork);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sync', () => {
    it('should return OFFLINE status when no network', async () => {
      mockNetwork.isOnline.mockReturnValue(false);

      const result = await service.sync();

      expect(result.status).toBe(SyncStatus.OFFLINE);
      expect(mockEngine.startSync).not.toHaveBeenCalled();
    });

    it('should delegate to SyncEngine and update last sync time on success', async () => {
      const spySetItem = jest.spyOn(require('../../utils/storage'), 'setItem').mockResolvedValue(undefined);

      mockEngine.startSync.mockResolvedValue({
        status: SyncStatus.COMPLETED,
        message: 'Sync completed',
        recordsSynced: 2,
        errors: [],
      });

      const result = await service.sync();

      expect(result.status).toBe(SyncStatus.COMPLETED);
      expect(result.recordsSynced).toBe(2);
      expect(spySetItem).toHaveBeenCalledWith('last_sync_timestamp', expect.any(String));
    });

    it('should NOT update last sync time when sync fails', async () => {
      const spySetItem = jest.spyOn(require('../../utils/storage'), 'setItem').mockResolvedValue(undefined);

      mockEngine.startSync.mockResolvedValue({
        status: SyncStatus.FAILED,
        message: 'Network error',
        recordsSynced: 0,
        errors: ['Network error'],
      });

      const result = await service.sync();

      expect(result.status).toBe(SyncStatus.FAILED);
      expect(spySetItem).not.toHaveBeenCalled();
    });
  });
});
