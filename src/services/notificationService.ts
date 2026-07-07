import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';

import apiClient from './apiClient';
import { getItem, setItem, removeItem } from './localDB';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: number; // hours between doses
  startDate: string;
  endDate?: string;
}

export interface Appointment {
  id: string;
  title: string;
  date: string;
  location?: string;
}

export interface Vaccination {
  id: string;
  name: string;
  dueDate: string;
  petId: string;
}

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  scheduledDate: string; // ISO date string
  category?: NotificationCategory;
  data?: Record<string, unknown>; // additional data
  categoryIdentifier?: string;
}

export interface NotificationPreferences {
  medicationReminders: boolean;
  appointmentReminders: boolean;
  vaccinationAlerts: boolean;
  marketingNotifications: boolean;
  reminderLeadTimeMinutes: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  badgeEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "HH:MM"
  quietHoursEnd: string; // "HH:MM"
  petOverrides: {
    petId: string;
    medicationReminders?: boolean;
    appointmentReminders?: boolean;
    vaccinationAlerts?: boolean;
  }[];
}

export type NotificationCategory = 'medication' | 'appointments' | 'health' | 'general';
export type NotificationGroup =
  | 'medication'
  | 'appointment'
  | 'vaccination'
  | 'alert'
  | 'health_alert'
  | 'community_reply'
  | 'scheduled'
  | 'sos';
export type NotificationAction =
  | 'open'
  | 'snooze'
  | 'mark_as_read'
  | 'mark_as_taken'
  | 'skip_dose'
  | 'snooze_30min';

// ─── Deep Link Navigation Types ───────────────────────────────────────────────
export interface DeepLinkParams {
  route: string;
  params?: Record<string, any>;
}

export interface NotificationDeepLink {
  petId?: string;
  medicationId?: string;
  appointmentId?: string;
  vaccinationId?: string;
  sosId?: string;
  [key: string]: any;
}

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'medication',
  'appointments',
  'health',
  'general',
];

const CATEGORY_BY_GROUP: Record<NotificationGroup, NotificationCategory> = {
  medication: 'medication',
  appointment: 'appointments',
  vaccination: 'health',
  alert: 'health',
  health_alert: 'health',
  community_reply: 'general',
  scheduled: 'general',
  sos: 'health',
};

const resolveNotificationCategory = (
  group: NotificationGroup,
  category?: NotificationCategory,
): NotificationCategory => category ?? CATEGORY_BY_GROUP[group];

const isNotificationCategory = (value: unknown): value is NotificationCategory =>
  typeof value === 'string' && NOTIFICATION_CATEGORIES.includes(value as NotificationCategory);

const getRequestCategory = (
  notification: Notifications.NotificationRequest,
): NotificationCategory => {
  const category = notification.content.data?.category;
  if (isNotificationCategory(category)) return category;

  const group = notification.content.data?.type;
  if (typeof group === 'string' && group in CATEGORY_BY_GROUP) {
    return CATEGORY_BY_GROUP[group as NotificationGroup];
  }

  return 'general';
};

const PREFS_KEY = '@notification_preferences';
const NOTIFICATION_MAP_KEY = '@notification_map'; // maps entity id -> notification ids
const READ_NOTIFICATIONS_KEY = '@read_notifications';
const SNOOZED_NOTIFICATIONS_KEY = '@snoozed_notifications';
const SNOOZE_DELAY_MS = 10 * 60 * 1000;

const ACTION_OPEN = 'OPEN_APP';
const ACTION_SNOOZE = 'SNOOZE';
const ACTION_MARK_AS_READ = 'MARK_AS_READ';
const ACTION_MARK_AS_TAKEN = 'MARK_AS_TAKEN';
const ACTION_SNOOZE_30MIN = 'SNOOZE_30MIN';
const ACTION_SKIP_DOSE = 'SKIP_DOSE';

const DEFAULT_PREFS: NotificationPreferences = {
  medicationReminders: true,
  appointmentReminders: true,
  vaccinationAlerts: true,
  marketingNotifications: false,
  reminderLeadTimeMinutes: 60,
  soundEnabled: true,
  vibrationEnabled: true,
  badgeEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  petOverrides: [],
};

// ─── Notification actions ────────────────────────────────────────────────────

const readActionState = async (key: string): Promise<Record<string, number>> => {
  const stored = await getItem(key);
  return stored ? JSON.parse(stored) : {};
};

