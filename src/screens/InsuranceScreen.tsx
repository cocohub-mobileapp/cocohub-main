import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  connectProvider,
  getClaims,
  getPolicies,
  submitClaim,
  type ClaimStatus,
  type InsuranceClaim,
  type InsurancePolicy,
} from '../services/claimsService';
import { generateInsuranceClaimSummary, shareCertificate } from '../services/pdfService';

type Screen = 'policies' | 'claims' | 'newClaim';

const STATUS_COLOR: Record<ClaimStatus, string> = {
  submitted: '#ecc94b',
  under_review: '#4299e1',
  approved: '#48bb78',
  denied: '#e53e3e',
};

const TIMELINE_STEPS: { status: ClaimStatus; label: string }[] = [
  { status: 'submitted', label: 'Submitted' },
  { status: 'under_review', label: 'Under Review' },
  { status: 'approved', label: 'Approved' },
];

const STATUS_ORDER: ClaimStatus[] = ['submitted', 'under_review', 'approved'];

/** Claims have no per-step timestamps, so derive a best-effort timeline from
 * the claim's submittedAt/updatedAt and current status. */
function buildTimeline(claim: InsuranceClaim) {
  const currentIndex = STATUS_ORDER.indexOf(
    claim.status === 'denied' ? 'under_review' : claim.status,
  );
  return TIMELINE_STEPS.map((step, i) => {
    const stepIndex = STATUS_ORDER.indexOf(step.status);
    const reached = claim.status === 'denied' ? stepIndex <= 1 : stepIndex <= currentIndex;
    const isCurrent = claim.status !== 'denied' && stepIndex === currentIndex;
    return {
      ...step,
      reached,
      isCurrent,
      date: reached ? (i === 0 ? claim.submittedAt : claim.updatedAt) : null,
    };
  });
}

function expectedCompletionDate(claim: InsuranceClaim): string {
  const submitted = new Date(claim.submittedAt);
  submitted.setDate(submitted.getDate() + 14);
  return submitted.toLocaleDateString();
}

function buildAppealMailto(claim: InsuranceClaim): string {
  const subject = encodeURIComponent(
    `Appeal for denied claim #${claim.id.slice(0, 8).toUpperCase()}`,
  );
  const body = encodeURIComponent(
    `Hello,\n\nI would like to appeal the denial of my insurance claim #${claim.id
      .slice(0, 8)
      .toUpperCase()} for "${claim.description}" (amount: $${claim.amount}).\n\nPlease review my case.\n\nThank you.`,
  );
  return `mailto:claims-appeals@cocohub.app?subject=${subject}&body=${body}`;
}

