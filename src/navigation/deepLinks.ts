import { type LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';

function extractUTM(url: string): Record<string, string> {
  const params = new URL(url).searchParams;
  const utm: Record<string, string> = {};

  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
    const value = params.get(key);
    if (value) utm[key] = value;
  }

  return utm;
}

export function trackDeepLinkAttribution(url: string) {
  const utm = extractUTM(url);
  if (Object.keys(utm).length > 0) {
    console.log('[attribution]', utm);
  }
}

export const linking: LinkingOptions<any> = {
  prefixes: [Linking.createURL('/'), 'https://cocohub.app', 'cocohub://', 'cocohubapp://'],
  config: {
    screens: {
      Main: {
        screens: {
          PetList: {
            screens: {
              PetDetail: 'pets/:petId',
              PetHealthDashboard: 'pets/:petId/dashboard',
              PetHealthMetrics: 'pets/:petId/health',
            },
          },
          Care: 'care/:initialTab?',
          Schedule: 'schedule',
          More: {
            path: 'more',
            screens: {
              Community: 'community',
              Emergency: 'emergency',
              Notifications: 'notifications',
              Profile: 'profile',
            },
          },
        },
      },
      Appointment: 'appointments/:appointmentId',
      SOSDetail: 'sos/:sosId',
      Community: 'community',
      HealthAlert: 'care/alerts',
      WebFallback: '*',
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url) trackDeepLinkAttribution(url);
    return url;
  },
  subscribe(listener) {
    const sub = Linking.addEventListener('url', ({ url }) => {
      trackDeepLinkAttribution(url);
      listener(url);
    });

    return () => sub.remove();
  },
};