const saveActionState = async (
  key: string,
  notificationId: string,
  timestamp: number,
): Promise<void> => {
  const state = await readActionState(key);
  state[notificationId] = timestamp;
  await setItem(key, JSON.stringify(state));
};

const getNotificationUrl = (data: Record<string, unknown> = {}): string => {
  const deepLink = data.deepLink ?? data.url;
  if (typeof deepLink === 'string' && deepLink.length > 0) return deepLink;

  if (data.type === 'medication' && typeof data.medicationId === 'string') {
    return `cocohub://care/medications?medicationId=${encodeURIComponent(data.medicationId)}`;
  }
  if (data.type === 'appointment' && typeof data.appointmentId === 'string') {
    return `cocohub://schedule?appointmentId=${encodeURIComponent(data.appointmentId)}`;
  }
  if (data.type === 'vaccination' && typeof data.vaccinationId === 'string') {
    return `cocohub://care/vaccinations?vaccinationId=${encodeURIComponent(data.vaccinationId)}`;
  }
  if (data.type === 'sos' && typeof data.sosId === 'string') {
    return `cocohub://more/emergency?sosId=${encodeURIComponent(data.sosId)}`;
  }
  if ((data.type === 'alert' || data.type === 'health_alert') && typeof data.petId === 'string') {
    const alertId =
      typeof data.alertId === 'string'
        ? data.alertId
        : typeof data.healthAlertId === 'string'
          ? data.healthAlertId
          : undefined;
    const suffix = alertId ? `?alertId=${encodeURIComponent(alertId)}` : '';
    return `cocohub://pets/${encodeURIComponent(data.petId)}/dashboard${suffix}`;
  }
  if (data.type === 'alert' || data.type === 'health_alert') {
    const alertId =
      typeof data.alertId === 'string'
        ? data.alertId
        : typeof data.healthAlertId === 'string'
          ? data.healthAlertId
          : undefined;
    const suffix = alertId ? `?alertId=${encodeURIComponent(alertId)}` : '';
    return `cocohub://care/alerts${suffix}`;
  }
  if (data.type === 'community_reply') {
    const params = new URLSearchParams();
    if (typeof data.postId === 'string') params.set('postId', data.postId);
    if (typeof data.replyId === 'string') params.set('replyId', data.replyId);
    if (typeof data.commentId === 'string') params.set('commentId', data.commentId);
    const query = params.toString();
    return query ? `cocohub://more/community?${query}` : 'cocohub://more/community';
  }
  if (typeof data.petId === 'string') return `cocohub://pets/${encodeURIComponent(data.petId)}`;
  if (data.type === 'medication') return 'cocohub://care/medications';
  if (data.type === 'appointment') return 'cocohub://schedule';
  if (data.type === 'vaccination') return 'cocohub://care/vaccinations';
  if (data.type === 'sos') return 'cocohub://more/emergency';
  if (data.type === 'community_reply') return 'cocohub://more/community';

  return 'cocohub://';
};

export const registerNotificationActions = async (): Promise<void> => {
  const defaultActions = [
    {
      identifier: ACTION_OPEN,
      buttonTitle: 'Open',
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: 'Snooze',
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_MARK_AS_READ,
      buttonTitle: 'Mark read',
      options: { opensAppToForeground: false },
    },
  ];

  const medicationActions = [
    {
      identifier: ACTION_MARK_AS_TAKEN,
      buttonTitle: 'Mark as Taken',
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_SNOOZE_30MIN,
      buttonTitle: 'Snooze 30 min',
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_SKIP_DOSE,
      buttonTitle: 'Skip Dose',
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_OPEN,
      buttonTitle: 'Open',
      options: { opensAppToForeground: true },
    },
  ];

  await Promise.all([
    Notifications.setNotificationCategoryAsync('medication', medicationActions),
    ...['appointment', 'vaccination', 'alert', 'scheduled'].map((category) =>
      Notifications.setNotificationCategoryAsync(category, defaultActions),
    ),
  ]);
};

export const markAsRead = async (notificationId: string): Promise<void> => {
  if (!notificationId) return;
  await saveActionState(READ_NOTIFICATIONS_KEY, notificationId, Date.now());
  await (
    Notifications as unknown as { dismissNotificationAsync?: (id: string) => Promise<void> }
  ).dismissNotificationAsync?.(notificationId);
};

