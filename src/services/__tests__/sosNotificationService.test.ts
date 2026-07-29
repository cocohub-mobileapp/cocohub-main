import * as Notifications from 'expo-notifications';

import emergencyService from '../emergencyService';
import { getItem, setItem } from '../localDB';
import {
  registerSOSNotificationCategory,
  showPersistentSOSNotification,
  dismissPersistentSOSNotification,
  startSOSNotificationIfReady,
  refreshSOSNotification,
  handleSOSNotificationAction,
} from '../sosNotificationService';

jest.mock('../localDB', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../emergencyService', () => ({
  default: {
    triggerSOS: jest.fn(),
  },
}));

jest.mock('expo-notifications', () => ({
  Platform: { OS: 'android' },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidNotificationVisibility: { PUBLIC: 'PUBLIC' },
  AndroidNotificationPriority: { MAX: 'max' },
}));

describe('sosNotificationService', () => {
  const mockContacts = [
    {
      id: 'contact-1',
      name: 'Dr. Smith',
      phoneNumber: '555-0100',
      type: 'vet',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerSOSNotificationCategory', () => {
    it('should register SOS notification category with Send and Dismiss actions', async () => {
      await registerSOSNotificationCategory();

      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith('sos', [
        expect.objectContaining({
          identifier: 'SOS_SEND',
          buttonTitle: '🚨 Send SOS',
          options: expect.objectContaining({
            opensAppToForeground: false,
            isAuthenticationRequired: false,
          }),
        }),
        expect.objectContaining({
          identifier: 'SOS_DISMISS',
          buttonTitle: 'Dismiss',
        }),
      ]);
    });
  });

  describe('showPersistentSOSNotification', () => {
    it('should show persistent SOS notification when contacts exist', async () => {
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockContacts));

      await showPersistentSOSNotification();

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'sos-alerts',
        expect.objectContaining({
          name: 'SOS Emergency Alerts',
          importance: 'max',
          bypassDnd: true,
        }),
      );

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: '🚨 SOS Emergency Ready',
            body: expect.stringContaining('Send SOS'),
            categoryIdentifier: 'sos',
          }),
          identifier: 'persistent-sos-notification',
        }),
      );
    });

    it('should not show notification when no contacts exist', async () => {
      (getItem as jest.Mock).mockResolvedValue(null);

      await showPersistentSOSNotification();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('should dismiss existing notification before showing new one', async () => {
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockContacts));

      await showPersistentSOSNotification();

      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(
        'persistent-sos-notification',
      );
    });
  });

  describe('dismissPersistentSOSNotification', () => {
    it('should dismiss the persistent SOS notification', async () => {
      await dismissPersistentSOSNotification();

      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(
        'persistent-sos-notification',
      );
    });

    it('should not throw if notification does not exist', async () => {
      (Notifications.dismissNotificationAsync as jest.Mock).mockRejectedValue(
        new Error('Notification not found'),
      );

      // Should not throw
      await expect(dismissPersistentSOSNotification()).resolves.toBeUndefined();
    });
  });

  describe('startSOSNotificationIfReady', () => {
    it('should start persistent notification if contacts are configured', async () => {
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockContacts));

      await startSOSNotificationIfReady();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should not start notification if no contacts', async () => {
      (getItem as jest.Mock).mockResolvedValue('[]');

      await startSOSNotificationIfReady();

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('refreshSOSNotification', () => {
    it('should show notification if contacts exist', async () => {
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockContacts));

      await refreshSOSNotification();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    it('should dismiss notification if no contacts', async () => {
      (getItem as jest.Mock).mockResolvedValue('[]');

      await refreshSOSNotification();

      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith(
        'persistent-sos-notification',
      );
    });
  });

  describe('handleSOSNotificationAction', () => {
    it('should trigger SOS when SOS_SEND action is received', async () => {
      (emergencyService.triggerSOS as jest.Mock).mockResolvedValue({});

      const result = await handleSOSNotificationAction('SOS_SEND');

      expect(result).toBe(true);
      expect(emergencyService.triggerSOS).toHaveBeenCalledWith(
        expect.stringContaining('lock screen SOS'),
      );
    });

    it('should dismiss notification on SOS_DISMISS action', async () => {
      const result = await handleSOSNotificationAction('SOS_DISMISS');

      expect(result).toBe(true);
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalled();
    });

    it('should return false for unknown action', async () => {
      const result = await handleSOSNotificationAction('UNKNOWN_ACTION');

      expect(result).toBe(false);
    });

    it('should return false if SOS trigger fails', async () => {
      (emergencyService.triggerSOS as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );

      const result = await handleSOSNotificationAction('SOS_SEND');

      expect(result).toBe(false);
    });
  });
});
