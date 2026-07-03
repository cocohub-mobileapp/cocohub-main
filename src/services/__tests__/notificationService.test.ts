import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

import { getItem, setItem } from '../localDB';
import {
  requestPermissions,
  checkPermissions,
  getPreferences,
  savePreferences,
  scheduleMedicationReminder,
  scheduleAppointmentNotification,
  scheduleVaccinationReminder,
  cancelEntityNotification,
  registerNotificationActions,
  handleNotificationAction,
  filterNotificationsByCategory,
  groupNotificationsByCategory,
  scheduleSOSLockScreenNotification,
  scheduleFutureNotification,
  updateScheduledNotification,
  cancelScheduledNotification,
  type ScheduledNotification,
} from '../notificationService';

jest.mock('../localDB', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { MAX: 'max' },
  AndroidNotificationPriority: { MAX: 'max' },
  AndroidNotificationVisibility: { PUBLIC: 'public' },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  dismissNotificationAsync: jest.fn(),
}));

jest.mock('react-native', () => ({
  Linking: { openURL: jest.fn() },
  Platform: { OS: 'android' },
}));

jest.mock('../emergencyService', () => ({
  __esModule: true,
  default: {
    triggerSOS: jest.fn(),
  },
}));

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('permissions', () => {
    it('should return true if granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      expect(await checkPermissions()).toBe(true);
    });

    it('should request permissions if not granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'undetermined',
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      expect(await requestPermissions()).toBe(true);
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('preferences', () => {
    it('should return default preferences if none stored', async () => {
      (getItem as jest.Mock).mockResolvedValue(null);
      const prefs = await getPreferences();
      expect(prefs.medicationReminders).toBe(true);
    });

    it('should save preferences', async () => {
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify({ medicationReminders: true }));
      await savePreferences({ medicationReminders: false });
      expect(setItem).toHaveBeenCalledWith(
        '@notification_preferences',
        expect.stringContaining('"medicationReminders":false'),
      );
    });
  });

  describe('medication reminders', () => {
    const mockMedication = {
      id: 'med-123',
      name: 'Aspirin',
      dosage: '10mg',
      frequency: 8,
      startDate: new Date().toISOString(),
    };

    it('should schedule medication reminders', async () => {
      (getItem as jest.Mock).mockResolvedValue(null);
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id-123');

      await scheduleMedicationReminder(mockMedication);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
      expect(setItem).toHaveBeenCalledWith(
        '@notification_map',
        expect.stringContaining('notif-id-123'),
      );
    });

    it('should cancel existing reminders before scheduling new ones', async () => {
      (getItem as jest.Mock)
        .mockResolvedValueOnce(null) // for getPreferences
        .mockResolvedValueOnce(JSON.stringify({ 'med-123': ['old-id'] })); // for getNotificationMap
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('new-id');

      await scheduleMedicationReminder(mockMedication);

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-id');
    });
  });

  describe('appointment notifications', () => {
    const mockAppointment = {
      id: 'appt-123',
      title: 'Vet Visit',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
    };

    it('should schedule appointment notification', async () => {
      (getItem as jest.Mock).mockResolvedValue(null);
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('appt-notif-id');

      const result = await scheduleAppointmentNotification(mockAppointment);

      expect(result).toBe('appt-notif-id');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });
  });

  describe('vaccination reminders', () => {
    const mockVaccination = {
      id: 'vac-123',
      name: 'Rabies Vaccine',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // next week
      petId: 'pet-123',
    };

    it('should schedule vaccination reminder', async () => {
      (getItem as jest.Mock).mockResolvedValue(null);
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('vac-notif-id');

      const result = await scheduleVaccinationReminder(mockVaccination);

      expect(result).toBe('vac-notif-id');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });
  });

  describe('generic scheduled notifications', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now

    const mockScheduledNotification: ScheduledNotification = {
      id: 'sched-123',
      title: 'Custom Reminder',
      body: 'This is a custom notification',
      scheduledDate: futureDate,
      data: { customData: 'test' },
    };

    it('should schedule future notification', async () => {
      (getItem as jest.Mock).mockResolvedValue(null);
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('sched-notif-id');

      const result = await scheduleFutureNotification(mockScheduledNotification);

      expect(result).toBe('sched-notif-id');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Custom Reminder',
            body: 'This is a custom notification',
            data: expect.objectContaining({
              type: 'scheduled',
              category: 'general',
              notificationId: 'sched-123',
              customData: 'test',
            }),
          }),
          trigger: expect.objectContaining({
            type: 'date',
            date: new Date(futureDate),
          }),
        }),
      );
    });

    it('should throw error for past date', async () => {
      const pastNotification: ScheduledNotification = {
        ...mockScheduledNotification,
        scheduledDate: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      };

      await expect(scheduleFutureNotification(pastNotification)).rejects.toThrow(
        'Scheduled date must be in the future',
      );
    });

    it('should update scheduled notification', async () => {
      (getItem as jest.Mock)
        .mockResolvedValueOnce(JSON.stringify({ 'sched-123': ['old-id'] })) // for cancel
        .mockResolvedValueOnce(null); // for schedule
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('new-sched-id');

      const result = await updateScheduledNotification(mockScheduledNotification);

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-id');
      expect(result).toBe('new-sched-id');
    });

    it('should cancel scheduled notification', async () => {
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify({ 'sched-123': ['notif-id'] }));

      await cancelScheduledNotification('sched-123');

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-id');
    });
  });

  describe('notification categories', () => {
    const requests = [
      { content: { data: { category: 'medication' } } },
      { content: { data: { type: 'appointment' } } },
      { content: { data: { type: 'vaccination' } } },
      { content: { data: {} } },
    ] as Notifications.NotificationRequest[];

    it('filters notifications by category', () => {
      expect(filterNotificationsByCategory(requests, 'appointments')).toEqual([requests[1]]);
      expect(filterNotificationsByCategory(requests, 'all')).toHaveLength(4);
    });

    it('groups notifications by category', () => {
      const grouped = groupNotificationsByCategory(requests);

      expect(grouped.medication).toEqual([requests[0]]);
      expect(grouped.appointments).toEqual([requests[1]]);
      expect(grouped.health).toEqual([requests[2]]);
      expect(grouped.general).toEqual([requests[3]]);
    });
  });

  describe('SOS lock screen notification', () => {
    it('registers an Android SOS notification action that does not require unlocking', async () => {
      await registerNotificationActions();

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'sos-emergency',
        expect.objectContaining({
          importance: 'max',
          lockscreenVisibility: 'public',
        }),
      );
      expect(Notifications.setNotificationCategoryAsync).toHaveBeenCalledWith(
        'sos',
        expect.arrayContaining([
          expect.objectContaining({
            identifier: 'TRIGGER_SOS',
            options: expect.objectContaining({
              opensAppToForeground: false,
              isAuthenticationRequired: false,
            }),
          }),
        ]),
      );
    });

    it('schedules a sticky SOS notification for the lock screen', async () => {
      (getItem as jest.Mock).mockResolvedValue(null);
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('sos-notif-id');

      const result = await scheduleSOSLockScreenNotification();

      expect(result).toBe('sos-notif-id');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            categoryIdentifier: 'sos',
            sticky: true,
            autoDismiss: false,
            data: expect.objectContaining({
              type: 'sos',
              notificationId: 'sos-lock-screen',
            }),
          }),
          trigger: { channelId: 'sos-emergency' },
        }),
      );
      expect(setItem).toHaveBeenCalledWith(
        '@notification_map',
        JSON.stringify({ 'sos-lock-screen': ['sos-notif-id'] }),
      );
    });

    it('triggers SOS from the notification action without opening the app first', async () => {
      const emergencyService = require('../emergencyService').default;
      emergencyService.triggerSOS.mockResolvedValue({});
      const notification = {
        request: {
          identifier: 'sos-notif-id',
          content: { data: { type: 'sos' }, categoryIdentifier: 'sos' },
        },
      } as Notifications.Notification;

      await handleNotificationAction({
        actionIdentifier: 'TRIGGER_SOS',
        notification,
      } as Notifications.NotificationResponse);

      expect(emergencyService.triggerSOS).toHaveBeenCalledWith(
        'Pet emergency - need immediate help',
        { allowForegroundActions: false },
      );
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });

    it('opens the app from the SOS notification without dismissing the persistent entry', async () => {
      const notification = {
        request: {
          identifier: 'sos-notif-id',
          content: { data: { type: 'sos' }, categoryIdentifier: 'sos' },
        },
      } as Notifications.Notification;

      await handleNotificationAction({
        actionIdentifier: 'OPEN_APP',
        notification,
      } as Notifications.NotificationResponse);

      expect(Linking.openURL).toHaveBeenCalledWith('cocohub://emergency');
      expect(Notifications.dismissNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('cancel operations', () => {
    it('should cancel entity notification', async () => {
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify({ 'entity-123': ['id1', 'id2'] }));

      await cancelEntityNotification('entity-123');

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
      expect(setItem).toHaveBeenCalledWith('@notification_map', '{}');
    });
  });
});