export const snooze = async (
  notification: Notifications.Notification,
  delayMs = SNOOZE_DELAY_MS,
): Promise<string> => {
  const snoozedUntil = Date.now() + delayMs;
  const { content } = notification.request;
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title ?? '',
      body: content.body ?? '',
      sound: content.sound ?? undefined,
      data: {
        ...(content.data ?? {}),
        snoozedUntil,
        originalNotificationId: notification.request.identifier,
      },
      categoryIdentifier: content.categoryIdentifier,
    },
    trigger: {
      type: 'date',
      date: new Date(snoozedUntil),
    } as Notifications.DateTriggerInput,
  });

  await saveActionState(SNOOZED_NOTIFICATIONS_KEY, notification.request.identifier, snoozedUntil);
  return notificationId;
};

export const openApp = async (notification: Notifications.Notification): Promise<void> => {
  await markAsRead(notification.request.identifier);
  await Linking.openURL(getNotificationUrl(notification.request.content.data));
};

// ─── Deep Link Builders ───────────────────────────────────────────────────────

/**
 * Extract deep link parameters from notification data
 */
export const extractDeepLinkParams = (
  data: Record<string, unknown>,
): { route: string; params: Record<string, any> } | null => {
  const type = typeof data.type === 'string' ? data.type : undefined;

  const copyPresentParams = (keys: string[]): Record<string, any> =>
    keys.reduce(
      (params, key) => {
        const value = data[key];
        if (value) params[key] = value;
        return params;
      },
      {} as Record<string, any>,
    );

  if (type === 'medication' && data.medicationId) {
    return {
      route: 'Medications',
      params: { medicationId: data.medicationId },
    };
  }

  if (type === 'appointment' && data.appointmentId) {
    return {
      route: 'Appointments',
      params: { appointmentId: data.appointmentId },
    };
  }

  if (type === 'vaccination' && (data.vaccinationId || data.petId || data.dueDate)) {
    const params = copyPresentParams(['vaccinationId', 'petId', 'dueDate']);
    return {
      route: 'Vaccinations',
      params,
    };
  }

  if (type === 'sos' && data.sosId) {
    return {
      route: 'Emergency',
      params: { sosId: data.sosId },
    };
  }

  if (type === 'alert' || type === 'health_alert') {
    const params = copyPresentParams(['alertId', 'healthAlertId', 'petId']);
    return {
      route: data.petId ? 'PetHealthDashboard' : 'Alerts',
      params,
    };
  }

  if (type === 'community_reply') {
    return {
      route: 'Community',
      params: copyPresentParams(['postId', 'replyId', 'commentId']),
    };
  }

  // Fallback to petId if available
  if (data.petId) {
    return {
      route: 'PetDetail',
      params: { petId: data.petId },
    };
  }

  // Type-based fallback without specific ID
  if (type === 'medication') {
    return { route: 'Medications', params: {} };
  }
  if (type === 'appointment') {
    return { route: 'Appointments', params: {} };
  }
  if (type === 'vaccination') {
    return { route: 'Vaccinations', params: {} };
  }
  if (type === 'sos') {
    return { route: 'Emergency', params: {} };
  }
  if (type === 'alert' || type === 'health_alert') {
    return { route: 'Alerts', params: {} };
  }
  if (type === 'community_reply') {
    return { route: 'Community', params: {} };
  }

  return null;
};

let medicationServiceModule: typeof import('./medicationService') | null = null;

async function getMedicationService() {
  if (!medicationServiceModule) {
    medicationServiceModule = await import('./medicationService');
  }
  return medicationServiceModule;
}

async function findMedicationId(notification: Notifications.Notification): Promise<string | null> {
  const data = notification.request.content.data ?? {};
  const medicationId = data.medicationId as string | undefined;
  return medicationId ?? null;
}

async function handleMarkAsTaken(notification: Notifications.Notification): Promise<void> {
  const medicationId = await findMedicationId(notification);
  if (!medicationId) return;
  try {
    const medService = await getMedicationService();
    await medService.logDose({
      id: `action-${Date.now()}`,
      medicationId,
      takenAt: new Date().toISOString(),
    });
    await markAsRead(notification.request.identifier);
  } catch {
    // Non-fatal — dose can be recorded manually
  }
}

async function handleSnooze30Min(notification: Notifications.Notification): Promise<void> {
  await snooze(notification, 30 * 60 * 1000);
}

