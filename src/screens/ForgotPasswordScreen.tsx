import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
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

interface Props {
  onBack: () => void;
}

type Step = 'request' | 'reset' | 'done';

const ForgotPasswordScreen: React.FC<Props> = ({ onBack }) => {
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Back */}
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={styles.logo}>🔑</Text>

        {step === 'request' && (
          <>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={[styles.subtitle, { color: colors.secondaryText }]}>Enter your email and we'll send a reset link.</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Email"
              placeholderTextColor="#aaa"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={() => void handleRequest()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === 'reset' && (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Reset Password</Text>
            <Text style={styles.subtitle}>Check your email for the reset token.</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Reset Token"
              placeholderTextColor="#aaa"
              autoCapitalize="none"
              value={token}
              onChangeText={setToken}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="New Password"
              placeholderTextColor="#aaa"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="Confirm New Password"
              placeholderTextColor="#aaa"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
            />
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={() => void handleReset()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {step === 'done' && (
          <>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.title}>Password Reset!</Text>
            <Text style={styles.subtitle}>You can now sign in with your new password.</Text>
            <TouchableOpacity style={styles.btn} onPress={onBack}>
              <Text style={styles.btnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  backBtn: { position: 'absolute', top: 48, left: 24 },
  backText: { fontSize: 17, color: '#4CAF50' },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  successIcon: { fontSize: 56, textAlign: 'center', marginBottom: 12 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
    color: '#1a1a1a',
  },
  btn: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default ForgotPasswordScreen;
