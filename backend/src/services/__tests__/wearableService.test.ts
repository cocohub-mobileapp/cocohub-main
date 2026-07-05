import wearableService, {
  buildOAuthAuthorizationUrl,
  detectAnomaliesForPet,
  normalizeProviderEvent,
} from '../../../services/wearableService';

jest.mock('../../db', () => ({
  query: jest.fn(),
}));

jest.mock('../../../../src/services/notificationService', () => ({
  sendAlertNotification: jest.fn(),
}));

const { sendAlertNotification } = require('../../../../src/services/notificationService');
const { query } = require('../../db');

describe('wearableService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('syncProviderForPet imports normalized metrics', async () => {
    // First query returns token record
    (query as jest.Mock)
      .mockResolvedValueOnce({
        rows: [{ access_token: 'tok', pet_id: 'pet1', provider_key: 'mockfit' }],
      })
      // subsequent inserts resolve to empty
      .mockResolvedValue({ rows: [] });

    const res = await wearableService.syncProviderForPet('mockfit', 'pet1');
    expect(res.imported).toBeGreaterThan(0);
    // ensure inserts were attempted (at least once)
    expect((query as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('detectAnomaliesForPet triggers alert when recent << baseline', async () => {
    // baseline query
    (query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ baseline: '10000' }] })
      // recent query
      .mockResolvedValueOnce({ rows: [{ recent: '100' }] });

    const result = await detectAnomaliesForPet('pet1', { windowDays: 14, thresholdPct: 0.4 });
    expect(result).toHaveProperty('alerted', true);
    expect(sendAlertNotification).toHaveBeenCalled();
  });

  it('normalizes FitBark and Whistle activity payloads', () => {
    const fitbarkMetrics = normalizeProviderEvent('fitbark', {
      id: 'fit-1',
      petId: 'pet1',
      timestamp: '2026-07-05T08:00:00.000Z',
      steps: 4200,
      calories_burned: 250,
      sleep_minutes: 480,
    });

    expect(fitbarkMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metricType: 'steps', value: 4200, unit: 'count' }),
        expect.objectContaining({ metricType: 'calories', value: 250, unit: 'kcal' }),
        expect.objectContaining({ metricType: 'sleep_duration', value: 480, unit: 'minutes' }),
      ]),
    );

    const whistleMetrics = normalizeProviderEvent('whistle', {
      id: 'whistle-1',
      pet_id: 'pet1',
      recorded_at: '2026-07-05T09:00:00.000Z',
      steps: 1000,
      sleep: 390,
    });

    expect(whistleMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metricType: 'steps', value: 1000 }),
        expect.objectContaining({ metricType: 'sleep_duration', value: 390 }),
      ]),
    );
  });

  it('buildOAuthAuthorizationUrl encodes pet/provider state when configured', () => {
    process.env.FITBARK_CLIENT_ID = 'fit-client';
    const url = buildOAuthAuthorizationUrl('fitbark', 'pet1', 'cocohub://wearables/callback');
    expect(url).toContain('client_id=fit-client');
    expect(url).toContain('redirect_uri=cocohub%3A%2F%2Fwearables%2Fcallback');
    expect(url).toContain('state=');
    delete process.env.FITBARK_CLIENT_ID;
  });

  it('syncProviderForPet reports unavailable providers without throwing', async () => {
    (query as jest.Mock).mockResolvedValueOnce({
      rows: [{ access_token: 'tok', pet_id: 'pet1', provider_key: 'unknown' }],
    });

    await expect(wearableService.syncProviderForPet('unknown', 'pet1')).resolves.toMatchObject({
      imported: 0,
      unavailable: true,
      reason: 'unsupported_provider',
    });
  });
});
