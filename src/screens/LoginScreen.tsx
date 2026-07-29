import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';

import { useAppTheme } from '../theme';
import { useAuthContext } from '../context/AuthContext';

const LoginScreen: React.FC = () => {
  const colors = useAppTheme();
  const { login } = useAuthContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (generalError) {
      const timer = setTimeout(() => setGeneralError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [generalError]);

  const handleLogin = async () => {
    const errors: { email?: string; password?: string } = {};
    if (!email.trim()) errors.email = 'Email is required';
    if (!password.trim()) errors.password = 'Password is required';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsLoading(true);
    setGeneralError('');
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      setGeneralError(error?.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.text }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: colors.secondaryText }]}>
          Sign in to manage your pet's health records
        </Text>

        {generalError ? (
          <View style={[styles.generalError, { backgroundColor: colors.primaryMuted }]}>
            <Text style={[styles.generalErrorText, { color: colors.error }]}>{generalError}</Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Email</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.input,
                color: colors.text,
                borderColor: fieldErrors.email ? colors.error : colors.border,
              },
            ]}
            placeholder="Enter your email"
            placeholderTextColor={colors.placeholder}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {fieldErrors.email ? (
            <Text style={[styles.fieldError, { color: colors.error }]}>{fieldErrors.email}</Text>
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.text }]}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                styles.passwordInput,
                {
                  backgroundColor: colors.input,
                  color: colors.text,
                  borderColor: fieldErrors.password ? colors.error : colors.border,
                },
              ]}
              placeholder="Enter your password"
              placeholderTextColor={colors.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={[styles.eyeBtn, { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.secondaryText }}>{showPassword ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>
          {fieldErrors.password ? (
            <Text style={[styles.fieldError, { color: colors.error }]}>{fieldErrors.password}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.loginBtn, { backgroundColor: colors.primary }]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={[styles.btnText, { color: colors.white }]}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/register')}>
          <Text style={[styles.link, { color: colors.info }]}>
            Don't have an account? Register
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    lineHeight: 22,
  },
  generalError: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  generalErrorText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
  },
  eyeBtn: {
    padding: 10,
    marginLeft: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  fieldError: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  loginBtn: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  link: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default LoginScreen;
