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

import { deleteAccount } from '../services/userService';
import { useTheme } from '../context/ThemeContext';

interface Props {
  onBack: () => void;
  onDeleted: () => void;
}

const CONFIRM_WORD = 'DELETE';

const DeleteAccountScreen: React.FC<Props> = ({ onBack, onDeleted }) => {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const confirmed = input.trim() === CONFIRM_WORD;

  const handleDelete = () => {
    Alert.alert(
      'Final Confirmation',
      'This will permanently delete your account, all pets, medical records, medications, and appointments. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await deleteAccount();
              onDeleted();
            } catch {
              Alert.alert('Error', 'Failed to delete account. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
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
        <Text style={[styles.title, { color: colors.text }]}>Delete Account</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.warningCard, { backgroundColor: colors.subtle, borderColor: colors.border }]}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={[styles.warningTitle, { color: colors.error }]}>This action is irreversible</Text>
          <Text style={[styles.warningBody, { color: colors.secondaryText }]}>Deleting your account will permanently remove:</Text>
          {[
            'Your profile and personal data',
            'All pets and their profiles',
            'All medical records',
            'All medications and schedules',
            'All appointments',
            'All notification preferences',
          ].map((item) => (
            <Text key={item} style={[styles.bulletItem, { color: colors.secondaryText }]}>
              • {item}
            </Text>
          ))}
        </View>

        <View style={[styles.confirmCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.confirmLabel, { color: colors.secondaryText }]}>
            Type <Text style={[styles.confirmWord, { color: colors.error }]}>{CONFIRM_WORD}</Text> to confirm
          </Text>
          <TextInput
            style={[styles.input, confirmed && styles.inputConfirmed, { borderColor: colors.border, backgroundColor: colors.input, color: colors.text }]}
            value={input}
            onChangeText={setInput}
            placeholder={CONFIRM_WORD}
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Type DELETE to confirm account deletion"
          />
        </View>

        <TouchableOpacity
          style={[styles.deleteBtn, { backgroundColor: colors.error }, (!confirmed || loading) && styles.deleteBtnDisabled]}
          onPress={handleDelete}
          disabled={!confirmed || loading}
          accessibilityRole="button"
          accessibilityLabel="Delete account permanently"
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={[styles.deleteBtnText, { color: colors.white }]}>Delete My Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.cancelBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={[styles.cancelBtnText, { color: colors.secondaryText }]}>Cancel</Text>
        </TouchableOpacity>
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
  content: { padding: 16, gap: 16 },
  warningCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 6,
  },
  warningIcon: { fontSize: 28, textAlign: 'center', marginBottom: 4 },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  warningBody: { fontSize: 14, marginBottom: 4 },
  bulletItem: { fontSize: 13, paddingLeft: 4 },
  confirmCard: {
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 10,
  },
  confirmLabel: { fontSize: 14 },
  confirmWord: { fontWeight: '700' },
  input: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    letterSpacing: 2,
  },
  inputConfirmed: {},
  deleteBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnDisabled: { opacity: 0.4 },
  deleteBtnText: { fontWeight: '700', fontSize: 15 },
  cancelBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelBtnText: { fontWeight: '600', fontSize: 15 },
});

export default DeleteAccountScreen;
