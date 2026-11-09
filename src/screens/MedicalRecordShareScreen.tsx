import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  exportRecordAsPdf,
  generateShareableLink,
  nativeShare,
  shareRecordWithVet,
} from '../services/medicalRecordSharingService';
import { useTheme } from '../context/ThemeContext';

interface Props {
  petId: string;
  recordId: string;
  onBack: () => void;
}

type LoadingAction = 'link' | 'pdf' | 'vet' | null;

const MedicalRecordShareScreen: React.FC<Props> = ({ petId, recordId, onBack }) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState<LoadingAction>(null);
  const [vetId, setVetId] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const handleGenerateLink = async () => {
    setLoading('link');
    try {
      const { url, expiresAt } = await generateShareableLink(petId, recordId);
      setGeneratedLink(url);
      const expiry = new Date(expiresAt).toLocaleString();
      await nativeShare(url, `Medical record (expires ${expiry}):`);
    } catch {
      Alert.alert('Error', 'Failed to generate shareable link.');
    } finally {
      setLoading(null);
    }
  };

  const handleExportPdf = async () => {
    setLoading('pdf');
    try {
      const { downloadUrl, filename } = await exportRecordAsPdf(petId, recordId);
      await nativeShare(downloadUrl, `Medical record PDF: ${filename}`);
    } catch {
      Alert.alert('Error', 'Failed to export record as PDF.');
    } finally {
      setLoading(null);
    }
  };

  const handleShareWithVet = async () => {
    if (!vetId.trim()) {
      Alert.alert('Required', 'Please enter a Vet ID.');
      return;
    }
    setLoading('vet');
    try {
      await shareRecordWithVet(petId, recordId, vetId.trim());
      Alert.alert('Sent', 'Record shared with vet successfully.');
      setVetId('');
    } catch {
      Alert.alert('Error', 'Failed to share record with vet.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Share Record</Text>
      </View>

      <View style={styles.content}>
        {/* Secure Link */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>🔗 Shareable Link</Text>
          <Text style={[styles.cardDesc, { color: colors.secondaryText }]}>Generate a time-limited secure link anyone can open.</Text>
          {generatedLink ? (
            <Text style={[styles.linkText, { color: colors.primary, backgroundColor: colors.primaryMuted }]} numberOfLines={2} accessibilityLabel="Generated link">
              {generatedLink}
            </Text>
          ) : null}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }, loading === 'link' && styles.btnDisabled]}
            onPress={handleGenerateLink}
            disabled={loading !== null}
            accessibilityRole="button"
            accessibilityLabel="Generate and share secure link"
          >
            {loading === 'link' ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={[styles.btnText, { color: colors.white }]}>Generate & Share</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* PDF Export */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>📄 Export as PDF</Text>
          <Text style={[styles.cardDesc, { color: colors.secondaryText }]}>Download a PDF copy and share via any app.</Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }, loading === 'pdf' && styles.btnDisabled]}
            onPress={handleExportPdf}
            disabled={loading !== null}
            accessibilityRole="button"
            accessibilityLabel="Export record as PDF"
          >
            {loading === 'pdf' ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={[styles.btnText, { color: colors.white }]}>Export PDF</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Direct Vet Share */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>🩺 Share with Vet</Text>
          <Text style={[styles.cardDesc, { color: colors.secondaryText }]}>Send directly to a vet using their Vet ID.</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.input, color: colors.text }]}
            placeholder="Enter Vet ID"
            value={vetId}
            onChangeText={setVetId}
            autoCapitalize="none"
            accessibilityLabel="Vet ID input"
          />
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }, loading === 'vet' && styles.btnDisabled]}
            onPress={handleShareWithVet}
            disabled={loading !== null}
            accessibilityRole="button"
            accessibilityLabel="Share record with vet"
          >
            {loading === 'vet' ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={[styles.btnText, { color: colors.white }]}>Send to Vet</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 17 },
  title: { fontSize: 17, fontWeight: '700' },
  content: { padding: 16, gap: 14 },
  card: {
    borderRadius: 10,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardDesc: { fontSize: 13 },
  linkText: {
    fontSize: 12,
    padding: 8,
    borderRadius: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  btn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontWeight: '600', fontSize: 14 },
});

export default MedicalRecordShareScreen;
