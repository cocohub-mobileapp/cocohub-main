import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAppTheme } from '../theme';

interface RetryErrorProps {
  error: Error;
  onRetry: () => void;
  retryCount?: number;
  maxRetries?: number;
}

export const RetryError: React.FC<RetryErrorProps> = ({
  error,
  onRetry,
  retryCount = 0,
  maxRetries = 3,
}) => {
  const colors = useAppTheme();
  const canRetry = retryCount < maxRetries;

  return (
    <View style={styles.container}>
      <Text style={styles.errorIcon}>⚠️</Text>
      <Text style={[styles.errorTitle, { color: colors.error }]}>Something went wrong</Text>
      <Text style={[styles.errorMessage, { color: colors.secondaryText }]}>{error.message}</Text>
      {retryCount > 0 && (
        <Text style={[styles.retryInfo, { color: colors.placeholder }]}>
          Attempt {retryCount} of {maxRetries}
        </Text>
      )}
      {canRetry && (
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry request"
        >
          <Text style={[styles.retryButtonText, { color: colors.white }]}>Retry</Text>
        </TouchableOpacity>
      )}
      {!canRetry && (
        <Text style={[styles.maxRetriesText, { color: colors.error }]}>
          Maximum retry attempts reached
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryInfo: {
    fontSize: 12,
    marginBottom: 12,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  maxRetriesText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