async function handleSkipDose(notification: Notifications.Notification): Promise<void> {
  const medicationId = await findMedicationId(notification);
  if (!medicationId) return;
  try {
    const medService = await getMedicationService();
    await medService.logDose({
      id: `skip-${Date.now()}`,
      medicationId,
      takenAt: new Date().toISOString(),
      skipped: true,
    });
    await cancelEntityNotification(medicationId);
    await markAsRead(notification.request.identifier);
  } catch {
    // Non-fatal
  }
}

export const handleNotificationAction = async (
  response: Notifications.NotificationResponse,
): Promise<void> => {
  const { actionIdentifier, notification } = response;

  if (actionIdentifier === ACTION_MARK_AS_TAKEN) {
    await handleMarkAsTaken(notification);
    return;
  }

  if (actionIdentifier === ACTION_SNOOZE_30MIN) {
    await handleSnooze30Min(notification);
    return;
  }

  if (actionIdentifier === ACTION_SKIP_DOSE) {
    await handleSkipDose(notification);
    return;
  }

  if (actionIdentifier === ACTION_SNOOZE) {
    await snooze(notification);
    return;
  }

  if (actionIdentifier === ACTION_MARK_AS_READ) {
    await markAsRead(notification.request.identifier);
    return;
  }

  await openApp(notification);
};

export const watchNotificationActions = (): ReturnType<
  typeof Notifications.addNotificationResponseReceivedListener
> =>
  Notifications.addNotificationResponseReceivedListener((response) => {
    void handleNotificationAction(response);
  });

// ─── Notification handler ─────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const prefs = await getPreferences();
    const suppressed =
      prefs.quietHoursEnabled && isQuietHour(prefs.quietHoursStart, prefs.quietHoursEnd);
    return {
      shouldShowAlert: !suppressed,
      shouldPlaySound: !suppressed && prefs.soundEnabled,
      shouldSetBadge: prefs.badgeEnabled,
      shouldShowBanner: !suppressed,
      shouldShowList: true,
    };
  },
});

// Returns true if the current time falls within quiet hours
export const isQuietHour = (start: string, end: string): boolean => {
  const now = new Date();
  const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const current = now.getHours() * 60 + now.getMinutes();
  const s = toMinutes(start);
  const e = toMinutes(end);
  return s < e ? current >= s && current < e : current >= s || current < e;
};

// ─── Permissions ──────────────────────────────────────────────────────────────

export const requestPermissions = async (): Promise<boolean> => {
  const existing = await Notifications.getPermissionsAsync();
  if ((existing as any).granted ?? (existing as any).status === 'granted') return true;
  const result = await Notifications.requestPermissionsAsync();
  return (result as any).granted ?? (result as any).status === 'granted';
};

export const checkPermissions = async (): Promise<boolean> => {
  const result = await Notifications.getPermissionsAsync();
  return (result as any).granted ?? (result as any).status === 'granted';
};

// ─── Preferences ─────────────────────────────────────────────────────────────

export const getPreferences = async (): Promise<NotificationPreferences> => {
  const stored = await getItem(PREFS_KEY);
  return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
};

export const savePreferences = async (prefs: Partial<NotificationPreferences>): Promise<void> => {
  const current = await getPreferences();
  await setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
};

// ─── Notification ID map helpers ─────────────────────────────────────────────

const getNotificationMap = async (): Promise<Record<string, string[]>> => {
  const stored = await getItem(NOTIFICATION_MAP_KEY);
  return stored ? JSON.parse(stored) : {};
};

const saveNotificationIds = async (entityId: string, notificationIds: string[]): Promise<void> => {
  const map = await getNotificationMap();
  map[entityId] = notificationIds;
  await setItem(NOTIFICATION_MAP_KEY, JSON.stringify(map));
};

const removeNotificationId = async (entityId: string): Promise<void> => {
  const map = await getNotificationMap();
  delete map[entityId];
  await setItem(NOTIFICATION_MAP_KEY, JSON.stringify(map));
};

// ─── Medication reminders ─────────────────────────────────────────────────────

