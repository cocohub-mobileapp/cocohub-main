import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Share,
} from 'react-native';

import HealthScoreChart, {
  type HealthScoreDataPoint,
  type MedicalEvent,
} from '../components/HealthScoreChart';
import { SkeletonCard } from '../components/SkeletonCard';
import WeightChart, { type WeightDataPoint } from '../components/WeightChart';
import { useTheme } from '../context/ThemeContext';
import type { Appointment } from '../models/Appointment';
import { AppointmentStatus } from '../models/Appointment';
import type { HealthMetricEntry } from '../models/HealthMetric';
import type { Medication } from '../models/Medication';
import { getUpcomingAppointments } from '../services/appointmentService';
import breedInsightsService from '../services/breedInsightsService';
import { getHealthMetrics, activityLevelToScore } from '../services/healthMetricService';
import healthScoringServiceV2 from '../services/healthScoringServiceV2';
import type { MedicalRecord } from '../services/medicalRecordService';
import { getMedicalRecords } from '../services/medicalRecordService';
import { getMedications, isMedicationActive } from '../services/medicationService';
import petService from '../services/petService';
import wearableService, {
  type ActivitySummaryRow,
  type WearableStatus,
} from '../services/wearableService';
import { useSecureScreen } from '../utils/secureScreen';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Props {
  petId: string;
  petName: string;
  onBack: () => void;
  onOpenMetrics: () => void;
}

interface DashboardData {
  recentRecords: MedicalRecord[];
  activeMedications: Medication[];
  upcomingAppointments: Appointment[];
  latestMetric: HealthMetricEntry | null;
  healthScore: number | null;
  weightHistory: WeightDataPoint[];
  healthScoreHistory: HealthScoreDataPoint[];
  medicalEvents: MedicalEvent[];
  /** Dynamic vet-recommended weight range from breed data, null if unknown */
  vetWeightRange: { min: number; max: number } | null;
  wearableStatus: WearableStatus;
  wearableSummary: ActivitySummaryRow[];
}

// ─── Health Score Calculation ──────────────────────────────────────────────

/**
 * Computes a 0–100 health score based on:
 *  - Latest temperature proximity to healthy range (38.0–39.2 °C)
 *  - Latest activity level (high = best)
 *  - Whether there are active medications (reduces score slightly)
 */
function computeHealthScore(
  latestMetric: HealthMetricEntry | null,
  activeMedCount: number,
): number | null {
  if (!latestMetric) return null;

  let score = 70; // baseline

  // Temperature component (max ±20 pts)
  if (latestMetric.temperatureC !== undefined) {
    const temp = latestMetric.temperatureC;
    if (temp >= 38.0 && temp <= 39.2) {
      score += 20; // ideal range
    } else if (temp >= 37.5 && temp < 38.0) {
      score += 10; // slightly low
    } else if (temp > 39.2 && temp <= 40.0) {
      score += 5; // slightly elevated
    } else {
      score -= 10; // outside healthy range
    }
  }

  // Activity component (max +10 pts)
  const activityScore = activityLevelToScore(latestMetric.activityLevel);
  if (activityScore !== undefined) {
    score += (activityScore - 1) * 5; // 0, 5, or 10
  }

  // Medication penalty (−3 per active medication, max −15)
  score -= Math.min(activeMedCount * 3, 15);

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return '#2e7d32';
  if (score >= 60) return '#f57f17';
  return '#c62828';
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Fair';
  return 'Needs Attention';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function appointmentTypeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function summaryValue(rows: ActivitySummaryRow[], metricType: string): number {
  const row = rows.find((item) => item.metric_type === metricType);
  return row ? Math.round(Number(row.sum || row.avg || 0)) : 0;
}

function formatMetric(value: number, unit: string): string {
  if (!value) return '--';
  return `${value.toLocaleString()} ${unit}`.trim();
}

// ─── Sub-components ─────────────────────────────────────────────────────────

// Memoized because it receives simple scalar props
const SectionHeader = React.memo(function SectionHeader({
  title,
  icon,
}: {
  title: string;
  icon: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
});

// Note: Card is not memoized because it accepts React.ReactNode children
function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.surface }, style]}>{children}</View>;
}

