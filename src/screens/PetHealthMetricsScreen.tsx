import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import MetricBarChart, { type ChartPoint } from '../components/MetricBarChart';
import type { ActivityLevel, HealthMetricEntry } from '../models/HealthMetric';
import {
  activityLevelToScore,
  deleteHealthMetric,
  getHealthMetrics,
  saveHealthMetric,
} from '../services/healthMetricService';
import { updatePet } from '../services/petService';
import wearableService, {
  WEARABLE_PROVIDERS,
  type HistoricalPoint,
  type WearableProviderKey,
  type WearableStatus,
} from '../services/wearableService';
import { useSecureScreen } from '../utils/secureScreen';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChartTab = 'weight' | 'temperature' | 'activity';

interface Props {
  petId: string;
  petName: string;
  /** Current step goal from pet.metadata.stepGoal (optional, defaults to 8000) */
  stepGoal?: number;
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '?';
  return d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

function parseOptionalFloat(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

function historicalToChartPoints(data: HistoricalPoint[]): ChartPoint[] {
  return data.map((p) => ({
    label: shortDateLabel(p.recorded_at),
    value: p.value,
  }));
}

function formatSyncTime(iso?: string): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

/** Device connection badge — shows provider name + sync time, or a CTA */
function DeviceStatusBadge({
  status,
  onSync,
  onConnect,
  syncing,
}: {
  status: WearableStatus;
  onSync: () => void;
  onConnect: () => void;
  syncing: boolean;
}) {
  if (!status.connected) {
    return (
      <View style={badgeStyles.emptyCard}>
        <Text style={badgeStyles.emptyIcon}>📡</Text>
        <Text style={badgeStyles.emptyTitle}>No Wearable Connected</Text>
        <Text style={badgeStyles.emptySubtitle}>
          Connect a device to track steps, heart rate, and sleep.
        </Text>
        <TouchableOpacity
          style={badgeStyles.ctaBtn}
          onPress={onConnect}
          accessibilityRole="button"
          accessibilityLabel="Set up wearable device"
        >
          <Text style={badgeStyles.ctaBtnText}>+ Set Up Wearable</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={badgeStyles.connectedCard}>
      <View style={badgeStyles.connectedLeft}>
        <View style={badgeStyles.dot} />
        <View>
          <Text style={badgeStyles.providerName}>
            {WEARABLE_PROVIDERS.find((provider) => provider.key === status.providerKey)?.name ??
              status.providerKey ??
              'Device'}
          </Text>
          <Text style={badgeStyles.syncTime}>Synced {formatSyncTime(status.lastSync)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[badgeStyles.syncBtn, syncing && badgeStyles.syncBtnDisabled]}
        onPress={onSync}
        disabled={syncing}
        accessibilityRole="button"
        accessibilityLabel="Sync wearable device"
      >
        {syncing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={badgeStyles.syncBtnText}>↻ Sync</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

/** Step goal progress ring (simple horizontal bar) */
function StepsProgressCard({
  steps,
  goal,
  onEditGoal,
}: {
  steps: number;
  goal: number;
  onEditGoal: () => void;
}) {
  const pct = Math.min(steps / goal, 1);
  const achieved = pct >= 1;

  return (
    <View style={metricsStyles.card}>
      <View style={metricsStyles.cardHeader}>
        <Text style={metricsStyles.cardTitle}>🦶 Daily Steps</Text>
        <TouchableOpacity
          onPress={onEditGoal}
          accessibilityRole="button"
          accessibilityLabel="Edit step goal"
        >
          <Text style={metricsStyles.editGoalLink}>Edit goal</Text>
        </TouchableOpacity>
      </View>
      <Text style={metricsStyles.stepsValue}>
        {steps.toLocaleString()}{' '}
        <Text style={metricsStyles.stepsGoal}>/ {goal.toLocaleString()} goal</Text>
      </Text>
      <View style={metricsStyles.progressBar}>
        <View
          style={[
            metricsStyles.progressFill,
            { width: `${Math.round(pct * 100)}%` as any },
            achieved && metricsStyles.progressFillDone,
          ]}
        />
      </View>
      {achieved && <Text style={metricsStyles.goalAchieved}>🎉 Goal achieved!</Text>}
    </View>
  );
}

/** Wearable chart cards for heart rate and sleep */
function WearableChartCard({
  title,
  emoji,
  points,
  color,
  unit,
}: {
  title: string;
  emoji: string;
  points: ChartPoint[];
  color: string;
  unit: string;
}) {
  return (
    <View style={metricsStyles.card}>
      <Text style={metricsStyles.cardTitle}>
        {emoji} {title}
      </Text>
      <Text style={metricsStyles.cardSubtitle}>Last 7 days</Text>
      <MetricBarChart points={points} color={color} unit={unit} height={140} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

const PetHealthMetricsScreen: React.FC<Props> = ({
  petId,
  petName,
  stepGoal: initialStepGoal,
  onBack,
}) => {
  useSecureScreen();

  // --- Existing health metric state ---
  const [entries, setEntries] = useState<HealthMetricEntry[]>([]);
  const [chartTab, setChartTab] = useState<ChartTab>('weight');
  const [modalVisible, setModalVisible] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [tempInput, setTempInput] = useState('');
  const [activity, setActivity] = useState<ActivityLevel | undefined>(undefined);
  const [notesInput, setNotesInput] = useState('');

  // --- Wearable state ---
  const [wearableStatus, setWearableStatus] = useState<WearableStatus>({ connected: false });
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hrPoints, setHrPoints] = useState<ChartPoint[]>([]);
  const [sleepPoints, setSleepPoints] = useState<ChartPoint[]>([]);
  const [todaySteps, setTodaySteps] = useState(0);
  const [stepGoal, setStepGoal] = useState(initialStepGoal ?? 8000);

  // --- Step goal modal ---
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  // --- Connect modal ---
  const [connectModalVisible, setConnectModalVisible] = useState(false);

  // Track if screen is focused to avoid stale requests
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadHealthMetrics = useCallback(async () => {
    const data = await getHealthMetrics(petId);
    if (isMounted.current) setEntries(data);
  }, [petId]);

  const loadWearableData = useCallback(async () => {
    const [status, hrData, sleepData, summary] = await Promise.all([
      wearableService.getWearableStatus(petId),
      wearableService.getHistoricalMetrics(petId, 'heart_rate'),
      wearableService.getHistoricalMetrics(petId, 'sleep_duration'),
      wearableService.getActivitySummary(petId),
    ]);

    if (!isMounted.current) return;

    setWearableStatus(status);
    setHrPoints(historicalToChartPoints(hrData));
    setSleepPoints(historicalToChartPoints(sleepData));

    const stepsRow = summary.find((r) => r.metric_type === 'steps');
    if (stepsRow) {
      setTodaySteps(Math.round(parseFloat(stepsRow.sum) || 0));
    }
  }, [petId]);

  const loadAll = useCallback(async () => {
    await Promise.all([loadHealthMetrics(), loadWearableData()]);
  }, [loadHealthMetrics, loadWearableData]);

  // Initial load
  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // ---------------------------------------------------------------------------
  // Pull-to-refresh
  // ---------------------------------------------------------------------------

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  // ---------------------------------------------------------------------------
  // Wearable actions
  // ---------------------------------------------------------------------------

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await wearableService.syncWearable(petId);
      await loadWearableData();
    } catch (e) {
      Alert.alert('Sync failed', 'Could not sync wearable data. Please try again.');
    } finally {
      if (isMounted.current) setSyncing(false);
    }
  }, [petId, loadWearableData]);

  const handleConnect = useCallback(
    async (providerKey: WearableProviderKey) => {
      try {
        await wearableService.connectWearable(petId, providerKey, `${providerKey}-token`);
        await wearableService.syncWearable(petId, providerKey);
        await loadWearableData();
        setConnectModalVisible(false);
        Alert.alert('Connected!', 'Wearable device linked and initial sync completed.');
      } catch (e) {
        Alert.alert('Connection failed', 'Could not connect device. Please try again.');
      }
    },
    [petId, loadWearableData],
  );

  // ---------------------------------------------------------------------------
  // Step goal
  // ---------------------------------------------------------------------------

  const openGoalModal = useCallback(() => {
    setGoalInput(String(stepGoal));
    setGoalModalVisible(true);
  }, [stepGoal]);

  const handleSaveGoal = useCallback(async () => {
    const parsed = parseInt(goalInput.trim(), 10);
    if (!parsed || parsed < 100 || parsed > 100000) {
      Alert.alert('Invalid goal', 'Please enter a step goal between 100 and 100,000.');
      return;
    }
    setStepGoal(parsed);
    setGoalModalVisible(false);
    try {
      await updatePet(petId, { metadata: { stepGoal: parsed } });
    } catch {
      // persist failure is non-critical; local state is already updated
    }
  }, [petId, goalInput]);

  // ---------------------------------------------------------------------------
  // Existing metric actions
  // ---------------------------------------------------------------------------

  const openAdd = () => {
    setWeightInput('');
    setTempInput('');
    setActivity(undefined);
    setNotesInput('');
    setModalVisible(true);
  };

  const handleSave = async () => {
    const weightKg = parseOptionalFloat(weightInput);
    const temperatureC = parseOptionalFloat(tempInput);
    if (weightKg === undefined && temperatureC === undefined && activity === undefined) {
      Alert.alert('Validation', 'Enter at least weight, temperature, or activity level.');
      return;
    }
    const entry: HealthMetricEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      petId,
      recordedAt: new Date().toISOString(),
      weightKg,
      temperatureC,
      activityLevel: activity,
      notes: notesInput.trim() || undefined,
    };
    await saveHealthMetric(entry);
    setModalVisible(false);
    void loadHealthMetrics();
  };

  const confirmDelete = useCallback(
    (id: string) => {
      Alert.alert('Delete entry', 'Remove this health log?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteHealthMetric(id);
            void loadHealthMetrics();
          },
        },
      ]);
    },
    [loadHealthMetrics],
  );

