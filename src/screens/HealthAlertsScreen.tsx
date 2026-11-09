import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SkeletonCard } from '../components/SkeletonCard';
import { useTheme } from '../context/ThemeContext';
import { useMinimumLoadingTime } from '../hooks/useMinimumLoadingTime';
import {
  dismissHealthAlert,
  getHealthAlerts,
  runDailyHealthPredictions,
  type HealthAlertFeedback,
  type HealthPredictionAlert,
} from '../services/healthAlertService';
import { useSecureScreen } from '../utils/secureScreen';

function formatDate(iso: string): string {
  const date = new Date(iso);
  return isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function riskPercent(alert: HealthPredictionAlert): string {
  return `${Math.round(alert.riskScore * 100)}%`;
}

function riskColor(level: HealthPredictionAlert['riskLevel']): string {
  switch (level) {
    case 'critical': return '#B71C1C';
    case 'high':     return '#E53935';
    case 'medium':   return '#F57C00';
    case 'low':      return '#F9A825';
    default:         return '#388E3C';
  }
}

const feedbackOptions: Array<{ label: string; value: HealthAlertFeedback }> = [
  { label: 'Helpful', value: 'helpful' },
  { label: 'Known', value: 'already_known' },
  { label: 'False alarm', value: 'false_alarm' },
];

const HealthAlertsScreen: React.FC = () => {
  useSecureScreen();
  const { colors } = useTheme();

  const [alerts, setAlerts] = useState<HealthPredictionAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayLoading = useMinimumLoadingTime(loading, { minLoadingTime: 300 });

  const load = useCallback(async () => {
    try {
      setError(null);
      const next = await getHealthAlerts('active');
      setAlerts(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load health alerts.');
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  const runPredictions = async () => {
    setRunning(true);
    try {
      await runDailyHealthPredictions();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to run predictions.');
    } finally {
      setRunning(false);
    }
  };

  const dismiss = async (id: string, feedback: HealthAlertFeedback) => {
    try {
      await dismissHealthAlert(id, feedback);
      setAlerts((cur) => cur.filter((a) => a.id !== id));
    } catch {
      setError('Unable to dismiss this alert.');
    }
  };

  if (displayLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.headerRow, { padding: 18 }]}>
          <Text style={[styles.heading, { color: colors.text }]}>Health Alerts</Text>
        </View>
        <View style={{ paddingHorizontal: 18 }}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} height={100} />)}
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.heading, { color: colors.text }]}>Health Alerts</Text>
        <TouchableOpacity
          style={[styles.runButton, { backgroundColor: colors.primary }, running && styles.disabledButton]}
          onPress={() => void runPredictions()}
          disabled={running}
        >
          <Text style={styles.runButtonText}>{running ? 'Running…' : '▶ Run'}</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={[styles.errorCard, { backgroundColor: colors.surface }]}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity onPress={() => void load()} style={[styles.runButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.runButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!error && alerts.length ? (
        alerts.map((alert) => {
          const badgeColor = riskColor(alert.riskLevel);
          return (
            <View key={alert.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.riskBadge, { backgroundColor: badgeColor }]}>
                  <Text style={styles.riskValue}>{riskPercent(alert)}</Text>
                  <Text style={styles.riskLabel}>{alert.riskLevel}</Text>
                </View>
                <View style={styles.alertTitleWrap}>
                  <Text style={[styles.alertTitle, { color: colors.text }]}>{alert.predictedIssue}</Text>
                  <Text style={[styles.alertDate, { color: colors.secondaryText }]}>Generated {formatDate(alert.createdAt)}</Text>
                </View>
              </View>

              <Text style={[styles.sectionLabel, { color: colors.secondaryText }]}>Contributing factors</Text>
              <View style={styles.factorList}>
                {alert.contributingFactors.map((factor) => (
                  <Text key={factor} style={[styles.factorChip, { backgroundColor: colors.muted, color: colors.text }]}>{factor}</Text>
                ))}
              </View>

              <Text style={[styles.modelText, { color: colors.placeholder }]}>Model {alert.modelVersion}</Text>

              <View style={styles.feedbackRow}>
                {feedbackOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.feedbackButton, { backgroundColor: colors.card }]}
                    onPress={() => void dismiss(alert.id, option.value)}
                  >
                    <Text style={[styles.feedbackButtonText, { color: colors.text }]}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })
      ) : (
        !error && (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>🐾</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No active alerts</Text>
            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
              Daily predictions will appear here when vitals indicate elevated risk.
            </Text>
          </View>
        )
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 36 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorCard: {
    borderRadius: 10, padding: 16, marginBottom: 14,
    borderWidth: 1, alignItems: 'center',
  },
  errorText: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heading: { fontSize: 22, fontWeight: '700' },
  runButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  disabledButton: { opacity: 0.6 },
  runButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  card: {
    borderRadius: 10, padding: 16, marginBottom: 14, borderWidth: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  riskBadge: {
    width: 70, height: 70, borderRadius: 35,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  riskValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  riskLabel: { color: '#fff', fontSize: 11, textTransform: 'uppercase', marginTop: 2 },
  alertTitleWrap: { flex: 1 },
  alertTitle: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  alertDate: { fontSize: 12, marginTop: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  factorList: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  factorChip: {
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    fontSize: 12, marginRight: 8, marginBottom: 8,
  },
  feedbackButton: {
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
  },
  feedbackButtonText: { fontSize: 12, fontWeight: '700' },
  emptyCard: {
    borderRadius: 10, padding: 20, borderWidth: 1,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptyText: { fontSize: 14, lineHeight: 20 },
});

export default HealthAlertsScreen;
