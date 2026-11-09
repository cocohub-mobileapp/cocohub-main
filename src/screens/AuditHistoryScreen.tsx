import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import auditTrailService, { type AuditTrailEntry } from '../services/auditTrailService';
import { formatRelativeTime } from '../utils/dateLocale';
import { useSecureScreen } from '../utils/secureScreen';
import { useTheme } from '../context/ThemeContext';

interface Props {
  entityType: 'pet' | 'medication' | 'appointment';
  entityId: string;
  title?: string;
  onBack: () => void;
}

function prettyDiff(entry: AuditTrailEntry): string {
  const before = entry.beforeData ?? {};
  const after = entry.afterData ?? {};

  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  if (!keys.length) return 'No field changes captured.';

  return keys
    .map((k) => {
      const b = k in before ? JSON.stringify(before[k]) : '∅';
      const a = k in after ? JSON.stringify(after[k]) : '∅';
      return `${k}: ${b} → ${a}`;
    })
    .join('\n');
}

const AuditHistoryScreen: React.FC<Props> = ({ entityType, entityId, title, onBack }) => {
  useSecureScreen();
  const { colors } = useTheme();

  const [rows, setRows] = useState<AuditTrailEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const headerTitle = useMemo(() => title ?? 'Audit History', [title]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditTrailService.getAuditTrail({ entityType, entityId, limit: 200 });
      setRows(data);
    } catch {
      Alert.alert('Error', 'Failed to load audit history.');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = async () => {
    try {
      const csv = await auditTrailService.exportAuditTrailCsv({ entityType, entityId });
      await Share.share({ message: csv });
    } catch {
      Alert.alert('Error', 'Failed to export audit history.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{headerTitle}</Text>
        <TouchableOpacity
          onPress={handleExport}
          style={[styles.exportBtn, { backgroundColor: colors.primaryMuted }]}
          accessibilityRole="button"
          accessibilityLabel="Export audit history"
          accessibilityHint="Exports audit log as CSV to share"
        >
          <Text style={[styles.exportBtnText, { color: colors.primary }]}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading && <Text style={[styles.muted, { color: colors.placeholder }]}>Loading…</Text>}
        {!loading && rows.length === 0 && (
          <Text style={[styles.muted, { color: colors.placeholder }]}>No audit history available yet.</Text>
        )}

        {rows.map((r) => (
          <View key={r.id} style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.action, { color: colors.text }]}>{r.action}</Text>
              <Text style={[styles.time, { color: colors.secondaryText }]}>{formatRelativeTime(r.createdAt)}</Text>
            </View>
            <Text style={[styles.meta, { color: colors.secondaryText }]}>
              {r.changedBy ? `User: ${r.changedBy}` : 'User: (system/unknown)'}
            </Text>
            <Text style={[styles.diff, { color: colors.text }]}>{prettyDiff(r)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 17 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  exportBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  exportBtnText: { fontWeight: '700' },
  content: { padding: 16 },
  muted: { paddingVertical: 8 },
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  action: { fontWeight: '800' },
  time: {},
  meta: { marginBottom: 10 },
  diff: { fontFamily: 'monospace', lineHeight: 18 },
});

export default AuditHistoryScreen;
