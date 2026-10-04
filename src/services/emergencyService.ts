import * as Notifications from 'expo-notifications';
import * as Permissions from 'expo-permissions';
import { Alert, Platform } from 'react-native';

// Configurações iniciais do canal de notificação
const SOS_NOTIFICATION_CHANNEL = 'sos-notification-channel';
const SOS_NOTIFICATION_ID = 'sos-notification';

// Configura o canal de notificação para Android
const setupNotificationChannel = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(SOS_NOTIFICATION_CHANNEL, {
      name: 'SOS Emergency',
      description: 'Canal para notificações de emergência',
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidLockscreenVisibility.PUBLIC,
      enableVibrate: true,
      enableLights: true,
      color: '#FF0000',
      // Configurações para foreground service
      showBadge: true,
      sound: 'default',
    });
  }
};

// Solicita permissões de notificação
const requestUserPermission = async () => {
  const { status } = await Permissions.askAsync(Permissions.NOTIFICATIONS);
  if (status !== 'granted') {
    Alert.alert('Permissão negada', 'Não será possível exibir notificações na tela de bloqueio.');
    return false;
  }
  return true;
};

// Configura a notificação persistente do SOS
export const registerSOSNotification = async () => {
  try {
    const hasPermission = await requestUserPermission();
    if (!hasPermission) return;

    await setupNotificationChannel();

    // Configura a notificação com ação de botão SOS
    await Notifications.scheduleNotificationAsync({
      identifier: SOS_NOTIFICATION_ID,
      content: {
        title: 'Emergência SOS',
        body: 'Toque para acionar SOS',
        data: { type: 'sos' },
        android: {
          channelId: SOS_NOTIFICATION_CHANNEL,
          priority: Notifications.AndroidPriority.HIGH,
          // Configurações para aparecer na tela de bloqueio
          visibility: Notifications.AndroidVisibility.PUBLIC,
          // Configurações do foreground service
          foregroundService: {
            channelId: SOS_NOTIFICATION_CHANNEL,
            id: 1,
            title: 'SOS Ativo',
            text: 'Notificação de emergência ativa',
          },
          actions: [
            {
              title: 'SOS',
              icon: 'ic_sos',
              input: false,
            },
          ],
        },
      },
      trigger: null, // Notificação imediata e persistente
    });
  } catch (error) {
    console.error('Erro ao registrar notificação SOS:', error);
  }
};

// Cancela a notificação persistente
export const cancelSOSNotification = async () => {
  await Notifications.cancelScheduledNotificationAsync(SOS_NOTIFICATION_ID);
};

// Função existente para acionar SOS (manter conforme implementação atual)
export const triggerSOS = async (contacts: string[]) => {
  // Implementação atual de acionamento do SOS
  console.log('SOS acionado para contatos:', contacts);
};

// Inicialização do serviço
export const initializeEmergencyService = async () => {
  await setupNotificationChannel();
};
