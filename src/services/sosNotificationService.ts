import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import emergencyService from './emergencyService';

const SOS_CATEGORY = 'sos-action';
const SOS_CHANNEL = 'sos-emergency';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let subscription: Notifications.Subscription | null = null;

export async function setupSOSNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Ensure channel exists with MAX importance so it can show on lockscreen
  await Notifications.setNotificationChannelAsync(SOS_CHANNEL, {
    name: 'Emergency SOS',
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });

  // Define the category with an SOS action button
  await Notifications.setNotificationCategoryAsync(SOS_CATEGORY, [
    {
      identifier: 'TRIGGER_SOS',
      buttonTitle: '🚨 TRIGGER SOS',
      options: {
        isDestructive: true,
        isAuthenticationRequired: false, // Don't require unlock
      },
    },
  ]);

  // Schedule the persistent notification
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Emergency SOS Ready',
      body: 'Tap the button below to instantly alert your emergency contacts.',
      categoryIdentifier: SOS_CATEGORY,
      autoDismiss: false,
      sticky: true, // Make it ongoing/persistent
    },
    trigger: null, // show immediately
  });

  // Listen for the action
  if (!subscription) {
    subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      if (response.actionIdentifier === 'TRIGGER_SOS') {
        try {
          await emergencyService.triggerSOS();
        } catch (error) {
          console.error('Failed to trigger SOS from notification:', error);
        }
      }
    });
  }
}

export async function teardownSOSNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Cancel all notifications (including our sticky one)
  await Notifications.cancelAllScheduledNotificationsAsync();
  
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
}
