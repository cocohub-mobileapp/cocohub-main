import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { requestPasswordReset, resetPassword } from '../services/authService';
import { useTheme } from '../context/ThemeContext';

interface Props {
  onBack: () => void;
}

type Step = 'request' | 'reset' | 'done';

const ForgotPasswordScreen: React.FC<Props> = ({ onBack }) => {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async () => {
    if (!email.trim()) {
      Alert.alert('Validation', 'Please enter your email.');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setStep('reset');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!token.trim() || !newPassword) {
      Alert.alert('Validation', 'Token and new password are required.');
      return;
    }
    if (newPassword !== confirm) {
      Alert.alert('Validation', 'Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Validation', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(token.trim(), newPassword);
      setStep('done');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Back */}
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={[styles.logo, { color: colors.text }]}>🔑</Text>

        {step === 'request' && (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Forgot Password</Text>
            <Text style={[styles.subtitle, { color: colors.secondaryText }]}>Enter your email and we'll send a reset link.</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="Email"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }, loading && styles.btnDisabled]}
              onPress={() => void handleRequest()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={[styles.btnText, { color: colors.white }]}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === 'reset' && (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Reset Password</Text>
            <Text style={[styles.subtitle, { color: colors.secondaryText }]}>Check your email for the reset token.</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="Reset Token"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              value={token}
              onChangeText={setToken}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="New Password"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="Confirm New Password"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
            />
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }, loading && styles.btnDisabled]}
              onPress={() => void handleReset()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={[styles.btnText, { color: colors.white }]}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === 'done' && (
          <>
            <Text style={[styles.successIcon, { color: colors.text }]}>✅</Text>
            <Text style={[styles.title, { color: colors.text }]}>Password Reset!</Text>
            <Text style={[styles.subtitle, { color: colors.secondaryText }]}>You can now sign in with your new password.</Text>
            <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={onBack}>
              <Text style={[styles.btnText, { color: colors.white }]}>Back to Sign In</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  backBtn: { position: 'absolute', top: 48, left: 24 },
  backText: { fontSize: 17 },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  successIcon: { fontSize: 56, textAlign: 'center', marginBottom: 12 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  btn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 16, fontWeight: '700' },
});

export default ForgotPasswordScreen;
