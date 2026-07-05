import Constants from 'expo-constants';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import LanguageSelector from '../components/LanguageSelector';
import { usePetContext } from '../context/PetContext';
import type { NotificationPreferences, User } from '../models/User';
import {
  disableBiometricAuthentication,
  isBiometricAuthenticationAvailable,
  isBiometricAuthenticationEnabled,
  logout,
  requestPasswordReset,
  promptForBiometricSetup,
} from '../services/authService';
import { getEntitySyncStatuses, type EntitySyncRecord } from '../services/cloudSyncService';
import { type SyncEntityType } from '../services/syncService';
import { getUserProfile, saveUserProfile, updateUserProfile } from '../services/userService';
import { registerBackgroundWearableSyncTask } from '../services/wearableBackgroundSyncService';
import wearableService, {
  type WearableProvider,
  type WearableProviderKey,
} from '../services/wearableService';
import { useAppTheme } from '../theme';
import { formatAddress } from '../utils/localeValues';
import { useTheme, type ThemeMode } from '../utils/useTheme';

// ─── App version info ─────────────────────────────────────────────────────────
// Pulled from expo-constants at runtime; fallback to package values.
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const BUILD_NUMBER = String(
  Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? '1',
);

const TERMS_URL = 'https://cocohub.app/terms';
const PRIVACY_URL = 'https://cocohub.app/privacy';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  /** Called after a successful logout so the parent can redirect to auth. */
  onLogout: () => void;
}

// ─── Change Password Modal ────────────────────────────────────────────────────

