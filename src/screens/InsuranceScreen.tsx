import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppTheme } from '../theme';
import {
  getClaims,
  getPolicies,
  submitClaim,
  type ClaimStatus,
  type InsuranceClaim,
  type InsurancePolicy,
} from '../services/claimsService';

const STATUS_LABELS: Record<ClaimStatus, { label: string; color: string }> = {
  submitted: { label: 'Submitted', color: '#3B82F6' },
  under_review: { label: 'Under Review', color: '#F59E0B' },
  approved: { label: 'Approved', color: '#10B981' },
  denied: { label: 'Denied', color: '#EF4444' },
};

export default function InsuranceScreen() {
  const colors = useAppTheme();
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<string>('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimDesc, setClaimDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [policyData, claimData] = await Promise.all([getPolicies(), getClaims()]);
      setPolicies(policyData);
      setClaims(claimData);
      if (policyData.length > 0) setSelectedPolicy(policyData[0].id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load insurance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmitClaim = async () => {
    if (!selectedPolicy || !claimAmount || !claimDesc.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    const amount = parseFloat(claimAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid claim amount.');
      return;
    }

    setSubmitting(true);
    try {
      await submitClaim({
        policyId: selectedPolicy,
        amount,
        description: claimDesc.trim(),
      });
      Alert.alert('Claim Submitted', 'Your claim has been submitted for review.');
      setShowClaimForm(false);
      setClaimAmount('');
      setClaimDesc('');
      await loadData();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit claim.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={loadData}
        >
          <Text style={[styles.retryBtnText, { color: colors.white }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={claims}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            {/* Policies */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>My Policies</Text>
            {policies.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ color: colors.placeholder }}>No policies connected.</Text>
              </View>
            ) : (
              policies.map((p) => (
                <View key={p.id} style={[styles.policyCard, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow }]}>
                  <Text style={[styles.policyName, { color: colors.text }]}>{p.provider}</Text>
                  <Text style={[styles.policyNumber, { color: colors.secondaryText }]}>#{p.policyNumber}</Text>
                  <View style={styles.policyRow}>
                    <Text style={[styles.policyDetail, { color: colors.secondaryText }]}>
                      Coverage: ${p.coverageLimit.toLocaleString()}
                    </Text>
                    <Text style={[styles.policyDetail, { color: colors.secondaryText }]}>
                      Deductible: ${p.deductible}
                    </Text>
                  </View>
                </View>
              ))
            )}

            {/* Actions + Claims Header */}
            <View style={styles.headerRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Claims</Text>
              {policies.length > 0 && (
                <TouchableOpacity
                  style={[styles.fileBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setShowClaimForm(true)}
                >
                  <Text style={[styles.fileBtnText, { color: colors.white }]}>+ File Claim</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.placeholder }]}>No claims filed yet.</Text>
        }
        renderItem={({ item }) => {
          const status = STATUS_LABELS[item.status];
          return (
            <View style={[styles.claimCard, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow }]}>
              <View style={styles.claimHeader}>
                <Text style={[styles.claimAmount, { color: colors.text }]}>${item.amount.toFixed(2)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: status.color + '20', borderColor: status.color }]}>
                  <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>
              <Text style={[styles.claimDesc, { color: colors.secondaryText }]} numberOfLines={2}>{item.description}</Text>
              <Text style={[styles.claimDate, { color: colors.placeholder }]}>
                Submitted: {new Date(item.submittedAt).toLocaleDateString()}
              </Text>
            </View>
          );
        }}
        contentContainerStyle={styles.list}
        refreshing={loading}
        onRefresh={loadData}
      />

      {/* Claim Form Modal */}
      <Modal visible={showClaimForm} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>File a Claim</Text>

            <Text style={[styles.label, { color: colors.secondaryText }]}>Policy</Text>
            <ScrollView horizontal style={styles.policyPicker}>
              {policies.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.policyChip,
                    {
                      backgroundColor: selectedPolicy === p.id ? colors.primary : colors.muted,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setSelectedPolicy(p.id)}
                >
                  <Text style={{ color: selectedPolicy === p.id ? colors.white : colors.text, fontSize: 13, fontWeight: '600' }}>
                    {p.provider}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.label, { color: colors.secondaryText }]}>Amount ($)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              placeholder="0.00"
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
              value={claimAmount}
              onChangeText={setClaimAmount}
            />

            <Text style={[styles.label, { color: colors.secondaryText }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.descInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              placeholder="Describe the claim..."
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={3}
              value={claimDesc}
              onChangeText={setClaimDesc}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowClaimForm(false)}
                disabled={submitting}
              >
                <Text style={{ color: colors.secondaryText }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
                onPress={handleSubmitClaim}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={{ color: colors.white, fontWeight: '700' }}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  list: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fileBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  fileBtnText: { fontSize: 14, fontWeight: '700' },
  emptyCard: { borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, marginBottom: 12 },
  emptyText: { textAlign: 'center', paddingTop: 24 },
  errorText: { fontSize: 14 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryBtnText: { fontSize: 14, fontWeight: '700' },
  policyCard: { borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  policyName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  policyNumber: { fontSize: 13, marginBottom: 6 },
  policyRow: { flexDirection: 'row', gap: 16 },
  policyDetail: { fontSize: 12 },
  claimCard: { borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  claimHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  claimAmount: { fontSize: 18, fontWeight: '700' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  statusText: { fontSize: 11, fontWeight: '700' },
  claimDesc: { fontSize: 13, marginBottom: 6, lineHeight: 18 },
  claimDate: { fontSize: 11 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 15, marginBottom: 4 },
  descInput: { minHeight: 80, textAlignVertical: 'top' },
  policyPicker: { marginBottom: 4 },
  policyChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  submitBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
});
