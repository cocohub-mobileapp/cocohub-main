import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import emergencyService from './emergencyService';
import { getItem, setItem } from './localDB';

// ─── Constants ──────────────────────────────────────────────────────────────

const SOS_NOTIFICATION_ID = 'persistent-sos-notification';
const SOS_ACTION_SEND = 'SOS_SEND';
const SOS_ACTION_DISMISS = 'SOS_DISMISS';
const CONTACTS_STORAGE_KEY = '@emergency_contacts';
const SOS_NOTIF_CHANNEL = 'sos-alerts';

// ─── Notification Category ──────────────────────────────────────────────────

/**
 * Register the SOS notification category with a "Send SOS" action.
 * This action is visible on the Android lock screen, allowing users to
 * trigger an SOS emergency without unlocking their phone.
 */
export const registerSOSNotificationCategory = async (): Promise<void> => {
  await Notifications.setNotificationCategoryAsync('sos', [
    {
      identifier: SOS_ACTION_SEND,
      buttonTitle: '🚨 Send SOS',
      options: {
        opensAppToForeground: false,
        isAuthenticationRequired: false, // Allow from lock screen
        isDestructive: false,
      },
    },
    {
      identifier: SOS_ACTION_DISMISS,
      buttonTitle: 'Dismiss',
      options: {
        opensAppToForeground: false,
        isAuthenticationRequired: false,
      },
    },
  ]);
};

// ─── SOS Notification Channel (Android) ─────────────────────────────────────

/**
 * Creates a high-importance notification channel for SOS alerts on Android.
 * High importance ensures the notification shows on the lock screen with
 * heads-up display and sound.
 */
const ensureSOSChannel = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  const { AndroidImportance } = await import('expo-notifications');
  await Notifications.setNotificationChannelAsync(SOS_NOTIF_CHANNEL, {
    name: 'SOS Emergency Alerts',
    importance: AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#e53e3e',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
    bypassDnd: true,
    description:
      'Persistent SOS notification for emergency access from the lock screen',
  });
};

// ─── Persistent SOS Notification ────────────────────────────────────────────

/**
 * Show a persistent SOS notification with a "Send SOS" action button.
 * On Android, this appears on the lock screen as a high-priority notification
 * so the user can trigger SOS without unlocking the phone.
 */
export const showPersistentSOSNotification = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  await ensureSOSChannel();

  // Check if emergency contacts are configured
  const hasContacts = await hasEmergencyContacts();
  if (!hasContacts) return;

  // Dismiss any existing persistent SOS notification first
  await dismissPersistentSOSNotification();

  // Show new persistent notification with SOS action
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🚨 SOS Emergency Ready',
      body: 'Tap "Send SOS" to alert your emergency contacts',
      sound: false,
      priority: Notifications.AndroidNotificationPriority.MAX,
      sticky: true,
      data: {
        type: 'sos',
        category: 'sos',
        isPersistent: true,
      },
      categoryIdentifier: 'sos',
    },
    trigger: null, // Show immediately
    identifier: SOS_NOTIFICATION_ID,
  });
};

/**
 * Dismiss the persistent SOS notification.
 */
export const dismissPersistentSOSNotification = async (): Promise<void> => {
  try {
    await Notifications.dismissNotificationAsync(SOS_NOTIFICATION_ID);
  } catch {
    // Notification may not exist yet — ignore
  }
};

// ─── Emergency Contact Check ────────────────────────────────────────────────

const hasEmergencyContacts = async (): Promise<boolean> => {
  try {
    const stored = await getItem(CONTACTS_STORAGE_KEY);
    if (!stored) return false;
    const contacts = JSON.parse(stored);
    return Array.isArray(contacts) && contacts.length > 0;
  } catch {
    return false;
  }
};

// ─── Lifecycle Management ───────────────────────────────────────────────────

/**
 * Start the persistent SOS notification. Call this on app startup
 * if emergency contacts are configured.
 */
export const startSOSNotificationIfReady = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  const hasContacts = await hasEmergencyContacts();
  if (hasContacts) {
    await showPersistentSOSNotification();
  }
};

/**
 * Refresh the persistent SOS notification. Call this after contacts
 * are added or removed.
 */
export const refreshSOSNotification = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;
  const hasContacts = await hasEmergencyContacts();
  if (hasContacts) {
    await showPersistentSOSNotification();
  } else {
    await dismissPersistentSOSNotification();
  }
};

/**
 * Handle the SOS notification action when user taps "Send SOS"
 * from the lock screen.
 */
export const handleSOSNotificationAction = async (
  actionIdentifier: string,
): Promise<boolean> => {
  if (actionIdentifier === SOS_ACTION_SEND) {
    try {
      await emergencyService.triggerSOS('Pet emergency - need immediate help (lock screen SOS)');
      return true;
    } catch (error) {
      console.error('Lock screen SOS failed', error);
      return false;
    }
  }

  if (actionIdentifier === SOS_ACTION_DISMISS) {
    await dismissPersistentSOSNotification();
    return true;
  }

  return false;
};

export default {
  registerSOSNotificationCategory,
  showPersistentSOSNotification,
  dismissPersistentSOSNotification,
  startSOSNotificationIfReady,
  refreshSOSNotification,
  handleSOSNotificationAction,
};
