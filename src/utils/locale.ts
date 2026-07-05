import { I18nManager } from 'react-native';

import i18n, { changeLanguage, isRTL, type LanguageCode } from '../i18n';

const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  ar: 'ar-SA',
};

export function getLocaleTag(): string {
  return LOCALE_MAP[i18n.language] ?? i18n.language;
}

export async function switchLanguage(lang: LanguageCode): Promise<void> {
  await changeLanguage(lang);
  const rtl = isRTL(lang);

  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
  }
}

export function currentIsRTL(): boolean {
  return isRTL(i18n.language);
}

export { getLocaleTag as locale };
