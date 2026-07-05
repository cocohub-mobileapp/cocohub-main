import React from 'react';
import { Picker } from '@react-native-picker/picker';
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'en', label: 'English' },
  { code: 'pt-BR', label: 'Português (Brasil)' },
];

const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
  };

  return (
    <Picker
      selectedValue={i18n.language}
      onValueChange={handleLanguageChange}
      style={{ height: 50, width: 150 }}
    >
      {languages.map((lang) => (
        <Picker.Item key={lang.code} label={lang.label} value={lang.code} />
      ))}
    </Picker>
  );
};

export default LanguageSelector;