export const scheduleMedicationReminder = async (medication: Medication): Promise<string[]> => {
  const prefs = await getPreferences();
  if (!prefs.medicationReminders) return [];

  await cancelEntityNotification(medication.id);

  const startDate = new Date(medication.startDate);
  if (Number.isNaN(startDate.getTime())) return [];

  const now = new Date();
  const windowStart = startDate > now ? startDate : now;
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + 7);

  const intervalMs = medication.frequency * 60 * 60 * 1000;
  if (intervalMs <= 0) return [];

  const endDate = medication.endDate ? new Date(medication.endDate) : null;
  if (endDate && Number.isNaN(endDate.getTime())) return [];
  if (endDate && endDate < windowStart) return [];

  const lastDate = endDate && endDate < windowEnd ? endDate : windowEnd;
  const notificationIds: string[] = [];

  let currentDose = new Date(startDate);
  if (currentDose < windowStart) {
    const diff = windowStart.getTime() - currentDose.getTime();
    const steps = Math.ceil(diff / intervalMs);
    currentDose = new Date(currentDose.getTime() + steps * intervalMs);
  }

  while (currentDose <= lastDate) {
    if (currentDose > new Date()) {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💊 Medication Reminder',
          body: `Time to give ${medication.name} (${medication.dosage})`,
          sound: prefs.soundEnabled ? 'default' : undefined,
          data: {
            type: 'medication' as NotificationGroup,
            category: resolveNotificationCategory('medication'),
            medicationId: medication.id,
          },
          categoryIdentifier: resolveNotificationCategory('medication'),
        },
        trigger: {
          type: 'date',
          date: currentDose,
        } as Notifications.DateTriggerInput,
      });
      notificationIds.push(notificationId);
    }
    currentDose = new Date(currentDose.getTime() + intervalMs);
  }

  await saveNotificationIds(medication.id, notificationIds);
  return notificationIds;
};

// ─── Appointment reminders ────────────────────────────────────────────────────

export const scheduleAppointmentNotification = async (
  appointment: Appointment,
): Promise<string> => {
  const prefs = await getPreferences();
  if (!prefs.appointmentReminders) return '';

  await cancelEntityNotification(appointment.id);

  const appointmentDate = new Date(appointment.date);
  const triggerDate = new Date(
    appointmentDate.getTime() - prefs.reminderLeadTimeMinutes * 60 * 1000,
  );

  if (triggerDate <= new Date()) return ''; // already past

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📅 Appointment Reminder',
      body: `${appointment.title}${appointment.location ? ` at ${appointment.location}` : ''} in ${prefs.reminderLeadTimeMinutes} min`,
      sound: prefs.soundEnabled ? 'default' : undefined,
      data: {
        type: 'appointment' as NotificationGroup,
        category: resolveNotificationCategory('appointment'),
        appointmentId: appointment.id,
      },
      categoryIdentifier: resolveNotificationCategory('appointment'),
    },
    trigger: {
      type: 'date',
      date: triggerDate,
    } as Notifications.DateTriggerInput,
  });

  await saveNotificationIds(appointment.id, [notificationId]);
  return notificationId;
};

// ─── Vaccination reminders ────────────────────────────────────────────────────

export const scheduleVaccinationReminder = async (vaccination: Vaccination): Promise<string> => {
  const prefs = await getPreferences();
  if (!prefs.vaccinationAlerts) return '';

  await cancelEntityNotification(vaccination.id);

  const dueDate = new Date(vaccination.dueDate);
  if (Number.isNaN(dueDate.getTime()) || dueDate <= new Date()) return '';

  const notificationIds: string[] = [];
  for (const leadDays of [30, 7, 1]) {
    const triggerDate = new Date(dueDate);
    triggerDate.setDate(dueDate.getDate() - leadDays);
    if (triggerDate <= new Date()) continue;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Vaccination Reminder',
        body: `${vaccination.name} is due in ${leadDays} day${leadDays === 1 ? '' : 's'}`,
        sound: prefs.soundEnabled ? 'default' : undefined,
        data: {
          type: 'vaccination' as NotificationGroup,
          category: resolveNotificationCategory('vaccination'),
          vaccinationId: vaccination.id,
          petId: vaccination.petId,
          dueDate: vaccination.dueDate,
          leadDays,
        },
        categoryIdentifier: resolveNotificationCategory('vaccination'),
      },
      trigger: {
        type: 'date',
        date: triggerDate,
      } as Notifications.DateTriggerInput,
    });
    notificationIds.push(notificationId);
  }

  await saveNotificationIds(vaccination.id, notificationIds);
  return notificationIds[0] ?? '';
};

// ─── Alert helpers ───────────────────────────────────────────────────────────