  // ---------------------------------------------------------------------------
  // Derived chart data
  // ---------------------------------------------------------------------------

  const weightPoints: ChartPoint[] = entries
    .filter((e) => e.weightKg !== undefined && e.weightKg !== null)
    .map((e) => ({ label: shortDateLabel(e.recordedAt), value: e.weightKg as number }));

  const tempPoints: ChartPoint[] = entries
    .filter((e) => e.temperatureC !== undefined && e.temperatureC !== null)
    .map((e) => ({ label: shortDateLabel(e.recordedAt), value: e.temperatureC as number }));

  const activityPoints: ChartPoint[] = entries
    .filter((e) => e.activityLevel)
    .map((e) => ({
      label: shortDateLabel(e.recordedAt),
      value: activityLevelToScore(e.activityLevel) as number,
    }));

  const sortedDesc = [...entries].sort(
    (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
  );

  const renderChart = (): React.ReactElement => {
    if (chartTab === 'weight') {
      return <MetricBarChart points={weightPoints} color="#4CAF50" unit="kg" />;
    }
    if (chartTab === 'temperature') {
      return <MetricBarChart points={tempPoints} color="#2196F3" unit="°C" />;
    }
    return (
      <MetricBarChart
        points={activityPoints}
        color="#FF9800"
        unit="1 = low, 2 = moderate, 3 = high"
      />
    );
  };

  const activityChip = (level: ActivityLevel, label: string) => {
    const on = activity === level;
    return (
      <TouchableOpacity
        key={level}
        style={[styles.chip, on && styles.chipOn]}
        onPress={() => setActivity(on ? undefined : level)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={label}
      >
        <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderMetricItem = useCallback(
    ({ item }: { item: HealthMetricEntry }) => (
      <View style={styles.rowCard}>
        <View style={styles.rowMain}>
          <Text style={styles.rowDate}>{new Date(item.recordedAt).toLocaleString()}</Text>
          <Text style={styles.rowValues}>
            {item.weightKg !== undefined ? `${item.weightKg} kg` : ''}
            {item.weightKg !== undefined && (item.temperatureC !== undefined || item.activityLevel)
              ? ' · '
              : ''}
            {item.temperatureC !== undefined ? `${item.temperatureC} °C` : ''}
            {item.temperatureC !== undefined && item.activityLevel ? ' · ' : ''}
            {item.activityLevel ? `Activity: ${item.activityLevel}` : ''}
          </Text>
          {item.notes ? <Text style={styles.rowNotes}>{item.notes}</Text> : null}
        </View>
        <TouchableOpacity
          onPress={() => confirmDelete(item.id)}
          style={styles.delTouch}
          accessibilityRole="button"
          accessibilityLabel="Delete entry"
        >
          <Text style={styles.delText}>✕</Text>
        </TouchableOpacity>
      </View>
    ),
    [confirmDelete],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const listHeader = (
    <View style={styles.headerBlock}>
      {/* — Existing trends section — */}
      <Text style={styles.sectionTitle}>Trends</Text>
      <View style={styles.tabRow}>
        {(['weight', 'temperature', 'activity'] as ChartTab[]).map((tab, idx) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, idx === 2 && styles.tabLast, chartTab === tab && styles.tabActive]}
            onPress={() => setChartTab(tab)}
            accessibilityRole="button"
            accessibilityState={{ selected: chartTab === tab }}
          >
            <Text style={[styles.tabText, chartTab === tab && styles.tabTextActive]}>
              {tab === 'weight' ? 'Weight' : tab === 'temperature' ? 'Temp' : 'Activity'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.chartCard}>{renderChart()}</View>

      {/* — Wearable Dashboard Section — */}
      <View style={metricsStyles.sectionHeader}>
        <Text style={styles.sectionTitle}>Wearable Device</Text>
      </View>

      <DeviceStatusBadge
        status={wearableStatus}
        onSync={() => void handleSync()}
        onConnect={() => setConnectModalVisible(true)}
        syncing={syncing}
      />

      {wearableStatus.connected && (
        <>
          {/* Steps progress card */}
          <StepsProgressCard steps={todaySteps} goal={stepGoal} onEditGoal={openGoalModal} />

          {/* Heart Rate trend */}
          <WearableChartCard
            title="Heart Rate"
            emoji="❤️"
            points={hrPoints}
            color="#E53935"
            unit="bpm"
          />

          {/* Sleep Duration trend */}
          <WearableChartCard
            title="Sleep Duration"
            emoji="😴"
            points={sleepPoints}
            color="#5C6BC0"
            unit="min"
          />
        </>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>History</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Health · {petName}
        </Text>
        <TouchableOpacity
          onPress={openAdd}
          style={styles.addBtn}
          accessibilityRole="button"
          accessibilityLabel="Add health entry"
        >
          <Text style={styles.addBtnText}>+ Log</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sortedDesc}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        extraData={[chartTab, wearableStatus, hrPoints, sleepPoints, todaySteps, stepGoal]}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <Text style={styles.emptyList}>
            No entries yet. Tap + Log to add weight, temperature, or activity.
          </Text>
        }
        renderItem={renderMetricItem}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor="#4CAF50"
            colors={['#4CAF50']}
          />
        }
      />

      {/* Add Metric Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log health metrics</Text>
            <Text style={styles.modalHint}>At least one field is required.</Text>
            <Text style={styles.inputLabel}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 12.5"
              placeholderTextColor="#aaa"
            />
            <Text style={styles.inputLabel}>Temperature (°C)</Text>
            <TextInput
              style={styles.input}
              value={tempInput}
              onChangeText={setTempInput}
              keyboardType="decimal-pad"
              placeholder="e.g. 38.5"
              placeholderTextColor="#aaa"
            />
            <Text style={styles.inputLabel}>Activity (optional)</Text>
            <View style={styles.chipRow}>
              {activityChip('low', 'Low')}
              {activityChip('moderate', 'Moderate')}
              {activityChip('high', 'High')}
            </View>
            <Text style={styles.inputLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notesInput}
              onChangeText={setNotesInput}
              placeholder="Optional"
              placeholderTextColor="#aaa"
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="save-metric-btn"
                style={styles.saveBtn}
                onPress={() => void handleSave()}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Step Goal Modal */}
      <Modal visible={goalModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Daily Step Goal</Text>
            <Text style={styles.modalHint}>Set a daily steps target for {petName}.</Text>
            <Text style={styles.inputLabel}>Step Goal</Text>
            <TextInput
              style={styles.input}
              value={goalInput}
              onChangeText={setGoalInput}
              keyboardType="number-pad"
              placeholder="e.g. 8000"
              placeholderTextColor="#aaa"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setGoalModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="save-step-goal-btn"
                style={styles.saveBtn}
                onPress={() => void handleSaveGoal()}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Connect Wearable Modal */}
      <Modal visible={connectModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Connect Wearable</Text>
            <Text style={styles.modalHint}>
              Link a wearable device to automatically track activity, heart rate and sleep.
            </Text>
            <View style={connectStyles.providerList}>
              {WEARABLE_PROVIDERS.map((provider) => (
                <TouchableOpacity
                  key={provider.key}
                  style={connectStyles.providerRow}
                  onPress={() => void handleConnect(provider.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Connect ${provider.name} device`}
                >
                  <Text style={connectStyles.providerIcon}>⌚</Text>
                  <View style={connectStyles.providerText}>
                    <Text style={connectStyles.providerName}>{provider.name}</Text>
                    <Text style={connectStyles.providerSub}>{provider.description}</Text>
                  </View>
                  <Text style={connectStyles.providerArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setConnectModalVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 17, color: '#4CAF50' },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  addBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  headerBlock: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 10 },
  tabRow: { flexDirection: 'row', marginBottom: 12 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#e8e8e8',
    alignItems: 'center',
    marginRight: 8,
  },
  tabLast: { marginRight: 0 },
  tabActive: { backgroundColor: '#e8f5e9' },
  tabText: { fontSize: 13, color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#2e7d32' },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyList: { textAlign: 'center', color: '#999', marginTop: 16, fontSize: 14 },
  rowCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  rowMain: { flex: 1 },
  rowDate: { fontSize: 12, color: '#888', marginBottom: 4 },
  rowValues: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  rowNotes: { fontSize: 13, color: '#666', marginTop: 6 },
  delTouch: { padding: 8 },
  delText: { fontSize: 16, color: '#e53935' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  modalHint: { fontSize: 13, color: '#888', marginTop: 4, marginBottom: 12 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1a1a1a',
  },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    marginBottom: 8,
  },
  chipOn: { backgroundColor: '#e8f5e9', borderColor: '#4CAF50' },
  chipText: { fontSize: 14, color: '#555' },
  chipTextOn: { color: '#2e7d32', fontWeight: '700' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  cancelBtnText: { color: '#666', fontSize: 16 },
  saveBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
    marginLeft: 12,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

/** Styles for the DeviceStatusBadge component */
const badgeStyles = StyleSheet.create({
  connectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  connectedLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    marginRight: 10,
  },
  providerName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  syncTime: { fontSize: 12, color: '#888', marginTop: 2 },
  syncBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  syncBtnDisabled: { backgroundColor: '#a5d6a7', opacity: 0.8 },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderStyle: 'dashed',
  },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 6 },
  emptySubtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 19,
  },
  ctaBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  ctaBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

/** Styles for wearable metric cards */
const metricsStyles = StyleSheet.create({
  sectionHeader: { marginTop: 4, marginBottom: 2 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 4 },
  cardSubtitle: { fontSize: 12, color: '#999', marginBottom: 8 },
  stepsValue: { fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 10 },
  stepsGoal: { fontSize: 14, fontWeight: '400', color: '#888' },
  progressBar: {
    height: 10,
    backgroundColor: '#e8e8e8',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 5,
  },
  progressFillDone: { backgroundColor: '#2e7d32' },
  goalAchieved: {
    marginTop: 8,
    fontSize: 13,
    color: '#2e7d32',
    fontWeight: '600',
  },
  editGoalLink: { fontSize: 13, color: '#4CAF50', fontWeight: '600' },
});

/** Styles for the connect wearable modal */
const connectStyles = StyleSheet.create({
  providerList: { marginVertical: 12 },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  providerIcon: { fontSize: 28 },
  providerText: { flex: 1 },
  providerName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  providerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  providerArrow: { marginLeft: 'auto', fontSize: 20, color: '#ccc' },
});

export default PetHealthMetricsScreen;
