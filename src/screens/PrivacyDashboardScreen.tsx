import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { resilientRequest } from '../services/apiClient';

interface ConsentState {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

interface DataCategory {
  label: string;
  count: number | null;
}

const CATEGORIES: { key: keyof ConsentState; label: string; description: string }[] = [
  { key: 'necessary', label: 'Necessary', description: 'Required for the app to function.' },
  { key: 'functional', label: 'Functional', description: 'Remembers your preferences.' },
  { key: 'analytics', label: 'Analytics', description: 'Helps us improve the app.' },
  { key: 'marketing', label: 'Marketing', description: 'Personalised offers and updates.' },
];

interface Props {
  onDeleteAccount?: () => void;
}

const PrivacyDashboardScreen: React.FC<Props> = ({ onDeleteAccount }) => {
  const { colors } = useTheme();
  const [consents, setConsents] = useState<ConsentState>({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExportDate, setLastExportDate] = useState<string | null>(null);
  const [dataCategories, setDataCategories] = useState<DataCategory[]>([]);

  const loadConsents = useCallback(async () => {
    try {
      const res = await resilientRequest<{
        data: {
          consents: ConsentState;
          lastExportDate?: string;
          dataCounts?: Record<string, number>;
        };
      }>({ method: 'GET', url: '/privacy/consent' });

      setConsents((prev) => ({ ...prev, ...res.data.data.consents }));

      if (res.data.data.lastExportDate) {
        setLastExportDate(res.data.data.lastExportDate);
      }

      if (res.data.data.dataCounts) {
        const counts = res.data.data.dataCounts;
        setDataCategories([
          { label: 'Medical Records', count: counts.medicalRecords ?? null },
          { label: 'Medications', count: counts.medications ?? null },
          { label: 'Appointments', count: counts.appointments ?? null },
          { label: 'Pets', count: counts.pets ?? null },
        ]);
      }
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConsents();
  }, [loadConsents]);

  const saveConsents = useCallback(async () => {
    setSaving(true);
    try {
      await resilientRequest({ method: 'POST', url: '/privacy/consent', data: { consents } });
      Alert.alert('Saved', 'Your privacy preferences have been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  }, [consents]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await resilientRequest<object>({ method: 'GET', url: '/privacy/export' });

      const json = JSON.stringify(res.data, null, 2);
      const fileUri = `${FileSystem.cacheDirectory}cocohub-data-export.json`;
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Save your Cocohub data export',
        });
        const now = new Date().toISOString();
        setLastExportDate(now);
      } else {
        Alert.alert(
          'Export Ready',
          'Your data has been prepared but sharing is not available on this device.',
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to export data.');
    } finally {
      setExporting(false);
    }
  }, []);

  const handleErase = useCallback(() => {
    if (onDeleteAccount) {
      onDeleteAccount();
    } else {
      Alert.alert(
        'Delete All Data',
        'This will permanently delete your account and all associated data. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await resilientRequest({ method: 'DELETE', url: '/privacy/erase' });
                Alert.alert('Done', 'Your data has been erased.');
              } catch {
                Alert.alert('Error', 'Failed to erase data.');
              }
            },
          },
        ],
      );
    }
  }, [onDeleteAccount]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator style={styles.loader} size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>Privacy Dashboard</Text>
      <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
        Manage how Cocohub uses your data. Changes are logged for compliance.
      </Text>

      {dataCategories.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Data</Text>
          {dataCategories.map(({ label, count }) => (
            <View key={label} style={[styles.row, { borderBottomColor: colors.border }]}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
              <Text style={[styles.rowCount, { color: colors.secondaryText }]}>
                {count !== null ? count : '—'}
              </Text>
            </View>
          ))}
        </>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Processing Consents</Text>
      {CATEGORIES.map(({ key, label, description }) => (
        <View key={key} style={[styles.row, { borderBottomColor: colors.border }]}>
          <View style={styles.rowInfo}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
            <Text style={[styles.rowDesc, { color: colors.secondaryText }]}>{description}</Text>
          </View>
          <Switch
            value={consents[key]}
            onValueChange={(v) =>
              key !== 'necessary' && setConsents((prev) => ({ ...prev, [key]: v }))
            }
            disabled={key === 'necessary'}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel={`Toggle ${label} consent`}
          />
        </View>
      ))}

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.primary }]}
        onPress={() => void saveConsents()}
        disabled={saving}
        accessibilityLabel="Save privacy preferences"
      >
        {saving ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={[styles.btnText, { color: colors.white }]}>Save Preferences</Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Data Rights</Text>

      {lastExportDate && (
        <Text style={[styles.lastExport, { color: colors.secondaryText }]}>
          Last exported: {new Date(lastExportDate).toLocaleDateString()}
        </Text>
      )}

      <TouchableOpacity
        style={[
          styles.btn,
          { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
        ]}
        onPress={() => void handleExport()}
        disabled={exporting}
        accessibilityLabel="Download my data"
      >
        {exporting ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={[styles.btnTextSecondary, { color: colors.text }]}>📥 Download My Data</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: colors.error }]}
        onPress={handleErase}
        accessibilityLabel="Delete my account"
      >
        <Text style={[styles.btnText, { color: colors.white }]}>🗑 Delete My Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  loader: { flex: 1, marginTop: 40 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  rowInfo: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
  rowCount: { fontSize: 14 },
  rowDesc: { fontSize: 13, marginTop: 2 },
  lastExport: { fontSize: 13, marginBottom: 4, marginTop: 4 },
  btn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: { fontWeight: '600', fontSize: 15 },
  btnTextSecondary: { fontWeight: '600', fontSize: 15 },
});

export default PrivacyDashboardScreen;
