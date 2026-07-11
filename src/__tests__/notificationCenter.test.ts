/**
 * Comprehensive tests for the notification center feature.
 *
 * Covers:
 *  - SQLite persistence (add, get, delete)
 *  - Read/unread state transitions
 *  - Filtering by category
 *  - Bulk actions (markManyAsRead, deleteMany)
 *  - Badge count synchronisation
 *  - Duplicate prevention (INSERT OR IGNORE)
 *  - Deep-link routing via resolveNavPayload
 *  - Invalid / missing nav payload handling
 *  - Database recovery (graceful error handling)
 *  - Performance with large datasets
 */

// expo-sqlite is mapped to src/__mocks__/expo-sqlite.ts by jest moduleNameMapper.
// We import it here so we can spy on the mock db methods.
import * as SQLiteMock from 'expo-sqlite';

import {
  addNotification,
  deleteAll,
  deleteMany,
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  markManyAsRead,
  type AppNotification,
} from '../services/notificationStore';
import { resolveNavPayload } from '../utils/notificationNavigation';

// ─── In-memory store ──────────────────────────────────────────────────────────

interface Row {
  id: string;
  category: string;
  title: string;
  body: string;
  is_read: number;
  created_at: number;
  metadata: string | null;
  nav_payload: string | null;
}

let rows: Row[] = [];

// Get the mock db instance that the store module received at import time.

const mockDb = (SQLiteMock.openDatabaseSync as jest.Mock).mock.results[0]?.value as any;

