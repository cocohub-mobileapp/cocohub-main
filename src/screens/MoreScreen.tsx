/**
 * MoreScreen — hub for secondary features that don't belong in the main 5 tabs.
 * Replaces: Community, Referrals, Telemedicine, Emergency, Notifications, Profile.
 */

import { Ionicons } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { Suspense } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { useNotificationBadge } from '../hooks/useNotificationBadge';
import type { RootStackParamList } from '../navigation/types';

// Lazy-loaded screens within the More stack
const ProfileScreen = React.lazy(() => import('./ProfileScreen'));
const NotificationCenterScreen = React.lazy(() => import('./NotificationCenterScreen'));
const CommunityScreen = React.lazy(() => import('./CommunityScreen'));
const TelemedicineScreen = React.lazy(() => import('./TelemedicineScreen'));
const EmergencyContactsScreen = React.lazy(() => import('./EmergencyContactsScreen'));
const ReferralScreen = React.lazy(() => import('./ReferralScreen'));
const SettingsScreen = React.lazy(() => import('./SettingsScreen'));
const SymptomCheckerScreen = React.lazy(() => import('./SymptomCheckerScreen'));

type MoreStackParamList = {
  MoreHub: undefined;
  Profile: undefined;
  Notifications: undefined;
  Community: undefined;
  Telemedicine: undefined;
  Emergency: undefined;
  Referrals: undefined;
  Settings: undefined;
  SymptomChecker: undefined;
};

const MoreStack = createNativeStackNavigator<MoreStackParamList>();

function Lazy({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>}>
      {children}
    </Suspense>
  );
}

// ─── Hub screen ───────────────────────────────────────────────────────────────

function MoreHub() {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<MoreStackParamList>>();
  const rootNav = useNavigation<NavigationProp<RootStackParamList>>();
  const { count: badgeCount } = useNotificationBadge();

  const sections: {
    title: string;
    items: {
      icon: keyof typeof Ionicons.glyphMap;
      label: string;
      badge?: number;
      onPress: () => void;
      color?: string;
    }[];
  }[] = [
    {
      title: 'Account',
      items: [
        { icon: 'person-circle-outline', label: 'My Profile', onPress: () => navigation.navigate('Profile') },
        {
          icon: 'notifications-outline', label: 'Notifications',
          badge: badgeCount > 0 ? badgeCount : undefined,
          onPress: () => navigation.navigate('Notifications'),
        },
        { icon: 'settings-outline', label: 'Settings', onPress: () => navigation.navigate('Settings') },
      ],
    },
    {
      title: 'Community',
      items: [
        { icon: 'people-outline', label: 'Community Feed', onPress: () => navigation.navigate('Community') },
        { icon: 'gift-outline', label: 'Referrals & Credits', onPress: () => navigation.navigate('Referrals') },
        { icon: 'chatbubbles-outline', label: 'Forum', onPress: () => rootNav.navigate('Forum') },
        { icon: 'search-outline', label: 'Lost & Found', onPress: () => rootNav.navigate('LostFound') },
      ],
    },
    {
      title: 'Veterinary',
      items: [
        { icon: 'pulse-outline', label: 'AI Symptom Checker', color: '#7B3FE4', onPress: () => navigation.navigate('SymptomChecker') },
        { icon: 'videocam-outline', label: 'Telemedicine', onPress: () => navigation.navigate('Telemedicine') },
        {
          icon: 'warning-outline', label: 'Emergency SOS',
          color: '#EF4444',
          onPress: () => navigation.navigate('Emergency'),
        },
      ],
    },
    {
      title: 'Blockchain',
      items: [
        { icon: 'scan-outline', label: 'Scan QR Code', onPress: () => rootNav.navigate('QRScanner') },
        { icon: 'card-outline', label: 'Fiat On-Ramp', onPress: () => rootNav.navigate('FiatOnRamp') },
      ],
    },
  ];

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.pageTitle, { color: colors.text }]}>More</Text>

      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.placeholder }]}>{section.title.toUpperCase()}</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {section.items.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.row,
                  { borderBottomColor: colors.border },
                  idx === section.items.length - 1 && styles.rowLast,
                ]}
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={[styles.iconWrap, { backgroundColor: (item.color ?? colors.primary) + '18' }]}>
                  <Ionicons name={item.icon} size={20} color={item.color ?? colors.primary} />
                </View>
                <Text style={[styles.rowLabel, { color: item.color ?? colors.text }]}>{item.label}</Text>
                <View style={styles.rowRight}>
                  {item.badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  ) : null}
                  <Ionicons name="chevron-forward" size={16} color={colors.placeholder} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <Text style={[styles.version, { color: colors.placeholder }]}>Cocohub v1.0.0</Text>
    </ScrollView>
  );
}

// ─── More Stack Navigator ─────────────────────────────────────────────────────

export default function MoreScreen() {
  return (
    <MoreStack.Navigator>
      <MoreStack.Screen name="MoreHub" component={MoreHub} options={{ headerShown: false }} />
      <MoreStack.Screen name="Profile" options={{ title: 'My Profile' }}>
        {() => <Lazy><ProfileScreen /></Lazy>}
      </MoreStack.Screen>
      <MoreStack.Screen name="Notifications" options={{ title: 'Notifications' }}>
        {() => <Lazy><NotificationCenterScreen /></Lazy>}
      </MoreStack.Screen>
      <MoreStack.Screen name="Community" options={{ title: 'Community' }}>
        {() => <Lazy><CommunityScreen /></Lazy>}
      </MoreStack.Screen>
      <MoreStack.Screen name="Telemedicine" options={{ title: 'Telemedicine' }}>
        {() => <Lazy><TelemedicineScreen /></Lazy>}
      </MoreStack.Screen>
      <MoreStack.Screen name="Emergency" options={{ title: 'Emergency SOS' }}>
        {() => <Lazy><EmergencyContactsScreen /></Lazy>}
      </MoreStack.Screen>
      <MoreStack.Screen name="Referrals" options={{ title: 'Referrals' }}>
        {() => <Lazy><ReferralScreen /></Lazy>}
      </MoreStack.Screen>
      <MoreStack.Screen name="Settings" options={{ title: 'Settings' }}>
        {() => <Lazy><SettingsScreen /></Lazy>}
      </MoreStack.Screen>
      <MoreStack.Screen name="SymptomChecker" options={{ title: 'AI Symptom Checker' }}>
        {({ navigation }) => (
          <Lazy>
            <SymptomCheckerScreen onBack={() => navigation.goBack()} />
          </Lazy>
        )}
      </MoreStack.Screen>
    </MoreStack.Navigator>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingBottom: 40 },
  pageTitle: { fontSize: 28, fontWeight: '800', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8 },
  sectionCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLast: { borderBottomWidth: 0 },
  iconWrap: { width: 34, height: 34, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, marginTop: 32 },
});
