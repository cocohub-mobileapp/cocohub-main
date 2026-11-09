/**
 * KeyRotationScreen — key rotation with UX guards:
 *   1. Block if pending co-sign requests exist (show modal listing them)
 *   2. Require biometric re-auth before proceeding
 *   3. Step-by-step progress with per-step retry on failure
 *   4. Clear old key from secure store on completion
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { authenticateWithBiometric } from '../services/authService';
import keyBackupService from '../services/keyBackupService';
import multisigService, { type PendingTransactionResponse } from '../services/multisigService';
import { useTheme } from '../context/ThemeContext';
import { clearSecret } from '../services/stellarAccountService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  jointOwnershipId: string;
  petName: string;
  currentPublicKey: string;
  currentUserId: string;
  onBack: () => void;
  onRotationComplete: () => void;
}

type Phase =
  | 'form' // user fills in new key
  | 'checking' // querying pending co-sign requests
  | 'blocked' // modal: pending requests must be resolved
  | 'biometric' // waiting for biometric auth
  | 'rotating' // step-by-step execution
  | 'done';

type StepStatus = 'waiting' | 'running' | 'done' | 'error';

interface Step {
  label: string;
  status: StepStatus;
  error?: string;
}

const STEP_LABELS = [
  'Generate new keypair',
  'Update on-chain signers',
  'Backup new key',
  'Revoke old key',
];

function makeSteps(): Step[] {
  return STEP_LABELS.map((label) => ({ label, status: 'waiting' }));
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const KeyRotationScreen: React.FC<Props> = ({
  jointOwnershipId,
  petName,
  currentPublicKey,
  currentUserId,
  onBack,
  onRotationComplete,
}) => {
  const { colors } = useTheme();
  const [newPublicKey, setNewPublicKey] = useState('');
  const [reason, setReason] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [pendingRequests, setPendingRequests] = useState<PendingTransactionResponse[]>([]);
  const [steps, setSteps] = useState<Step[]>(makeSteps());
  // newMnemonic is kept in state only during the rotation session
  const [newMnemonic, setNewMnemonic] = useState<string | null>(null);

  const isValidStellarKey = (key: string) => /^G[A-Z2-7]{55}$/.test(key.trim());

  function setStepStatus(index: number, status: StepStatus, error?: string) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status, error: error ?? s.error } : s)),
    );
  }

  // ─── Step execution ──────────────────────────────────────────────────────

  async function runStep(index: number): Promise<boolean> {
    setStepStatus(index, 'running', undefined);
    try {
      switch (index) {
        case 0: {
          // Generate new keypair — mnemonic for backup, new public key derived from it
          const mnemonic = await keyBackupService.generateMnemonic();
          setNewMnemonic(mnemonic);
          break;
        }
        case 1: {
          // Request key rotation (creates pending signer_management tx on server)
          await multisigService.requestKeyRotation({
            jointOwnershipId,
            oldPublicKey: currentPublicKey,
            newPublicKey: newPublicKey.trim(),
            reason: reason.trim() || undefined,
          });
          await multisigService.notifyCoSignRequest(
            'signer_management',
            `A co-owner of ${petName} has requested a key rotation. Your approval is needed.`,
            jointOwnershipId,
          );
          break;
        }
        case 2: {
          // Backup new mnemonic encrypted with the user's ID as a PIN surrogate.
          // In production this would prompt for a PIN; here we use currentUserId.
          if (!newMnemonic) throw new Error('Mnemonic not generated');
          await keyBackupService.createBackupWithPin(newMnemonic, currentUserId);
          break;
        }
        case 3: {
          // Clear old key from expo-secure-store
          await clearSecret();
          break;
        }
      }
      setStepStatus(index, 'done');
      return true;
    } catch (err: any) {
      setStepStatus(index, 'error', err?.message ?? 'Unknown error');
      return false;
    }
  }

  async function runAllSteps(startFrom = 0) {
    for (let i = startFrom; i < STEP_LABELS.length; i++) {
      const ok = await runStep(i);
      if (!ok) return; // stop; user can retry this step
    }
    setPhase('done');
  }

  // ─── Guard flow ───────────────────────────────────────────────────────────

  async function handleProceed() {
    const trimmedKey = newPublicKey.trim();
    if (!isValidStellarKey(trimmedKey)) {
      Alert.alert('Invalid Key', 'Enter a valid Stellar public key (starts with G, 56 chars).');
      return;
    }
    if (trimmedKey === currentPublicKey) {
      Alert.alert('Same Key', 'The new key must differ from your current key.');
      return;
    }

    // Step 1: check pending co-sign requests
    setPhase('checking');
    try {
      const pending = await multisigService.getPendingTransactions(jointOwnershipId);
      if (pending.length > 0) {
        setPendingRequests(pending);
        setPhase('blocked');
        return;
      }
    } catch {
      // Non-fatal: if we can't check, warn and allow continuing
      Alert.alert('Warning', 'Could not verify pending co-sign requests. Proceed with caution.', [
        { text: 'Cancel', onPress: () => setPhase('form') },
        { text: 'Continue Anyway', onPress: () => requestBiometric() },
      ]);
      return;
    }

    requestBiometric();
  }

  async function requestBiometric() {
    setPhase('biometric');
    const ok = await authenticateWithBiometric();
    if (!ok) {
      Alert.alert(
        'Authentication Failed',
        'Biometric re-authentication is required to rotate your key.',
      );
      setPhase('form');
      return;
    }
    setSteps(makeSteps());
    setPhase('rotating');
    await runAllSteps(0);
  }

  // ─── Render helpers ───────────────────────────────────────────────────────

  function renderStepIcon(status: StepStatus, index: number) {
    if (status === 'done') return <Text style={styles.stepIconDone}>✓</Text>;
    if (status === 'error') return <Text style={styles.stepIconError}>✕</Text>;
    if (status === 'running') return <ActivityIndicator size="small" color={colors.info} />;
    return <Text style={styles.stepIconWaiting}>{index + 1}</Text>;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (phase === 'done') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.doneContainer}>
          <Text style={styles.doneIcon}>🎉</Text>
          <Text style={[styles.doneTitle, { color: colors.text }]}>Key Rotation Complete</Text>
          <Text style={[styles.doneBody, { color: colors.secondaryText }]}>
            Your new key has been submitted for co-owner approval. The old key has been cleared from
            this device.
          </Text>
          <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={onRotationComplete}>
            <Text style={[styles.submitBtnText, { color: colors.white }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} disabled={phase !== 'form'}>
          <Text style={[styles.backText, { color: colors.primary }, phase !== 'form' && styles.disabledText]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Key Rotation</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Pending co-sign modal */}
      <Modal visible={phase === 'blocked'} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.error }]}>⚠️ Pending Approvals</Text>
            <Text style={[styles.modalBody, { color: colors.text }]}>
              You have {pendingRequests.length} pending co-sign request
              {pendingRequests.length !== 1 ? 's' : ''} that will be{' '}
              <Text style={styles.bold}>invalidated</Text> by a key rotation. Resolve them first:
            </Text>
            {pendingRequests.map((r) => (
              <View key={r.id} style={styles.pendingRow}>
                <Text style={styles.pendingType}>{r.operationType.replace('_', ' ')}</Text>
                <Text style={styles.pendingDesc} numberOfLines={2}>
                  {r.description}
                </Text>
              </View>
            ))}
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.info }]} onPress={() => setPhase('form')}>
              <Text style={[styles.modalBtnText, { color: colors.white }]}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Step progress (shown during rotation) */}
        {phase === 'rotating' && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Rotation Progress</Text>
            {steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepIconBox}>{renderStepIcon(step.status, i)}</View>
                <View style={styles.stepTextBox}>
                  <Text style={[styles.stepLabel, { color: colors.text }]}>{step.label}</Text>
                  {step.status === 'error' && (
                    <>
                      <Text style={[styles.stepError, { color: colors.error }]}>{step.error}</Text>
                      <TouchableOpacity onPress={() => runAllSteps(i)}>
                        <Text style={[styles.retryLink, { color: colors.info }]}>Retry this step →</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Form (shown in form / checking / biometric phases) */}
        {(phase === 'form' || phase === 'checking' || phase === 'biometric') && (
          <>
            <View style={[styles.infoBanner, { backgroundColor: colors.infoMuted, borderColor: colors.border }]}>
              <Text style={styles.infoIcon}>🔄</Text>
              <View style={styles.infoText}>
                <Text style={[styles.infoTitle, { color: colors.info }]}>Rotate Your Signing Key</Text>
                <Text style={[styles.infoBody, { color: colors.secondaryText }]}>
                  Biometric re-authentication and co-owner approval are required. Any pending
                  co-sign requests will be checked before proceeding.
                </Text>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Current Key</Text>
              <View style={[styles.keyBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[styles.keyText, { color: colors.text }]} numberOfLines={2}>
                  {currentPublicKey}
                </Text>
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>New Key Details</Text>

              <Text style={[styles.label, { color: colors.secondaryText }]}>New Stellar Public Key *</Text>
              <TextInput
                style={[styles.input, styles.monoInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.input }]}
                value={newPublicKey}
                onChangeText={setNewPublicKey}
                placeholder="GABC...XYZ (56 characters)"
                autoCapitalize="characters"
                autoCorrect={false}
                placeholderTextColor={colors.placeholder}
                editable={phase === 'form'}
              />
              {newPublicKey.length > 0 && !isValidStellarKey(newPublicKey) && (
                <Text style={[styles.fieldError, { color: colors.error }]}>Must start with G and be 56 characters</Text>
              )}

              <Text style={[styles.label, { color: colors.secondaryText }]}>Reason (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.text, backgroundColor: colors.input }]}
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Key compromise, hardware upgrade..."
                multiline
                numberOfLines={3}
                placeholderTextColor={colors.placeholder}
                editable={phase === 'form'}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }, phase !== 'form' && styles.submitBtnDisabled]}
              onPress={handleProceed}
              disabled={phase !== 'form'}
            >
              {phase === 'checking' ? (
                <ActivityIndicator color={colors.white} />
              ) : phase === 'biometric' ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={[styles.submitBtnText, { color: colors.white }]}>Rotate Key</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  disabledText: { color: '#bbb' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerRight: { width: 60 },
  content: { padding: 16, paddingBottom: 40 },
  infoBanner: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoIcon: { fontSize: 24 },
  infoText: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  infoBody: { fontSize: 13, lineHeight: 18 },
  bold: { fontWeight: '700' },
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
  keyBox: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
  },
  keyText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  monoInput: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12 },
  textArea: { height: 80, textAlignVertical: 'top' },
  fieldError: { fontSize: 11, marginTop: 4 },
  submitBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontWeight: '700', fontSize: 16 },
  // Step progress
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  stepIconBox: { width: 28, alignItems: 'center', marginRight: 10, paddingTop: 2 },
  stepIconDone: { fontSize: 16, fontWeight: '700' },
  stepIconError: { fontSize: 16, fontWeight: '700' },
  stepIconWaiting: { fontSize: 14, fontWeight: '700' },
  stepTextBox: { flex: 1 },
  stepLabel: { fontSize: 14 },
  stepError: { fontSize: 12, marginTop: 2 },
  retryLink: { fontSize: 12, marginTop: 4 },
  // Blocking modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 10 },
  modalBody: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  pendingRow: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  pendingType: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  pendingDesc: { fontSize: 12, marginTop: 2 },
  modalBtn: {
    marginTop: 8,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnText: { fontWeight: '700', fontSize: 15 },
  // Done screen
  doneContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  doneIcon: { fontSize: 56, marginBottom: 16 },
  doneTitle: { fontSize: 22, fontWeight: '700', marginBottom: 10 },
  doneBody: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
});

export default KeyRotationScreen;
