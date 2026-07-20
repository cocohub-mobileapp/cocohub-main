/**
 * Android lock-screen SOS notification (issue #50).
 * Shows a persistent high-priority notification with an SOS action when
 * emergency contacts are configured. Tapping the action calls triggerSOS
 * without requiring the app UI to be open.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import emergencyService from './emergencyService';

export const SOS_CHANNEL_ID = 'cocohub-sos-lockscreen';
export const SOS_CATEGORY_ID = 'sos_lockscreen';
export const SOS_ACTION_ID = 'TRIGGER_SOS';
export const SOS_NOTIFICATION_ID = 'cocohub-sos-persistent';

let responseSub: Notifications.Subscription | null = null;

export async function ensureSosNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(SOS_CHANNEL_ID, {
    name: 'SOS Emergency',
    importance: Notifications.AndroidImportance.MAX,
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    showBadge: true,
  });
}

export async function registerSosNotificationCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(SOS_CATEGORY_ID, [
    {
      identifier: SOS_ACTION_ID,
      buttonTitle: '🚨 SOS',
      options: {
        opensAppToForeground: false,
        isDestructive: true,
        isAuthenticationRequired: false,
      },
    },
  ]);
}

/**
 * Present (or refresh) a sticky SOS notification on Android when contacts exist.
 * No-op on iOS (lock-screen action model differs).
 */
export async function enableSosLockScreenNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  const contacts = await emergencyService.getEmergencyContacts();
  if (!contacts.length) {
    await disableSosLockScreenNotification();
    return;
  }

  await ensureSosNotificationChannel();
  await registerSosNotificationCategory();

  // Cancel prior instance then re-schedule sticky local notification
  await Notifications.dismissNotificationAsync(SOS_NOTIFICATION_ID).catch(() => undefined);
  await Notifications.cancelScheduledNotificationAsync(SOS_NOTIFICATION_ID).catch(() => undefined);

  await Notifications.scheduleNotificationAsync({
    identifier: SOS_NOTIFICATION_ID,
    content: {
      title: 'Cocohub SOS ready',
      body: 'Tap SOS to alert emergency contacts without unlocking.',
      categoryIdentifier: SOS_CATEGORY_ID,
      sticky: true,
      autoDismiss: false,
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { type: 'sos_lockscreen', action: SOS_ACTION_ID },
      ...(Platform.OS === 'android'
        ? {
            channelId: SOS_CHANNEL_ID,
          }
        : {}),
    },
    trigger: null, // show immediately
  });
}

export async function disableSosLockScreenNotification(): Promise<void> {
  await Notifications.dismissNotificationAsync(SOS_NOTIFICATION_ID).catch(() => undefined);
  await Notifications.cancelScheduledNotificationAsync(SOS_NOTIFICATION_ID).catch(() => undefined);
}

/** Handle notification response; returns true if SOS was triggered. */
export async function handleSosNotificationResponse(
  response: Notifications.NotificationResponse,
): Promise<boolean> {
  const actionId = response.actionIdentifier;
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  const isSos =
    actionId === SOS_ACTION_ID ||
    data?.action === SOS_ACTION_ID ||
    data?.type === 'sos_lockscreen';
  if (!isSos) return false;
  await emergencyService.triggerSOS('Lock-screen SOS — pet emergency');
  return true;
}

/** Subscribe once for SOS action taps (Android lock screen / notification tray). */
export function attachSosNotificationListener(): () => void {
  if (responseSub) {
    responseSub.remove();
    responseSub = null;
  }
  responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    void handleSosNotificationResponse(response);
  });
  return () => {
    responseSub?.remove();
    responseSub = null;
  };
}
