/**
 * SessionTimeoutModal
 *
 * Displayed 2 minutes before session expiry. Shows a live countdown and offers
 * "Stay logged in" (extends the session) and "Log out now" actions.
 *
 * Wire up by subscribing to sessionMonitoringService.onTimeoutWarning() and
 * sessionMonitoringService.onTimeoutExpired() in your root component or context.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { logout } from '../services/authService';
import sessionMonitoringService from '../services/sessionMonitoringService';
import { useAppTheme } from '../theme';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

const SessionTimeoutModal: React.FC = () => {
  const colors = useAppTheme();
  const [visible, setVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const stayButtonRef = useRef<TouchableOpacity>(null);

  const dismiss = useCallback(() => {
    setVisible(false);
  }, []);

  const handleStayLoggedIn = useCallback(async () => {
    dismiss();
    await sessionMonitoringService.extendSession();
  }, [dismiss]);

  const handleLogoutNow = useCallback(async () => {
    dismiss();
    await logout();
  }, [dismiss]);

  useEffect(() => {
    const unsubWarning = sessionMonitoringService.onTimeoutWarning(({ secondsRemaining: secs }) => {
      setSecondsRemaining(secs);
      if (!visible) {
        setVisible(true);
        // Announce to screen readers
        AccessibilityInfo.announceForAccessibility(
          `Your session will expire in ${formatCountdown(secs)}. Tap Stay logged in to continue.`,
        );
      }
    });

    const unsubExpired = sessionMonitoringService.onTimeoutExpired(() => {
      setVisible(false);
      logout().catch(() => {});
    });

    return () => {
      unsubWarning();
      unsubExpired();
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleStayLoggedIn}
      accessibilityViewIsModal
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View
          style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}
          accessibilityRole="alert"
        >
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            Session expiring soon
          </Text>
          <Text style={[styles.message, { color: colors.secondaryText }]}>
            Your session will expire in{' '}
            <Text
              style={[styles.countdown, { color: colors.error }]}
              accessibilityLabel={formatCountdown(secondsRemaining)}
            >
              {formatCountdown(secondsRemaining)}
            </Text>{' '}
            — tap to stay logged in.
          </Text>

          <TouchableOpacity
            ref={stayButtonRef}
            style={[styles.button, { backgroundColor: colors.info }]}
            onPress={handleStayLoggedIn}
            accessibilityRole="button"
            accessibilityLabel="Stay logged in"
            accessibilityHint="Extends your session and dismisses this dialog"
          >
            <Text style={[styles.primaryButtonText, { color: colors.white }]}>Stay logged in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton, { borderColor: colors.border }]}
            onPress={handleLogoutNow}
            accessibilityRole="button"
            accessibilityLabel="Log out now"
            accessibilityHint="Immediately logs you out of the app"
          >
            <Text style={[styles.secondaryButtonText, { color: colors.secondaryText }]}>
              Log out now
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
  },
  countdown: {
    fontWeight: '700',
  },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontWeight: '500',
    fontSize: 15,
  },
});

export default SessionTimeoutModal;
