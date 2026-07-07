/**
 * CareNavigator — groups Medications, Vaccinations, and Health Alerts
 * into a single "Care" tab with a custom top-tab bar.
 * Uses plain React state instead of @react-navigation/material-top-tabs
 * to avoid native dependency conflicts.
 */

import React, { Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import GlobalPetSelector from '../components/GlobalPetSelector';
import { useTheme } from '../context/ThemeContext';

const MedicationScreen = React.lazy(() => import('../screens/MedicationScreen'));
const VaccinationScreen = React.lazy(() => import('../screens/VaccinationScreen'));
const HealthAlertsScreen = React.lazy(() => import('../screens/HealthAlertsScreen'));

type CareTab = 'Medications' | 'Vaccinations' | 'Alerts';
type CareTabParam = CareTab | 'medications' | 'vaccinations' | 'alerts';
type CareNavigatorProps = {
  route?: {
    params?: {
      initialTab?: CareTabParam;
    };
  };
};

const TABS: { key: CareTab; label: string }[] = [
  { key: 'Medications', label: '💊 Meds' },
  { key: 'Vaccinations', label: '💉 Vaccines' },
  { key: 'Alerts', label: '⚠️ Alerts' },
];

const normalizeCareTab = (tab?: CareTabParam): CareTab | undefined => {
  if (!tab) return undefined;
  if (tab === 'medications') return 'Medications';
  if (tab === 'vaccinations') return 'Vaccinations';
  if (tab === 'alerts') return 'Alerts';
  return tab;
};

function Loader() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}

export default function CareNavigator({ route }: CareNavigatorProps = {}) {
  const { colors } = useTheme();
  const [active, setActive] = useState<CareTab>('Medications');
  const initialTab = normalizeCareTab(route?.params?.initialTab);

  useEffect(() => {
    if (initialTab) setActive(initialTab);
  }, [initialTab]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Pet selector — lets users switch pets without leaving Care tab */}
      <GlobalPetSelector />

      {/* Top tab bar */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                isActive && { borderBottomColor: colors.primary, borderBottomWidth: 3 },
              ]}
              onPress={() => setActive(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[styles.tabLabel, { color: isActive ? colors.primary : colors.placeholder }]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Active screen */}
      <View style={{ flex: 1 }}>
        <Suspense fallback={<Loader />}>
          {active === 'Medications' && <MedicationScreen />}
          {active === 'Vaccinations' && <VaccinationScreen />}
          {active === 'Alerts' && <HealthAlertsScreen />}
        </Suspense>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});
