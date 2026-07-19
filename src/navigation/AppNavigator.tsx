import React from'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useRoute } from './useRoute';
import MedicationScreen from '../screens/MedicationScreen';
import AppointmentDetailScreen from '../screens/AppointmentDetailScreen';
import VaccinationScreen from '../screens/VaccinationScreen';
import EmergencyContactsScreen from '../screens/EmergencyContactsScreen';
import PetDetailScreen from '../screens/PetDetailScreen';
import HomeScreen from '../screens/HomeScreen';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { initialRouteName, initialParams } = useRoute();

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRouteName}>
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

export const handleNotificationDeepLink = (screen: string, petId?: string, appointmentId?: string) => {
  const route = useRoute();
  route.setInitialRoute({ screen, params: { petId, appointmentId } });
};

export default AppNavigator;