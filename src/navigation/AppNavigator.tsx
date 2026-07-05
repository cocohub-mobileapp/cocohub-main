import React, { useEffect, useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { notificationService } from '../services/notificationService';

type RootStackParamList = {
  MedicationScreen: { petId: string } | undefined;
  AppointmentDetailScreen: { appointmentId: string } | undefined;
  VaccinationScreen: { petId: string } | undefined;
  EmergencyContactsScreen: undefined;
  PetDetailScreen: { petId: string } | undefined;
  Home: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

export const handleNotificationDeepLink = async (notification: any) => {
  const { type, data } = notification;
  const screenConfig = notificationService.getScreenForType(type, data);
  if (screenConfig && navigationRef.current) {
    navigationRef.current.navigate(screenConfig.screen, screenConfig.params);
  }
};

const AppNavigator: React.FC = () => {
  const routeNameRef = useRef<string>();

  useEffect(() => {
    // Handle cold-start deep links
    const init = async () => {
      const initialNotification = await notificationService.getInitialNotification();
      if (initialNotification) {
        handleNotificationDeepLink(initialNotification);
      }
    };
    init();

    // Handle foreground notifications
    const unsubscribe = notificationService.onNotificationOpenedApp((notification) => {
      handleNotificationDeepLink(notification);
    });

    return () => unsubscribe();
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name;
      }}
    >
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="MedicationScreen" component={MedicationScreen} />
        <Stack.Screen name="AppointmentDetailScreen" component={AppointmentDetailScreen} />
        <Stack.Screen name="VaccinationScreen" component={VaccinationScreen} />
        <Stack.Screen name="EmergencyContactsScreen" component={EmergencyContactsScreen} />
        <Stack.Screen name="PetDetailScreen" component={PetDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Placeholder screens (actual implementations assumed elsewhere)
const HomeScreen = () => null;
const MedicationScreen = () => null;
const AppointmentDetailScreen = () => null;
const VaccinationScreen = () => null;
const EmergencyContactsScreen = () => null;
const PetDetailScreen = () => null;

export default AppNavigator;
