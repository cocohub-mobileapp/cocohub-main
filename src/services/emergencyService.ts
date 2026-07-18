import * as Notifications from 'expo-notifications';
import { useEffect } from'react';
import { Platform } from'react-native';

export const scheduleSOSNotification = () => {
  if (Platform.OS === 'android') {
    Notifications.scheduleNotificationAsync({
      content: {
        title: "SOS",
        body: "Tap to trigger SOS",
      },
      trigger: null, // null means it's an ongoing (alertWhileActive) notification
      android: {
        channelId: 'default',
        actions: [
          {
            type: Notifications.AndroidActionType.BUTTON,
            title: 'SOS',
            buttonTitle: 'Trigger SOS',
            action: 'TRIGGER_SOS',
          },
        ],
        sticky: true, // Make it persistent
      },
    });
  }
};

export const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
  if (response.actionIdentifier === 'TRIGGER_SOS') {
    triggerSOS();
  }
};

export const triggerSOS = () => {
  // Implement your SOS logic here
  console.log("SOS Triggered!");
};

export const setupNotificationListeners = () => {
  Notifications.addNotificationReceivedListener(notification => {
    console.log(notification);
  });

  Notifications.addNotificationResponseReceivedListener(response => {
    handleNotificationResponse(response);
  });
};

export const configurePushNotifications = async () => {
  await Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.getExpoPushTokenAsync({ experienceId: '@your/experienceId' });
  }
};

useEffect(() => {
  configurePushNotifications();
  setupNotificationListeners();
  scheduleSOSNotification();
}, []);
