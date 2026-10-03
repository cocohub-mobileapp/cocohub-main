import { SyncEngine } from '../syncEngine';
import type { SyncRecord } from '../../types/sync';
import { SyncStatus } from '../../types/sync';

describe('SyncEngine', () => {
  let engine: SyncEngine;
  let mockQueueService: {
    getBatch: jest.Mock;
    getRemainingAfter: jest.Mock;
    removeSuccessfulRecords: jest.Mock;
    clearAll: jest.Mock;
    getSize: jest.Mock;
  };
  let mockApiService: {
    syncRecords: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    engine = SyncEngine.getInstance();

    mockQueueService = {
      getBatch: jest.fn().mockResolvedValue([]),
      getRemainingAfter: jest.fn().mockResolvedValue([]),
      removeSuccessfulRecords: jest.fn().mockResolvedValue(undefined),
      clearAll: jest.fn().mockResolvedValue(undefined),
      getSize: jest.fn().mockResolvedValue(0),
    };

    mockApiService = {
      syncRecords: jest.fn().mockResolvedValue({
        success: [],
        failed: [],
        errors: [],
      }),
    };
  });

  afterEach(() => {
    engine.cancelSync();
  });

  describe('startSync', () => {
    it('should not remove records when no records to sync', async () => {
      mockQueueService.getBatch.mockResolvedValue([]);

      const result = await engine.startSync(mockQueueService, mockApiService);

      expect(result.status).toBe(SyncStatus.IDLE);
      expect(mockQueueService.removeSuccessfulRecords).not.toHaveBeenCalled();
    });

    it('should clear queue after successful server confirmation (clear-on-success path)', async () => {
      const records: SyncRecord[] = [
        { id: '1', type: 'patient', data: {}, timestamp: Date.now() },
        { id: '2', type: 'patient', data: {}, timestamp: Date.now() },
      ];

      mockQueueService.getBatch.mockResolvedValue(records);
      mockApiService.syncRecords.mockResolvedValue({
        success: records,
        failed: [],
        errors: [],
      });

      const result = await engine.startSync(mockQueueService, mockApiService);

      expect(result.status).toBe(SyncStatus.COMPLETED);
      expect(result.recordsSynced).toBe(2);
      // Verify that removeSuccessfulRecords is called with the successful records
      // AFTER the server confirms (not before)
      expect(mockApiService.syncRecords).toHaveBeenCalledTimes(1);
      expect(mockQueueService.removeSuccessfulRecords).toHaveBeenCalledWith(records);
    });

    it('should not remove records when sync partially fails', async () => {
      const records: SyncRecord[] = [
        { id: '1', type: 'patient', data: {}, timestamp: Date.now() },
        { id: '2', type: 'patient', data: {}, timestamp: Date.now() },
      ];

      mockQueueService.getBatch.mockResolvedValue(records);
      mockApiService.syncRecords.mockResolvedValue({
        success: [records[0]],
        failed: [records[1]],
        errors: ['Record 2 failed'],
      });

      const result = await engine.startSync(mockQueueService, mockApiService);

      expect(result.status).toBe(SyncStatus.PARTIAL);
      expect(result.recordsSynced).toBe(1);
      // Only the successful record should be removed
      expect(mockQueueService.removeSuccessfulRecords).toHaveBeenCalledWith([records[0]]);
    });

    it('should not remove any records when all sync fails', async () => {
      const records: SyncRecord[] = [
        { id: '1', type: 'patient', data: {}, timestamp: Date.now() },
      ];

      mockQueueService.getBatch.mockResolvedValue(records);
      mockApiService.syncRecords.mockResolvedValue({
        success: [],
        failed: records,
        errors: ['All records failed'],
      });

      const result = await engine.startSync(mockQueueService, mockApiService);

      expect(result.status).toBe(SyncStatus.FAILED);
      expect(result.recordsSynced).toBe(0);
      // No records should be removed since none succeeded
      expect(mockQueueService.removeSuccessfulRecords).not.toHaveBeenCalled();
    });

    it('should handle network errors without removing records', async () => {
      const records: SyncRecord[] = [
        { id: '1', type: 'patient', data: {}, timestamp: Date.now() },
      ];

      mockQueueService.getBatch.mockResolvedValue(records);
      mockApiService.syncRecords.mockRejectedValue(new Error('Network error'));

      const result = await engine.startSync(mockQueueService, mockApiService);

      expect(result.status).toBe(SyncStatus.FAILED);
      expect(result.recordsSynced).toBe(0);
      // Records should remain in queue on error
      expect(mockQueueService.removeSuccessfulRecords).not.toHaveBeenCalled();
    });

    it('should prevent concurrent syncs', async () => {
      mockQueueService.getBatch.mockResolvedValue([
        { id: '1', type: 'patient', data: {}, timestamp: Date.now() },
      ]);
      mockApiService.syncRecords.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      const sync1 = engine.startSync(mockQueueService, mockApiService);
      const sync2 = engine.startSync(mockQueueService, mockApiService);

      const [result1, result2] = await Promise.all([sync1, sync2]);

      expect(result1.status).toBe(SyncStatus.COMPLETED);
      expect(result2.status).toBe(SyncStatus.BUSY);
    });
  });
});
