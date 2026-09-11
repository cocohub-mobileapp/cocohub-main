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
import { pickDocument } from '../services/documentService';
import {
  generateClaimSummaryPdf,
  shareClaimSummary,
  type ClaimSummaryInfo,
} from '../services/pdfService';

type Screen = 'policies' | 'claims' | 'newClaim';

interface TimelineStepItem {
  status: string;
  label: string;
  reached: boolean;
  isCurrent: boolean;
  date: string | null;
  color?: string;
}

const STATUS_COLOR: Record<ClaimStatus, string> = {
  submitted: '#ecc94b',
  under_review: '#4299e1',
  approved: '#48bb78',
  denied: '#e53e3e',
};

function buildTimeline(claim: InsuranceClaim): TimelineStepItem[] {
  const isDenied = claim.status === 'denied';
  const isApproved = claim.status === 'approved';
  const isUnderReview = claim.status === 'under_review';
  const isSubmitted = claim.status === 'submitted';

  const step1: TimelineStepItem = {
    status: 'submitted',
    label: 'Submitted',
    reached: true,
    isCurrent: isSubmitted,
    date: claim.submittedAt,
  };

  const step2: TimelineStepItem = {
    status: 'under_review',
    label: 'Under Review',
    reached: isUnderReview || isApproved || isDenied,
    isCurrent: isUnderReview,
    date: isUnderReview || isApproved || isDenied ? claim.updatedAt : null,
  };

  const step3: TimelineStepItem = {
    status: isDenied ? 'denied' : isApproved ? 'approved' : 'decision',
    label: isDenied ? 'Denied' : isApproved ? 'Approved' : 'Decision Pending',
    reached: isApproved || isDenied,
    isCurrent: isApproved || isDenied,
    date: isApproved || isDenied ? claim.updatedAt : null,
    color: isDenied ? '#e53e3e' : isApproved ? '#48bb78' : undefined,
  };

  return [step1, step2, step3];
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

const InsuranceScreen: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('policies');
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaimsData] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [claimDetail, setClaimDetail] = useState<InsuranceClaim | null>(null);

  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [attachmentInput, setAttachmentInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [p, c] = await Promise.all([getPolicies(), getClaims()]);
      setPolicies(p);
      setClaimsData(c);
    } catch {
      setLoadError('Failed to load insurance data. Please check your connection and try again.');
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
          Alert.alert('Error', 'Failed to connect provider. Please check the code and try again.');
        }
      },
    );
  }, []);

  const handleAddAttachmentUrl = useCallback(() => {
    const trimmed = attachmentInput.trim();
    if (!trimmed) return;
    if (!attachmentUrls.includes(trimmed)) {
      setAttachmentUrls((prev) => [...prev, trimmed]);
    }
    setAttachmentInput('');
  }, [attachmentInput, attachmentUrls]);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachmentUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await pickDocument();
      if (result?.uri) {
        const item = result.name ? `${result.name} (${result.uri})` : result.uri;
        setAttachmentUrls((prev) => [...prev, item]);
      }
    } catch (err) {
      Alert.alert(
        'Attachment Error',
        err instanceof Error ? err.message : 'Failed to select attachment.',
      );
    }
  }, []);

  const handleSubmitClaim = useCallback(async () => {
    setFormError(null);

    if (!selectedPolicyId) {
      const msg = 'Please select an insurance policy.';
      setFormError(msg);
      Alert.alert('Validation Error', msg);
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      const msg = 'Please enter a valid claim amount greater than $0.00.';
      setFormError(msg);
      Alert.alert('Validation Error', msg);
      return;
    }

    if (!description.trim()) {
      const msg = 'Please describe the treatment or expense.';
      setFormError(msg);
      Alert.alert('Validation Error', msg);
      return;
    }

    setSubmitting(true);
    try {
      const selectedPolicy = policies.find((p) => p.id === selectedPolicyId);
      const claim = await submitClaim({
        policyId: selectedPolicyId,
        petId: selectedPolicy?.petId,
        amount: parsedAmount,
        description: description.trim(),
        attachmentUrls,
      });

      setClaimsData((prev) => [claim, ...prev]);
      Alert.alert('Claim Submitted', `Claim #${claim.id.slice(0, 8).toUpperCase()} submitted.`);

      setSelectedPolicyId('');
      setAmount('');
      setDescription('');
      setAttachmentUrls([]);
      setAttachmentInput('');
      setScreen('claims');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit claim. Please try again.';
      setFormError(msg);
      Alert.alert('Submission Error', msg);
    } finally {
      setSubmitting(false);
    }
  }, [selectedPolicyId, amount, description, attachmentUrls, policies]);

  const handleExportPdf = useCallback(
    async (claim: InsuranceClaim) => {
      setExportingPdf(true);
      try {
        const matchedPolicy = policies.find((p) => p.id === claim.policyId);
        const summaryData: ClaimSummaryInfo = {
          claimId: claim.id,
          policyId: claim.policyId,
          petId: claim.petId ?? matchedPolicy?.petId,
          provider: matchedPolicy?.provider,
          policyNumber: matchedPolicy?.policyNumber,
          amount: claim.amount,
          description: claim.description,
          status: claim.status,
          submittedAt: claim.submittedAt,
          updatedAt: claim.updatedAt,
          attachmentUrls: claim.attachmentUrls,
        };

        const result = await generateClaimSummaryPdf(summaryData);
        Alert.alert(
          'Claim Summary Exported',
          `Document Hash: ${result.hash.slice(0, 16)}...\n\nWould you like to share this claim summary?`,
          [
            { text: 'Done', style: 'cancel' },
            {
              text: 'Share',
              onPress: () => {
                void shareClaimSummary(result.filePath).catch((err: unknown) => {
                  Alert.alert(
                    'Sharing Error',
                    err instanceof Error ? err.message : 'Unable to share claim summary.',
                  );
                });
              },
            },
          ],
        );
      } catch (err) {
        Alert.alert(
          'Export Failed',
          err instanceof Error ? err.message : 'Unable to export claim summary.',
        );
      } finally {
        setExportingPdf(false);
      }
    },
    [policies],
  );

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color="#4299e1" />;
  }

  if (loadError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error Loading Insurance Data</Text>
        <Text style={styles.errorMessage}>{loadError}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => void load()}>
          <Text style={styles.btnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screen === 'policies') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Pet Insurance</Text>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, styles.tabActive]}
            onPress={() => setScreen('policies')}
            accessibilityLabel="Policies tab"
          >
            <Text style={styles.tabTextActive}>Policies</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setScreen('claims')}
            accessibilityLabel="Claims tab"
          >
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

  if (screen === 'claims') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Pet Insurance</Text>
        <View style={styles.tabs}>
          <TouchableOpacity
            style={styles.tab}
            onPress={() => setScreen('policies')}
            accessibilityLabel="Policies tab"
          >
            <Text style={styles.tabText}>Policies</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, styles.tabActive]}
            onPress={() => setScreen('claims')}
            accessibilityLabel="Claims tab"
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
              <Text style={styles.cardSub}>Amount: ${item.amount.toFixed(2)}</Text>
              {item.attachmentUrls && item.attachmentUrls.length > 0 && (
                <Text style={styles.cardSub}>
                  Attachments: {item.attachmentUrls.length} file(s)
                </Text>
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
          ListEmptyComponent={<Text style={styles.empty}>No claims submitted yet.</Text>}
        />

        <TouchableOpacity
          style={styles.btn}
          onPress={() => {
            if (policies.length === 0) {
              Alert.alert(
                'No Policy Available',
                'Please link an insurance policy before filing a claim.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Connect', onPress: handleConnect },
                ],
              );
              return;
            }
            setSelectedPolicyId(policies[0]?.id ?? '');
            setFormError(null);
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
              <TouchableOpacity
                onPress={() => setClaimDetail(null)}
                style={styles.back}
                accessibilityLabel="Back to claims"
              >
                <Text style={styles.backText}>‹ Back</Text>
              </TouchableOpacity>
              <Text style={styles.title}>Claim #{claimDetail.id.slice(0, 8).toUpperCase()}</Text>
              <Text style={styles.cardSub}>{claimDetail.description}</Text>
              <Text style={styles.detailAmount}>Amount: ${claimDetail.amount.toFixed(2)}</Text>

              {claimDetail.attachmentUrls && claimDetail.attachmentUrls.length > 0 && (
                <View style={styles.evidenceContainer}>
                  <Text style={styles.sectionHeading}>Attachments & Evidence</Text>
                  {claimDetail.attachmentUrls.map((url, idx) => (
                    <TouchableOpacity
                      key={`${url}-${idx}`}
                      style={styles.attachmentItem}
                      onPress={() => {
                        if (url.startsWith('http://') || url.startsWith('https://')) {
                          void Linking.openURL(url).catch(() => {
                            Alert.alert('Unable to open attachment', url);
                          });
                        } else {
                          Alert.alert('Attachment', url);
                        }
                      }}
                      accessibilityLabel={`Open attachment ${idx + 1}`}
                    >
                      <Text style={styles.attachmentItemText} numberOfLines={1}>
                        📄 {url}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.sectionHeading}>Status Timeline</Text>
              <View style={styles.timeline}>
                {buildTimeline(claimDetail).map((step, i) => (
                  <View key={step.status} style={styles.timelineRow}>
                    <View style={styles.timelineMarkerCol}>
                      <View
                        style={[
                          styles.timelineDot,
                          step.reached && styles.timelineDotDone,
                          step.isCurrent && styles.timelineDotActive,
                          step.color
                            ? { backgroundColor: step.color, borderColor: step.color }
                            : null,
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
                        style={[
                          styles.timelineLabel,
                          !step.reached && styles.timelineLabelPending,
                          step.color ? { color: step.color } : null,
                        ]}
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
              </View>

              <TouchableOpacity
                style={[styles.exportBtn, exportingPdf && styles.btnDisabled]}
                onPress={() => void handleExportPdf(claimDetail)}
                disabled={exportingPdf}
                accessibilityLabel="Export claim summary as PDF"
              >
                {exportingPdf ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.exportBtnText}>📄 Export Claim Summary (PDF)</Text>
                )}
              </TouchableOpacity>

              {claimDetail.status === 'denied' && (
                <TouchableOpacity
                  style={styles.appealBtn}
                  onPress={() => void Linking.openURL(buildAppealMailto(claimDetail))}
                  accessibilityLabel="Appeal denied claim"
                >
                  <Text style={styles.appealBtnText}>Appeal Decision</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </Modal>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.formContent}>
      <TouchableOpacity
        onPress={() => setScreen('claims')}
        style={styles.back}
        accessibilityLabel="Back to claims"
      >
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Submit Claim</Text>

      {formError && (
        <View style={styles.inlineError}>
          <Text style={styles.inlineErrorText}>{formError}</Text>
        </View>
      )}

      <Text style={styles.label}>Policy</Text>
      {policies.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={[styles.policyOption, selectedPolicyId === p.id && styles.policyOptionActive]}
          onPress={() => setSelectedPolicyId(p.id)}
          accessibilityLabel={`Select policy ${p.policyNumber}`}
        >
          <Text style={styles.policyOptionText}>
            {p.provider.toUpperCase()} — {p.policyNumber}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={styles.label}>Amount ($)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={(val) => {
          setAmount(val);
          setFormError(null);
        }}
        keyboardType="decimal-pad"
        placeholder="0.00"
        accessibilityLabel="Claim amount"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={(val) => {
          setDescription(val);
          setFormError(null);
        }}
        placeholder="Describe the treatment, medical visit, or expense…"
        multiline
        numberOfLines={4}
        accessibilityLabel="Claim description"
      />

      <Text style={styles.label}>Attachments & Evidence</Text>
      <View style={styles.attachmentInputRow}>
        <TextInput
          style={[styles.input, styles.attachmentTextInput]}
          value={attachmentInput}
          onChangeText={setAttachmentInput}
          placeholder="Receipt or document URL…"
          autoCapitalize="none"
          accessibilityLabel="Attachment URL input"
        />
        <TouchableOpacity
          style={styles.addAttachmentBtn}
          onPress={handleAddAttachmentUrl}
          accessibilityLabel="Add attachment URL"
        >
          <Text style={styles.addAttachmentBtnText}>+ Add URL</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.filePickerBtn}
        onPress={() => void handlePickDocument()}
        accessibilityLabel="Select document from device"
      >
        <Text style={styles.filePickerBtnText}>📎 Attach File from Device</Text>
      </TouchableOpacity>

      {attachmentUrls.length > 0 && (
        <View style={styles.attachmentsList}>
          {attachmentUrls.map((url, idx) => (
            <View key={`${url}-${idx}`} style={styles.attachmentRow}>
              <Text style={styles.attachmentText} numberOfLines={1}>
                {idx + 1}. {url}
              </Text>
              <TouchableOpacity
                onPress={() => handleRemoveAttachment(idx)}
                accessibilityLabel={`Remove attachment ${idx + 1}`}
              >
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.btn, submitting && styles.btnDisabled]}
        onPress={() => void handleSubmitClaim()}
        disabled={submitting}
        accessibilityLabel="Submit claim button"
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
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#e53e3e', marginBottom: 8 },
  errorMessage: { fontSize: 14, color: '#718096', textAlign: 'center', marginBottom: 16 },
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
  formContent: { padding: 16, paddingBottom: 40 },
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
  attachmentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentTextInput: {
    flex: 1,
    marginRight: 8,
  },
  addAttachmentBtn: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  addAttachmentBtnText: {
    color: '#2d3748',
    fontWeight: '600',
    fontSize: 13,
  },
  filePickerBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#cbd5e0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  filePickerBtnText: {
    color: '#4299e1',
    fontWeight: '600',
    fontSize: 13,
  },
  attachmentsList: {
    backgroundColor: '#f7fafc',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  attachmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  attachmentText: {
    flex: 1,
    fontSize: 13,
    color: '#4a5568',
    marginRight: 8,
  },
  removeText: {
    color: '#e53e3e',
    fontSize: 12,
    fontWeight: '600',
  },
  inlineError: {
    backgroundColor: '#fed7d7',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  inlineErrorText: {
    color: '#9b2c2c',
    fontSize: 13,
  },
  detailContent: { padding: 16, paddingBottom: 40 },
  detailAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2d3748',
    marginTop: 4,
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4a5568',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  evidenceContainer: {
    marginBottom: 12,
  },
  attachmentItem: {
    backgroundColor: '#edf2f7',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  attachmentItemText: {
    fontSize: 13,
    color: '#2b6cb0',
  },
  timeline: { marginTop: 12, marginBottom: 20 },
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
  timelineLine: { flex: 1, width: 2, minHeight: 28, backgroundColor: '#e2e8f0', marginTop: 2 },
  timelineLineDone: { backgroundColor: '#48bb78' },
  timelineTextCol: { flex: 1, paddingLeft: 12, paddingBottom: 20 },
  timelineLabel: { fontSize: 15, fontWeight: '700', color: '#1a202c' },
  timelineLabelPending: { color: '#a0aec0', fontWeight: '600' },
  timelineDate: { fontSize: 12, color: '#718096', marginTop: 2 },
  timelineEta: { fontSize: 12, color: '#4299e1', marginTop: 4, fontWeight: '600' },
  exportBtn: {
    backgroundColor: '#319795',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  exportBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  appealBtn: {
    backgroundColor: '#e53e3e',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  appealBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default InsuranceScreen;
