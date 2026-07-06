import { extractDeepLinkParams } from '../notificationDeepLinking';

describe('Notification deep link routing', () => {
  it('routes medication reminders to the Care medications tab with medication context', () => {
    expect(
      extractDeepLinkParams({
        type: 'medication',
        medicationId: 'med-123',
        petId: 'pet-1',
      }),
    ).toEqual({
      route: 'Care',
      params: {
        initialTab: 'Medications',
        medicationId: 'med-123',
        petId: 'pet-1',
      },
    });
  });

  it('routes appointment reminders to the Schedule tab', () => {
    expect(
      extractDeepLinkParams({
        type: 'appointment',
        appointmentId: 'apt-456',
        petId: 'pet-1',
      }),
    ).toEqual({
      route: 'Schedule',
      params: {
        appointmentId: 'apt-456',
        petId: 'pet-1',
      },
    });
  });

  it('routes vaccination reminders to the Care vaccinations tab', () => {
    expect(
      extractDeepLinkParams({
        type: 'vaccination',
        vaccinationId: 'vac-789',
        petId: 'pet-1',
        dueDate: '2026-07-15',
      }),
    ).toEqual({
      route: 'Care',
      params: {
        initialTab: 'Vaccinations',
        vaccinationId: 'vac-789',
        petId: 'pet-1',
        dueDate: '2026-07-15',
      },
    });
  });

  it('routes SOS alerts to the More emergency screen', () => {
    expect(
      extractDeepLinkParams({
        type: 'sos',
        sosId: 'sos-911',
        petId: 'pet-1',
      }),
    ).toEqual({
      route: 'More',
      params: {
        screen: 'Emergency',
        params: {
          sosId: 'sos-911',
          petId: 'pet-1',
        },
      },
    });
  });

  it('routes health alerts to the Care alerts tab', () => {
    expect(
      extractDeepLinkParams({
        type: 'health_alert',
        healthAlertId: 'alert-321',
        petId: 'pet-1',
      }),
    ).toEqual({
      route: 'Care',
      params: {
        initialTab: 'Alerts',
        healthAlertId: 'alert-321',
        petId: 'pet-1',
      },
    });
  });

  it('routes community replies to the root Forum screen', () => {
    expect(
      extractDeepLinkParams({
        type: 'community_reply',
        postId: 'post-1',
        replyId: 'reply-2',
      }),
    ).toEqual({
      route: 'Forum',
      root: true,
      params: {
        postId: 'post-1',
        replyId: 'reply-2',
      },
    });
  });

  it('routes birthday notifications to the related pet detail screen', () => {
    expect(
      extractDeepLinkParams({
        type: 'birthday',
        petId: 'pet-birthday',
      }),
    ).toEqual({
      route: 'PetList',
      params: {
        screen: 'PetDetail',
        params: { petId: 'pet-birthday' },
      },
    });
  });

  it('falls back to pet detail when an unknown notification still has pet context', () => {
    expect(
      extractDeepLinkParams({
        type: 'unknown',
        petId: 'pet-fallback',
      }),
    ).toEqual({
      route: 'PetList',
      params: {
        screen: 'PetDetail',
        params: { petId: 'pet-fallback' },
      },
    });
  });

  it('returns null for unknown notifications without route context', () => {
    expect(extractDeepLinkParams({ type: 'unknown' })).toBeNull();
    expect(extractDeepLinkParams({})).toBeNull();
  });
});
