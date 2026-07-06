import * as Sentry from '@sentry/react-native';
import * as Notifications from 'expo-notifications';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, AppState, type AppStateStatus, I18nManager } from 'react-native';

import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineIndicator from './src/components/OfflineIndicator';
import SessionTimeoutModal from './src/components/SessionTimeoutModal';
import { useSplashGuard } from './src/components/SplashGuard';
import ThemeTransitionView from './src/components/ThemeTransitionView';
import UpdatePrompt from './src/components/UpdatePrompt';
import { PetProvider } from './src/context/PetContext';
import { PetSelectorProvider } from './src/components/GlobalPetSelector';
import { ThemeProvider } from './src/context/ThemeContext';
import { ToastProvider } from './src/context/ToastContext';
import i18n, { isRTL } from './src/i18n';
import AppNavigator, { handleNotificationDeepLink } from './src/navigation/AppNavigator';
import LockScreen from './src/screens/LockScreen';
import {
  enableScreenCapturePrevention,
  loadLockTimeout,
  getLockTimeoutMs,
} from './src/services/appLockService';
import { registerBackgroundMedicationTask } from './src/services/backgroundTaskService';
import errorTracking from './src/services/errorTracking';
import { scheduleAllPetBirthdays } from './src/services/petBirthdayService';
import {
  registerNotificationActions,
  watchNotificationActions,
} from './src/services/notificationService';
import updateService from './src/services/updateService';
import { checkAppVersion } from './src/services/versionCheckService';
import { initializeWidgetService } from './src/services/widgetService';

const isStorybookEnabled = process.env.STORYBOOK_ENABLED === 'true';

// Lazy-load Storybook only when explicitly enabled to avoid bundling issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const StorybookUIRoot = isStorybookEnabled ? require('./.storybook').default : null;

// Initialise Sentry before the first render
errorTracking.init();

// Apply RTL direction based on the active language at startup
const startupRTL = isRTL(i18n.language);
if (I18nManager.isRTL !== startupRTL) {
  I18nManager.forceRTL(startupRTL);
}

function App() {
  const { appReady } = useSplashGuard();
  const [updateStatus, setUpdateStatus] = React.useState<
    { visible: false } | { visible: true; variant: 'optional' | 'force'; storeUrl?: string }
  >({ visible: false });
  const [locked, setLocked] = useState(false);
  const [pinFallback, setPinFallback] = useState(false);
  const backgroundedAt = React.useRef<number | null>(null);

  // Enable screen capture prevention on mount
  useEffect(() => {
    void enableScreenCapturePrevention();
  }, []);

  // Lock app after idle timeout when returning to foreground
  useEffect(() => {
    const onChange = async (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active' && backgroundedAt.current !== null) {
        const elapsed = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        const timeout = await loadLockTimeout();
        const ms = getLockTimeoutMs(timeout);
        if (ms > 0 && elapsed >= ms) {
          setPinFallback(false);
          setLocked(true);
        }
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  // Check for updates on launch
  React.useEffect(() => {
    if (!appReady) return;
    void (async () => {
      // 1. Check server-side minimum version (critical/recommended)
      const versionResult = await checkAppVersion();
      if (versionResult.type === 'critical') {
        setUpdateStatus({ visible: true, variant: 'force', storeUrl: versionResult.storeUrl });
        return; // no need to check OTA if a store update is required
      }
      if (versionResult.type === 'recommended') {
        setUpdateStatus({ visible: true, variant: 'optional', storeUrl: versionResult.storeUrl });
        return;
      }

      // 2. Fall back to OTA check via expo-updates
      const result = await updateService.checkForUpdate();
      if (result.type === 'force-update') {
        setUpdateStatus({ visible: true, variant: 'force', storeUrl: result.storeUrl });
      } else if (result.type === 'ota-available') {
        setUpdateStatus({ visible: true, variant: 'optional' });
      }
    })();
  }, [appReady]);

  const handleUpdate = () => {
    void updateService.applyOtaUpdate();
  };

  const handleDismiss = () => {
    setUpdateStatus({ visible: false });
  };

  useEffect(() => {
    void registerNotificationActions();
    const subscription = watchNotificationActions();
    void registerBackgroundMedicationTask();
    void scheduleAllPetBirthdays(); // Schedule birthday + health milestone reminders

    // Initialize widget service and update widgets
    const unsubscribeWidget = initializeWidgetService();

    return () => {
      subscription.remove();
      unsubscribeWidget();
    };
  }, []);

  // Handle initial notification if app was launched from a notification tap
  // (cold-start or background)
  useEffect(() => {
    const checkInitialNotification = async () => {
      const notification = await Notifications.getLastNotificationResponseAsync();
      if (notification) {
        const data = notification.notification.request.content.data;
        handleNotificationDeepLink(data);
      }
    };
    void checkInitialNotification();
  }, [appReady]);

  if (!appReady) return <View style={styles.root} />;

  if (locked) {
    return (
      <LockScreen
        showPinFallback={pinFallback}
        onUnlock={() => setLocked(false)}
        onWipe={async () => {
          const { default: authSvc } = await import('./src/services/authService');
          await authSvc.logout();
          setLocked(false);
        }}
      />
    );
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <PetProvider>
          <PetSelectorProvider>
            <ErrorBoundary>
              <ThemeTransitionView>
                <View style={styles.root}>
                  <OfflineIndicator />
                  <AppNavigator />
                  <SessionTimeoutModal />
                  <UpdatePrompt
                    visible={updateStatus.visible}
                    variant={updateStatus.visible ? updateStatus.variant : 'optional'}
                    storeUrl={updateStatus.visible ? updateStatus.storeUrl : undefined}
                    onUpdate={handleUpdate}
                    onDismiss={handleDismiss}
                  />
                </View>
              </ThemeTransitionView>
            </ErrorBoundary>
          </PetSelectorProvider>
        </PetProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

const AppRoot = isStorybookEnabled ? StorybookUIRoot : Sentry.wrap(App);

export default AppRoot;
