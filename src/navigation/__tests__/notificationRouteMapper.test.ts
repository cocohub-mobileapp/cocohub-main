import { resolveNotificationNavigationTarget } from '../notificationRouteMapper';

describe('resolveNotificationNavigationTarget', () => {
  it('routes medication notifications into the Care medications tab', () => {
    expect(
      resolveNotificationNavigationTarget({
        route: 'Medications',
        params: { medicationId: 'med-1', petId: 'pet-1' },
      }),
    ).toEqual({
      route: 'Main',
      screen: 'Care',
      params: { initialTab: 'Medications', medicationId: 'med-1', petId: 'pet-1' },
    });
  });

  it('routes vaccination notifications into the Care vaccinations tab', () => {
    expect(
      resolveNotificationNavigationTarget({
        route: 'Vaccinations',
        params: { vaccinationId: 'vac-1', petId: 'pet-1' },
      }),
    ).toEqual({
      route: 'Main',
      screen: 'Care',
      params: { initialTab: 'Vaccinations', vaccinationId: 'vac-1', petId: 'pet-1' },
    });
  });

  it('routes appointment notifications with pet context to AppointmentDetail', () => {
    expect(
      resolveNotificationNavigationTarget({
        route: 'Appointments',
        params: { appointmentId: 'apt-1', petId: 'pet-1' },
      }),
    ).toEqual({
      route: 'AppointmentDetail',
      params: { appointmentId: 'apt-1', petId: 'pet-1' },
    });
  });

  it('routes appointment notifications without pet context to Schedule', () => {
    expect(
      resolveNotificationNavigationTarget({
        route: 'Appointments',
        params: { appointmentId: 'apt-1' },
      }),
    ).toEqual({
      route: 'Main',
      screen: 'Schedule',
      params: { appointmentId: 'apt-1' },
    });
  });

  it('routes SOS notifications into the nested Emergency screen', () => {
    expect(
      resolveNotificationNavigationTarget({
        route: 'Emergency',
        params: { sosId: 'sos-1' },
      }),
    ).toEqual({
      route: 'Main',
      screen: 'More',
      params: { screen: 'Emergency', params: { sosId: 'sos-1' } },
    });
  });

  it('routes pet birthday notifications to pet detail through the Pets tab', () => {
    expect(
      resolveNotificationNavigationTarget({
        route: 'PetDetail',
        params: { petId: 'pet-birthday' },
      }),
    ).toEqual({
      route: 'Main',
      screen: 'PetList',
      params: { screen: 'PetDetail', params: { petId: 'pet-birthday' } },
    });
  });
});
