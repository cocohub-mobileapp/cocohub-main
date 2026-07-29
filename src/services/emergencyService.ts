import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { triggerSOS as nativeTriggerSOS } from './emergencyService';

const SOS_CHANNEL_ID = 'sos-emergency';
const SOS_NOTIFICATION_ID = 9999;

/**
 * Create the persistent SOS notification channel (Android only).
 * Must be called once on app startup if emergency contacts are configured.
 */
export async function setupSOSNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(SOS_CHANNEL_ID, {
    name: 'Emergency SOS',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF0000',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });
}

/**
 * Show a persistent SOS notification on the Android lock screen.
 * The notification action triggers SOS without unlocking the phone.
 */
export async function showSOSLockScreenNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.scheduleNotificationAsync({
    identifier: `sos-persistent-${SOS_NOTIFICATION_ID}`,
    content: {
      title: '🆘 Emergency SOS Ready',
      body: 'Tap to send emergency alert with your location',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      categoryIdentifier: 'sos',
      color: '#FF0000',
      data: { type: 'sos' },
    },
    trigger: null, // Show immediately and persist
  });
}

/**
 * Remove the SOS notification (e.g., when contacts are removed).
 */
export async function removeSOSLockScreenNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.dismissNotificationAsync(`sos-persistent-${SOS_NOTIFICATION_ID}`);
}

/**
 * Handle the SOS notification action tap.
 * Uses expo-notifications foreground service for lock-screen handling.
 */
export function configureSOSNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });

  // Handle SOS notification taps
  Notifications.addNotificationResponseReceivedListener((response) => {
    const { type } = response.notification.request.content.data || {};
    if (type === 'sos') {
      void nativeTriggerSOS();
    }
  });
}
