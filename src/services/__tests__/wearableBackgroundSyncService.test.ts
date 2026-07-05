import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import {
  BACKGROUND_WEARABLE_SYNC_TASK,
  registerBackgroundWearableSyncTask,
  unregisterBackgroundWearableSyncTask,
} from '../wearableBackgroundSyncService';

jest.mock('expo-background-fetch', () => ({
  BackgroundFetchResult: { NewData: 'newData', NoData: 'noData', Failed: 'failed' },
  registerTaskAsync: jest.fn(),
  unregisterTaskAsync: jest.fn(),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(),
}));

jest.mock('../wearableService', () => ({
  __esModule: true,
  default: { syncConnectedWearables: jest.fn().mockResolvedValue(0) },
}));

jest.mock('../../utils/errorLogger', () => ({ logError: jest.fn() }));

describe('wearableBackgroundSyncService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('registers the wearable sync task when not already registered', async () => {
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(false);
    await registerBackgroundWearableSyncTask();

    expect(BackgroundFetch.registerTaskAsync).toHaveBeenCalledWith(
      BACKGROUND_WEARABLE_SYNC_TASK,
      expect.objectContaining({ stopOnTerminate: false, startOnBoot: true }),
    );
  });

  it('skips registration when already registered', async () => {
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);
    await registerBackgroundWearableSyncTask();

    expect(BackgroundFetch.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('unregisters only when currently registered', async () => {
    (TaskManager.isTaskRegisteredAsync as jest.Mock).mockResolvedValue(true);
    await unregisterBackgroundWearableSyncTask();

    expect(BackgroundFetch.unregisterTaskAsync).toHaveBeenCalledWith(BACKGROUND_WEARABLE_SYNC_TASK);
  });
});
