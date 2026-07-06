import React, { useState, useEffect, useCallback } from 'react';
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

import { verifyEmail, resendVerificationEmail } from '../services/authService';

interface Props {
  onVerified: () => void;
  onSkip?: () => void;
}

const RESEND_COOLDOWN_S = 60;

const EmailVerificationScreen: React.FC<Props> = ({ onVerified, onSkip }) => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Start a 60-second cooldown on mount so user can't spam resend immediately
  useEffect(() => {
    setCooldown(RESEND_COOLDOWN_S);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleVerify = async () => {
    if (!token.trim()) {
      Alert.alert('Validation', 'Please enter the 6-digit verification code.');
      return;
    }
    setLoading(true);
    try {
      await verifyEmail(token.trim());
      setDone(true);
    } catch (err: unknown) {
      Alert.alert(
        'Verification Failed',
        err instanceof Error ? err.message : 'Invalid or expired code. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setResending(true);
    try {
      await resendVerificationEmail();
      setCooldown(RESEND_COOLDOWN_S);
      Alert.alert('Email Sent', 'A new verification code has been sent to your email address.');
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to resend email.');
    } finally {
      setResending(false);
    }
  }, [cooldown]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {done ? (
          <>
            <Text style={styles.icon}>✅</Text>
            <Text style={styles.title}>Email Verified!</Text>
            <Text style={styles.subtitle}>Your account is now fully activated.</Text>
            <TouchableOpacity style={styles.btn} onPress={onVerified} accessibilityRole="button">
              <Text style={styles.btnText}>Continue</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.icon}>📧</Text>
            <Text style={styles.title}>Verify Your Email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit verification code to your email. Enter it below to activate your
              account.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter 6-digit code"
              placeholderTextColor="#aaa"
              autoCapitalize="none"
              keyboardType="number-pad"
              maxLength={6}
              value={token}
              onChangeText={setToken}
              onSubmitEditing={() => void handleVerify()}
              accessibilityLabel="Verification code"
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={() => void handleVerify()}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Verify email"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Verify Email</Text>
              )}
            </TouchableOpacity>

            {/* Resend code */}
            <TouchableOpacity
              style={[styles.resendBtn, (cooldown > 0 || resending) && styles.resendBtnDisabled]}
              onPress={() => void handleResend()}
              disabled={cooldown > 0 || resending}
              accessibilityRole="button"
              accessibilityLabel={
                cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend verification code'
              }
            >
              {resending ? (
                <ActivityIndicator size="small" color="#4CAF50" />
              ) : (
                <Text style={[styles.resendText, cooldown > 0 && styles.resendTextDisabled]}>
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Didn't receive the code? Resend"}
                </Text>
              )}
            </TouchableOpacity>

            {onSkip && (
              <TouchableOpacity
                style={styles.skipBtn}
                onPress={onSkip}
                accessibilityRole="button"
                accessibilityLabel="Skip email verification for now"
              >
                <Text style={styles.skipText}>Skip for now</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  inner: { flex: 1, justifyContent: 'center', padding: 24 },
  icon: { fontSize: 56, textAlign: 'center', marginBottom: 12 },
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
    paddingVertical: 14,
    fontSize: 20,
    marginBottom: 12,
    color: '#1a1a1a',
    textAlign: 'center',
    letterSpacing: 6,
  },
  btn: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendBtn: { alignItems: 'center', paddingVertical: 12 },
  resendBtnDisabled: { opacity: 0.6 },
  resendText: { color: '#4CAF50', fontSize: 14, fontWeight: '500' },
  resendTextDisabled: { color: '#999' },
  skipBtn: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  skipText: { color: '#bbb', fontSize: 13 },
});

export default EmailVerificationScreen;
