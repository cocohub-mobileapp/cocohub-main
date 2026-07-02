import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import React, { Suspense } from 'react';
import { ActivityIndicator, StatusBar, Text, View } from 'react-native';

import { useNavigationTheme } from '../theme';
import { useTheme } from '../context/ThemeContext';
import type { RootStackParamList, MainTabParamList, PetStackParamList } from './types';
import { DEEP_LINK_PREFIX } from './types';
import LazyScreen from '../components/LazyScreen';
import { useNotificationBadge } from '../hooks/useNotificationBadge';
import type { Pet } from '../models/Pet';
// ── Critical screens (eagerly loaded) ────────────────────────────────────────
import AuthNavigator from '../screens/AuthNavigator';
import OnboardingScreen from '../screens/OnboardingScreen';
import PetHealthDashboardScreen from '../screens/PetHealthDashboardScreen';
import PetListScreen from '../screens/PetListScreen';
// ── Non-critical screens (lazy loaded) ───────────────────────────────────────
const AdoptionScreen = React.lazy(() => import('../screens/AdoptionScreen'));
const AppointmentScreen = React.lazy(() => import('../screens/AppointmentScreen'));
const AuditHistoryScreen = React.lazy(() => import('../screens/AuditHistoryScreen'));
const ClinicalNotesScreen = React.lazy(() => import('../screens/ClinicalNotesScreen'));
const CommunityScreen = React.lazy(() => import('../screens/CommunityScreen'));
const DeleteAccountScreen = React.lazy(() => import('../screens/DeleteAccountScreen'));
const EmergencyContactsScreen = React.lazy(() => import('../screens/EmergencyContactsScreen'));
const FiatOnRampScreen = React.lazy(() => import('../screens/FiatOnRampScreen'));
const ForumScreen = React.lazy(() => import('../screens/ForumScreen'));
const GlobalSearchScreen = React.lazy(() => import('../screens/GlobalSearchScreen'));
const HealthAlertsScreen = React.lazy(() => import('../screens/HealthAlertsScreen'));
const LostFoundScreen = React.lazy(() => import('../screens/LostFoundScreen'));
const ManualEntryScreen = React.lazy(() => import('../screens/ManualEntryScreen'));
const MedicalRecordSearchScreen = React.lazy(() => import('../screens/MedicalRecordSearchScreen'));
const MedicalRecordViewerScreen = React.lazy(() => import('../screens/MedicalRecordViewerScreen'));
const MedicationScreen = React.lazy(() => import('../screens/MedicationScreen'));
const NearbyVetScreen = React.lazy(() => import('../screens/NearbyVetScreen'));
const NotificationCenterScreen = React.lazy(() => import('../screens/NotificationCenterScreen'));
const NotificationPreferencesScreen = React.lazy(
  () => import('../screens/NotificationPreferencesScreen'),
);
const PaymentScreen = React.lazy(() => import('../screens/PaymentScreen'));
const PetDetailScreen = React.lazy(() => import('../screens/PetDetailScreen'));
const PetFormScreen = React.lazy(() => import('../screens/PetFormScreen'));
const PetHealthMetricsScreen = React.lazy(() => import('../screens/PetHealthMetricsScreen'));
const PetProfileScreen = React.lazy(() => import('../screens/PetProfileScreen'));
const PetShareScreen = React.lazy(() => import('../screens/PetShareScreen'));
const PrivacyDashboardScreen = React.lazy(() => import('../screens/PrivacyDashboardScreen'));
const ProfileScreen = React.lazy(() => import('../screens/ProfileScreen'));
const QRScannerScreen = React.lazy(() => import('../screens/QRScannerScreen'));
const ReconciliationScreen = React.lazy(() => import('../screens/ReconciliationScreen'));
const ReferralScreen = React.lazy(() => import('../screens/ReferralScreen'));
const TelemedicineScreen = React.lazy(() => import('../screens/TelemedicineScreen'));
const TravelCertificateScreen = React.lazy(() => import('../screens/TravelCertificateScreen'));
const TrustlineScreen = React.lazy(() => import('../screens/TrustlineScreen'));
const VaccinationScreen = React.lazy(() => import('../screens/VaccinationScreen'));
const VetMapScreen = React.lazy(() => import('../screens/VetMapScreen'));
import analyticsService from '../services/analyticsService';
import { getSession } from '../services/authService';
import { extractDeepLinkParams } from '../services/notificationService';
import onboardingService from '../services/onboardingService';
import performance from '../utils/performance';
import CareNavigator from './CareNavigator';
import { resolveNotificationNavigationTarget } from './notificationRouteMapper';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const PetStack = createNativeStackNavigator<PetStackParamList>();

