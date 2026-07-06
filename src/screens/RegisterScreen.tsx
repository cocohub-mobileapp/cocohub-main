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

import { register } from '../services/authService';
import type { AuthSession } from '../services/authService';
import { isValidEmail, isValidPassword } from '../utils/validators';

interface Props {
  onSuccess: (session: AuthSession) => void;
  onLogin: () => void;
}

const RegisterScreen: React.FC<Props> = ({ onSuccess, onLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // 🔴 Required fields check
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Validation', 'All fields are required.');
      return;
    }

    // 🔴 Email validation
    if (!isValidEmail(email)) {
      Alert.alert('Validation', 'Please enter a valid email address.');
      return;
    }

    // 🔴 Password strength validation
    if (!isValidPassword(password)) {
      Alert.alert(
        'Validation',
        'Password must be at least 8 characters and include uppercase, lowercase, and a number.',
      );
      return;
    }

    // 🔴 Confirm password
    if (password !== confirm) {
      Alert.alert('Validation', 'Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const session = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        referralCode: referralCode.trim() || undefined,
      });

      onSuccess(session);
    } catch (err: unknown) {
      Alert.alert('Registration Failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="register-screen"
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🐾</Text>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join Cocohub</Text>

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#aaa"
          value={name}
          onChangeText={setName}
          testID="register-name-input"
        />

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#aaa"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          testID="register-email-input"
        />

        <TextInput
          style={styles.input}
          placeholder="Password (min 8 chars, A-Z, a-z, 0-9)"
          placeholderTextColor="#aaa"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          testID="register-password-input"
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#aaa"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          onSubmitEditing={() => void handleRegister()}
        />

        <TextInput
          style={styles.input}
          placeholder="Referral Code (optional)"
          placeholderTextColor="#aaa"
          autoCapitalize="characters"
          value={referralCode}
          onChangeText={setReferralCode}
          testID="register-referral-input"
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={() => void handleRegister()}
          disabled={loading}
          testID="register-submit-button"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={onLogin}>
            <Text style={styles.link}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 56, textAlign: 'center', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center', color: '#1a1a1a' },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 32 },
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
    marginTop: 8,
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { color: '#666', fontSize: 14 },
  link: { color: '#4CAF50', fontWeight: '600', fontSize: 14 },
});

export default RegisterScreen;
