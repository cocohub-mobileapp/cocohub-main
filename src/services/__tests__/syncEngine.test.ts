import { networkMonitor } from '../../utils/networkMonitor';
import apiClient from '../apiClient';
import { SyncEngine } from '../syncEngine';

jest.mock('../apiClient');
jest.mock('../../utils/networkMonitor', () => ({
  networkMonitor: { isOnline: jest.fn() },
}));

// Mock AsyncStorage for backoff persistence
const asyncStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(asyncStore[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    asyncStore[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete asyncStore[key];
    return Promise.resolve();
  }),
}));

// Mock AppState so the subscription doesn't fire during tests
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

const sqliteState: Record<string, Record<string, unknown>> = {};

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({
    execAsync: jest.fn(() => Promise.resolve()),
    runAsync: jest.fn((sql: string, params: unknown[]) => {
      if (sql.includes('INSERT OR REPLACE INTO dirty_records')) {
        sqliteState[String(params[0])] = {
          id: params[0],
          entity_type: params[1],
          entity_id: params[2],
          action: params[3],
          payload: params[4],
          updated_at: params[5],
          sync_version: params[6],
          attempts: params[7],
        };
      }
      if (sql.includes('DELETE FROM dirty_records')) delete sqliteState[String(params[0])];
      if (sql.includes('UPDATE dirty_records SET attempts')) {
        const id = String(params[1]);
        if (sqliteState[id]) sqliteState[id].attempts = (Number(sqliteState[id].attempts) || 0) + 1;
      }
      return Promise.resolve({ changes: 1 });
    }),
    getFirstAsync: jest.fn((_sql: string, params: unknown[]) =>
      Promise.resolve(sqliteState[String(params[0])] ?? null),
    ),
    getAllAsync: jest.fn(() => Promise.resolve(Object.values(sqliteState))),
  }),
}));

describe('SyncEngine', () => {
  beforeEach(() => {
    Object.keys(sqliteState).forEach((key) => delete sqliteState[key]);
    Object.keys(asyncStore).forEach((key) => delete asyncStore[key]);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('queues dirty records with versions and emits progress', async () => {
    const engine = new SyncEngine();
    const listener = jest.fn();
    engine.onProgress(listener);

    await engine.markDirty('pet', 'p1', 'update', { name: 'Buddy' });

    expect(Object.keys(sqliteState)).toHaveLength(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'queued' }));
    engine.destroy();
  });

  it('keeps failed records when network interruption happens mid-sync', async () => {
    (networkMonitor.isOnline as jest.Mock).mockResolvedValue(true);
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { results: [{ status: 'updated' }] },
    });
    (apiClient.post as jest.Mock).mockRejectedValueOnce(new Error('network down'));
    const engine = new SyncEngine({ batchSize: 10 });

    await engine.markDirty('pet', 'p1', 'update', { name: 'One' });
    await engine.markDirty('pet', 'p2', 'update', { name: 'Two' });
    const result = await engine.syncNow();

    expect(result.failed).toBe(1);
    expect(sqliteState['pet:p1']).toBeUndefined();
    expect(sqliteState['pet:p2']).toBeDefined();
    engine.destroy();
  });

  it('clears a queued record only after a confirmed server success', async () => {
    (networkMonitor.isOnline as jest.Mock).mockResolvedValue(true);
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { results: [{ status: 'updated' }] },
    });
    const engine = new SyncEngine({ batchSize: 10 });

    await engine.markDirty('pet', 'p1', 'update', { name: 'Buddy' });
    const result = await engine.syncNow();

    expect(result.type).toBe('completed');
    expect(sqliteState['pet:p1']).toBeUndefined();
    engine.destroy();
  });

  it('keeps queued records when the server response is not a success confirmation', async () => {
    (networkMonitor.isOnline as jest.Mock).mockResolvedValue(true);
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { results: [{ status: 'conflict', serverRecord: { id: 'p1' } }] },
    });
    const engine = new SyncEngine({ batchSize: 10 });

    await engine.markDirty('pet', 'p1', 'update', { name: 'Buddy' });
    const result = await engine.syncNow();

    expect(result.failed).toBe(1);
    expect(sqliteState['pet:p1']).toBeDefined();
    engine.destroy();
  });

  it('supports configurable conflict strategies', () => {
    const engine = new SyncEngine();
    const client = { name: 'client', updatedAt: '2026-01-02T00:00:00.000Z' };
    const server = { name: 'server', updatedAt: '2026-01-01T00:00:00.000Z' };

    expect(engine.resolveConflict(client, server, 'last-write-wins').name).toBe('client');
    expect(engine.resolveConflict(client, server, 'server-wins').name).toBe('server');
    expect(engine.resolveConflict(client, server, 'client-wins').name).toBe('client');
    engine.destroy();
  });

  it('persists backoff state to AsyncStorage after a failed sync', async () => {
    (networkMonitor.isOnline as jest.Mock).mockResolvedValue(true);
    (apiClient.post as jest.Mock).mockRejectedValue(new Error('timeout'));
    const engine = new SyncEngine({ batchSize: 10 });

    await engine.markDirty('pet', 'p1', 'update', { name: 'Buddy' });
    const result = await engine.syncNow();

    expect(result.failed).toBe(1);
    expect(asyncStore['@sync_engine:backoff']).toBeDefined();
    const state = JSON.parse(asyncStore['@sync_engine:backoff']);
    expect(state.stepIndex).toBeGreaterThan(0);
    expect(state.nextRetryAt).toBeGreaterThan(Date.now());
    engine.destroy();
  });

  it('resets backoff state after a successful sync', async () => {
    (networkMonitor.isOnline as jest.Mock).mockResolvedValue(true);
    (apiClient.post as jest.Mock).mockResolvedValue({
      data: { results: [{ status: 'updated' }] },
    });
    // Seed a pre-existing backoff state
    asyncStore['@sync_engine:backoff'] = JSON.stringify({
      stepIndex: 2,
      nextRetryAt: Date.now() + 120_000,
    });
    const engine = new SyncEngine({ batchSize: 10 });

    await engine.markDirty('pet', 'p1', 'update', { name: 'Buddy' });
    const result = await engine.syncNow();

    expect(result.type).toBe('completed');
    expect(asyncStore['@sync_engine:backoff']).toBeUndefined();
    engine.destroy();
  });

  it('does not retry non-retryable errors (401/403/422)', async () => {
    (networkMonitor.isOnline as jest.Mock).mockResolvedValue(true);
    const authError = Object.assign(new Error('Unauthorized'), { response: { status: 401 } });
    (apiClient.post as jest.Mock).mockRejectedValue(authError);
    const engine = new SyncEngine({ batchSize: 10 });

    await engine.markDirty('pet', 'p1', 'update', { name: 'Buddy' });
    const result = await engine.syncNow();

    // Non-retryable errors are cleared from the queue immediately
    expect(result.failed).toBe(1);
    expect(sqliteState['pet:p1']).toBeUndefined();
    engine.destroy();
  });
});
