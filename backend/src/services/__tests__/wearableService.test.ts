import wearableService, {
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

    const insertCalls = (query as jest.Mock).mock.calls.filter(([sql]) =>
      String(sql).includes('INSERT INTO activity_metrics'),
    );
    const providerEventIds = insertCalls.map(([, params]) => params[6]);

    expect(providerEventIds.some((id) => String(id).endsWith(':steps'))).toBe(true);
    expect(providerEventIds.some((id) => String(id).endsWith(':sleep_duration'))).toBe(true);
    expect(new Set(providerEventIds).size).toBe(providerEventIds.length);
  });

  it('normalizes FitBark daily activity without live credentials', () => {
    const metrics = normalizeProviderEvent('fitbark', {
      id: 'fitbark-day-1',
      petId: 'pet1',
      date: '2026-07-03',
      activity: { steps: '8123', score: 74 },
      sleep: { minutes: 498, score: 0.86 },
    });

    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricType: 'steps',
          value: 8123,
          unit: 'count',
          providerEventId: 'fitbark-day-1:steps',
        }),
        expect.objectContaining({
          metricType: 'sleep_duration',
          value: 498,
          unit: 'minutes',
          providerEventId: 'fitbark-day-1:sleep_duration',
        }),
        expect.objectContaining({
          metricType: 'sleep_quality',
          value: 0.86,
          unit: 'ratio',
          providerEventId: 'fitbark-day-1:sleep_quality',
        }),
        expect.objectContaining({
          metricType: 'activity_score',
          value: 74,
          unit: 'score',
          providerEventId: 'fitbark-day-1:activity_score',
        }),
      ]),
    );
  });

  it('normalizes Whistle activity and GPS payloads without live credentials', () => {
    const metrics = normalizeProviderEvent('whistle', {
      id: 'whistle-event-1',
      pet_id: 'pet1',
      timestamp: '2026-07-03T08:00:00.000Z',
      activity: { steps: 6320, active_minutes: 58, distance_meters: 2710 },
      location: { latitude: 40.7128, longitude: -74.006 },
    });

    expect(metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricType: 'steps',
          value: 6320,
          providerEventId: 'whistle-event-1:steps',
        }),
        expect.objectContaining({
          metricType: 'activity_score',
          value: 58,
          providerEventId: 'whistle-event-1:activity_score',
        }),
        expect.objectContaining({
          metricType: 'distance',
          value: 2710,
          unit: 'meters',
          providerEventId: 'whistle-event-1:distance',
        }),
        expect.objectContaining({
          metricType: 'gps_latitude',
          value: 40.7128,
          unit: 'degrees',
          providerEventId: 'whistle-event-1:gps_latitude',
        }),
        expect.objectContaining({
          metricType: 'gps_longitude',
          value: -74.006,
          unit: 'degrees',
          providerEventId: 'whistle-event-1:gps_longitude',
        }),
      ]),
    );
  });

  it('skips configured provider sync gracefully when API config is absent', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    delete process.env.FITBARK_API_BASE_URL;
    delete process.env.FITBARK_ACTIVITY_PATH;

    (query as jest.Mock).mockResolvedValueOnce({
      rows: [{ access_token: 'tok', pet_id: 'pet1', provider_key: 'fitbark' }],
    });

    await expect(wearableService.syncProviderForPet('fitbark', 'pet1')).resolves.toEqual({
      imported: 0,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      '[wearableService] fitbark API config is absent; skipping wearable sync for pet1',
    );

    warnSpy.mockRestore();
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
});
