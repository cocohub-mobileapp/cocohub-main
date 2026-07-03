import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  applyReferralCode,
  getReferralStats,
  type ReferralStats,
} from '../services/referralService';
import { useSecureScreen } from '../utils/secureScreen';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Unlock annual discount after this many successful referrals. */
const MILESTONE_TARGET = 5;
const REFERRAL_LINK_BASE = 'https://cocohub.app/join?ref=';

// ─── Component ────────────────────────────────────────────────────────────────

const ReferralScreen: React.FC = () => {
  useSecureScreen();

  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadStats = useCallback(async () => {
    const next = await getReferralStats();
    setStats(next);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadStats();
      } catch (error) {
        Alert.alert(
          'Referrals unavailable',
          error instanceof Error ? error.message : 'Unable to load referral stats.',
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [loadStats]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadStats();
    } finally {
      setRefreshing(false);
    }
  };

  const shareCode = async () => {
    if (!stats?.code) return;
    const referralLink = `${REFERRAL_LINK_BASE}${stats.code}`;
    await Share.share({
      title: 'Join Cocohub',
      message: `Join me on Cocohub — the smartest pet health app! Use my referral link to get started:\n${referralLink}`,
      url: referralLink,
    });
  };

  const submitCode = async () => {
    if (!codeInput.trim()) {
      Alert.alert('Referral code', 'Enter a referral code first.');
      return;
    }

    setSubmitting(true);
    try {
      await applyReferralCode(codeInput.trim());
      setCodeInput('');
      await loadStats();
      Alert.alert('Referral applied', 'Your referral code was saved.');
    } catch (error) {
      Alert.alert(
        'Referral not applied',
        error instanceof Error ? error.message : 'Unable to apply this referral code.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#4CAF50" />
      </View>
    );
  }

  const successfulCount = stats?.successfulConversions ?? 0;
  const pendingCount = stats?.pendingConversions ?? 0;
  const milestoneProgress = Math.min(successfulCount, MILESTONE_TARGET);
  const milestonePercent = (milestoneProgress / MILESTONE_TARGET) * 100;
  const milestoneReached = successfulCount >= MILESTONE_TARGET;

  const successfulReferrals = stats?.referrals.filter((r) => r.status === 'converted') ?? [];
  const pendingReferrals = stats?.referrals.filter((r) => r.status === 'pending') ?? [];

  function formatJoinedAgo(signupAt: string): string {
    const diffMs = Date.now() - new Date(signupAt).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    return `${diffDays} days ago`;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
    >
      <Text style={styles.heading}>Referrals</Text>

      {/* ── Total rewards summary ── */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryBox, styles.summaryBoxFirst]}>
          <Text style={styles.summaryValue}>{successfulCount}</Text>
          <Text style={styles.summaryLabel}>Converted</Text>
        </View>
        <View style={[styles.summaryBox, styles.summaryBoxFirst]}>
          <Text style={styles.summaryValue}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={[styles.summaryValue, styles.summaryValueGreen]}>
            {stats?.availablePremiumDays ?? 0}
          </Text>
          <Text style={styles.summaryLabel}>Premium days</Text>
        </View>
      </View>

      {/* ── Milestone progress bar ── */}
      <View style={styles.card}>
        <View style={styles.milestoneHeader}>
          <Text style={styles.sectionTitle}>🏆 Milestone Progress</Text>
          {milestoneReached && (
            <View style={styles.milestoneBadge}>
              <Text style={styles.milestoneBadgeText}>Unlocked!</Text>
            </View>
          )}
        </View>
        <Text style={styles.milestoneDesc}>
          {milestoneReached
            ? "You've unlocked the annual plan discount!"
            : `${milestoneProgress} of ${MILESTONE_TARGET} referrals to unlock annual plan discount`}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${milestonePercent}%` }]} />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.progressLabelText}>{milestoneProgress}</Text>
          <Text style={styles.progressLabelText}>{MILESTONE_TARGET}</Text>
        </View>
      </View>

      {/* ── Your code + share button ── */}
      <View style={styles.card}>
        <Text style={styles.label}>Your referral code</Text>
        <Text style={styles.code}>{stats?.code ?? 'Unavailable'}</Text>
        {stats?.code && (
          <Text style={styles.referralLink} numberOfLines={1}>
            {REFERRAL_LINK_BASE}{stats.code}
          </Text>
        )}
        <TouchableOpacity style={styles.primaryButton} onPress={() => void shareCode()}>
          <Text style={styles.primaryButtonText}>🔗 Share Referral Link</Text>
        </TouchableOpacity>
      </View>

      {/* ── Successful referrals list ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          ✅ Successful Referrals ({successfulReferrals.length})
        </Text>
        {successfulReferrals.length > 0 ? (
          successfulReferrals.slice(0, 10).map((referral) => (
            <View key={referral.id} style={styles.referralRow}>
              <View style={styles.referralAvatar}>
                <Text style={styles.referralAvatarText}>
                  {referral.referredUserId.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.referralInfo}>
                <Text style={styles.referralName}>
                  User {referral.referredUserId.slice(-6)}
                </Text>
                <Text style={styles.referralDate}>
                  joined {formatJoinedAgo(referral.signupAt)}
                </Text>
              </View>
              <View style={styles.rewardBadge}>
                <Text style={styles.rewardBadgeText}>+1 month Premium</Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No successful referrals yet — share your link!</Text>
        )}
      </View>

      {/* ── Pending referrals ── */}
      {pendingCount > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>⏳ Pending Referrals</Text>
          <Text style={styles.pendingDesc}>
            {pendingCount} {pendingCount === 1 ? 'person has' : 'people have'} clicked your link
            but not signed up yet.
          </Text>
          {pendingReferrals.slice(0, 5).map((referral) => (
            <View key={referral.id} style={styles.pendingRow}>
              <Text style={styles.pendingId}>Pending user · {formatJoinedAgo(referral.signupAt)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Apply a code ── */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Apply a Code</Text>
        <TextInput
          style={styles.input}
          placeholder="Referral code"
          autoCapitalize="characters"
          value={codeInput}
          onChangeText={setCodeInput}
        />
        <TouchableOpacity
          style={[styles.secondaryButton, submitting && styles.disabledButton]}
          onPress={() => void submitCode()}
          disabled={submitting}
        >
          <Text style={styles.secondaryButtonText}>
            {submitting ? 'Applying...' : 'Apply Code'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 18, paddingBottom: 36 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 16, color: '#111' },

  // Summary row
  summaryRow: { flexDirection: 'row', marginBottom: 14, gap: 10 },
  summaryBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 14,
    alignItems: 'center',
  },
  summaryBoxFirst: {},
  summaryValue: { color: '#111', fontWeight: '800', fontSize: 24, marginBottom: 2 },
  summaryValueGreen: { color: '#2f855a' },
  summaryLabel: { color: '#666', fontSize: 11, textAlign: 'center' },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#eee',
  },

  // Milestone
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  milestoneBadge: {
    backgroundColor: '#c6f6d5',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  milestoneBadgeText: { fontSize: 11, fontWeight: '700', color: '#276749' },
  milestoneDesc: { fontSize: 13, color: '#555', marginBottom: 10 },
  progressTrack: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: '#4CAF50', borderRadius: 4 },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressLabelText: { fontSize: 11, color: '#718096' },

  // Code card
  label: { color: '#666', fontSize: 13, marginBottom: 6 },
  code: { color: '#111', fontSize: 28, fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
  referralLink: { fontSize: 12, color: '#4CAF50', marginBottom: 14 },
  primaryButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Section title
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, color: '#333' },

  // Referral rows
  referralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 10,
  },
  referralAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  referralAvatarText: { fontSize: 14, fontWeight: '700', color: '#4a5568' },
  referralInfo: { flex: 1 },
  referralName: { fontSize: 14, fontWeight: '600', color: '#111' },
  referralDate: { fontSize: 12, color: '#777', marginTop: 1 },
  rewardBadge: {
    backgroundColor: '#f0fff4',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#c6f6d5',
  },
  rewardBadgeText: { fontSize: 11, fontWeight: '600', color: '#276749' },

  // Pending
  pendingDesc: { fontSize: 13, color: '#555', marginBottom: 8 },
  pendingRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  pendingId: { fontSize: 13, color: '#718096' },

  // Apply code
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabledButton: { opacity: 0.6 },
  secondaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  emptyText: { color: '#666', fontSize: 14 },
});

export default ReferralScreen;