function setupMockDb() {
  if (!mockDb) return;

  mockDb.execAsync.mockResolvedValue(undefined);

  mockDb.runAsync.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const s = sql.trim().toUpperCase();

    if (s.startsWith('INSERT OR IGNORE INTO NOTIFICATIONS')) {
      const [id, category, title, body, is_read, created_at, metadata, nav_payload] = params as [
        string,
        string,
        string,
        string,
        number,
        number,
        string | null,
        string | null,
      ];
      if (!rows.find((r) => r.id === id)) {
        rows.push({ id, category, title, body, is_read, created_at, metadata, nav_payload });
      }
    } else if (s.startsWith('UPDATE NOTIFICATIONS SET IS_READ = 1 WHERE ID IN')) {
      const ids = params as string[];
      rows.forEach((r) => {
        if (ids.includes(r.id)) r.is_read = 1;
      });
    } else if (s.startsWith('UPDATE NOTIFICATIONS SET IS_READ = 1 WHERE CATEGORY =')) {
      const [cat] = params as string[];
      rows.forEach((r) => {
        if (r.category === cat) r.is_read = 1;
      });
    } else if (s.startsWith('UPDATE NOTIFICATIONS SET IS_READ = 1 WHERE ID =')) {
      const [id] = params as string[];
      rows.forEach((r) => {
        if (r.id === id) r.is_read = 1;
      });
    } else if (s.startsWith('UPDATE NOTIFICATIONS SET IS_READ = 1')) {
      rows.forEach((r) => {
        r.is_read = 1;
      });
    } else if (s.startsWith('DELETE FROM NOTIFICATIONS WHERE ID IN')) {
      const ids = new Set(params as string[]);
      rows = rows.filter((r) => !ids.has(r.id));
    } else if (s.startsWith('DELETE FROM NOTIFICATIONS WHERE ID =')) {
      const [id] = params as string[];
      rows = rows.filter((r) => r.id !== id);
    } else if (s.startsWith('DELETE FROM NOTIFICATIONS WHERE CATEGORY =')) {
      const [cat] = params as string[];
      rows = rows.filter((r) => r.category !== cat);
    } else if (s.startsWith('DELETE FROM NOTIFICATIONS')) {
      rows = [];
    }
    return { changes: 1, lastInsertRowId: 1 };
  });

  mockDb.getFirstAsync.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const s = sql.trim().toUpperCase();
    if (s.includes('COUNT(*)') && s.includes('IS_READ = 0') && s.includes('CATEGORY =')) {
      const [cat] = params as string[];
      return { count: rows.filter((r) => r.is_read === 0 && r.category === cat).length };
    }
    if (s.includes('COUNT(*)') && s.includes('IS_READ = 0')) {
      return { count: rows.filter((r) => r.is_read === 0).length };
    }
    if (s.includes('NOTIFICATION_META')) return { value: '1' };
    return null;
  });

  mockDb.getAllAsync.mockImplementation(async (sql: string, params: unknown[] = []) => {
    const s = sql.trim().toUpperCase();
    const sorted = [...rows].sort((a, b) => b.created_at - a.created_at);
    if (s.includes('WHERE CATEGORY =')) {
      const [cat] = params as string[];
      return sorted.filter((r) => r.category === cat);
    }
    return sorted;
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let idCounter = 0;

function makeNotification(
  overrides: Partial<AppNotification> = {},
): Omit<AppNotification, 'isRead'> {
  idCounter++;
  return {
    id: `notif-${idCounter}`,
    category: 'system',
    title: `Notification ${idCounter}`,
    body: `Body ${idCounter}`,
    createdAt: Date.now() - idCounter * 1000,
    ...overrides,
  };
}

beforeEach(() => {
  rows = [];
  idCounter = 0;
  setupMockDb();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('notificationStore — persistence', () => {
  it('adds a notification and retrieves it', async () => {
    const n = makeNotification({ category: 'medication', title: 'Take Aspirin' });
    await addNotification(n);
    const result = await getNotifications();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(n.id);
    expect(result[0].title).toBe('Take Aspirin');
    expect(result[0].isRead).toBe(false);
  });

  it('persists metadata and navPayload', async () => {
    const n = makeNotification({
      metadata: { petId: 'pet-1' },
      navPayload: { screen: 'Medications', params: { petId: 'pet-1' } },
    });
    await addNotification(n);
    const [saved] = await getNotifications();
    expect(saved.metadata).toEqual({ petId: 'pet-1' });
    expect(saved.navPayload).toEqual({ screen: 'Medications', params: { petId: 'pet-1' } });
  });

  it('returns notifications newest-first', async () => {
    const now = Date.now();
    await addNotification(makeNotification({ createdAt: now - 2000 }));
    await addNotification(makeNotification({ createdAt: now - 1000 }));
    await addNotification(makeNotification({ createdAt: now }));
    const result = await getNotifications();
    expect(result[0].createdAt).toBeGreaterThan(result[1].createdAt);
    expect(result[1].createdAt).toBeGreaterThan(result[2].createdAt);
  });
});

describe('notificationStore — duplicate prevention', () => {
  it('ignores duplicate ids (INSERT OR IGNORE)', async () => {
    const n = makeNotification({ id: 'dup-1' });
    await addNotification(n);
    await addNotification({ ...n, title: 'Different title' });
    const result = await getNotifications();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe(n.title);
  });
});

describe('notificationStore — read/unread state', () => {
  it('starts as unread', async () => {
    await addNotification(makeNotification());
    const [n] = await getNotifications();
    expect(n.isRead).toBe(false);
  });

  it('markAsRead transitions to read', async () => {
    const n = makeNotification();
    await addNotification(n);
    await markAsRead(n.id);
    const [updated] = await getNotifications();
    expect(updated.isRead).toBe(true);
  });

  it('markAllAsRead marks every notification', async () => {
    await addNotification(makeNotification());
    await addNotification(makeNotification());
    await markAllAsRead();
    const result = await getNotifications();
    expect(result.every((n) => n.isRead)).toBe(true);
  });

  it('markManyAsRead marks only specified ids', async () => {
    const a = makeNotification();
    const b = makeNotification();
    const c = makeNotification();
    await addNotification(a);
    await addNotification(b);
    await addNotification(c);
    await markManyAsRead([a.id, b.id]);
    const result = await getNotifications();
    const byId = Object.fromEntries(result.map((n) => [n.id, n]));
    expect(byId[a.id].isRead).toBe(true);
    expect(byId[b.id].isRead).toBe(true);
    expect(byId[c.id].isRead).toBe(false);
  });

  it('markManyAsRead with empty array is a no-op', async () => {
    await addNotification(makeNotification());
    await markManyAsRead([]);
    const [n] = await getNotifications();
    expect(n.isRead).toBe(false);
  });
});

describe('notificationStore — filtering', () => {
  beforeEach(async () => {
    await addNotification(makeNotification({ category: 'medication' }));
    await addNotification(makeNotification({ category: 'appointment' }));
    await addNotification(makeNotification({ category: 'sos' }));
    await addNotification(makeNotification({ category: 'system' }));
  });

  it('filter=all returns all notifications', async () => {
    expect(await getNotifications('all')).toHaveLength(4);
  });

  it('filter=medication returns only medication', async () => {
    const result = await getNotifications('medication');
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('medication');
  });

  it('filter=appointment returns only appointment', async () => {
    const result = await getNotifications('appointment');
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('appointment');
  });

  it('filter=sos returns only sos', async () => {
    const result = await getNotifications('sos');
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('sos');
  });

  it('filter=system returns only system', async () => {
    const result = await getNotifications('system');
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('system');
  });

  it('markAllAsRead with category filter only marks that category', async () => {
    await markAllAsRead('medication');
    const meds = await getNotifications('medication');
    const others = await getNotifications('appointment');
    expect(meds[0].isRead).toBe(true);
    expect(others[0].isRead).toBe(false);
  });
});

describe('notificationStore — deletion', () => {
  it('deleteNotification removes a single entry', async () => {
    const n = makeNotification();
    await addNotification(n);
    await deleteNotification(n.id);
    expect(await getNotifications()).toHaveLength(0);
  });

  it('deleteMany removes specified ids', async () => {
    const a = makeNotification();
    const b = makeNotification();
    const c = makeNotification();
    await addNotification(a);
    await addNotification(b);
    await addNotification(c);
    await deleteMany([a.id, b.id]);
    const result = await getNotifications();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(c.id);
  });

  it('deleteMany with empty array is a no-op', async () => {
    await addNotification(makeNotification());
    await deleteMany([]);
    expect(await getNotifications()).toHaveLength(1);
  });

  it('deleteAll removes everything', async () => {
    await addNotification(makeNotification());
    await addNotification(makeNotification());
    await deleteAll();
    expect(await getNotifications()).toHaveLength(0);
  });

  it('deleteAll with category filter removes only that category', async () => {
    await addNotification(makeNotification({ category: 'medication' }));
    await addNotification(makeNotification({ category: 'system' }));
    await deleteAll('medication');
    const result = await getNotifications();
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe('system');
  });
});

describe('notificationStore — badge count', () => {
  it('getUnreadCount returns 0 when empty', async () => {
    expect(await getUnreadCount()).toBe(0);
  });

  it('getUnreadCount increments on add', async () => {
    await addNotification(makeNotification());
    await addNotification(makeNotification());
    expect(await getUnreadCount()).toBe(2);
  });

  it('getUnreadCount decrements after markAsRead', async () => {
    const n = makeNotification();
    await addNotification(n);
    await markAsRead(n.id);
    expect(await getUnreadCount()).toBe(0);
  });

  it('getUnreadCount is 0 after markAllAsRead', async () => {
    await addNotification(makeNotification());
    await addNotification(makeNotification());
    await markAllAsRead();
    expect(await getUnreadCount()).toBe(0);
  });

  it('getUnreadCount decrements after deleteNotification', async () => {
    const n = makeNotification();
    await addNotification(n);
    await deleteNotification(n.id);
    expect(await getUnreadCount()).toBe(0);
  });

  it('getUnreadCount filtered by category', async () => {
    await addNotification(makeNotification({ category: 'medication' }));
    await addNotification(makeNotification({ category: 'system' }));
    expect(await getUnreadCount('medication')).toBe(1);
    expect(await getUnreadCount('system')).toBe(1);
    expect(await getUnreadCount('appointment')).toBe(0);
  });

  it('already-read notification does not affect unread count', async () => {
    await addNotification({ ...makeNotification(), isRead: true });
    expect(await getUnreadCount()).toBe(0);
  });
});

describe('resolveNavPayload — deep-link routing', () => {
  function notif(screen: string, params?: Record<string, unknown>): AppNotification {
    return {
      id: 'x',
      category: 'system',
      title: 'T',
      body: 'B',
      isRead: false,
      createdAt: Date.now(),
      navPayload: { screen, params },
    };
  }

  it('normalizes legacy Medications payloads to the Care tab', () => {
    expect(resolveNavPayload(notif('Medications'))).toEqual({
      screen: 'Care',
      params: { initialTab: 'Medications' },
    });
  });

  it('normalizes legacy Appointments payloads to Schedule', () => {
    expect(resolveNavPayload(notif('Appointments'))).toEqual({
      screen: 'Schedule',
      params: undefined,
    });
  });

  it('normalizes legacy Vaccinations payloads to the Care tab', () => {
    expect(resolveNavPayload(notif('Vaccinations', { petId: 'pet-1' }))).toEqual({
      screen: 'Care',
      params: { initialTab: 'Vaccinations', petId: 'pet-1' },
    });
  });

  it('normalizes Emergency payloads to the nested More screen', () => {
    expect(resolveNavPayload(notif('Emergency', { sosId: 'sos-1' }))).toEqual({
      screen: 'More',
      params: {
        screen: 'Emergency',
        params: { sosId: 'sos-1' },
      },
    });
  });

  it('normalizes PetDetail payloads to the nested PetList screen', () => {
    expect(resolveNavPayload(notif('PetDetail', { petId: 'pet-1' }))).toEqual({
      screen: 'PetList',
      params: {
        screen: 'PetDetail',
        params: { petId: 'pet-1' },
      },
    });
  });

  it('normalizes PetHealthDashboard payloads to the nested PetList screen', () => {
    expect(resolveNavPayload(notif('PetHealthDashboard', { petId: 'p1' }))).toEqual({
      screen: 'PetList',
      params: {
        screen: 'PetHealthDashboard',
        params: { petId: 'p1' },
      },
    });
  });

  it('normalizes Community payloads to the nested More screen', () => {
    expect(resolveNavPayload(notif('Community'))).toEqual({
      screen: 'More',
      params: {
        screen: 'Community',
        params: {},
      },
    });
  });

  it('passes through current main tab payloads', () => {
    expect(resolveNavPayload(notif('Care', { initialTab: 'Alerts' }))).toEqual({
      screen: 'Care',
      params: { initialTab: 'Alerts' },
    });
  });

  it('returns null for unknown screen', () => {
    expect(resolveNavPayload(notif('UnknownScreen'))).toBeNull();
  });

  it('returns null when navPayload is missing', () => {
    const n: AppNotification = {
      id: 'x',
      category: 'system',
      title: 'T',
      body: 'B',
      isRead: false,
      createdAt: Date.now(),
    };
    expect(resolveNavPayload(n)).toBeNull();
  });

  it('returns null when screen is empty string', () => {
    expect(resolveNavPayload(notif(''))).toBeNull();
  });

  it('returns null for SOS notification with invalid screen', () => {
    expect(resolveNavPayload(notif('SOSDetail'))).toBeNull();
  });

  it('returns null for injection-style screen name', () => {
    expect(resolveNavPayload(notif('../../Admin'))).toBeNull();
  });
});

describe('notificationStore — database recovery', () => {
  it('getNotifications rejects when db throws', async () => {
    mockDb.getAllAsync.mockRejectedValueOnce(new Error('DB error'));
    await expect(getNotifications()).rejects.toThrow('DB error');
  });

  it('getUnreadCount returns count after recovery', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ count: 5 });
    expect(await getUnreadCount()).toBe(5);
  });
});

describe('notificationStore — performance with large datasets', () => {
  it('handles 500 notifications without error', async () => {
    const batch = Array.from({ length: 500 }, (_, i) =>
      makeNotification({ id: `perf-${i}`, createdAt: Date.now() - i * 100 }),
    );
    for (const n of batch) await addNotification(n);
    const result = await getNotifications();
    expect(result.length).toBe(500);
  });

  it('bulk markManyAsRead on 100 ids completes without error', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => {
      const n = makeNotification({ id: `bulk-${i}` });
      rows.push({
        id: n.id,
        category: n.category as string,
        title: n.title,
        body: n.body,
        is_read: 0,
        created_at: n.createdAt,
        metadata: null,
        nav_payload: null,
      });
      return n.id;
    });
    await expect(markManyAsRead(ids)).resolves.not.toThrow();
  });

  it('deleteMany on 100 ids completes without error', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => {
      const n = makeNotification({ id: `del-${i}` });
      rows.push({
        id: n.id,
        category: n.category as string,
        title: n.title,
        body: n.body,
        is_read: 0,
        created_at: n.createdAt,
        metadata: null,
        nav_payload: null,
      });
      return n.id;
    });
    await expect(deleteMany(ids)).resolves.not.toThrow();
  });
});
