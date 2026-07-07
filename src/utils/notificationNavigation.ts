/**
 * Validated deep-link navigation helper for notifications.
 * Pure TypeScript — no JSX — so it can be imported in tests without JSX transform.
 */
import type { AppNotification } from '../services/notificationStore';

/** Screens that are valid navigation targets from a notification. */
export const VALID_NAV_SCREENS = new Set([
  'Medications',
  'Appointments',
  'Vaccinations',
  'Alerts',
  'Emergency',
  'PetList',
  'PetDetail',
  'PetHealthDashboard',
  'Community',
  'Profile',
]);

export function resolveNavPayload(
  notification: AppNotification,
): { screen: string; params?: Record<string, unknown> } | null {
  const payload = notification.navPayload;
  if (!payload || typeof payload.screen !== 'string' || !payload.screen) return null;
  if (!VALID_NAV_SCREENS.has(payload.screen)) return null;
  return { screen: payload.screen, params: payload.params };
}
