import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  generatePetShareLink,
  nativeSharePetProfile,
  PetSharingError,
} from '../services/petProfileSharingService';
import { getPetById } from '../services/petService';
import {
  generateQR,
  getQRImageUrl,
  printPetQRCode,
  revokeQRCode,
  sharePetQRCode,
  type PetQRInput,
  type QRCodeOptions,
  type QRExpiry,
} from '../services/qrCodeService';

interface Props {
  petId: string;
  petName: string;
  onBack: () => void;
}

type LoadingAction = 'link' | 'social' | 'qr' | 'qr-share' | 'print' | null;

const PetShareScreen: React.FC<Props> = ({ petId, petName, onBack }) => {
  const [loading, setLoading] = useState<LoadingAction>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrExpiry, setQrExpiry] = useState<QRExpiry>('24h');
  const [qrOneTimeUse, setQrOneTimeUse] = useState(false);

  const loadPetQRInput = async (): Promise<PetQRInput> => {
    const pet = await getPetById(petId);
    return {
      id: pet.id,
      name: pet.name,
      species: pet.species as PetQRInput['species'],
      breed: pet.breed,
      microchipId: pet.microchipId,
    };
  };

  const handleShareLink = async () => {
    setLoading('link');
    try {
      const { url, expiresAt } = await generatePetShareLink(petId);
      const expiry = new Date(expiresAt).toLocaleString();
      await nativeSharePetProfile(url, petName);
      Alert.alert('Link Ready', `Share link expires on ${expiry}.`);
    } catch (error) {
      const msg =
        error instanceof PetSharingError && error.code === 'FORBIDDEN'
          ? 'You do not have permission to share this pet profile.'
          : 'Failed to generate share link. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(null);
    }
  };

  const handleSocialShare = async () => {
    setLoading('social');
    try {
      const { url } = await generatePetShareLink(petId);
      await nativeSharePetProfile(url, petName);
    } catch (error) {
      const msg =
        error instanceof PetSharingError && error.code === 'FORBIDDEN'
          ? 'You do not have permission to share this pet profile.'
          : 'Failed to share. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(null);
    }
  };

  const handleQRCode = async () => {
    setLoading('qr');
    try {
      const pet = await loadPetQRInput();
      const options: QRCodeOptions = { expiry: qrExpiry, oneTimeUse: qrOneTimeUse };
      const payload = await generateQR(pet, options);
      const parsed = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
      setQrToken(parsed.token ?? null);
      setQrPayload(payload);
      setQrImageUrl(getQRImageUrl(payload));
    } catch {
      Alert.alert('Error', 'Failed to generate QR code. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleRevokeQRCode = async () => {
    if (!qrToken) return;
    Alert.alert('Revoke QR Code', 'This code will stop working immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          await revokeQRCode(qrToken);
          setQrPayload(null);
          setQrImageUrl(null);
          setQrToken(null);
          Alert.alert('Revoked', 'The QR code has been revoked.');
        },
      },
    ]);
  };

  const handleShareQRCode = async () => {
    setLoading('qr-share');
    try {
      const pet = await loadPetQRInput();
      const options: QRCodeOptions = { expiry: qrExpiry, oneTimeUse: qrOneTimeUse };
      const payload = await sharePetQRCode(pet, options);
      const parsed = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
      setQrToken(parsed.token ?? null);
      setQrPayload(payload);
      setQrImageUrl(getQRImageUrl(payload));
    } catch {
      Alert.alert('Error', 'Failed to share QR code. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handlePrintQRCode = async () => {
    setLoading('print');
    try {
      const pet = await loadPetQRInput();
      const options: QRCodeOptions = { expiry: qrExpiry, oneTimeUse: qrOneTimeUse };
      const payload = await printPetQRCode(pet, options);
      const parsed = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
      setQrToken(parsed.token ?? null);
      setQrPayload(payload);
      setQrImageUrl(getQRImageUrl(payload));
    } catch {
      Alert.alert('Error', 'Failed to prepare QR code for printing. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const isLoading = (action: LoadingAction) => loading === action;

  return (
    <View style={styles.container} testID="pet-share-screen">
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="pet-share-back-button"
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share {petName}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Choose how to share {petName}'s profile</Text>

        {/* QR Options */}
        <View style={styles.qrOptionsRow}>
          {(['1h', '24h', '7d', 'never'] as QRExpiry[]).map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.expiryChip, qrExpiry === opt && styles.expiryChipActive]}
              onPress={() => setQrExpiry(opt)}
              testID={`qr-expiry-${opt}`}
            >
              <Text
                style={[styles.expiryChipText, qrExpiry === opt && styles.expiryChipTextActive]}
              >
                {opt === 'never' ? '∞' : opt}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.expiryChip, qrOneTimeUse && styles.expiryChipActive]}
            onPress={() => setQrOneTimeUse(!qrOneTimeUse)}
            testID="qr-one-time-use-toggle"
          >
            <Text style={[styles.expiryChipText, qrOneTimeUse && styles.expiryChipTextActive]}>
              1×
            </Text>
          </TouchableOpacity>
        </View>

        {/* Share Link */}
        <TouchableOpacity
          style={[styles.optionCard, isLoading('link') && styles.optionCardDisabled]}
          onPress={handleShareLink}
          disabled={loading !== null}
          accessibilityRole="button"
          accessibilityLabel="Share link"
          accessibilityHint="Generate a shareable link for this pet profile"
        >
          <Text style={styles.optionIcon}>🔗</Text>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Share Link</Text>
            <Text style={styles.optionDesc}>Generate a time-limited secure link</Text>
          </View>
          {isLoading('link') ? (
            <ActivityIndicator size="small" color="#4CAF50" />
          ) : (
            <Text style={styles.optionArrow}>›</Text>
          )}
        </TouchableOpacity>

        {/* Social Media */}
        <TouchableOpacity
          style={[styles.optionCard, isLoading('social') && styles.optionCardDisabled]}
          onPress={handleSocialShare}
          disabled={loading !== null}
          accessibilityRole="button"
          accessibilityLabel="Share on social media"
          accessibilityHint="Share this pet profile via social media or messaging apps"
        >
          <Text style={styles.optionIcon}>📲</Text>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Social Media</Text>
            <Text style={styles.optionDesc}>Share via social apps or messaging</Text>
          </View>
          {isLoading('social') ? (
            <ActivityIndicator size="small" color="#4CAF50" />
          ) : (
            <Text style={styles.optionArrow}>›</Text>
          )}
        </TouchableOpacity>

        {/* QR Code */}
        <TouchableOpacity
          style={[styles.optionCard, isLoading('qr') && styles.optionCardDisabled]}
          onPress={handleQRCode}
          disabled={loading !== null}
          accessibilityRole="button"
          accessibilityLabel="Generate QR code"
          accessibilityHint="Generate a QR code for this pet profile"
          testID="generate-qr-code-button"
        >
          <Text style={styles.optionIcon}>📷</Text>
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>QR Code</Text>
            <Text style={styles.optionDesc}>Generate a scannable QR code</Text>
          </View>
          {isLoading('qr') ? (
            <ActivityIndicator size="small" color="#4CAF50" />
          ) : (
            <Text style={styles.optionArrow}>›</Text>
          )}
        </TouchableOpacity>

        {/* QR Code Preview */}
        {qrPayload && qrImageUrl && (
          <View
            style={styles.qrContainer}
            accessibilityLabel={`QR code for ${petName}'s profile`}
            testID="pet-share-qr-preview"
          >
            <Text style={styles.qrLabel}>Scan to view {petName}'s profile</Text>
            <Image
              source={{ uri: qrImageUrl }}
              style={styles.qrImage}
              accessible
              accessibilityLabel="QR code"
              testID="pet-share-qr-image"
            />
            <Text style={styles.qrPayload} selectable numberOfLines={6}>
              {qrPayload}
            </Text>
            <TouchableOpacity
              style={styles.qrShareBtn}
              onPress={handleShareQRCode}
              disabled={loading !== null}
              accessibilityRole="button"
              accessibilityLabel="Share QR code"
              testID="share-qr-code-button"
            >
              {isLoading('qr-share') ? (
                <ActivityIndicator size="small" color="#4CAF50" />
              ) : (
                <Text style={styles.qrShareBtnText}>Share QR Code</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.qrShareBtn}
              onPress={handlePrintQRCode}
              disabled={loading !== null}
              accessibilityRole="button"
              accessibilityLabel="Print QR code"
              testID="print-qr-code-button"
            >
              {isLoading('print') ? (
                <ActivityIndicator size="small" color="#4CAF50" />
              ) : (
                <Text style={styles.qrShareBtnText}>Print QR Code</Text>
              )}
            </TouchableOpacity>
            {qrToken && (
              <TouchableOpacity
                style={styles.revokeBtn}
                onPress={handleRevokeQRCode}
                disabled={loading !== null}
                accessibilityRole="button"
                accessibilityLabel="Revoke QR code"
                testID="revoke-qr-code-button"
              >
                <Text style={styles.revokeBtnText}>Revoke Code</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <Text style={styles.permissionNote}>
          Only you can generate share links. Recipients can view but not edit this profile.
        </Text>
      </ScrollView>
    </View>
  );
};

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
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  headerSpacer: { width: 40 },
  content: { padding: 16 },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  optionCardDisabled: { opacity: 0.6 },
  optionIcon: { fontSize: 28, marginRight: 14 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  optionDesc: { fontSize: 13, color: '#666' },
  optionArrow: { fontSize: 22, color: '#ccc' },
  qrContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  qrLabel: { fontSize: 14, color: '#666', marginBottom: 16 },
  qrImage: { width: 220, height: 220, marginBottom: 12 },
  qrPayload: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#f7f7f7',
    color: '#333',
    fontSize: 12,
    padding: 12,
    marginBottom: 16,
  },
  qrShareBtn: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  qrOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
  },
  expiryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  expiryChipActive: { borderColor: '#4CAF50', backgroundColor: '#e8f5e9' },
  expiryChipText: { fontSize: 13, color: '#666' },
  expiryChipTextActive: { color: '#4CAF50', fontWeight: '700' },
  revokeBtn: {
    backgroundColor: '#fdecea',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 8,
  },
  revokeBtnText: { color: '#d32f2f', fontWeight: '700', fontSize: 14 },
  permissionNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
});

export default PetShareScreen;
