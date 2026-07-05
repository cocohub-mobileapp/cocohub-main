import { extractDeepLinkParams } from '../../services/notificationDeepLinking';

describe('Notification deep linking navigation targets', () => {
  it('builds a cold-start target for medication reminders', () => {
    const target = extractDeepLinkParams({
      type: 'medication',
      medicationId: 'penicillin-fluffy',
      category: 'medication',
    });

    expect(target).toEqual({
      route: 'Care',
      params: {
        initialTab: 'Medications',
        medicationId: 'penicillin-fluffy',
      },
    });
  });

  it('builds a cold-start target for appointment reminders', () => {
    const target = extractDeepLinkParams({
      type: 'appointment',
      appointmentId: 'vet-checkup-2026-07',
      category: 'appointments',
    });

    expect(target).toEqual({
      route: 'Schedule',
      params: {
        appointmentId: 'vet-checkup-2026-07',
      },
    });
  });

  it('builds a cold-start target for vaccination reminders', () => {
    const target = extractDeepLinkParams({
      type: 'vaccination_due',
      vaccinationId: 'rabies-booster',
      petId: 'fluffy',
      dueDate: '2026-07-15',
    });

    expect(target).toEqual({
      route: 'Care',
      params: {
        initialTab: 'Vaccinations',
        vaccinationId: 'rabies-booster',
        petId: 'fluffy',
        dueDate: '2026-07-15',
      },
    });
  });

  it('builds a cold-start target for emergency SOS alerts', () => {
    const target = extractDeepLinkParams({
      type: 'sos_alert',
      sosId: 'sos-2026-07-05',
    });

    expect(target).toEqual({
      route: 'More',
      params: {
        screen: 'Emergency',
        params: {
          sosId: 'sos-2026-07-05',
        },
      },
    });
  });

  it('builds a root navigation target for community replies', () => {
    const target = extractDeepLinkParams({
      type: 'community_reply',
      postId: 'post-22',
      commentId: 'comment-5',
    });

    expect(target).toEqual({
      route: 'Forum',
      root: true,
      params: {
        postId: 'post-22',
        commentId: 'comment-5',
      },
    });
  });
});
