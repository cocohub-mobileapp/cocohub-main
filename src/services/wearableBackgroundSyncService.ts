import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import wearableService from './wearableService';
import { logError } from '../utils/errorLogger';

export const BACKGROUND_WEARABLE_SYNC_TASK = 'BACKGROUND_WEARABLE_SYNC_TASK';

const FETCH_INTERVAL_SECONDS = 60 * 60;

TaskManager.defineTask(BACKGROUND_WEARABLE_SYNC_TASK, async () => {
  try {
    const imported = await wearableService.syncConnectedWearables();
    return imported > 0
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (err) {
    logError(err as Error, { context: BACKGROUND_WEARABLE_SYNC_TASK });
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundWearableSyncTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_WEARABLE_SYNC_TASK);
    if (isRegistered) return;

    await BackgroundFetch.registerTaskAsync(BACKGROUND_WEARABLE_SYNC_TASK, {
      minimumInterval: FETCH_INTERVAL_SECONDS,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch (err) {
    logError(err as Error, { context: 'registerBackgroundWearableSyncTask' });
  }
}

export async function unregisterBackgroundWearableSyncTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_WEARABLE_SYNC_TASK);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_WEARABLE_SYNC_TASK);
    }
  } catch (err) {
    logError(err as Error, { context: 'unregisterBackgroundWearableSyncTask' });
  }
}
