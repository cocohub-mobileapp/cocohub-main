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

jest.mock('../localDB', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn(),
    canOpenURL: jest.fn().mockResolvedValue(true),
  },
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios),
  },
  PermissionsAndroid: {
    request: jest.fn().mockResolvedValue('granted'),
    RESULTS: { GRANTED: 'granted' },
    PERMISSIONS: { ACCESS_FINE_LOCATION: 'ACCESS_FINE_LOCATION' },
  },
}));

describe('SOS Feature Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Location Fallback', () => {
    it('should use fresh GPS if it responds within 5 seconds', async () => {
      const mockPosition = { coords: { latitude: 10, longitude: 20 } };
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) => {
        success(mockPosition);
      });

      const location = await emergencyService.getCurrentLocation();

      expect(location.latitude).toBe(10);
      expect(location.longitude).toBe(20);
    });
  });

  describe('SOS Trigger', () => {
    it('should dispatch alerts and call primary contact', async () => {
      const mockPosition = { coords: { latitude: 40, longitude: -70 } };
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) =>
        success(mockPosition),
      );

      const contacts = [
        { id: '1', name: 'Contact 1', phoneNumber: '111', type: 'emergency', available24h: true },
      ];

      const { getItem } = require('../localDB');
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify(contacts));

      await emergencyService.triggerSOS('Help me!');

      // Verify SMS alert dispatch
      expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('sms:111'));
      expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('body='));
      // "google.com/maps" is encoded as "google.com%2Fmaps"
      expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('google.com'));

      // Verify phone call (after SMS in this implementation's logic)
      expect(Linking.openURL).toHaveBeenCalledWith('tel:111');
    });

    it('should avoid foreground SMS and phone intents for lock-screen SOS actions', async () => {
      const mockPosition = { coords: { latitude: 40, longitude: -70 } };
      (Geolocation.getCurrentPosition as jest.Mock).mockImplementation((success) =>
        success(mockPosition),
      );

      const contacts = [
        { id: '1', name: 'Contact 1', phoneNumber: '111', type: 'emergency', available24h: true },
      ];

      const { getItem } = require('../localDB');
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify(contacts));

      const payload = await emergencyService.triggerSOS('Help me!', {
        allowForegroundActions: false,
      });

      expect(payload.location).toEqual({ latitude: 40, longitude: -70 });
      expect(Linking.openURL).not.toHaveBeenCalled();
    });
  });
});
