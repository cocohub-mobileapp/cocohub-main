import { Notification } from 'react-native-push-notification';

export const sendNotification = (type: string, petId?: string, appointmentId?: string) => {
  let data: any = {};

  switch (type) {
    case'medication':
      data = { screen: 'MedicationScreen', petId };
      break;
    case 'appointment':
      data = { screen: 'AppointmentDetailScreen', appointmentId };
      break;
    case 'vaccination':
      data = { screen: 'VaccinationScreen' };
      break;
    case 'sos':
      data = { screen: 'EmergencyContactsScreen' };
      break;
    case 'birthday':
      data = { screen: 'PetDetailScreen', petId };
      break;
    default:
      return;
  }

  PushNotification.localNotification({
    message: `You have a ${type} notification`,
    data,
  });
};

export const handleNotification = (notification: Notification) => {
  if (notification.data && notification.data.screen) {
    // Handle deep linking here
    const { screen, petId, appointmentId } = notification.data;
    handleNotificationDeepLink(screen, petId, appointmentId);
  }
};