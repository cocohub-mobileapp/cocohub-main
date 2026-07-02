import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { SUPPORTED_LANGUAGES, type LanguageCode, changeLanguage } from '../../i18n';
import onboardingService from '../../services/onboardingService';

const LANGUAGE_FLAGS: Record<LanguageCode, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  ar: '🇸🇦',
};

function getDeviceLanguage(): LanguageCode {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const code = locale.split('-')[0] as LanguageCode;
    return SUPPORTED_LANGUAGES.some((l) => l.code === code) ? code : 'en';
  } catch {
    return 'en';
  }
}

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

const WelcomeStep: React.FC<Props> = ({ onNext, onSkip }) => {
  const [selectedLang, setSelectedLang] = useState<LanguageCode>(getDeviceLanguage);

  useEffect(() => {
    onboardingService.getSavedLanguage().then((saved) => {
      if (saved) setSelectedLang(saved);
    });
  }, []);

  async function handleLanguageSelect(lang: LanguageCode) {
    setSelectedLang(lang);
    await changeLanguage(lang);
    await onboardingService.saveLanguage(lang);
  }

  return (
    <View style={styles.container}>
      <View style={styles.langRow}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[styles.langBtn, selectedLang === lang.code && styles.langBtnActive]}
            onPress={() => handleLanguageSelect(lang.code)}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedLang === lang.code }}
            accessibilityLabel={lang.label}
          >
            <Text style={styles.langFlag}>{LANGUAGE_FLAGS[lang.code]}</Text>
            <Text style={[styles.langLabel, selectedLang === lang.code && styles.langLabelActive]}>
              {lang.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.emoji}>🐾</Text>
      <Text style={styles.title}>Welcome to Cocohub</Text>
      <Text style={styles.subtitle}>
        Secure, blockchain-verified health records for your beloved pets.
      </Text>
      <Text style={styles.body}>
        Manage medications, appointments, and emergency contacts — all in one place.
      </Text>
      <TouchableOpacity style={styles.primary} onPress={onNext} accessibilityRole="button">
        <Text style={styles.primaryText}>Get Started</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onSkip} accessibilityRole="button">
        <Text style={styles.skip}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  langRow: {
    flexDirection: 'row',
    marginBottom: 32,
    gap: 8,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    gap: 6,
  },
  langBtnActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  langFlag: { fontSize: 18 },
  langLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  langLabelActive: { color: '#3B82F6' },
  emoji: { fontSize: 96, marginBottom: 24 },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  body: { fontSize: 15, color: '#4B5563', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  primary: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginBottom: 16,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skip: { color: '#6B7280', fontSize: 15 },
});

export default WelcomeStep;