function parseAttachmentUrls(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

const InsuranceScreen: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('policies');
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaimsData] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimDetail, setClaimDetail] = useState<InsuranceClaim | null>(null);

  // New claim form
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentInput, setAttachmentInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [exportingClaimId, setExportingClaimId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([getPolicies(), getClaims()]);
      setPolicies(p);
      setClaimsData(c);
    } catch {
      Alert.alert('Error', 'Failed to load insurance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConnect = useCallback(() => {
    Alert.prompt(
      'Connect Insurance',
      'Enter your Trupanion or Nationwide OAuth code:',
      async (code) => {
        if (!code) return;
        try {
          const policy = await connectProvider('mock', code);
          setPolicies((prev) => [...prev, policy]);
          Alert.alert('Connected', `Policy ${policy.policyNumber} linked.`);
        } catch {
          Alert.alert('Error', 'Failed to connect provider');
        }
      },
    );
  }, []);

  const handleSubmitClaim = useCallback(async () => {
    if (!selectedPolicyId || !amount || !description) {
      Alert.alert('Validation', 'Please fill all fields');
      return;
    }
    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Validation', 'Enter a valid claim amount');
      return;
    }
    const attachmentUrls = parseAttachmentUrls(attachmentInput);
    setSubmitting(true);
    try {
      const claim = await submitClaim({
        policyId: selectedPolicyId,
        amount: parsedAmount,
        description,
        attachmentUrls,
      });
      setClaimsData((prev) => [claim, ...prev]);
      setAmount('');
      setDescription('');
      setAttachmentInput('');
      Alert.alert('Submitted', `Claim #${claim.id.slice(0, 8)} submitted.`);
      setScreen('claims');
    } catch {
      Alert.alert('Error', 'Failed to submit claim');
    } finally {
      setSubmitting(false);
    }
  }, [selectedPolicyId, amount, description, attachmentInput]);

  const handleExportClaimSummary = useCallback(async (claim: InsuranceClaim) => {
    setExportingClaimId(claim.id);
    try {
      const summary = await generateInsuranceClaimSummary(claim);
      await shareCertificate(summary.filePath);
    } catch {
      Alert.alert('Error', 'Could not export claim summary');
    } finally {
      setExportingClaimId(null);
    }
  }, []);

  if (loading) return <ActivityIndicator style={styles.loader} size="large" color="#4299e1" />;

  // ─── Policies ─────────────────────────────────────────────────────────────
  if (screen === 'policies') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Pet Insurance</Text>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, styles.tabActive]}
            onPress={() => setScreen('policies')}
          >
            <Text style={styles.tabTextActive}>Policies</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab} onPress={() => setScreen('claims')}>
            <Text style={styles.tabText}>Claims</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={policies}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.provider.toUpperCase()}</Text>
              <Text style={styles.cardSub}>Policy: {item.policyNumber}</Text>
              <Text style={styles.cardSub}>Coverage: ${item.coverageLimit.toLocaleString()}</Text>
              <Text style={styles.cardSub}>Deductible: ${item.deductible}</Text>
              <Text style={styles.cardSub}>Premium: ${item.premium}/mo</Text>
              <Text style={styles.cardSub}>
                Expires: {new Date(item.expiresAt).toLocaleDateString()}
              </Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: item.status === 'active' ? '#c6f6d5' : '#fed7d7' },
                ]}
              >
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No policies linked yet.</Text>}
        />

        <TouchableOpacity
          style={styles.btn}
          onPress={handleConnect}
          accessibilityLabel="Connect insurance provider"
        >
          <Text style={styles.btnText}>+ Connect Provider</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Claims ───────────────────────────────────────────────────────────────
  if (screen === 'claims') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Pet Insurance</Text>
        <View style={styles.tabs}>
          <TouchableOpacity style={styles.tab} onPress={() => setScreen('policies')}>
            <Text style={styles.tabText}>Policies</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, styles.tabActive]}
            onPress={() => setScreen('claims')}
          >
            <Text style={styles.tabTextActive}>Claims</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={claims}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setClaimDetail(item)}
              accessibilityLabel={`View timeline for claim ${item.id.slice(0, 8)}`}
            >
              <Text style={styles.cardTitle}>#{item.id.slice(0, 8).toUpperCase()}</Text>
              <Text style={styles.cardSub}>{item.description}</Text>
              <Text style={styles.cardSub}>Amount: ${item.amount}</Text>
              {item.attachmentUrls.length > 0 && (
                <Text style={styles.cardSub}>Attachments: {item.attachmentUrls.length}</Text>
              )}
              <Text style={styles.cardSub}>
                Submitted: {new Date(item.submittedAt).toLocaleDateString()}
              </Text>
              <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] + '33' }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] }]}>
                  {item.status.replace('_', ' ')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No claims yet.</Text>}
        />

        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            setSelectedPolicyId(policies[0]?.id ?? '');
            setScreen('newClaim');
          }}
          accessibilityLabel="Submit new claim"
        >
          <Text style={styles.btnText}>+ Submit Claim</Text>
        </TouchableOpacity>

        <Modal
          visible={claimDetail !== null}
          animationType="slide"
          onRequestClose={() => setClaimDetail(null)}
        >
          {claimDetail && (
            <ScrollView style={styles.container} contentContainerStyle={styles.detailContent}>
              <TouchableOpacity onPress={() => setClaimDetail(null)} style={styles.back}>
                <Text style={styles.backText}>‹ Back</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Claim #{claimDetail.id.slice(0, 8).toUpperCase()}</Text>
              <Text style={styles.cardSub}>{claimDetail.description}</Text>
              <Text style={styles.cardSub}>Amount: ${claimDetail.amount.toFixed(2)}</Text>

              {claimDetail.attachmentUrls.length > 0 && (
                <View style={styles.attachmentsBox}>
                  <Text style={styles.sectionHeading}>Attachments</Text>
                  {claimDetail.attachmentUrls.map((url) => (
                    <Text key={url} style={styles.attachmentText} numberOfLines={1}>
                      {url}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.timeline}>
                {buildTimeline(claimDetail).map((step, i) => (
                  <View key={step.status} style={styles.timelineRow}>
                    <View style={styles.timelineMarkerCol}>
                      <View
                        style={[
                          styles.timelineDot,
                          step.reached && styles.timelineDotDone,
                          step.isCurrent && styles.timelineDotActive,
                        ]}
                      />
                      {i < buildTimeline(claimDetail).length - 1 && (
                        <View
                          style={[styles.timelineLine, step.reached && styles.timelineLineDone]}
                        />
                      )}
                    </View>
                    <View style={styles.timelineTextCol}>
                      <Text
                        style={[styles.timelineLabel, !step.reached && styles.timelineLabelPending]}
                      >
                        {step.label}
                      </Text>
                      {step.date && (
                        <Text style={styles.timelineDate}>
                          {new Date(step.date).toLocaleDateString()}
                        </Text>
                      )}
                      {step.isCurrent && claimDetail.status === 'under_review' && (
                        <Text style={styles.timelineEta}>
                          Expected completion: {expectedCompletionDate(claimDetail)}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}

                {claimDetail.status === 'denied' && (
                  <View style={styles.timelineRow}>
                    <View style={styles.timelineMarkerCol}>
                      <View style={[styles.timelineDot, styles.timelineDotDenied]} />
                    </View>
                    <View style={styles.timelineTextCol}>
                      <Text style={[styles.timelineLabel, styles.timelineLabelDenied]}>
                        Rejected
                      </Text>
                      <Text style={styles.timelineDate}>
                        {new Date(claimDetail.updatedAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              {claimDetail.status === 'denied' && (
                <TouchableOpacity
                  style={styles.appealBtn}
                  onPress={() => void Linking.openURL(buildAppealMailto(claimDetail))}
                  accessibilityLabel="Appeal denied claim"
                >
                  <Text style={styles.appealBtnText}>Appeal</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => void handleExportClaimSummary(claimDetail)}
                disabled={exportingClaimId === claimDetail.id}
                accessibilityLabel="Export claim summary"
              >
                {exportingClaimId === claimDetail.id ? (
                  <ActivityIndicator color="#4299e1" />
                ) : (
                  <Text style={styles.secondaryBtnText}>Export Claim Summary</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </Modal>
      </View>
    );
  }

  // ─── New Claim ────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.formContent}>
      <TouchableOpacity onPress={() => setScreen('claims')} style={styles.back}>
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Submit Claim</Text>

      <Text style={styles.label}>Policy</Text>
      {policies.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={[styles.policyOption, selectedPolicyId === p.id && styles.policyOptionActive]}
          onPress={() => setSelectedPolicyId(p.id)}
          accessibilityLabel={`Select policy ${p.policyNumber}`}
        >
          <Text style={styles.policyOptionText}>
            {p.provider} — {p.policyNumber}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.label}>Amount ($)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
        accessibilityLabel="Claim amount"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the treatment or expense…"
        multiline
        numberOfLines={4}
        accessibilityLabel="Claim description"
      />

      <Text style={styles.label}>Attachment URLs</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={attachmentInput}
        onChangeText={setAttachmentInput}
        placeholder="Paste receipt or invoice URLs, one per line"
        multiline
        numberOfLines={3}
        autoCapitalize="none"
        accessibilityLabel="Claim attachment URLs"
      />

      <TouchableOpacity
        style={[styles.btn, submitting && styles.btnDisabled]}
        onPress={() => void handleSubmitClaim()}
        disabled={submitting}
        accessibilityLabel="Submit claim"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Submit Claim</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, marginTop: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#1a202c', padding: 16, paddingBottom: 8 },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginHorizontal: 16,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#4299e1' },
  tabText: { color: '#718096', fontWeight: '600' },
  tabTextActive: { color: '#4299e1', fontWeight: '700' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#f7fafc',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1a202c', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#718096', marginBottom: 2 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#718096', marginTop: 40 },
  btn: {
    margin: 16,
    backgroundColor: '#4299e1',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  formContent: { padding: 16 },
  back: { marginBottom: 8 },
  backText: { color: '#4299e1', fontSize: 16 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#718096',
    marginTop: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a202c',
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  policyOption: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  policyOptionActive: { borderColor: '#4299e1', backgroundColor: '#ebf8ff' },
  policyOptionText: { fontSize: 14, color: '#2d3748' },
  detailContent: { padding: 16, paddingBottom: 40 },
  timeline: { marginTop: 24 },
  attachmentsBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f7fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionHeading: { fontSize: 13, fontWeight: '700', color: '#2d3748', marginBottom: 6 },
  attachmentText: { fontSize: 12, color: '#4299e1', marginBottom: 4 },
  timelineRow: { flexDirection: 'row' },
  timelineMarkerCol: { width: 24, alignItems: 'center' },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#e2e8f0',
    borderWidth: 2,
    borderColor: '#cbd5e0',
  },
  timelineDotDone: { backgroundColor: '#48bb78', borderColor: '#48bb78' },
  timelineDotActive: { backgroundColor: '#4299e1', borderColor: '#4299e1' },
  timelineDotDenied: { backgroundColor: '#e53e3e', borderColor: '#e53e3e' },
  timelineLine: { flex: 1, width: 2, minHeight: 28, backgroundColor: '#e2e8f0', marginTop: 2 },
  timelineLineDone: { backgroundColor: '#48bb78' },
  timelineTextCol: { flex: 1, paddingLeft: 12, paddingBottom: 20 },
  timelineLabel: { fontSize: 15, fontWeight: '700', color: '#1a202c' },
  timelineLabelPending: { color: '#a0aec0', fontWeight: '600' },
  timelineLabelDenied: { color: '#e53e3e' },
  timelineDate: { fontSize: 12, color: '#718096', marginTop: 2 },
  timelineEta: { fontSize: 12, color: '#4299e1', marginTop: 4, fontWeight: '600' },
  appealBtn: {
    marginTop: 12,
    backgroundColor: '#e53e3e',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  appealBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4299e1',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: { color: '#4299e1', fontWeight: '700', fontSize: 15 },
});

export default InsuranceScreen;
