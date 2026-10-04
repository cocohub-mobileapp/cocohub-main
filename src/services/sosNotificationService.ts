import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import emergencyService from './emergencyService';

const SOS_CHANNEL_ID = 'sos-emergency';
const SOS_CATEGORY_ID = 'sos';
export const SOS_ACTION_IDENTIFIER = 'sos_action';

/**
 * Manages the persistent SOS notification that is accessible from the
 * Android lock screen (issue #50).
 *
 * The notification is:
 * - ongoing (non-dismissable) while emergency contacts are configured
 * - MAX priority with PUBLIC lock-screen visibility, so the SOS action
 *   button is shown on the lock screen without unlocking the device
 * - tappable via a notification category action that triggers the SOS
 *   flow directly (no unlock required)
 */
class SosNotificationService {
  private responseListener: { remove: () => void } | null = null;
  private activeNotificationId: string | null = null;

  /**
   * Registers the notification category/channel and the response listener.
   * Safe to call multiple times; returns whether notifications are allowed.
   */
  async setup(): Promise<boolean> {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false;

    const settings = await Notifications.getPermissionsAsync();
    if (settings.status !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      if (request.status !== 'granted') return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(SOS_CHANNEL_ID, {
        name: 'SOS Emergency',
        importance: Notifications.AndroidNotificationPriority.HIGH,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
        bypassDnd: true,
      });
    }

    await Notifications.setNotificationCategoryAsync(SOS_CATEGORY_ID, [
      {
        identifier: SOS_ACTION_IDENTIFIER,
        buttonTitle: '🚨 SOS',
        options: { opensAppToForeground: true },
      },
    ]);

    if (!this.responseListener) {
      this.responseListener =
        Notifications.addNotificationResponseReceivedListener((response) => {
          const actionId = response.actionIdentifier;
          if (
            actionId === SOS_ACTION_IDENTIFIER ||
            (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER &&
              response.notification.request.content.categoryIdentifier === SOS_CATEGORY_ID)
          ) {
            // Fire SOS directly from the notification action — works from
            // the lock screen without unlocking the phone.
            void emergencyService.triggerSOS('Pet emergency - need immediate help');
          }
        });
    }

    return true;
  }

  /**
   * Shows (or updates) the persistent lock-screen SOS notification.
   * No-op if notifications are not permitted or no contacts are configured.
   */
  async refresh(): Promise<void> {
    const contacts = await emergencyService.getEmergencyContacts();
    if (contacts.length === 0) {
      await this.hide();
      return;
    }

    const granted = await this.setup();
    if (!granted) return;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 SOS Emergency',
        body: 'Tap SOS to alert your emergency contacts',
        categoryIdentifier: SOS_CATEGORY_ID,
        sticky: true,
        data: { type: 'sos-lock-screen' },
      },
      trigger: null, // show immediately
      identifier: 'sos-lock-screen-notification',
    });
    this.activeNotificationId = notificationId;
  }

  /**
   * Removes the persistent SOS notification and the response listener.
   */
  async hide(): Promise<void> {
    if (this.activeNotificationId) {
      await Notifications.dismissNotificationAsync(this.activeNotificationId);
      this.activeNotificationId = null;
    }
  }

  teardown(): void {
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
    void this.hide();
  }
}

export default new SosNotificationService();
