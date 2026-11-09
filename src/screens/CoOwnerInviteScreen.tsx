/**
 * CoOwnerInviteScreen — invite a new co-owner to a jointly-owned pet.
 * Collects the invitee's email, Stellar public key, and signing weight.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import multisigService, { notifyCoSignRequest } from '../services/multisigService';
import { useTheme } from '../context/ThemeContext';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  petId: string;
  petName: string;
  jointOwnershipId: string;
  totalWeight: number;
  onBack: () => void;
  onInviteSent: () => void;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const CoOwnerInviteScreen: React.FC<Props> = ({
  petId,
  petName,
  jointOwnershipId,
  totalWeight,
  onBack,
  onInviteSent,
}) => {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [weight, setWeight] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const isValidStellarKey = (key: string) => /^G[A-Z2-7]{55}$/.test(key.trim());

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    const trimmedKey = publicKey.trim();
    const parsedWeight = parseInt(weight, 10);

    if (!isValidEmail(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!isValidStellarKey(trimmedKey)) {
      Alert.alert(
        'Invalid Public Key',
        'Please enter a valid Stellar public key (starts with G, 56 characters).',
      );
      return;
    }
    if (isNaN(parsedWeight) || parsedWeight < 1 || parsedWeight > totalWeight) {
      Alert.alert('Invalid Weight', `Weight must be between 1 and ${totalWeight}.`);
      return;
    }

    setSubmitting(true);
    try {
      await multisigService.inviteCoOwner({
        petId,
        jointOwnershipId,
        invitedEmail: trimmedEmail,
        weight: parsedWeight,
      });

      await notifyCoSignRequest(
        'signer_management',
        `You've been invited to co-own ${petName}. Accept the invite to become a co-signer.`,
        jointOwnershipId,
      );

      Alert.alert(
        'Invite Sent',
        `An invitation has been sent to ${trimmedEmail}. They'll need to accept before becoming an active co-owner.`,
        [{ text: 'OK', onPress: onInviteSent }],
      );
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to send invite. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Invite Co-Owner</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Info banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.primaryMuted }]}>
          <Text style={styles.infoBannerIcon}>🤝</Text>
          <Text style={[styles.infoBannerText, { color: colors.success }]}>
            Inviting a co-owner for <Text style={styles.bold}>{petName}</Text>. They will be added
            as a Stellar signer on the multisig account and must co-sign critical operations.
          </Text>
        </View>

        {/* Form */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.secondaryText }]}>Co-owner Email *</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.input }]}
            value={email}
            onChangeText={setEmail}
            placeholder="co-owner@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={colors.placeholder}
          />

          <Text style={[styles.label, { color: colors.secondaryText }]}>Stellar Public Key *</Text>
          <TextInput
            style={[styles.input, styles.monoInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.input }]}
            value={publicKey}
            onChangeText={setPublicKey}
            placeholder="GABC...XYZ (56 characters)"
            autoCapitalize="characters"
            autoCorrect={false}
            placeholderTextColor={colors.placeholder}
          />
          {publicKey.length > 0 && !isValidStellarKey(publicKey) && (
            <Text style={[styles.fieldError, { color: colors.error }]}>
              Must start with G and be 56 characters (Stellar Ed25519 key)
            </Text>
          )}

          <Text style={[styles.label, { color: colors.secondaryText }]}>Signing Weight *</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.input }]}
            value={weight}
            onChangeText={setWeight}
            placeholder="1"
            keyboardType="number-pad"
            placeholderTextColor={colors.placeholder}
          />
          <Text style={[styles.hint, { color: colors.placeholder }]}>
            Weight determines voting power. Current total weight: {totalWeight}. Higher weight =
            more influence on M-of-N threshold.
          </Text>
        </View>

        {/* M-of-N explanation */}
        <View style={[styles.explainCard, { backgroundColor: colors.subtle, borderColor: colors.border }]}>
          <Text style={[styles.explainTitle, { color: colors.warning }]}>How M-of-N Signing Works</Text>
          <Text style={[styles.explainText, { color: colors.secondaryText }]}>
            • <Text style={styles.bold}>Ownership transfers</Text> and{' '}
            <Text style={styles.bold}>record deletions</Text> require the high threshold — all
            co-owners must agree.{'\n'}• <Text style={styles.bold}>Adding/removing signers</Text>{' '}
            requires the medium threshold.{'\n'}• Each co-owner signs with their Stellar keypair.
            Once enough weight accumulates, the transaction is submitted to the Stellar testnet.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary }, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={[styles.submitBtnText, { color: colors.white }]}>Send Invite</Text>
          )}
        </TouchableOpacity>
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
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerRight: { width: 60 },
  content: { padding: 16, paddingBottom: 40 },
  infoBanner: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    alignItems: 'flex-start',
    gap: 10,
  },
  infoBannerIcon: { fontSize: 22 },
  infoBannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
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
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  monoInput: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 12 },
  fieldError: { fontSize: 11, marginTop: 4 },
  hint: { fontSize: 11, marginTop: 6, lineHeight: 16 },
  explainCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
  },
  explainTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  explainText: { fontSize: 12, lineHeight: 18 },
  submitBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontWeight: '700', fontSize: 16 },
});

export default CoOwnerInviteScreen;
