import type { DeepLinkParams } from '../services/notificationService';

export interface NotificationNavigationTarget {
  route: 'Main' | 'AppointmentDetail';
  screen?: 'PetList' | 'Care' | 'Schedule' | 'More';
  params?: Record<string, unknown>;
}

export function resolveNotificationNavigationTarget(
  deepLink: DeepLinkParams,
): NotificationNavigationTarget | null {
  switch (deepLink.route) {
    case 'Medications':
      return {
        route: 'Main',
        screen: 'Care',
        params: { initialTab: 'Medications', ...(deepLink.params ?? {}) },
      };
    case 'Vaccinations':
      return {
        route: 'Main',
        screen: 'Care',
        params: { initialTab: 'Vaccinations', ...(deepLink.params ?? {}) },
      };
    case 'Appointments': {
      if (deepLink.params?.appointmentId && deepLink.params?.petId) {
        return {
          route: 'AppointmentDetail',
          params: deepLink.params,
        };
      }

      return {
        route: 'Main',
        screen: 'Schedule',
        params: deepLink.params,
      };
    }
    case 'Emergency':
      return {
        route: 'Main',
        screen: 'More',
        params: { screen: 'Emergency', params: deepLink.params },
      };
    case 'PetDetail':
      return {
        route: 'Main',
        screen: 'PetList',
        params: { screen: 'PetDetail', params: deepLink.params },
      };
    default:
      return null;
  }
}
