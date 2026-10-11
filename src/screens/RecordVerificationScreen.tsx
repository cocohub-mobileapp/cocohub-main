import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { TrustBadge } from '../components/TrustBadge';
import { useTheme } from '../context/ThemeContext';
import type { MedicalRecord } from '../services/medicalRecordService';
import {
  clearVerificationCache,
  verifyRecord,
  type VerificationResult,
} from '../services/verificationService';

interface Props {
  record: MedicalRecord;
  onClose?: () => void;
}

export const RecordVerificationScreen: React.FC<Props> = ({ record, onClose }) => {
  const { colors } = useTheme();
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  const runVerification = useCallback(async () => {
    setLoading(true);
    const res = await verifyRecord(record);
    setResult(res);
    setLoading(false);
  }, [record]);

  useEffect(() => {
    runVerification();
  }, [runVerification]);

  const handleRefresh = async () => {
    await clearVerificationCache(record.id);
    runVerification();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      accessibilityLabel="Record verification screen"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          Blockchain Verification
        </Text>
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close verification screen"
            style={styles.closeBtn}
          >
            <Text style={[styles.closeBtnText, { color: colors.secondaryText }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <View
        style={[
          styles.recordInfo,
          { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
        ]}
      >
        <Text style={[styles.label, { color: colors.placeholder }]}>Record ID</Text>
        <Text
          style={[styles.value, { color: colors.text }]}
          accessibilityLabel={`Record ID: ${record.id}`}
        >
          {record.id}
        </Text>
        <Text style={[styles.label, { color: colors.placeholder }]}>Type</Text>
        <Text style={[styles.value, { color: colors.text }]}>{record.type}</Text>
        <Text style={[styles.label, { color: colors.placeholder }]}>Date</Text>
        <Text style={[styles.value, { color: colors.text }]}>{record.date}</Text>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          accessibilityLabel="Verifying record on blockchain"
          style={styles.spinner}
        />
      ) : result ? (
        <View
          style={[
            styles.resultSection,
            { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
          ]}
        >
          <TrustBadge status={result.status} />

          {result.txHash && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.placeholder }]}>Transaction Hash</Text>
              <Text
                style={[styles.mono, { color: colors.primary }]}
                accessibilityLabel={`Transaction hash: ${result.txHash}`}
              >
                {result.txHash}
              </Text>
            </View>
          )}

          {result.onChainHash && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.placeholder }]}>On-Chain Hash</Text>
              <Text style={[styles.mono, { color: colors.text }]}>{result.onChainHash}</Text>
            </View>
          )}

          {result.ledger !== undefined && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.placeholder }]}>Ledger</Text>
              <Text style={[styles.value, { color: colors.text }]}>{result.ledger}</Text>
            </View>
          )}

          {result.timestamp && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.placeholder }]}>Verified At</Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {new Date(result.timestamp).toLocaleString()}
              </Text>
            </View>
          )}

          {result.txDetails && (
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.placeholder }]}>Source Account</Text>
              <Text style={[styles.mono, { color: colors.text }]}>
                {result.txDetails.sourceAccount ?? '—'}
              </Text>
            </View>
          )}

          {result.status === 'offline' && (
            <Text style={[styles.offlineNote, { color: colors.warning }]} accessibilityRole="text">
              ⚡ Showing cached result — connect to the internet to re-verify.
            </Text>
          )}
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.refreshBtn, { backgroundColor: colors.primary }]}
        onPress={handleRefresh}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Re-verify record on blockchain"
        accessibilityState={{ disabled: loading }}
      >
        <Text style={[styles.refreshBtnText, { color: colors.white }]}>Re-verify on Chain</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  closeBtn: { padding: 8 },
  closeBtnText: { fontSize: 18 },
  recordInfo: { borderRadius: 12, padding: 16, gap: 4 },
  resultSection: { borderRadius: 12, padding: 16, gap: 12 },
  row: { gap: 2 },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  value: { fontSize: 14 },
  mono: { fontSize: 12, fontFamily: 'monospace' },
  spinner: { marginVertical: 32 },
  offlineNote: { fontSize: 13, fontStyle: 'italic' },
  refreshBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  refreshBtnText: { fontWeight: '700', fontSize: 15 },
});
