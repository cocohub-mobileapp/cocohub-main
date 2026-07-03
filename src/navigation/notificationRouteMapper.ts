import type { DeepLinkParams } from '../services/notificationService';

export interface NotificationNavigationTarget {
  screen: string;
  params?: Record<string, unknown>;
}

const hasParams = (params?: Record<string, unknown>): params is Record<string, unknown> =>
  !!params && Object.keys(params).length > 0;

const careTarget = (
  initialTab: 'Medications' | 'Vaccinations' | 'Alerts',
  params?: Record<string, unknown>,
): NotificationNavigationTarget => ({
  screen: 'Care',
  params: { ...(params ?? {}), initialTab },
});

const nestedTarget = (
  screen: string,
  nestedScreen: string,
  params?: Record<string, unknown>,
): NotificationNavigationTarget => ({
  screen,
  params: {
    screen: nestedScreen,
    ...(hasParams(params) ? { params } : {}),
  },
});

export const resolveNotificationNavigationTarget = (
  deepLink: DeepLinkParams | null,
): NotificationNavigationTarget | null => {
  if (!deepLink) return null;

  switch (deepLink.route) {
    case 'Medications':
      return careTarget('Medications', deepLink.params);
    case 'Vaccinations':
      return careTarget('Vaccinations', deepLink.params);
    case 'HealthAlerts':
      return careTarget('Alerts', deepLink.params);
    case 'Appointments':
      return { screen: 'Schedule', params: deepLink.params };
    case 'Emergency':
      return nestedTarget('More', 'Emergency', deepLink.params);
    case 'Community':
      return nestedTarget('More', 'Community', deepLink.params);
    case 'Profile':
      return nestedTarget('More', 'Profile', deepLink.params);
    case 'PetDetail':
      return nestedTarget('PetList', 'PetDetail', deepLink.params);
    case 'PetHealthDashboard':
      return nestedTarget('PetList', 'PetHealthDashboard', deepLink.params);
    default:
      return { screen: deepLink.route, params: deepLink.params };
  }
};
