import React, { useState, useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../context/ThemeContext';
import { login } from '../services/authService';
import type { AuthSession } from '../services/authService';
import { isValidEmail } from '../utils/validators';

interface Props {
  onSuccess: (session: AuthSession) => void;
  onRegister: () => void;
  onForgotPassword: () => void;
}

const LoginScreen: React.FC<Props> = ({ onSuccess, onRegister, onForgotPassword }) => {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const passwordRef = useRef<TextInput>(null);

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Email is required';
    else if (!isValidEmail(email)) next.email = 'Enter a valid email address';
    if (!password) next.password = 'Password is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      const session = await login(email.trim(), password);
      onSuccess(session);
    } catch (err: unknown) {
      setErrors({ general: err instanceof Error ? err.message : 'Login failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      testID="login-screen"
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🐾</Text>
        <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>Sign in to Cocohub</Text>

        {errors.general && (
          <View style={[styles.generalError, { backgroundColor: colors.primaryMuted }]}>
            <Text style={[styles.generalErrorText, { color: colors.error }]}>⚠️ {errors.general}</Text>
          </View>
        )}

        <View style={styles.fieldWrap}>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.input, borderColor: errors.email ? colors.error : colors.border, color: colors.text },
            ]}
            placeholder="Email"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            testID="login-email-input"
          />
          {errors.email && <Text style={[styles.fieldError, { color: colors.error }]}>{errors.email}</Text>}
        </View>

        <View style={styles.fieldWrap}>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                styles.passwordInput,
                { backgroundColor: colors.input, borderColor: errors.password ? colors.error : colors.border, color: colors.text },
              ]}
              placeholder="Password"
              placeholderTextColor={colors.placeholder}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
              ref={passwordRef}
              returnKeyType="go"
              onSubmitEditing={() => void handleLogin()}
              testID="login-password-input"
            />
            <TouchableOpacity
              style={[styles.eyeBtn, { borderColor: colors.border }]}
              onPress={() => setShowPassword((s) => !s)}
            >
              <Text style={{ fontSize: 18 }}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          {errors.password && <Text style={[styles.fieldError, { color: colors.error }]}>{errors.password}</Text>}
        </View>

        <TouchableOpacity onPress={onForgotPassword} style={styles.forgotLink}>
          <Text style={[styles.link, { color: colors.primary }]}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }, loading && styles.btnDisabled]}
          onPress={() => void handleLogin()}
          disabled={loading}
          testID="login-submit-button"
        >
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={[styles.btnText, { color: colors.white }]}>Sign In</Text>
          }
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.secondaryText }]}>Don't have an account? </Text>
          <TouchableOpacity onPress={onRegister}>
            <Text style={[styles.link, { color: colors.primary }]}>Register</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 56, textAlign: 'center', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', marginBottom: 28, marginTop: 4 },
  generalError: { borderRadius: 10, padding: 12, marginBottom: 16 },
  generalErrorText: { fontSize: 14 },
  fieldWrap: { marginBottom: 4 },
  fieldError: { fontSize: 12, marginTop: 4, marginLeft: 4, marginBottom: 8 },
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, marginBottom: 0,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRightWidth: 0 },
  eyeBtn: {
    borderWidth: 1, borderLeftWidth: 0, borderRadius: 10,
    borderTopLeftRadius: 0, borderBottomLeftRadius: 0,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  forgotLink: { alignSelf: 'flex-end', marginVertical: 14 },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { fontSize: 14 },
  link: { fontWeight: '600', fontSize: 14 },
});