export const sendAlertNotification = async (
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<string> => {
  const prefs = await getPreferences();
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: prefs.soundEnabled ? 'default' : undefined,
      data: {
        type: 'alert' as NotificationGroup,
        ...data,
        category: resolveNotificationCategory('alert'),
      },
      categoryIdentifier: resolveNotificationCategory('alert'),
    },
    trigger: null, // fire immediately
  });
  return notificationId;
};

// ─── Cancel helpers ───────────────────────────────────────────────────────────

export const cancelEntityNotification = async (entityId: string): Promise<void> => {
  const map = await getNotificationMap();
  const notificationIds = map[entityId] ?? [];
  await Promise.all(
    notificationIds.map((notificationId) =>
      Notifications.cancelScheduledNotificationAsync(notificationId),
    ),
  );
  await removeNotificationId(entityId);
};

export const cancelNotification = async (notificationId: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
};

export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await removeItem(NOTIFICATION_MAP_KEY);
};

// ─── Grouping helpers ─────────────────────────────────────────────────────────

export const cancelGroupNotifications = async (
  group: NotificationGroup,
): Promise<Notifications.NotificationRequest[]> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter(
    (n: Notifications.NotificationRequest) => n.content.data?.type === group,
  );
  await Promise.all(
    toCancel.map((n: Notifications.NotificationRequest) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier),
    ),
  );
  return toCancel;
};

export const getScheduledByGroup = async (
  group: NotificationGroup,
): Promise<Notifications.NotificationRequest[]> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter((n: Notifications.NotificationRequest) => n.content.data?.type === group);
};

export const getAllScheduled = async (): Promise<Notifications.NotificationRequest[]> => {
  return Notifications.getAllScheduledNotificationsAsync();
};

export const filterNotificationsByCategory = (
  notifications: Notifications.NotificationRequest[],
  category?: NotificationCategory | 'all',
): Notifications.NotificationRequest[] => {
  if (!category || category === 'all') return notifications;
  return notifications.filter((notification) => getRequestCategory(notification) === category);
};

export const groupNotificationsByCategory = (
  notifications: Notifications.NotificationRequest[],
): Record<NotificationCategory, Notifications.NotificationRequest[]> => {
  return notifications.reduce(
    (groups, notification) => {
      groups[getRequestCategory(notification)].push(notification);
      return groups;
    },
    {
      medication: [],
      appointments: [],
      health: [],
      general: [],
    } as Record<NotificationCategory, Notifications.NotificationRequest[]>,
  );
};

export const getScheduledByCategory = async (
  category: NotificationCategory | 'all',
): Promise<Notifications.NotificationRequest[]> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return filterNotificationsByCategory(scheduled, category);
};

// ─── Generic Scheduled Notifications ──────────────────────────────────────────

export const scheduleFutureNotification = async (
  notification: ScheduledNotification,
): Promise<string> => {
  const prefs = await getPreferences();
  const scheduledDate = new Date(notification.scheduledDate);

  if (scheduledDate <= new Date()) {
    throw new Error('Scheduled date must be in the future');
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: notification.title,
      body: notification.body,
      sound: prefs.soundEnabled ? 'default' : undefined,
      data: {
        type: 'scheduled' as NotificationGroup,
        notificationId: notification.id,
        ...notification.data,
        category: resolveNotificationCategory('scheduled', notification.category),
      },
      categoryIdentifier:
        notification.categoryIdentifier ||
        resolveNotificationCategory('scheduled', notification.category),
    },
    trigger: {
      type: 'date',
      date: scheduledDate,
    } as Notifications.DateTriggerInput,
  });

  // Store the mapping
  const map = await getNotificationMap();
  map[notification.id] = [notificationId];
  await setItem(NOTIFICATION_MAP_KEY, JSON.stringify(map));

  return notificationId;
};

export const updateScheduledNotification = async (
  notification: ScheduledNotification,
): Promise<string> => {
  // Cancel existing notification
  await cancelEntityNotification(notification.id);

  // Schedule new one
  return scheduleFutureNotification(notification);
};

export const cancelScheduledNotification = async (notificationId: string): Promise<void> => {
  await cancelEntityNotification(notificationId);
};

// ─── Vaccination notification transfer ───────────────────────────────────────

