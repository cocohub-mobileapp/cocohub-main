import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useSecureScreen } from '../utils/secureScreen';

interface ManualEntryScreenProps {
  onSubmit: (recordId: string) => void;
  onClose: () => void;
}

const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({ onSubmit, onClose }) => {
  useSecureScreen();

  const [recordId, setRecordId] = useState('');
  const [petId, setPetId] = useState('');
  const [vetId, setVetId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!recordId.trim() && !petId.trim() && !vetId.trim()) {
      Alert.alert(
        'Missing Information',
        'Please enter at least one identifier to search for records.',
      );
      return;
    }
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onSubmit(recordId.trim() || petId.trim() || vetId.trim());
    } catch {
      Alert.alert('Error', 'Failed to search for records. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setRecordId('');
    setPetId('');
    setVetId('');
  };

  return (
    <SafeAreaView style={styles.container} testID="manual-entry-screen">
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            testID="manual-entry-close-button"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manual Entry</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionTitle}>Enter Record Information</Text>
            <Text style={styles.instructionText}>
              Enter any of the following identifiers to access pet medical records:
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Record ID</Text>
            <TextInput
              style={styles.textInput}
              value={recordId}
              onChangeText={setRecordId}
              placeholder="Enter medical record ID"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              testID="manual-entry-record-id-input"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Pet ID</Text>
            <TextInput
              style={styles.textInput}
              value={petId}
              onChangeText={setPetId}
              placeholder="Enter pet ID or microchip number"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              testID="manual-entry-pet-id-input"
            />
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Veterinarian ID</Text>
            <TextInput
              style={styles.textInput}
              value={vetId}
              onChangeText={setVetId}
              placeholder="Enter veterinarian ID or license number"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              testID="manual-entry-vet-id-input"
            />
          </View>

          <View style={styles.helpContainer}>
            <Text style={styles.helpTitle}>Where to find these IDs?</Text>
            {[
              'Record ID: Found on printed medical documents or previous QR scans',
              "Pet ID: Your pet's unique identifier or microchip number",
              "Vet ID: Veterinarian's license number or clinic ID",
            ].map((text) => (
              <View key={text} style={styles.helpItem}>
                <Text style={styles.helpBullet}>•</Text>
                <Text style={styles.helpText}>{text}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.clearButton, styles.footerButton]}
            onPress={handleClear}
            disabled={loading}
            testID="manual-entry-clear-button"
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, styles.footerButton]}
            onPress={() => void handleSubmit()}
            disabled={loading || (!recordId.trim() && !petId.trim() && !vetId.trim())}
            testID="manual-entry-submit-button"
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Searching...' : 'Search Records'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  keyboardContainer: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: { color: '#374151', fontSize: 18, fontWeight: 'bold' },
  headerTitle: { color: '#1F2937', fontSize: 18, fontWeight: '600' },
  placeholder: { width: 40 },
  formContainer: { flex: 1, padding: 20 },
  instructionContainer: { marginBottom: 30 },
  instructionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  instructionText: { fontSize: 16, color: '#6B7280', lineHeight: 24 },
  inputContainer: { marginBottom: 20 },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#ffffff',
  },
  helpContainer: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  helpItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  helpBullet: { color: '#6B7280', fontSize: 16, marginRight: 8, marginTop: 2 },
  helpText: { flex: 1, fontSize: 14, color: '#6B7280', lineHeight: 20 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#ffffff',
  },
  footerButton: {
    flex: 1,
    marginHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  clearButtonText: { color: '#6B7280', fontSize: 16, fontWeight: '500' },
  submitButton: { backgroundColor: '#3B82F6' },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});

export default ManualEntryScreen;
