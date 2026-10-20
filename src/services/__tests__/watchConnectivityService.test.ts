import watchConnectivityService from '../watchConnectivityService';
import emergencyService from '../emergencyService';

jest.mock('../emergencyService', () => ({
  triggerSOS: jest.fn().mockResolvedValue({ success: true, alertId: 'sos-123' }),
}));

describe('WatchConnectivityService (#38)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('syncs pet health score and medication info to watch payload', async () => {
    const payload = {
      petId: 'pet-123',
      petName: 'Rocky',
      healthScore: 92,
      nextDoseName: 'Prednisone',
      nextDoseTime: '18:00',
      emergencyContactsCount: 3,
    };

    const synced = await watchConnectivityService.syncToWatch(payload);
    expect(synced).toBe(true);
    expect(watchConnectivityService.getLastSyncedPayload()).toEqual(payload);
  });

  it('triggers emergency SOS when receiving trigger_sos message from Apple Watch', async () => {
    const res = await watchConnectivityService.handleWatchMessage({
      action: 'trigger_sos',
      source: 'apple_watch',
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe('SOS_DISPATCHED');
    expect(emergencyService.triggerSOS).toHaveBeenCalledWith('Apple Watch SOS Shortcut Triggered');
  });

  it('returns unknown action for unhandled watch messages', async () => {
    const res = await watchConnectivityService.handleWatchMessage({ action: 'heartbeat' });
    expect(res.success).toBe(false);
    expect(res.status).toBe('UNKNOWN_ACTION');
  });
});
