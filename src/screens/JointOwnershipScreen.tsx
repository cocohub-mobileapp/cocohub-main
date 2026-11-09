/**
 * JointOwnershipScreen — displays multisig status, co-owners, and pending
 * co-sign requests for a jointly-owned pet.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import multisigService, {
  type JointOwnershipResponse,
  type PendingTransactionResponse,
  type CoOwnerResponse,
} from '../services/multisigService';
import { useTheme } from '../context/ThemeContext';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  petId: string;
  petName: string;
  currentUserId: string;
  currentUserPublicKey?: string;
  onBack: () => void;
  onInviteCoOwner: (jointOwnershipId: string) => void;
  onSignTransaction: (transaction: PendingTransactionResponse) => void;
  onInitiateTransfer: (jointOwnershipId: string) => void;
}

// ─── Status badge helpers ─────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: '#4CAF50',
  pending: '#FF9800',
  revoked: '#9E9E9E',
  approved: '#4CAF50',
  rejected: '#F44336',
  expired: '#9E9E9E',
};

// Build theme-aware status colors
function useStatusColors() {
  const { colors } = useTheme();
  return {
    active: colors.success,
    pending: colors.warning,
    revoked: colors.placeholder,
    approved: colors.success,
    rejected: colors.error,
    expired: colors.placeholder,
  };
}

const OP_LABELS: Record<PendingTransactionResponse['operationType'], string> = {
  ownership_transfer: 'Ownership Transfer',
  record_deletion: 'Record Deletion',
  signer_management: 'Signer Change',
};

const OP_ICONS: Record<PendingTransactionResponse['operationType'], string> = {
  ownership_transfer: '🔑',
  record_deletion: '🗑️',
  signer_management: '👤',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string; colors: Record<string, string> }> = ({ status, colors }) => (
  <View style={[styles.badge, { backgroundColor: colors[status] ?? colors.revoked }]}>
    <Text style={styles.badgeText}>{status.toUpperCase()}</Text>
  </View>
);

const CoOwnerRow: React.FC<{ owner: CoOwnerResponse; statusColors: Record<string, string> }> = ({ owner, statusColors }) => (
  <View style={styles.coOwnerRow}>
    <View style={styles.coOwnerAvatar}>
      <Text style={styles.coOwnerInitial}>{owner.name.charAt(0).toUpperCase()}</Text>
    </View>
    <View style={styles.coOwnerInfo}>
      <Text style={styles.coOwnerName}>{owner.name}</Text>
      <Text style={styles.coOwnerEmail}>{owner.email}</Text>
      <Text style={styles.coOwnerKey} numberOfLines={1}>
        {owner.publicKey.substring(0, 12)}…{owner.publicKey.slice(-6)}
      </Text>
    </View>
    <View style={styles.coOwnerRight}>
      <StatusBadge status={owner.status} colors={statusColors} />
      <Text style={styles.weightLabel}>Weight: {owner.weight}</Text>
    </View>
  </View>
);

const PendingTxCard: React.FC<{
  tx: PendingTransactionResponse;
  currentUserPublicKey?: string;
  statusColors: Record<string, string>;
  themeColors: typeof import('../theme/colors').lightTheme;
  onSign: () => void;
  onReject: () => void;
}> = ({ tx, currentUserPublicKey, statusColors, themeColors, onSign, onReject }) => {
  const userSigner = tx.signers.find((s) => s.publicKey === currentUserPublicKey);
  const canSign = userSigner && !userSigner.hasSigned && tx.status === 'pending';
  const expiresAt = new Date(tx.expiresAt);
  const isExpiringSoon = expiresAt.getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <View style={styles.txCard}>
      <View style={styles.txHeader}>
        <Text style={styles.txIcon}>{OP_ICONS[tx.operationType]}</Text>
        <View style={styles.txHeaderText}>
          <Text style={styles.txOpType}>{OP_LABELS[tx.operationType]}</Text>
          <Text style={styles.txDescription} numberOfLines={2}>
            {tx.description}
          </Text>
        </View>
        <StatusBadge status={tx.status} colors={statusColors} />
      </View>

      {/* Signature progress */}
      <View style={styles.sigProgress}>
        <Text style={styles.sigProgressLabel}>
          Signatures: {tx.currentSignatureCount} / {tx.requiredSignatures} required
        </Text>
        <View style={styles.sigBar}>
          <View
            style={[
              styles.sigBarFill,
              {
                width: `${Math.min(
                  100,
                  (tx.currentSignatureCount / tx.requiredSignatures) * 100,
                )}%`,
                backgroundColor: themeColors.primary,
              },
            ]}
          />
        </View>
      </View>

      {/* Signer list */}
      <View style={styles.signerList}>
        {tx.signers.map((s) => (
          <View key={s.publicKey} style={styles.signerItem}>
            <Text style={s.hasSigned ? [styles.signerSigned, { color: themeColors.success }] : [styles.signerPending, { color: themeColors.warning }]}>
              {s.hasSigned ? '✅' : '⏳'} {s.name ?? `${s.publicKey.substring(0, 8)}…`}
            </Text>
            {s.signedAt && (
              <Text style={styles.signerTime}>{new Date(s.signedAt).toLocaleDateString()}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Expiry */}
      <Text style={[styles.expiryText, isExpiringSoon && styles.expiryWarning]}>
        {tx.status === 'pending'
          ? `Expires: ${expiresAt.toLocaleDateString()} ${expiresAt.toLocaleTimeString()}`
          : `${tx.status.charAt(0).toUpperCase() + tx.status.slice(1)} on ${new Date(tx.createdAt).toLocaleDateString()}`}
      </Text>

      {/* Actions */}
      {canSign && (
        <View style={styles.txActions}>
          <TouchableOpacity style={[styles.rejectBtn, { borderColor: themeColors.error }]} onPress={onReject}>
            <Text style={[styles.rejectBtnText, { color: themeColors.error }]}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.signBtn, { backgroundColor: themeColors.primary }]} onPress={onSign}>
            <Text style={[styles.signBtnText, { color: themeColors.white }]}>Sign & Approve</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const JointOwnershipScreen: React.FC<Props> = ({
  petId,
  petName,
  currentUserId,
  currentUserPublicKey,
  onBack,
  onInviteCoOwner,
  onSignTransaction,
  onInitiateTransfer,
}) => {
  const { colors } = useTheme();
  const statusColors = useStatusColors();
  const [jointOwnership, setJointOwnership] = useState<JointOwnershipResponse | null>(null);
  const [pendingTxs, setPendingTxs] = useState<PendingTransactionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'pending'>('overview');

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const jo = await multisigService.getJointOwnershipByPet(petId);
        setJointOwnership(jo);
        if (jo) {
          const txs = await multisigService.getPendingTransactions(jo.multisigAccountId);
          setPendingTxs(txs);
        }
      } catch {
        Alert.alert('Error', 'Failed to load joint ownership details.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [petId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void load(true);
  }, [load]);

  const handleRejectTx = useCallback(
    (tx: PendingTransactionResponse) => {
      if (!currentUserPublicKey) return;
      Alert.alert('Reject Transaction', `Are you sure you want to reject "${tx.description}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await multisigService.rejectTransaction(tx.id, currentUserPublicKey);
              void load(true);
            } catch {
              Alert.alert('Error', 'Failed to reject transaction.');
            }
          },
        },
      ]);
    },
    [currentUserPublicKey, load],
  );

  const pendingCount = pendingTxs.filter((t) => t.status === 'pending').length;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Joint Ownership</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Pet name */}
      <View style={[styles.petBanner, { backgroundColor: colors.primaryMuted }]}>
        <Text style={styles.petBannerEmoji}>🐾</Text>
        <Text style={[styles.petBannerName, { color: colors.accent }]}>{petName}</Text>
        {jointOwnership && (
          <View style={[styles.multisigBadge, { backgroundColor: colors.info }]}>
            <Text style={[styles.multisigBadgeText, { color: colors.white }]}>⛓ Multisig</Text>
          </View>
        )}
      </View>

      {!jointOwnership ? (
        /* No joint ownership yet */
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🤝</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Joint Ownership</Text>
          <Text style={[styles.emptySubtitle, { color: colors.secondaryText }]}>
            Set up a Stellar multisig account to share ownership of {petName} with co-owners.
            Critical operations will require M-of-N signatures.
          </Text>
        </View>
      ) : (
        <>
          {/* Tabs */}
          <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'overview' && [styles.tabActive, { borderBottomColor: colors.primary }]]}
              onPress={() => setActiveTab('overview')}
            >
              <Text style={[styles.tabText, activeTab === 'overview' && [styles.tabTextActive, { color: colors.primary }]]}>
                Overview
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'pending' && [styles.tabActive, { borderBottomColor: colors.primary }]]}
              onPress={() => setActiveTab('pending')}
            >
              <Text style={[styles.tabText, activeTab === 'pending' && [styles.tabTextActive, { color: colors.primary }]]}>
                Pending {pendingCount > 0 ? `(${pendingCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          >
            {activeTab === 'overview' ? (
              <OverviewTab
                jointOwnership={jointOwnership}
                currentUserId={currentUserId}
                statusColors={statusColors}
                themeColors={colors}
                onInviteCoOwner={() => onInviteCoOwner(jointOwnership.id)}
                onInitiateTransfer={() => onInitiateTransfer(jointOwnership.id)}
              />
            ) : (
              <PendingTab
                transactions={pendingTxs}
                currentUserPublicKey={currentUserPublicKey}
                statusColors={statusColors}
                themeColors={colors}
                onSign={onSignTransaction}
                onReject={handleRejectTx}
              />
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
};

// ─── Overview Tab ─────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{
  jointOwnership: JointOwnershipResponse;
  currentUserId: string;
  statusColors: Record<string, string>;
  themeColors: typeof import('../theme/colors').lightTheme;
  onInviteCoOwner: () => void;
  onInitiateTransfer: () => void;
}> = ({ jointOwnership, statusColors, themeColors, onInviteCoOwner, onInitiateTransfer }) => (
  <View>
    {/* Multisig account info */}
    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
      <Text style={[styles.cardTitle, { color: themeColors.text }]}>Stellar Multisig Account</Text>
      <View style={[styles.row, { borderBottomColor: themeColors.border }]}>
        <Text style={[styles.rowLabel, { color: themeColors.secondaryText }]}>Public Key</Text>
        <Text style={[styles.rowValue, { color: themeColors.text }]} numberOfLines={1}>
          {jointOwnership.multisigPublicKey.substring(0, 12)}…
          {jointOwnership.multisigPublicKey.slice(-6)}
        </Text>
      </View>
      <View style={[styles.row, { borderBottomColor: themeColors.border }]}>
        <Text style={[styles.rowLabel, { color: themeColors.secondaryText }]}>Required Weight</Text>
        <Text style={[styles.rowValue, { color: themeColors.text }]}>
          {jointOwnership.requiredWeight} / {jointOwnership.totalWeight}
        </Text>
      </View>
      <View style={[styles.row, { borderBottomColor: themeColors.border }]}>
        <Text style={[styles.rowLabel, { color: themeColors.secondaryText }]}>Thresholds</Text>
        <Text style={[styles.rowValue, { color: themeColors.text }]}>
          L:{jointOwnership.thresholds.low} M:{jointOwnership.thresholds.medium} H:
          {jointOwnership.thresholds.high}
        </Text>
      </View>
    </View>

    {/* Co-owners */}
    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
      <View style={styles.cardTitleRow}>
        <Text style={[styles.cardTitle, { color: themeColors.text }]}>Co-Owners ({jointOwnership.coOwners.length})</Text>
        <TouchableOpacity style={[styles.inviteBtn, { backgroundColor: themeColors.primaryMuted }]} onPress={onInviteCoOwner}>
          <Text style={[styles.inviteBtnText, { color: themeColors.primary }]}>+ Invite</Text>
        </TouchableOpacity>
      </View>
      {jointOwnership.coOwners.map((owner) => (
        <CoOwnerRow key={owner.publicKey} owner={owner} statusColors={statusColors} />
      ))}
    </View>

    {/* Critical operations */}
    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
      <Text style={[styles.cardTitle, { color: themeColors.text }]}>Critical Operations</Text>
      <Text style={[styles.cardSubtitle, { color: themeColors.secondaryText }]}>
        These actions require {jointOwnership.requiredWeight} of {jointOwnership.totalWeight} weight
        in co-signatures before executing on Stellar.
      </Text>
      <TouchableOpacity style={[styles.criticalBtn, { backgroundColor: themeColors.muted, borderColor: themeColors.border }]} onPress={onInitiateTransfer}>
        <Text style={styles.criticalBtnIcon}>🔑</Text>
        <View style={styles.criticalBtnText}>
          <Text style={[styles.criticalBtnTitle, { color: themeColors.accent }]}>Transfer Ownership</Text>
          <Text style={[styles.criticalBtnSub, { color: themeColors.secondaryText }]}>Requires all co-owner signatures</Text>
        </View>
        <Text style={[styles.chevron, { color: themeColors.placeholder }]}>›</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ─── Pending Tab ──────────────────────────────────────────────────────────────

const PendingTab: React.FC<{
  transactions: PendingTransactionResponse[];
  currentUserPublicKey?: string;
  statusColors: Record<string, string>;
  themeColors: typeof import('../theme/colors').lightTheme;
  onSign: (tx: PendingTransactionResponse) => void;
  onReject: (tx: PendingTransactionResponse) => void;
}> = ({ transactions, currentUserPublicKey, statusColors, themeColors, onSign, onReject }) => {
  if (transactions.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>✅</Text>
        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No Pending Requests</Text>
        <Text style={[styles.emptySubtitle, { color: themeColors.secondaryText }]}>All co-sign requests have been resolved.</Text>
      </View>
    );
  }

  return (
    <View>
      {transactions.map((tx) => (
        <PendingTxCard
          key={tx.id}
          tx={tx}
          currentUserPublicKey={currentUserPublicKey}
          statusColors={statusColors}
          themeColors={themeColors}
          onSign={() => onSign(tx)}
          onReject={() => onReject(tx)}
        />
      ))}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  headerRight: { width: 60 },
  petBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  petBannerEmoji: { fontSize: 20 },
  petBannerName: { fontSize: 16, fontWeight: '700', flex: 1 },
  multisigBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  multisigBadgeText: { fontSize: 11, fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2 },
  tabText: { fontSize: 14 },
  tabTextActive: { fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardSubtitle: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 13 },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: '55%',
    textAlign: 'right',
  },
  badge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  coOwnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  coOwnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  coOwnerInitial: { fontWeight: '700', fontSize: 16 },
  coOwnerInfo: { flex: 1 },
  coOwnerName: { fontSize: 14, fontWeight: '600' },
  coOwnerEmail: { fontSize: 12, marginTop: 1 },
  coOwnerKey: { fontSize: 11, marginTop: 2, fontFamily: 'monospace' },
  coOwnerRight: { alignItems: 'flex-end', gap: 4 },
  weightLabel: { fontSize: 11, marginTop: 4 },
  inviteBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  inviteBtnText: { fontWeight: '600', fontSize: 13 },
  criticalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
  },
  criticalBtnIcon: { fontSize: 22, marginRight: 12 },
  criticalBtnText: { flex: 1 },
  criticalBtnTitle: { fontSize: 14, fontWeight: '700' },
  criticalBtnSub: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 22 },
  txCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  txHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  txIcon: { fontSize: 24, marginRight: 10 },
  txHeaderText: { flex: 1 },
  txOpType: { fontSize: 13, fontWeight: '700' },
  txDescription: { fontSize: 12, marginTop: 2 },
  sigProgress: { marginBottom: 10 },
  sigProgressLabel: { fontSize: 12, marginBottom: 4 },
  sigBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  sigBarFill: { height: '100%', borderRadius: 3 },
  signerList: { marginBottom: 8 },
  signerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  signerSigned: { fontSize: 12 },
  signerPending: { fontSize: 12 },
  signerTime: { fontSize: 11 },
  expiryText: { fontSize: 11, marginBottom: 10 },
  expiryWarning: {},
  txActions: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rejectBtnText: { fontWeight: '600', fontSize: 14 },
  signBtn: {
    flex: 2,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  signBtnText: { fontWeight: '700', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

export default JointOwnershipScreen;
