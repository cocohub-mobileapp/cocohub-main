import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { SUPPORTED_LANGUAGES, type LanguageCode } from '../i18n';
import { useAppTheme } from '../theme';
import { switchLanguage } from '../utils/locale';

const LanguageSelector: React.FC = () => {
  const colors = useAppTheme();
  const { t, i18n } = useTranslation();
  const current = i18n.language as LanguageCode;

  const handleSelect = (code: LanguageCode) => {
    void switchLanguage(code);
  };

  return (
    <View>
      <Text style={[styles.label, { color: colors.secondaryText }]}>
        {t('language.selectLanguage')}
      </Text>
      <View style={styles.row}>
        {SUPPORTED_LANGUAGES.map(({ code, label }) => (
          <TouchableOpacity
            key={code}
            style={[
              styles.btn,
              { backgroundColor: colors.input, borderColor: colors.border },
              current === code && {
                backgroundColor: colors.primaryMuted,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => handleSelect(code)}
          >
            <Text
              style={[
                styles.btnText,
                { color: colors.secondaryText },
                current === code && { color: colors.primary },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 13, marginTop: 12, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  btnText: { fontSize: 14 },
});

export default LanguageSelector;