// Memoized to avoid re-rendering when parent re-renders
const EmptyState = React.memo(function EmptyState({ message }: { message: string }) {
  const { colors } = useTheme();
  return <Text style={[styles.emptyText, { color: colors.placeholder }]}>{message}</Text>;
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

const PetHealthDashboardScreen: React.FC<Props> = ({ petId, petName, onBack, onOpenMetrics }) => {
  useSecureScreen();
  const { colors } = useTheme();

  const [data, setData] = useState<DashboardData>({
    recentRecords: [],
    activeMedications: [],
    upcomingAppointments: [],
    latestMetric: null,
    healthScore: null,
    weightHistory: [],
    healthScoreHistory: [],
    medicalEvents: [],
    vetWeightRange: null,
    wearableStatus: { connected: false },
    wearableSummary: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [
        recordsResp,
        medications,
        appointments,
        metrics,
        scoreHistory,
        pet,
        wearableStatus,
        wearableSummary,
      ] = await Promise.all([
        getMedicalRecords(petId, { limit: 100 }).catch(() => ({
          data: [] as MedicalRecord[],
          total: 0,
          page: 1,
          limit: 100,
          totalPages: 1,
        })),
        getMedications().catch(() => [] as Medication[]),
        getUpcomingAppointments(petId).catch(() => [] as Appointment[]),
        getHealthMetrics(petId).catch(() => [] as HealthMetricEntry[]),
        healthScoringServiceV2
          .getScoreHistory(petId, 365)
          .catch(() => [] as HealthScoreDataPoint[]),
        petService.getPetById(petId).catch(() => null),
        wearableService.getWearableStatus(petId).catch(() => ({ connected: false })),
        wearableService.getActivitySummary(petId).catch(() => [] as ActivitySummaryRow[]),
      ]);

      // Fetch breed-specific weight range if we have breed info
      const vetWeightRange = pet?.breed
        ? await breedInsightsService
            .getPetWeightRange({ breed: pet.breed, species: pet.species })
            .catch(() => null)
        : null;

      const activeMeds = medications.filter((m) => isMedicationActive(m));

      const sortedMetrics = [...metrics].sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      );
      const latestMetric = sortedMetrics[0] ?? null;

      const sortedRecords = [
        ...(Array.isArray(recordsResp.data) ? recordsResp.data : recordsResp.data?.data || []),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const healthScore = computeHealthScore(latestMetric, activeMeds.length);

      // Build weight history from metrics
      const weightHistory: WeightDataPoint[] = sortedMetrics
        .filter((m): m is HealthMetricEntry & { weightKg: number } => m.weightKg !== undefined)
        .map((m) => ({ date: m.recordedAt, weightKg: m.weightKg, note: m.notes }));

      // Build medical events from records for chart annotations
      const medicalEvents: MedicalEvent[] = sortedRecords
        .filter((r) => r.type === 'vaccination' || r.type === 'treatment' || r.type === 'diagnosis')
        .map((r) => ({
          date: r.date,
          type: r.type as 'vaccination' | 'treatment' | 'diagnosis',
          label:
            r.type === 'vaccination'
              ? 'Vaccination'
              : r.type === 'treatment'
                ? 'Treatment'
                : 'Diagnosis',
        }));

      setData({
        recentRecords: sortedRecords.slice(0, 3),
        activeMedications: activeMeds.slice(0, 5),
        upcomingAppointments: appointments
          .filter(
            (a) =>
              a.status !== AppointmentStatus.CANCELLED && a.status !== AppointmentStatus.COMPLETED,
          )
          .slice(0, 3),
        latestMetric,
        healthScore,
        weightHistory,
        healthScoreHistory: scoreHistory,
        medicalEvents,
        vetWeightRange,
        wearableStatus,
        wearableSummary,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [petId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Stabilized with useCallback to prevent re-creating this function on every render,
  // which would cause the RefreshControl to see a new prop unnecessarily
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const handleExportChart = useCallback(async () => {
    try {
      await Share.share({
        message: `${petName}'s weight chart - exported from Cocohub`,
        title: `${petName} Weight Chart`,
      });
    } catch (err) {
      console.error('Failed to share chart:', err);
    }
  }, [petName]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {petName} · Dashboard
          </Text>
          <View style={styles.metricsBtn} />
        </View>
        <View style={{ padding: 16 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} height={80} />
          ))}
        </View>
      </View>
    );
  }

  const {
    recentRecords,
    activeMedications,
    upcomingAppointments,
    latestMetric,
    healthScore,
    healthScoreHistory,
    medicalEvents,
  } = data;
  const wearableSteps = summaryValue(data.wearableSummary, 'steps');
  const wearableSleep = summaryValue(data.wearableSummary, 'sleep_duration');
  const wearableCalories = summaryValue(data.wearableSummary, 'calories');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {petName} · Dashboard
        </Text>
        <TouchableOpacity
          onPress={onOpenMetrics}
          style={[styles.metricsBtn, { backgroundColor: colors.primaryMuted }]}
          accessibilityRole="button"
          accessibilityLabel="Open health metrics"
        >
          <Text style={[styles.metricsBtnText, { color: colors.primary }]}>Metrics</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />
        }
      >
        <SectionHeader title="Health Score" icon="💚" />
        <Card>
          {healthScore !== null ? (
            <View style={styles.scoreRow}>
              <View style={[styles.scoreBadge, { backgroundColor: scoreColor(healthScore) }]}>
                <Text style={styles.scoreNumber}>{healthScore}</Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>
              <View style={styles.scoreDetails}>
                <Text style={[styles.scoreLabel, { color: scoreColor(healthScore) }]}>
                  {scoreLabel(healthScore)}
                </Text>
                {latestMetric && (
                  <Text style={styles.scoreSubtext}>
                    Based on reading from {formatDate(latestMetric.recordedAt)}
                  </Text>
                )}
                <View style={styles.scoreBarBg}>
                  <View
                    style={[
                      styles.scoreBarFill,
                      {
                        width: `${healthScore}%`,
                        backgroundColor: scoreColor(healthScore),
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          ) : (
            <EmptyState message="No health metrics recorded yet. Tap 'Metrics' to log data." />
          )}
        </Card>

        {/* ── Wearable Activity ─────────────────────────────────── */}
        <SectionHeader title="Wearable Activity" icon="⌚" />
        <Card>
          {data.wearableStatus.connected ? (
            <>
              <Text style={styles.listRowSub}>
                Connected to {data.wearableStatus.providerKey ?? 'wearable'}.
              </Text>
              <View style={styles.metricsGrid}>
                <View style={styles.metricTile}>
                  <Text style={styles.metricTileValue}>{formatMetric(wearableSteps, '')}</Text>
                  <Text style={styles.metricTileLabel}>Steps</Text>
                </View>
                <View style={styles.metricTile}>
                  <Text style={styles.metricTileValue}>{formatMetric(wearableSleep, 'min')}</Text>
                  <Text style={styles.metricTileLabel}>Sleep</Text>
                </View>
                <View style={styles.metricTile}>
                  <Text style={styles.metricTileValue}>
                    {formatMetric(wearableCalories, 'kcal')}
                  </Text>
                  <Text style={styles.metricTileLabel}>Calories</Text>
                </View>
              </View>
            </>
          ) : (
            <EmptyState message="No wearable connected. Connect FitBark or Whistle from Settings to sync activity and sleep." />
          )}
        </Card>

        {/* ── Health Score Trend ─────────────────────────────────── */}
        {healthScoreHistory.length > 0 && (
          <>
            <SectionHeader title="Health Score History" icon="📊" />
            <HealthScoreChart
              data={healthScoreHistory}
              medicalEvents={medicalEvents}
              onExport={handleExportChart}
              height={300}
            />
          </>
        )}

        {/* ── Latest Metrics ─────────────────────────────────────── */}
        {latestMetric && (
          <>
            <SectionHeader title="Latest Reading" icon="📊" />
            <Card>
              <View style={styles.metricsGrid}>
                {latestMetric.weightKg !== undefined && (
                  <View style={styles.metricTile}>
                    <Text style={styles.metricTileValue}>{latestMetric.weightKg} kg</Text>
                    <Text style={styles.metricTileLabel}>Weight</Text>
                  </View>
                )}
                {latestMetric.temperatureC !== undefined && (
                  <View style={styles.metricTile}>
                    <Text style={styles.metricTileValue}>{latestMetric.temperatureC} °C</Text>
                    <Text style={styles.metricTileLabel}>Temp</Text>
                  </View>
                )}
                {latestMetric.activityLevel && (
                  <View style={styles.metricTile}>
                    <Text style={styles.metricTileValue}>
                      {latestMetric.activityLevel.charAt(0).toUpperCase() +
                        latestMetric.activityLevel.slice(1)}
                    </Text>
                    <Text style={styles.metricTileLabel}>Activity</Text>
                  </View>
                )}
              </View>
            </Card>
          </>
        )}

        {/* ── Weight & Growth Chart ──────────────────────────────── */}
        {data.weightHistory.length > 0 && (
          <>
            <SectionHeader title="Weight & Growth" icon="📈" />
            <WeightChart
              data={data.weightHistory}
              petName={petName}
              vetRecommendedRange={data.vetWeightRange ?? undefined}
              onExport={handleExportChart}
              height={300}
            />
          </>
        )}

        {/* ── Upcoming Appointments ──────────────────────────────── */}
        <SectionHeader title="Upcoming Appointments" icon="📅" />
        <Card>
          {upcomingAppointments.length > 0 ? (
            upcomingAppointments.map((appt, idx) => (
              <View
                key={appt.id}
                style={[
                  styles.listRow,
                  idx < upcomingAppointments.length - 1 && styles.listRowBorder,
                ]}
              >
                <View style={styles.apptDot} />
                <View style={styles.listRowContent}>
                  <Text style={styles.listRowTitle}>{appointmentTypeLabel(appt.type)}</Text>
                  <Text style={styles.listRowSub}>
                    {formatDate(appt.date)} at {appt.time}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      appt.status === AppointmentStatus.CONFIRMED && styles.statusConfirmed,
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>{appt.status}</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <EmptyState message="No upcoming appointments scheduled." />
          )}
        </Card>

        {/* ── Active Medications ─────────────────────────────────── */}
        <SectionHeader title="Active Medications" icon="💊" />
        <Card>
          {activeMedications.length > 0 ? (
            activeMedications.map((med, idx) => (
              <View
                key={med.id}
                style={[styles.listRow, idx < activeMedications.length - 1 && styles.listRowBorder]}
              >
                <View style={styles.medDot} />
                <View style={styles.listRowContent}>
                  <Text style={styles.listRowTitle}>{med.name}</Text>
                  {med.dosage ? <Text style={styles.listRowSub}>Dosage: {med.dosage}</Text> : null}
                  {med.endDate ? (
                    <Text style={styles.listRowSub}>Until {formatDate(med.endDate)}</Text>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <EmptyState message="No active medications." />
          )}
        </Card>

        {/* ── Recent Medical Records ─────────────────────────────── */}
        <SectionHeader title="Recent Medical Records" icon="📋" />
        <Card>
          {recentRecords.length > 0 ? (
            recentRecords.map((rec, idx) => (
              <View
                key={rec.id}
                style={[styles.listRow, idx < recentRecords.length - 1 && styles.listRowBorder]}
              >
                <View style={styles.recDot} />
                <View style={styles.listRowContent}>
                  <Text style={styles.listRowTitle}>
                    {rec.type.charAt(0).toUpperCase() + rec.type.slice(1)}
                  </Text>
                  {rec.notes ? (
                    <Text style={styles.listRowSub} numberOfLines={2}>
                      {rec.notes}
                    </Text>
                  ) : null}
                  <Text style={styles.listRowDate}>{formatDate(rec.createdAt)}</Text>
                </View>
              </View>
            ))
          ) : (
            <EmptyState message="No medical records found." />
          )}
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 17 },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  metricsBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  metricsBtnText: { fontWeight: '700', fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  sectionIcon: { fontSize: 18, marginRight: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  card: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    backgroundColor: 'transparent', // set inline via colors.surface
  },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  scoreBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  scoreNumber: { fontSize: 28, fontWeight: '800', color: '#fff' },
  scoreMax: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: -4 },
  scoreDetails: { flex: 1 },
  scoreLabel: { fontSize: 18, fontWeight: '700' },
  scoreSubtext: { fontSize: 12, marginTop: 2, marginBottom: 8 },
  scoreBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  scoreBarFill: { height: 8, borderRadius: 4 },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  metricTile: { alignItems: 'center', paddingHorizontal: 8 },
  metricTileValue: { fontSize: 18, fontWeight: '700' },
  metricTileLabel: { fontSize: 12, marginTop: 2 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10 },
  listRowBorder: { borderBottomWidth: 1 },
  listRowContent: { flex: 1 },
  listRowTitle: { fontSize: 14, fontWeight: '600' },
  listRowSub: { fontSize: 13, marginTop: 2 },
  listRowDate: { fontSize: 12, marginTop: 4 },
  apptDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1565c0',
    marginTop: 4,
    marginRight: 12,
  },
  medDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6a1b9a',
    marginTop: 4,
    marginRight: 12,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2e7d32',
    marginTop: 4,
    marginRight: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusConfirmed: { backgroundColor: '#e8f5e9' },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
});

export default PetHealthDashboardScreen;
