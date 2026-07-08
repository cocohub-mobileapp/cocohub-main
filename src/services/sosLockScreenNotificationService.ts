import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getItem, removeItem, setItem } from './localDB';

export const SOS_LOCK_SCREEN_CHANNEL_ID = 'emergency-sos';
export const SOS_LOCK_SCREEN_CATEGORY_ID = 'emergency_sos_lock_screen';
export const SOS_LOCK_SCREEN_ACTION_ID = 'TRIGGER_EMERGENCY_SOS';

const SOS_LOCK_SCREEN_NOTIFICATION_KEY = '@sos_lock_screen_notification_id';
const SOS_LOCK_SCREEN_PAYLOAD_TYPE = 'sos_lock_screen';

async function getEmergencyService() {
  return (await import('./emergencyService')).default;
}

async function ensureSOSNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(SOS_LOCK_SCREEN_CHANNEL_ID, {
    name: 'Emergency SOS',
    importance: Notifications.AndroidImportance.MAX,
    bypassDnd: true,
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#EF4444',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function ensureSOSNotificationCategory(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(SOS_LOCK_SCREEN_CATEGORY_ID, [
    {
      identifier: SOS_LOCK_SCREEN_ACTION_ID,
      buttonTitle: 'Send SOS',
      options: {
        opensAppToForeground: false,
      },
    },
  ]);
}

export async function cancelSOSLockScreenNotification(): Promise<void> {
  const notificationId = await getItem(SOS_LOCK_SCREEN_NOTIFICATION_KEY);
  if (!notificationId) return;

  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
  const dismissNotificationAsync = (
    Notifications as unknown as { dismissNotificationAsync?: (id: string) => Promise<void> }
  ).dismissNotificationAsync;
  await dismissNotificationAsync?.(notificationId).catch(() => undefined);
  await removeItem(SOS_LOCK_SCREEN_NOTIFICATION_KEY);
}

export async function ensureSOSLockScreenNotification(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  const emergencyService = await getEmergencyService();
  const contacts = await emergencyService.getEmergencyContacts();
  if (contacts.length === 0) {
    await cancelSOSLockScreenNotification();
    return null;
  }

  const permissions = await Notifications.getPermissionsAsync();
  const hasPermission =
    (permissions as { granted?: boolean; status?: string }).granted ||
    (permissions as { granted?: boolean; status?: string }).status === 'granted';
  if (!hasPermission) return null;

  await ensureSOSNotificationChannel();
  await ensureSOSNotificationCategory();
  await cancelSOSLockScreenNotification();

  const content = {
    title: 'Emergency SOS ready',
    body: 'Use Send SOS from your lock screen if your pet needs urgent help.',
    data: { type: SOS_LOCK_SCREEN_PAYLOAD_TYPE },
    categoryIdentifier: SOS_LOCK_SCREEN_CATEGORY_ID,
    channelId: SOS_LOCK_SCREEN_CHANNEL_ID,
    sticky: true,
    autoDismiss: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  } as Notifications.NotificationContentInput & {
    sticky?: boolean;
    autoDismiss?: boolean;
    priority?: Notifications.AndroidNotificationPriority;
  };

  const notificationId = await Notifications.scheduleNotificationAsync({
    content,
    trigger: null,
  });

  await setItem(SOS_LOCK_SCREEN_NOTIFICATION_KEY, notificationId);
  return notificationId;
}

export async function handleSOSLockScreenNotificationAction(
  response: Notifications.NotificationResponse,
): Promise<boolean> {
  const { actionIdentifier, notification } = response;
  const data = notification.request.content.data ?? {};

  if (data.type !== SOS_LOCK_SCREEN_PAYLOAD_TYPE) {
    return false;
  }

  if (actionIdentifier !== SOS_LOCK_SCREEN_ACTION_ID) {
    return true;
  }

  const emergencyService = await getEmergencyService();
  await emergencyService.triggerSOS('Pet emergency - lock screen SOS activated');
  await ensureSOSLockScreenNotification().catch(() => undefined);
  return true;
}
