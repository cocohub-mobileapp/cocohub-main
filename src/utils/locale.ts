import { I18nManager } from 'react-native';

import i18n, { changeLanguage, isRTL, type LanguageCode } from '../i18n';

/** BCP-47 locale tag per language code */
const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  ar: 'ar-SA',
};

/** Returns the BCP-47 locale tag for the active language. */
export function getLocaleTag(): string {
  return LOCALE_MAP[i18n.language] ?? i18n.language;
}

/**
 * Switch language and flip layout direction for RTL locales.
 * On React Native, I18nManager.forceRTL requires an app reload to take full
 * effect on native components; JS-side flexbox flips immediately.
 */
export async function switchLanguage(lang: LanguageCode): Promise<void> {
  await changeLanguage(lang);
  const rtl = isRTL(lang);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    // Caller is responsible for reloading the app (e.g. via expo-updates or RNRestart)
    // when the direction actually changes, so we just signal it here.
  }
}

/** Whether the current language is RTL. */
export function currentIsRTL(): boolean {
  return isRTL(i18n.language);
}

export { getLocaleTag as locale };
