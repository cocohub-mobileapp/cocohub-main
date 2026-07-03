import { resolveNotificationNavigationTarget } from '../notificationRouteMapper';

describe('resolveNotificationNavigationTarget', () => {
  it('maps medication notifications to the Care medications tab', () => {
    expect(
      resolveNotificationNavigationTarget({
        route: 'Medications',
        params: { medicationId: 'med-123' },
      }),
    ).toEqual({
      screen: 'Care',
      params: { medicationId: 'med-123', initialTab: 'Medications' },
    });
  });

  it('maps vaccination notifications to the Care vaccinations tab', () => {
    expect(
      resolveNotificationNavigationTarget({
        route: 'Vaccinations',
        params: { vaccinationId: 'vac-123', petId: 'pet-123' },
      }),
    ).toEqual({
      screen: 'Care',
      params: {
        vaccinationId: 'vac-123',
        petId: 'pet-123',
        initialTab: 'Vaccinations',
      },
    });
  });

  it('maps health alert notifications to the Care alerts tab', () => {
    expect(
      resolveNotificationNavigationTarget({
        route: 'HealthAlerts',
        params: { alertId: 'alert-123' },
      }),
    ).toEqual({
      screen: 'Care',
      params: { alertId: 'alert-123', initialTab: 'Alerts' },
    });
  });

  it('maps appointments to the Schedule tab', () => {
    expect(
      resolveNotificationNavigationTarget({
        route: 'Appointments',
        params: { appointmentId: 'apt-123' },
      }),
    ).toEqual({
      screen: 'Schedule',
      params: { appointmentId: 'apt-123' },
    });
  });

  it('maps community replies to the nested Community screen', () => {
    expect(
      resolveNotificationNavigationTarget({
        route: 'Community',
        params: { postId: 'post-123', commentId: 'comment-456' },
      }),
    ).toEqual({
      screen: 'More',
      params: {
        screen: 'Community',
        params: { postId: 'post-123', commentId: 'comment-456' },
      },
    });
  });

  it('maps pet health alerts with pet context to the pet health dashboard', () => {
    expect(
      resolveNotificationNavigationTarget({
        route: 'PetHealthDashboard',
        params: { petId: 'pet-123', alertId: 'alert-123' },
      }),
    ).toEqual({
      screen: 'PetList',
      params: {
        screen: 'PetHealthDashboard',
        params: { petId: 'pet-123', alertId: 'alert-123' },
      },
    });
  });
});