// ─── Pet Stack ────────────────────────────────────────────────────────────────
function PetNavigator() {
  return (
    <PetStack.Navigator>
      <PetStack.Screen name="PetListScreen" options={{ title: 'My Pets' }}>
        {({ navigation }) => (
          <PetListScreen
            onSelectPet={(pet) => navigation.navigate('PetDetail', { petId: pet.id })}
            onAddPet={() => navigation.navigate('PetForm', {})}
            onAdoptPet={() => navigation.navigate('Adoption')}
          />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="Adoption" options={{ title: 'Adopt a Pet' }}>
        {() => (
          <LazyScreen screenName="Adoption">
            <AdoptionScreen />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="PetDetail" options={{ title: 'Pet Details' }}>
        {({ route, navigation }) => (
          <LazyScreen screenName="PetDetail">
            <PetDetailScreen
              petId={route.params.petId}
              onBack={() => navigation.goBack()}
              onEdit={(pet: Pet) => navigation.navigate('PetForm', { pet })}
              onHealthDashboard={(petId, petName) =>
                navigation.navigate('PetHealthDashboard', { petId, petName })
              }
              onShare={(petId, petName) => navigation.navigate('PetShare', { petId, petName })}
              onAuditHistory={(petId, petName) =>
                navigation.navigate('AuditHistory', {
                  entityType: 'pet',
                  entityId: petId,
                  title: `${petName} • Audit`,
                })
              }
              onViewProfile={(petId) => navigation.navigate('PetProfile', { petId })}
            />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="AuditHistory" options={{ title: 'Audit History' }}>
        {({ route, navigation }) => (
          <LazyScreen screenName="AuditHistory">
            <AuditHistoryScreen
              entityType={route.params.entityType}
              entityId={route.params.entityId}
              title={route.params.title}
              onBack={() => navigation.goBack()}
            />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="PetProfile" options={{ title: 'Pet Profile' }}>
        {({ route, navigation }) => (
          <LazyScreen screenName="PetProfile">
            <PetProfileScreen petId={route.params.petId} onBack={() => navigation.goBack()} />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="PetHealthDashboard" options={{ title: 'Health Dashboard' }}>
        {({ route, navigation }) => (
          <PetHealthDashboardScreen
            petId={route.params.petId}
            petName={route.params.petName ?? 'Pet'}
            onBack={() => navigation.goBack()}
            onOpenMetrics={() =>
              navigation.navigate('PetHealthMetrics', {
                petId: route.params.petId,
                petName: route.params.petName,
              })
            }
          />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="PetHealthMetrics" options={{ title: 'Health metrics' }}>
        {({ route, navigation }) => (
          <LazyScreen screenName="PetHealthMetrics">
            <PetHealthMetricsScreen
              petId={route.params.petId}
              petName={route.params.petName ?? 'Pet'}
              onBack={() => navigation.goBack()}
            />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="PetForm" options={{ title: 'Pet Form' }}>
        {({ route, navigation }) => (
          <LazyScreen screenName="PetForm">
            <PetFormScreen
              pet={route.params?.pet}
              ownerId={route.params?.ownerId}
              onBack={() => navigation.goBack()}
              onSaved={() => navigation.goBack()}
            />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="MedicalRecordSearch" options={{ title: 'Search Records' }}>
        {({ route, navigation }) => (
          <LazyScreen screenName="MedicalRecordSearch">
            <MedicalRecordSearchScreen
              petId={route.params.petId}
              onBack={() => navigation.goBack()}
            />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="MedicalRecordViewer" options={{ title: 'Medical Records' }}>
        {({ route, navigation }) => (
          <LazyScreen screenName="MedicalRecordViewer">
            <MedicalRecordViewerScreen
              petId={route.params.petId}
              petName={route.params.petName}
              onBack={() => navigation.goBack()}
            />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="PetShare" options={{ title: 'Share Pet Profile' }}>
        {({ route, navigation }) => (
          <LazyScreen screenName="PetShare">
            <PetShareScreen
              petId={route.params.petId}
              petName={route.params.petName}
              onBack={() => navigation.goBack()}
            />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="TravelCertificate" options={{ title: 'Travel Health Certificate' }}>
        {({ route, navigation }) => (
          <LazyScreen screenName="TravelCertificate">
            <TravelCertificateScreen
              petId={route.params.petId}
              petName={route.params.petName}
              onBack={() => navigation.goBack()}
            />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="NearbyVet" options={{ title: 'Nearby Vet Clinics' }}>
        {({ navigation }) => (
          <LazyScreen screenName="NearbyVet">
            <NearbyVetScreen onBack={() => navigation.goBack()} />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="VetMap" options={{ title: 'Vet Map' }}>
        {({ navigation }) => (
          <LazyScreen screenName="VetMap">
            <VetMapScreen
              onBookAppointment={(vetName, date, time) => {
                navigation.getParent()?.navigate('Appointments', {
                  initialVetName: vetName,
                  initialDate: date,
                  initialTime: time,
                  openBooking: true,
                });
              }}
            />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="ReconciliationReport" options={{ title: 'Record Reconciliation' }}>
        {({ navigation }) => (
          <LazyScreen screenName="ReconciliationReport">
            <ReconciliationScreen onBack={() => navigation.goBack()} />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="TrustlineManager" options={{ title: 'Stellar Trustlines' }}>
        {({ navigation }) => (
          <LazyScreen screenName="TrustlineManager">
            <TrustlineScreen onBack={() => navigation.goBack()} />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen
        name="NotificationPreferences"
        options={{ title: 'Notification Preferences' }}
      >
        {({ navigation }) => (
          <LazyScreen screenName="NotificationPreferences">
            <NotificationPreferencesScreen onBack={() => navigation.goBack()} />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="PrivacyDashboard" options={{ title: 'Privacy Dashboard' }}>
        {({ navigation }) => (
          <LazyScreen screenName="PrivacyDashboard">
            <PrivacyDashboardScreen onDeleteAccount={() => navigation.navigate('DeleteAccount')} />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="DeleteAccount" options={{ title: 'Delete Account' }}>
        {({ navigation }) => (
          <LazyScreen screenName="DeleteAccount">
            <DeleteAccountScreen
              onBack={() => navigation.goBack()}
              onDeleted={() =>
                navigation
                  .getParent()
                  ?.getParent()
                  ?.reset({ index: 0, routes: [{ name: 'Auth' }] })
              }
            />
          </LazyScreen>
        )}
      </PetStack.Screen>
      <PetStack.Screen name="ClinicalNotes" options={{ headerShown: false }}>
        {({ route, navigation }) => (
          <LazyScreen screenName="ClinicalNotes">
            <ClinicalNotesScreen
              petId={route.params.petId}
              vetId={route.params.vetId}
              onBack={() => navigation.goBack()}
            />
          </LazyScreen>
        )}
      </PetStack.Screen>
    </PetStack.Navigator>
  );
}

// ─── Tab icon helper ──────────────────────────────────────────────────────────
function TabIcon({ icon, color, size, badge }: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
  badge?: number;
}) {
  return (
    <View style={{ width: size + 4, height: size + 4, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size} color={color} />
      {badge ? (
        <View style={{
          position: 'absolute', top: -2, right: -4,
          backgroundColor: '#EF4444', borderRadius: 8,
          minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
        }}>
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Main Tabs — 5 tabs only ──────────────────────────────────────────────────
const MoreScreen = React.lazy(() => import('../screens/MoreScreen'));

function MainTabs() {
  const { count: badgeCount, refresh: refreshBadge } = useNotificationBadge();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          height: 62,
          paddingBottom: 8,
          paddingTop: 4,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.placeholder,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
      }}
      screenListeners={{ tabPress: () => { refreshBadge(); } }}
    >
      {/* 1 — Pets */}
      <Tab.Screen
        name="PetList"
        component={PetNavigator}
        options={{
          title: 'Pets',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <TabIcon icon="paw-outline" color={color} size={size} />,
        }}
      />

      {/* 2 — Care (Meds + Vaccines + Alerts) */}
      <Tab.Screen
        name="Care"
        component={CareNavigator}
        options={{
          title: 'Care',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <TabIcon icon="medkit-outline" color={color} size={size} />,
        }}
      />

      {/* 3 — Schedule (Appointments) */}
      <Tab.Screen
        name="Schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, size }) => <TabIcon icon="calendar-outline" color={color} size={size} />,
        }}
      >
        {() => (
          <LazyScreen screenName="Schedule">
            <AppointmentScreen />
          </LazyScreen>
        )}
      </Tab.Screen>

      {/* 4 — Search */}
      <Tab.Screen
        name="Search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => <TabIcon icon="search-outline" color={color} size={size} />,
        }}
      >
        {({ navigation }) => (
          <LazyScreen screenName="Search">
            <GlobalSearchScreen
              onSelectResult={(item) => {
                if (item.category === 'pet')
                  (navigation as any).navigate('PetList', { screen: 'PetDetail', params: { petId: item.id } });
              }}
              onQuickAction={(action) => {
                if (action === 'add_pet') (navigation as any).navigate('PetList', { screen: 'PetForm', params: {} });
                if (action === 'scan_qr') navigation.getParent()?.navigate('QRScanner' as any);
              }}
            />
          </LazyScreen>
        )}
      </Tab.Screen>

      {/* 5 — More (Profile, Community, Notifications, etc.) */}
      <Tab.Screen
        name="More"
        options={{
          title: 'More',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <TabIcon icon="menu-outline" color={color} size={size} badge={badgeCount > 0 ? badgeCount : undefined} />
          ),
        }}
      >
        {() => (
          <Suspense fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>}>
            <MoreScreen />
          </Suspense>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ─── Deep linking ─────────────────────────────────────────────────────────────
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: DEEP_LINK_PREFIX,
  config: {
    screens: {
      Onboarding: 'onboarding',
      Auth: 'auth',
      Main: {
        screens: {
          PetList: {
            screens: {
              PetListScreen: 'pets',
              PetDetail: 'pets/:petId',
              PetProfile: 'pets/:petId/profile',
              PetHealthDashboard: 'pets/:petId/dashboard',
              PetHealthMetrics: 'pets/:petId/health',
              PetForm: 'pets/form/:petId?',
              PetShare: 'pets/:petId/share',
              NearbyVet: 'nearby-vets',
            },
          },
          Care: 'care',
          Schedule: 'schedule',
          Search: 'search',
          More: 'more',
        },
      },
      QRScanner: 'scan',
      ManualEntry: 'manual-entry',
      Payment: 'payment',
    },
  },
};

// ─── Root Navigator ───────────────────────────────────────────────────────────
export const navigationRef = React.createRef<
  Parameters<typeof NavigationContainer>[0]['ref'] & {
    getCurrentRoute?: () => { name?: string } | undefined;
  }
>();

/**
 * Handle notification deep linking
 * Navigates to the appropriate screen based on notification data
 */
export const handleNotificationDeepLink = (data: Record<string, unknown>): void => {
  if (!navigationRef.current) return;

  const deepLink = extractDeepLinkParams(data);
  const target = resolveNotificationNavigationTarget(deepLink);
  if (!target) return;

  const nav = navigationRef.current;
  (nav as any)?.navigate?.('Main', target);
};

// ─── Root Navigator ───────────────────────────────────────────────────────────
export default function AppNavigator() {
  const navRef = React.useRef<
    Parameters<typeof NavigationContainer>[0] & {
      getCurrentRoute?: () => { name?: string } | undefined;
    }
  >(null);

  // Determine the correct initial route: skip onboarding if already completed,
  // skip auth if a valid session exists.
  const [initialRoute, setInitialRoute] = React.useState<'Onboarding' | 'Auth' | 'Main' | null>(null);

  const navTheme = useNavigationTheme();
  const currentScreenSpan = React.useRef<ReturnType<typeof performance.startSpan> | undefined>(
    undefined,
  );

  // Resolve initial route on mount — ALL hooks must be called before any early return
  React.useEffect(() => {
    void (async () => {
      try {
        const [onboardingState, session] = await Promise.all([
          onboardingService.load(),
          getSession(),
        ]);
        if (session) {
          setInitialRoute('Main');
        } else if (onboardingState?.completed) {
          setInitialRoute('Auth');
        } else {
          setInitialRoute('Onboarding');
        }
      } catch {
        setInitialRoute('Onboarding');
      }
    })();
  }, []);

  // Set the ref for external use (e.g., from App.tsx)
  React.useEffect(() => {
    if (navRef.current) {
      Object.assign(navigationRef, navRef);
    }
  }, []);

  // Listen for notification responses (taps) with deep linking
  React.useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      handleNotificationDeepLink(data);
    });

    return () => subscription.remove();
  }, []);

  // Still resolving initial route — show a loading spinner
  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={navTheme.dark ? 'light-content' : 'dark-content'}
        backgroundColor={navTheme.colors.card}
      />
      <Suspense
        fallback={
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" />
          </View>
        }
      >
        <NavigationContainer
          ref={navRef as React.Ref<never>}
          theme={navTheme}
          linking={linking}
          onStateChange={() => {
            const route = (
              navRef.current as { getCurrentRoute?: () => { name?: string } | undefined } | null
            )?.getCurrentRoute?.();
            const name = route?.name;
            // finish previous span
            try {
              performance.finishSpan(currentScreenSpan.current);
            } catch (e) {
              // ignore
            }

            if (name) {
              analyticsService.screenView(name);
              // start new screen span
              currentScreenSpan.current = performance.startSpan(`screen:${name}`);
              performance.recordMetric('screen.render_start', Date.now(), { screen: name });
            }
          }}
        >
          <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
            <RootStack.Screen name="Onboarding">
              {({ navigation }) => (
                <OnboardingScreen
                  onComplete={async () => {
                    const state = await onboardingService.load() ?? await onboardingService.init();
                    await onboardingService.complete(state);
                    navigation.replace('Auth');
                  }}
                  onSkip={async () => {
                    const state = await onboardingService.load() ?? await onboardingService.init();
                    await onboardingService.complete(state);
                    navigation.replace('Auth');
                  }}
                />
              )}
            </RootStack.Screen>

            <RootStack.Screen name="Auth">
              {({ navigation }) => (
                <AuthNavigator onAuthenticated={() => navigation.replace('Main')} />
              )}
            </RootStack.Screen>

            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen name="Forum" options={{ headerShown: true, title: 'Forum' }}>
              {() => (
                <LazyScreen screenName="Forum">
                  <ForumScreen />
                </LazyScreen>
              )}
            </RootStack.Screen>
            <RootStack.Screen
              name="LostFound"
              options={{ headerShown: true, title: 'Lost & Found' }}
            >
              {() => (
                <LazyScreen screenName="LostFound">
                  <LostFoundScreen />
                </LazyScreen>
              )}
            </RootStack.Screen>

            {/* Modals */}
            <RootStack.Group screenOptions={{ presentation: 'modal' }}>
              <RootStack.Screen name="QRScanner">
                {({ route, navigation }) => (
                  <LazyScreen screenName="QRScanner">
                    <QRScannerScreen
                      onScanSuccess={(data) => {
                        if (route.params?.onScanSuccess) {
                          route.params.onScanSuccess(data);
                        }
                        navigation.goBack();
                      }}
                      onClose={() => navigation.goBack()}
                      onManualEntry={() => navigation.replace('ManualEntry')}
                    />
                  </LazyScreen>
                )}
              </RootStack.Screen>
              <RootStack.Screen name="ManualEntry">
                {({ navigation }) => (
                  <LazyScreen screenName="ManualEntry">
                    <ManualEntryScreen
                      onSubmit={() => navigation.goBack()}
                      onClose={() => navigation.goBack()}
                    />
                  </LazyScreen>
                )}
              </RootStack.Screen>
              <RootStack.Screen
                name="Payment"
                options={{ headerShown: true, title: 'Premium Plans' }}
              >
                {() => (
                  <LazyScreen screenName="Payment">
                    <PaymentScreen />
                  </LazyScreen>
                )}
              </RootStack.Screen>
              <RootStack.Screen
                name="FiatOnRamp"
                options={{ headerShown: true, title: 'Fund Your Wallet' }}
              >
                {() => (
                  <LazyScreen screenName="FiatOnRamp">
                    <FiatOnRampScreen />
                  </LazyScreen>
                )}
              </RootStack.Screen>
            </RootStack.Group>
          </RootStack.Navigator>
        </NavigationContainer>
      </Suspense>
    </>
  );
}
