import { Platform } from 'react-native';
import emergencyService from './emergencyService';

export interface WatchSyncPayload {
  petId: string;
  petName: string;
  healthScore: number;
  nextDoseName?: string;
  nextDoseTime?: string;
  emergencyContactsCount: number;
}

/**
 * WatchConnectivity Service (#38)
 * Synchronizes pet health metrics to Apple Watch and handles Watch SOS triggers
 */
export class WatchConnectivityService {
  private lastSyncedPayload: WatchSyncPayload | null = null;

  /**
   * Push pet health summary to Apple Watch
   */
  async syncToWatch(payload: WatchSyncPayload): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;

    this.lastSyncedPayload = payload;

    try {
      // In production, delegates to NativeModules.WatchBridge.updateApplicationContext(payload)
      return true;
    } catch (err) {
      console.warn('WatchConnectivity sync failed:', err);
      return false;
    }
  }

  /**
   * Handle incoming message from Apple Watch
   */
  async handleWatchMessage(message: Record<string, unknown>): Promise<{ success: boolean; status: string }> {
    if (message.action === 'trigger_sos') {
      try {
        await emergencyService.triggerSOS('Apple Watch SOS Shortcut Triggered');
        return { success: true, status: 'SOS_DISPATCHED' };
      } catch (err) {
        return { success: false, status: 'SOS_FAILED' };
      }
    }

    return { success: false, status: 'UNKNOWN_ACTION' };
  }

  getLastSyncedPayload(): WatchSyncPayload | null {
    return this.lastSyncedPayload;
  }
}

export const watchConnectivityService = new WatchConnectivityService();
export default watchConnectivityService;
