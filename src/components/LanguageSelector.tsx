import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

type LanguageOption = {
  label: string;
  value: string;
};

const LANGUAGES: LanguageOption[] = [
  { label: 'English', value: 'en' },
  { label: 'Español', value: 'es' },
  { label: 'Français', value: 'fr' }, // Added French locale
];

export const LanguageSelector: React.FC = () => {
  const { t } = useTranslation();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('language')}</Text>
      {LANGUAGES.map((lang) => (
        <TouchableOpacity
          key={lang.value}
          style={styles.button}
          onPress={() => changeLanguage(lang.value)}
        >
          <Text style={styles.buttonText}>{lang.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    marginBottom: 12,
    fontWeight: '600',
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#eee',
    borderRadius: 4,
    marginBottom: 8,
  },
  buttonText: {
    fontSize: 16,
  },
});
