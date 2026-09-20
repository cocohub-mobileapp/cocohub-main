import apiClient from '../apiClient';
import { getItem, setItem } from '../localDB';
import offlineQueue from '../offlineQueue';
import syncService from '../syncService';
import { networkMonitor } from '../../utils/networkMonitor';

jest.mock('../localDB', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  executeSql: jest.fn().mockResolvedValue([]),
}));

jest.mock('../apiClient', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    get: jest.fn(),
  },
}));

jest.mock('../../utils/networkMonitor', () => ({
  networkMonitor: {
    isOnline: jest.fn().mockResolvedValue(true),
    setSyncCallback: jest.fn(),
    startNetworkMonitoring: jest.fn(),
  },
}));

jest.mock('../notificationService', () => ({
  sendAlertNotification: jest.fn().mockResolvedValue(undefined),
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('offlineQueue sync clearing (Issue #52)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (networkMonitor.isOnline as jest.Mock).mockResolvedValue(true);
    (getItem as jest.Mock).mockResolvedValue('[]');
  });

  it('clears the queue after successful server confirmation of medical record creation', async () => {
    const medicalRecordMutation = {
      id: 'mut_1',
      type: 'medicalRecord',
      action: 'create',
      data: { id: 'rec_1', petId: 'pet_123', notes: 'Vaccine rabies' },
      timestamp: Date.now(),
      retries: 0,
    };

    (getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === '@offline_queue') return Promise.resolve(JSON.stringify([medicalRecordMutation]));
      if (key === '@offline_queue:conflicts') return Promise.resolve('[]');
      if (key === '@sync_queue') return Promise.resolve('[]');
      return Promise.resolve(null);
    });

    mockedApiClient.post.mockResolvedValue({
      status: 201,
      data: { success: true },
      headers: {},
    });

    await offlineQueue.processQueue();

    // Verify correct REST endpoint was called with POST for create action
    expect(mockedApiClient.post).toHaveBeenCalledWith(
      '/pets/pet_123/medical-records',
      medicalRecordMutation.data,
      expect.anything(),
    );

    // Verify queue is cleared on success (setItem called with empty array)
    expect(setItem).toHaveBeenCalledWith('@offline_queue', '[]');
  });

  it('preserves items in queue if server request fails', async () => {
    const failingMutation = {
      id: 'mut_fail',
      type: 'pet',
      action: 'update',
      data: { id: 'pet_1', name: 'Fluffy' },
      timestamp: Date.now(),
      retries: 0,
    };

    (getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === '@offline_queue') return Promise.resolve(JSON.stringify([failingMutation]));
      if (key === '@offline_queue:conflicts') return Promise.resolve('[]');
      return Promise.resolve(null);
    });

    mockedApiClient.put.mockRejectedValue(new Error('Network failure'));

    await offlineQueue.processQueue();

    // Still pending in queue
    expect(setItem).toHaveBeenCalledWith(
      '@offline_queue',
      expect.stringContaining('mut_fail'),
    );
  });
});