interface ChangePasswordModalProps {
  visible: boolean;
  email: string;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ visible, email, onClose }) => {
  const { t } = useTranslation();
  const colors = useAppTheme();
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('changePassword.noEmail'));
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email);
      Alert.alert(t('changePassword.emailSentTitle'), t('changePassword.emailSentBody'), [
        { text: 'OK', onPress: onClose },
      ]);
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof Error ? err.message : t('changePassword.failedSend'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {t('changePassword.title')}
          </Text>
          <Text style={[styles.modalBody, { color: colors.secondaryText }]}>
            {t('changePassword.body')}
          </Text>
          <Text style={[styles.modalEmail, { color: colors.text }]}>{email}</Text>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={() => void handleSend()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{t('changePassword.sendResetLink')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={[styles.cancelText, { color: colors.secondaryText }]}>
              {t('common.cancel')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const SettingsScreen: React.FC<Props> = ({ onLogout }) => {
  const { t } = useTranslation();
  const { activePet } = usePetContext();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const colors = useAppTheme();
  const [_profile, setProfile] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelationship, setContactRelationship] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    medicationReminders: true,
    appointmentReminders: true,
    vaccinationAlerts: true,
    soundEnabled: true,
    badgeEnabled: true,
  });
  const [notifSaving, setNotifSaving] = useState(false);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [exportRequesting, setExportRequesting] = useState(false);
  const [entitySyncStatuses, setEntitySyncStatuses] = useState<Record<
    SyncEntityType,
    EntitySyncRecord
  > | null>(null);
  const [wearableProviders, setWearableProviders] = useState<WearableProvider[]>([]);
  const [wearableConnecting, setWearableConnecting] = useState<WearableProviderKey | null>(null);
  const [wearableMessage, setWearableMessage] = useState('');

  // ── Load profile on mount ──────────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      const stored = await getUserProfile();
      if (stored) {
        setProfile(stored);
        setName(stored.name ?? '');
        setEmail(stored.email ?? '');
        setPhone(stored.phone ?? '');
        setProfilePhoto(stored.profilePhoto ?? '');
        setStreet(stored.address?.street ?? '');
        setCity(stored.address?.city ?? '');
        setState(stored.address?.state ?? '');
        setPostalCode(stored.address?.postalCode ?? '');
        setCountry(stored.address?.country ?? '');
        setContactName(stored.emergencyContact?.name ?? '');
        setContactPhone(stored.emergencyContact?.phone ?? '');
        setContactRelationship(stored.emergencyContact?.relationship ?? '');
        setContactEmail(stored.emergencyContact?.email ?? '');
        setNotifPrefs((prev) => ({ ...prev, ...(stored.notificationPreferences ?? {}) }));
      }

      const available = await isBiometricAuthenticationAvailable();
      setBiometricAvailable(available);
      if (available) {
        const enabled = await isBiometricAuthenticationEnabled();
        setBiometricEnabled(enabled);
      }

      try {
        const statuses = await getEntitySyncStatuses();
        setEntitySyncStatuses(statuses);
      } catch {
        // Non-critical — sync status display degrades gracefully
      }

      const providers = await wearableService.getWearableProviders();
      setWearableProviders(providers);
    })();
  }, []);

  // ── Profile save ───────────────────────────────────────────────────────────

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('settings.nameRequired'));
      return;
    }
    if (email.trim() && !validateEmail(email)) {
      Alert.alert(t('common.error'), t('settings.invalidEmail'));
      return;
    }
    if (contactEmail.trim() && !validateEmail(contactEmail)) {
      Alert.alert(t('common.error'), t('settings.invalidEmergencyEmail'));
      return;
    }

    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const updates = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        profilePhoto: profilePhoto.trim(),
        address: {
          street: street.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          country: country.trim(),
        },
        emergencyContact: {
          name: contactName.trim(),
          phone: contactPhone.trim(),
          relationship: contactRelationship.trim(),
          email: contactEmail.trim(),
        },
      };

      const savedProfile = _profile
        ? await updateUserProfile(updates)
        : await saveUserProfile({
            id: `user_${Date.now()}`,
            role: 'owner',
            ...updates,
          });

      setProfile(savedProfile);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof Error ? err.message : t('settings.failedSaveProfile'),
      );
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Notification toggle ────────────────────────────────────────────────────

  const handleNotifToggle = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      const updated = { ...notifPrefs, [key]: value };
      setNotifPrefs(updated);
      setNotifSaving(true);
      try {
        await updateUserProfile({ notificationPreferences: updated });
      } catch {
        // Revert on failure
        setNotifPrefs(notifPrefs);
        Alert.alert(t('common.error'), t('settings.failedSaveNotif'));
      } finally {
        setNotifSaving(false);
      }
    },
    [notifPrefs, t],
  );

  // ── Biometric toggle ───────────────────────────────────────────────────────

  const handleBiometricToggle = useCallback(
    async (value: boolean) => {
      setBiometricLoading(true);
      try {
        if (value) {
          const success = await promptForBiometricSetup();
          setBiometricEnabled(success);
          if (!success) Alert.alert(t('common.error'), t('settings.biometricSetupFailed'));
        } else {
          await disableBiometricAuthentication();
          setBiometricEnabled(false);
        }
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Biometric setup failed.');
      } finally {
        setBiometricLoading(false);
      }
    },
    [t],
  );

  // ── Data Export ────────────────────────────────────────────────────────────

  const handleRequestDataExport = useCallback(async () => {
    Alert.alert(
      t('settings.exportDataTitle', 'Export Your Data'),
      t(
        'settings.exportDataMessage',
        'We will prepare a complete export of all your Cocohub data (pets, records, appointments, medications) in JSON and PDF formats. You will receive an email with a download link when ready (expires in 48 hours).',
      ),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.requestExport', 'Request Export'),
          onPress: async () => {
            setExportRequesting(true);
            try {
              const response = await fetch('/api/privacy/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              });

              if (!response.ok) {
                throw new Error('Export request failed');
              }

              const result = await response.json();

              Alert.alert(
                t('common.success', 'Success'),
                result.data?.message ||
                  t(
                    'settings.exportRequested',
                    'Your data export has been queued. You will receive an email when ready.',
                  ),
              );
            } catch (err) {
              Alert.alert(
                t('common.error'),
                err instanceof Error
                  ? err.message
                  : t('settings.exportFailed', 'Export request failed'),
              );
            } finally {
              setExportRequesting(false);
            }
          },
        },
      ],
    );
  }, [t]);

  const handleStartWearableOAuth = useCallback(
    async (providerKey: WearableProviderKey) => {
      if (!activePet) {
        Alert.alert('Select a pet first', 'Choose a pet before connecting a wearable account.');
        return;
      }

      setWearableConnecting(providerKey);
      setWearableMessage('');
      try {
        const authUrl = await wearableService.startWearableOAuth(activePet.id, providerKey);
        if (!authUrl) {
          setWearableMessage(
            'This wearable provider is not configured yet. MockFit remains available from the pet health metrics screen for local testing.',
          );
          return;
        }

        await wearableService.rememberConnectedWearable(activePet.id, providerKey);
        await registerBackgroundWearableSyncTask();
        await Linking.openURL(authUrl);
        setWearableMessage(
          'Wearable authorization opened. Sync will run in the background once the provider callback stores tokens.',
        );
      } catch (err) {
        Alert.alert(
          t('common.error'),
          err instanceof Error ? err.message : 'Could not start wearable connection.',
        );
      } finally {
        setWearableConnecting(null);
      }
    },
    [activePet, t],
  );

  // ── Logout ─────────────────────────────────────────────────────────────────

  const handleLogout = useCallback(() => {
    Alert.alert(t('common.logoutConfirmTitle'), t('common.logoutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.logout'),
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
            onLogout();
          } catch {
            // Even if server-side logout fails, local tokens are cleared — proceed
            onLogout();
          }
        },
      },
    ]);
  }, [onLogout, t]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={[styles.sectionHeader, { color: colors.secondaryText }]}>{title}</Text>
  );

  const RowSeparator = () => (
    <View style={[styles.separator, { backgroundColor: colors.border }]} />
  );

  /** Returns a human-readable label for a per-entity sync record */
  const formatEntitySyncLabel = (record: EntitySyncRecord): string => {
    if (record.status === 'never') return 'Never synced';
    if (record.status === 'failed') {
      const when = record.lastAttemptAt
        ? formatRelativeTime(new Date(record.lastAttemptAt))
        : 'recently';
      return `Failed ${when}`;
    }
    if (record.status === 'success' && record.lastSuccessAt) {
      const when = formatRelativeTime(new Date(record.lastSuccessAt));
      const pending = record.pendingCount > 0 ? ` — ${record.pendingCount} pending` : '';
      return `Last synced ${when}${pending}`;
    }
    return 'Pending…';
  };

  const formatRelativeTime = (date: Date): string => {
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);
    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const ENTITY_LABELS: Record<SyncEntityType, string> = {
    pet: 'Pets',
    appointment: 'Appointments',
    medication: 'Medications',
    medicalRecord: 'Medical Records',
  };

  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
  const inputStyle = [
    styles.input,
    { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
  ];
  const placeholderColor = colors.placeholder;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.screenTitle, { color: colors.text }]}>
        {t('settings.title', 'Settings')}
      </Text>

      {/* ── Profile Settings ── */}
      <SectionHeader title={t('settings.profile')} />
      <View style={cardStyle}>
        <Text style={[styles.label, { color: colors.secondaryText }]}>{t('settings.name')} *</Text>
        <TextInput
          style={inputStyle}
          value={name}
          onChangeText={setName}
          placeholder={t('settings.namePlaceholder')}
          placeholderTextColor={placeholderColor}
          autoCapitalize="words"
        />

        <Text style={[styles.label, { color: colors.secondaryText }]}>{t('settings.email')}</Text>
        <TextInput
          style={inputStyle}
          value={email}
          onChangeText={setEmail}
          placeholder={t('settings.emailPlaceholder')}
          placeholderTextColor={placeholderColor}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={[styles.label, { color: colors.secondaryText }]}>{t('settings.phone')}</Text>
        <TextInput
          style={inputStyle}
          value={phone}
          onChangeText={setPhone}
          placeholder={t('settings.phonePlaceholder')}
          placeholderTextColor={placeholderColor}
          keyboardType="phone-pad"
        />

        <Text style={[styles.label, { color: colors.secondaryText }]}>
          {t('settings.profilePhoto')}
        </Text>
        <TextInput
          style={inputStyle}
          value={profilePhoto}
          onChangeText={setProfilePhoto}
          placeholder={t('settings.profilePhotoPlaceholder')}
          placeholderTextColor={placeholderColor}
          autoCapitalize="none"
        />

        <Text style={[styles.label, { color: colors.secondaryText }]}>{t('settings.address')}</Text>
        <TextInput
          style={inputStyle}
          value={street}
          onChangeText={setStreet}
          placeholder={t('settings.streetPlaceholder')}
          placeholderTextColor={placeholderColor}
        />
        <TextInput
          style={inputStyle}
          value={city}
          onChangeText={setCity}
          placeholder={t('settings.cityPlaceholder')}
          placeholderTextColor={placeholderColor}
        />
        <TextInput
          style={inputStyle}
          value={state}
          onChangeText={setState}
          placeholder={t('settings.statePlaceholder')}
          placeholderTextColor={placeholderColor}
        />
        <TextInput
          style={inputStyle}
          value={postalCode}
          onChangeText={setPostalCode}
          placeholder={t('settings.postalCodePlaceholder')}
          placeholderTextColor={placeholderColor}
        />
        <TextInput
          style={inputStyle}
          value={country}
          onChangeText={setCountry}
          placeholder={t('settings.countryPlaceholder')}
          placeholderTextColor={placeholderColor}
        />
        {formatAddress({ street, city, state, postalCode, country }) ? (
          <Text style={[styles.helperText, { color: colors.primary }]}>
            {formatAddress({ street, city, state, postalCode, country })}
          </Text>
        ) : null}

        <Text style={[styles.label, { color: colors.secondaryText }]}>
          {t('settings.emergencyContact')}
        </Text>
        <TextInput
          style={inputStyle}
          value={contactName}
          onChangeText={setContactName}
          placeholder={t('settings.contactNamePlaceholder')}
          placeholderTextColor={placeholderColor}
          autoCapitalize="words"
        />
        <TextInput
          style={inputStyle}
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder={t('settings.contactPhonePlaceholder')}
          placeholderTextColor={placeholderColor}
          keyboardType="phone-pad"
        />
        <TextInput
          style={inputStyle}
          value={contactRelationship}
          onChangeText={setContactRelationship}
          placeholder={t('settings.contactRelationshipPlaceholder')}
          placeholderTextColor={placeholderColor}
          autoCapitalize="words"
        />
        <TextInput
          style={inputStyle}
          value={contactEmail}
          onChangeText={setContactEmail}
          placeholder={t('settings.contactEmailPlaceholder')}
          placeholderTextColor={placeholderColor}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {profileSaved && (
          <Text style={[styles.successText, { color: colors.success }]}>
            {t('settings.profileSaved')}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.btn, profileSaving && styles.btnDisabled]}
          onPress={() => void handleSaveProfile()}
          disabled={profileSaving}
        >
          {profileSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{t('settings.saveProfile')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Notification Preferences ── */}
      <SectionHeader title={t('settings.notifications')} />
      <View style={cardStyle}>
        {notifSaving && (
          <ActivityIndicator size="small" color={colors.primary} style={styles.notifLoader} />
        )}

        {(
          [
            { key: 'medicationReminders', label: t('settings.medicationReminders') },
            { key: 'appointmentReminders', label: t('settings.appointmentReminders') },
            { key: 'vaccinationAlerts', label: t('settings.vaccinationAlerts') },
            { key: 'soundEnabled', label: t('settings.sound') },
            { key: 'badgeEnabled', label: t('settings.badgeCount') },
          ] as { key: keyof NotificationPreferences; label: string }[]
        ).map(({ key, label }, idx, arr) => (
          <React.Fragment key={key}>
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
              <Switch
                value={Boolean(notifPrefs[key])}
                onValueChange={(v) => void handleNotifToggle(key, v)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                disabled={notifSaving}
              />
            </View>
            {idx < arr.length - 1 && <RowSeparator />}
          </React.Fragment>
        ))}
      </View>

      {/* ── Security Settings ── */}
      <SectionHeader title={t('settings.security')} />
      <View style={cardStyle}>
        <TouchableOpacity style={styles.row} onPress={() => setShowChangePassword(true)}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            {t('settings.changePassword')}
          </Text>
          <Text style={[styles.chevron, { color: colors.placeholder }]}>›</Text>
        </TouchableOpacity>

        {biometricAvailable && (
          <>
            <RowSeparator />
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>
                {t('settings.biometricLogin')}
              </Text>
              {biometricLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Switch
                  value={biometricEnabled}
                  onValueChange={(v) => void handleBiometricToggle(v)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                />
              )}
            </View>
          </>
        )}
      </View>

      {/* ── Theme ── */}
      <SectionHeader title={t('settings.theme', 'Theme')} />
      <View style={cardStyle}>
        {(['system', 'light', 'dark'] as ThemeMode[]).map((option, idx, arr) => (
          <React.Fragment key={option}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => void setThemeMode(option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: themeMode === option }}
            >
              <Text style={[styles.rowLabel, { color: colors.text }]}>
                {option === 'system'
                  ? t('settings.themeSystem', 'Follow system')
                  : option === 'light'
                    ? t('settings.themeLight', 'Light')
                    : t('settings.themeDark', 'Dark')}
              </Text>
              {themeMode === option && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            {idx < arr.length - 1 && <RowSeparator />}
          </React.Fragment>
        ))}
      </View>

      {/* ── Language ── */}
      <SectionHeader title={t('settings.language')} />
      <View style={cardStyle}>
        <LanguageSelector />
      </View>

      {/* ── Privacy & Data ── */}
      <SectionHeader title={t('settings.privacyData', 'Privacy & Data')} />
      <View style={cardStyle}>
        <TouchableOpacity style={styles.row} onPress={() => void handleRequestDataExport()}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            {t('settings.exportData', 'Export My Data')}
          </Text>
          <Text style={[styles.chevron, { color: colors.placeholder }]}>›</Text>
        </TouchableOpacity>
        <RowSeparator />
        <TouchableOpacity style={styles.row} onPress={() => void Linking.openURL(PRIVACY_URL)}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            {t('settings.privacyPolicy')}
          </Text>
          <Text style={[styles.chevron, { color: colors.placeholder }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Sync Status ── */}
      <SectionHeader title={t('settings.syncStatus', 'Sync Status')} />
      <View style={cardStyle}>
        {entitySyncStatuses ? (
          (Object.keys(ENTITY_LABELS) as SyncEntityType[]).map((entityType, idx, arr) => {
            const record = entitySyncStatuses[entityType];
            const label = formatEntitySyncLabel(record);
            const statusColor =
              record.status === 'success'
                ? colors.success
                : record.status === 'failed'
                  ? '#d32f2f'
                  : colors.secondaryText;
            return (
              <React.Fragment key={entityType}>
                <View style={styles.syncRow}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {ENTITY_LABELS[entityType]}
                  </Text>
                  <Text style={[styles.syncStatusText, { color: statusColor }]}>{label}</Text>
                </View>
                {idx < arr.length - 1 && <RowSeparator />}
              </React.Fragment>
            );
          })
        ) : (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </View>

      {/* ── Wearable Integrations ── */}
      <SectionHeader title="Wearables" />
      <View style={cardStyle}>
        <Text style={[styles.helperText, { color: colors.secondaryText }]}>
          {activePet
            ? `Connect activity and sleep data for ${activePet.name}.`
            : 'Select a pet before connecting a wearable account.'}
        </Text>
        {(wearableProviders.length
          ? wearableProviders
          : ([
              { key: 'fitbark', name: 'FitBark', scopes: ['activity', 'sleep'], configured: false },
              { key: 'whistle', name: 'Whistle', scopes: ['activity', 'sleep'], configured: false },
            ] as WearableProvider[])
        ).map((provider, idx, arr) => (
          <React.Fragment key={provider.key}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => void handleStartWearableOAuth(provider.key)}
              disabled={wearableConnecting !== null}
              accessibilityRole="button"
              accessibilityLabel={`Connect ${provider.name}`}
            >
              <View style={styles.rowTextBlock}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>{provider.name}</Text>
                <Text style={[styles.providerSubtext, { color: colors.secondaryText }]}>
                  {provider.configured ? 'OAuth ready' : 'OAuth credentials required on backend'}
                </Text>
              </View>
              {wearableConnecting === provider.key ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.chevron, { color: colors.placeholder }]}>›</Text>
              )}
            </TouchableOpacity>
            {idx < arr.length - 1 && <RowSeparator />}
          </React.Fragment>
        ))}
        {wearableMessage ? (
          <Text style={[styles.helperText, { color: colors.secondaryText }]}>
            {wearableMessage}
          </Text>
        ) : null}
      </View>

      {/* ── App Information ── */}
      <SectionHeader title={t('settings.appInfo')} />
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.version')}</Text>
          <Text style={[styles.rowValue, { color: colors.secondaryText }]}>{APP_VERSION}</Text>
        </View>
        <RowSeparator />
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>{t('settings.build')}</Text>
          <Text style={[styles.rowValue, { color: colors.secondaryText }]}>{BUILD_NUMBER}</Text>
        </View>
        <RowSeparator />
        <TouchableOpacity style={styles.row} onPress={() => void Linking.openURL(TERMS_URL)}>
          <Text style={[styles.rowLabel, { color: colors.text }]}>
            {t('settings.termsOfService')}
          </Text>
          <Text style={[styles.chevron, { color: colors.placeholder }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity
        style={[styles.logoutBtn, loggingOut && styles.btnDisabled]}
        onPress={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <ActivityIndicator color="#d32f2f" />
        ) : (
          <Text style={styles.logoutText}>{t('common.logout')}</Text>
        )}
      </TouchableOpacity>

      {/* ── Change Password Modal ── */}
      <ChangePasswordModal
        visible={showChangePassword}
        email={email}
        onClose={() => setShowChangePassword(false)}
      />
    </ScrollView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  successText: {
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  btn: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowTextBlock: { flex: 1, paddingRight: 12 },
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 15 },
  providerSubtext: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 20 },
  checkmark: { fontSize: 16, color: '#4CAF50', fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#f0f0f0' },
  notifLoader: { alignSelf: 'flex-end', marginBottom: 4 },
  logoutBtn: {
    marginTop: 32,
    borderWidth: 1.5,
    borderColor: '#d32f2f',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#d32f2f', fontSize: 16, fontWeight: '600' },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  modalBody: { fontSize: 15, marginBottom: 6 },
  modalEmail: { fontSize: 15, fontWeight: '600', marginBottom: 20 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  cancelText: { fontSize: 15 },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  syncStatusText: {
    fontSize: 12,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
});

export default SettingsScreen;
