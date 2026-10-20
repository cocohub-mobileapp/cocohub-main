import apiClient from '../apiClient';
import {
  fetchFitBarkDailyActivity,
  fetchWhistleGpsAndActivity,
  getConnectedDevices,
} from '../wearableService';

jest.mock('../apiClient');
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('wearableService FitBark & Whistle Integration (#29)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('FitBark Integration', () => {
    it('gracefully fails when API key is missing', async () => {
      const res = await fetchFitBarkDailyActivity('pet-123', undefined);
      expect(res.success).toBe(false);
      expect(res.error).toContain('FitBark API key not configured');
      expect(mockedApiClient.get).not.toHaveBeenCalled();
    });

    it('successfully fetches FitBark daily activity when API key is present', async () => {
      const mockActivity = {
        petId: 'pet-123',
        date: '2026-10-20',
        barkPoints: 4200,
        activeMinutes: 110,
        restMinutes: 720,
        playMinutes: 45,
      };
      mockedApiClient.get.mockResolvedValue({ data: { success: true, data: mockActivity } });

      const res = await fetchFitBarkDailyActivity('pet-123', 'fake-fitbark-key', '2026-10-20');
      expect(res.success).toBe(true);
      expect(res.data?.barkPoints).toBe(4200);
      expect(mockedApiClient.get).toHaveBeenCalledWith('/activity/fitbark/pet-123', expect.any(Object));
    });
  });

  describe('Whistle Integration', () => {
    it('gracefully fails when API token is missing', async () => {
      const res = await fetchWhistleGpsAndActivity('pet-123', undefined);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Whistle API credentials not configured');
      expect(mockedApiClient.get).not.toHaveBeenCalled();
    });

    it('successfully fetches Whistle GPS telemetry and battery level', async () => {
      const mockTelemetry = {
        petId: 'pet-123',
        latitude: 37.7749,
        longitude: -122.4194,
        batteryPercent: 88,
        distanceMeters: 3450,
        lastUpdated: '2026-10-20T12:00:00Z',
      };
      mockedApiClient.get.mockResolvedValue({ data: { success: true, data: mockTelemetry } });

      const res = await fetchWhistleGpsAndActivity('pet-123', 'fake-whistle-token');
      expect(res.success).toBe(true);
      expect(res.data?.batteryPercent).toBe(88);
      expect(res.data?.distanceMeters).toBe(3450);
    });
  });

  describe('getConnectedDevices', () => {
    it('returns connected devices list for pet', async () => {
      mockedApiClient.get.mockResolvedValue({
        data: {
          data: [
            { providerId: 'fitbark', deviceName: 'FitBark Activity Monitor', connected: true, lastSync: '2026-10-20T10:00:00Z' },
          ],
        },
      });

      const devices = await getConnectedDevices('pet-123');
      expect(devices).toHaveLength(1);
      expect(devices[0].providerId).toBe('fitbark');
      expect(devices[0].connected).toBe(true);
    });
  });
});
