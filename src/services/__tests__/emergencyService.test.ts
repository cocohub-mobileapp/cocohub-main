import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { Linking } from 'react-native';

import emergencyService from '../emergencyService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
}));

jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn(),
  },
  Platform: {
    OS: 'ios',
    select: jest.fn(),
  },
  PermissionsAndroid: {
    request: jest.fn(),
    RESULTS: { GRANTED: 'granted' },
    PERMISSIONS: { ACCESS_FINE_LOCATION: 'ACCESS_FINE_LOCATION' },
  },
}));

describe('EmergencyService', () => {
  const service = emergencyService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('contacts management', () => {
    it('should return default contacts if none stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const contacts = await service.getEmergencyContacts();
      expect(contacts.length).toBeGreaterThan(0);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should add a new contact', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('[]');
      const newContact = { name: 'New Vet', phoneNumber: '123456', type: 'vet' as const };

      const added = await service.addContact(newContact);

      expect(added.name).toBe('New Vet');
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should update an existing contact', async () => {
      const existing = { id: 'c1', name: 'Old Vet', phoneNumber: '123' };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([existing]));

      const updated = await service.updateContact('c1', { name: 'Updated Vet' });

      expect(updated.name).toBe('Updated Vet');
    });

    it('should delete a contact', async () => {
      const existing = { id: 'c1', name: 'Vet' };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([existing]));

      await service.deleteContact('c1');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@emergency_contacts', '[]');
    });
  });

  describe('utility functions', () => {
    it('should call phoneNumber using Linking', async () => {
      await service.callContact('1234567890');
      expect(Linking.openURL).toHaveBeenCalledWith('tel:1234567890');
    });

    it('should get current location', async () => {
      const mockPosition = { coords: { latitude: 1, longitude: 2 } };
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) =>
        success(mockPosition),
      );

      const location = await service.getCurrentLocation();

      expect(location.latitude).toBe(1);
      expect(location.longitude).toBe(2);
    });

    it('should calculate distance between two points', () => {
      // Test the distance calculation logic
      const d = service.calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
      expect(d).toBeGreaterThan(3000); // NY to LA is ~3900km
    });
  describe('lock screen SOS notification (#50)', () => {
    it('schedules persistent lock screen notification when contacts are configured', async () => {
      const mockContacts = [{ id: 'c1', name: 'Vet Dr. Lee', phoneNumber: '555-1234', type: 'vet' as const }];
      await service.syncLockScreenSOSNotification(mockContacts);

      const Notifications = await import('expo-notifications');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'sos-persistent-lockscreen',
          content: expect.objectContaining({
            title: '🚨 Cocohub Emergency SOS Active',
            categoryIdentifier: 'SOS_LOCKSCREEN_ACTION',
            sticky: true,
          }),
        })
      );
    });

    it('dismisses notification when no contacts are configured', async () => {
      await service.syncLockScreenSOSNotification([]);

      const Notifications = await import('expo-notifications');
      expect(Notifications.dismissNotificationAsync).toHaveBeenCalledWith('sos-persistent-lockscreen');
    });
  });
});