/**
 * Called when a pet changes owner. Cancels all scheduled vaccination
 * notifications for the pet on the current device, then asks the backend to
 * trigger a push to the new owner so they can re-schedule the reminders.
 *
 * @param petId - ID of the transferred pet
 * @param newOwnerUserId - User ID of the new owner
 */
export const cancelAndTransferVaccinationNotifications = async (
  petId: string,
  newOwnerUserId: string,
): Promise<void> => {
  // 1. Cancel every scheduled vaccination notification that belongs to this pet
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const petVaccinationNotifs = scheduled.filter(
    (n: Notifications.NotificationRequest) =>
      n.content.data?.type === 'vaccination' && n.content.data?.petId === petId,
  );
  await Promise.all(
    petVaccinationNotifs.map((n: Notifications.NotificationRequest) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier),
    ),
  );

  // 2. Clean up the notification map for any reminder ids associated with this pet
  const map = await getNotificationMap();
  const petReminderKeys = Object.keys(map).filter((key) => key.startsWith(`${petId}-`));
  for (const key of petReminderKeys) {
    delete map[key];
  }
  await setItem(NOTIFICATION_MAP_KEY, JSON.stringify(map));

  // 3. Notify the backend so it can push a re-schedule request to the new owner's device
  await apiClient.post('/api/notifications/vaccination-transfer', { petId, newOwnerUserId });
};

// ─── Ownership transfer: re-schedule vaccination reminders ───────────────────

/**
 * Called when a pet is transferred TO the current device/user.
 * Cancels any existing vaccination notifications for each reminder (the previous
 * owner's device keeps its own scheduled notifications — they will naturally
 * become stale since the pet no longer belongs to them) and schedules fresh
 * ones on this device.
 *
 * @param reminders - The vaccination reminders for the transferred pet,
 *                    fetched fresh from the server after the transfer completes.
 */
export const transferVaccinationNotifications = async (
  reminders: Array<{ id: string; name: string; dueDate: string; petId: string }>,
): Promise<void> => {
  await Promise.all(
    reminders.map(async (reminder) => {
      // Cancel any stale local notification for this reminder id, then re-schedule
      await cancelEntityNotification(reminder.id);
      await scheduleVaccinationReminder(reminder);
    }),
  );
};

// ─── Push token registration ──────────────────────────────────────────────────

export type PushTopic =
  | 'medication_reminders'
  | 'appointment_alerts'
  | 'sos_notifications'
  | 'health_tips';

export const ALL_PUSH_TOPICS: PushTopic[] = [
  'medication_reminders',
  'appointment_alerts',
  'sos_notifications',
  'health_tips',
];

/** Register the device's Expo push token with the backend. */
export async function registerDeviceToken(): Promise<void> {
  const granted = await requestPermissions();
  if (!granted) return;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;
  await apiClient.post('/api/notifications/tokens', { token });
}

/** Remove a specific token (e.g. on logout). */
export async function unregisterDeviceToken(token?: string): Promise<void> {
  if (token) {
    await apiClient.delete('/api/notifications/tokens', { data: { token } });
  } else {
    await apiClient.delete('/api/notifications/tokens/all');
  }
}

/** Subscribe to a push topic. */
export async function subscribeTopic(topic: PushTopic): Promise<void> {
  await apiClient.put(`/api/notifications/subscriptions/${topic}`);
}

/** Unsubscribe from a push topic. */
export async function unsubscribeTopic(topic: PushTopic): Promise<void> {
  await apiClient.delete(`/api/notifications/subscriptions/${topic}`);
}

/** Get current topic subscriptions from backend. */
export async function getTopicSubscriptions(): Promise<PushTopic[]> {
  const res = await apiClient.get<{ success: boolean; data: { subscriptions: PushTopic[] } }>(
    '/api/notifications/subscriptions',
  );
  return res.data.data.subscriptions;
}

/** Get push preferences from backend. */
export async function getServerPreferences(): Promise<{
  enabled: boolean;
  topics: Record<PushTopic, boolean>;
}> {
  const res = await apiClient.get<{
    success: boolean;
    data: { enabled: boolean; topics: Record<PushTopic, boolean> };
  }>('/api/notifications/preferences');
  return res.data.data;
}

/** Update push preferences on backend. */
export async function updateServerPreferences(
  prefs: Partial<{ enabled: boolean; topics: Partial<Record<PushTopic, boolean>> }>,
): Promise<void> {
  await apiClient.patch('/api/notifications/preferences', prefs);
}
