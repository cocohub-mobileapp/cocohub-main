/**
 * Validated deep-link navigation helper for notifications.
 * Pure TypeScript — no JSX — so it can be imported in tests without JSX transform.
 */
import type { AppNotification } from '../services/notificationStore';

/** Screens that are valid navigation targets from a notification. */
export const VALID_NAV_SCREENS = new Set([
  'Care',
  'Schedule',
  'More',
  'PetList',
  'Search',
  'Medications',
  'Appointments',
  'Vaccinations',
  'Emergency',
  'PetDetail',
  'PetHealthDashboard',
  'Community',
  'Profile',
]);

function normalizeNavPayload(payload: { screen: string; params?: Record<string, unknown> }): {
  screen: string;
  params?: Record<string, unknown>;
} {
  switch (payload.screen) {
    case 'Medications':
      return {
        screen: 'Care',
        params: { initialTab: 'Medications', ...payload.params },
      };
    case 'Appointments':
      return {
        screen: 'Schedule',
        params: payload.params,
      };
    case 'Vaccinations':
      return {
        screen: 'Care',
        params: { initialTab: 'Vaccinations', ...payload.params },
      };
    case 'Emergency':
    case 'Community':
    case 'Profile':
      return {
        screen: 'More',
        params: {
          screen: payload.screen,
          params: payload.params ?? {},
        },
      };
    case 'PetDetail':
    case 'PetHealthDashboard':
      return {
        screen: 'PetList',
        params: {
          screen: payload.screen,
          params: payload.params ?? {},
        },
      };
    default:
      return payload;
  }
}

export function resolveNavPayload(
  notification: AppNotification,
): { screen: string; params?: Record<string, unknown> } | null {
  const payload = notification.navPayload;
  if (!payload || typeof payload.screen !== 'string' || !payload.screen) return null;
  if (!VALID_NAV_SCREENS.has(payload.screen)) return null;
  return normalizeNavPayload({ screen: payload.screen, params: payload.params });
}
