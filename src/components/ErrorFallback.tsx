import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';

import updateService from '../services/updateService';
import { useAppTheme } from '../theme';
import { encryptedAsyncStorage } from '../utils/encryptedAsyncStorage';

interface Props {
  onRetry: () => void;
  onContactSupport?: () => void;
  onRestart?: () => void;
  onClearCache?: () => void;
}

export default function ErrorFallback({
  onRetry,
  onContactSupport,
  onRestart,
  onClearCache,
}: Props) {
  const colors = useAppTheme();

  const contactSupport = () => {
    if (onContactSupport) return onContactSupport();
    const mailto =
      'mailto:support@cocohub.app?subject=App%20Error&body=I%20encountered%20an%20error.';
    void Linking.openURL(mailto).catch(() => {});
  };

  const restart = () => {
    if (onRestart) return onRestart();
    void updateService.applyOtaUpdate().catch(() => {});
  };

  const clearCache = async () => {
    if (onClearCache) return onClearCache();
    try {
      await encryptedAsyncStorage.clear();
    } catch {
      // ignore
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: colors.secondaryText }]}>
        An unexpected error occurred. Try retrying or contact support.
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={onRetry}
          accessibilityRole="button"
        >
          <Text style={[styles.btnText, { color: colors.white }]}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.muted }]}
          onPress={contactSupport}
          accessibilityRole="button"
        >
          <Text style={[styles.btnText, { color: colors.text }]}>Contact Support</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.info }]}
          onPress={clearCache}
          accessibilityRole="button"
        >
          <Text style={[styles.btnText, { color: colors.white }]}>Clear Cache</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.info }]}
          onPress={restart}
          accessibilityRole="button"
        >
          <Text style={[styles.btnText, { color: colors.white }]}>Restart App</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  message: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  actions: { flexDirection: 'row', gap: 12, marginVertical: 8 },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 8,
  },
  btnText: { fontWeight: '600' },
});
