import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', rtl: false },
  { code: 'es', label: 'Español', rtl: false },
  { code: 'fr', label: 'Français', rtl: false },
  { code: 'ar', label: 'العربية', rtl: true },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export const RTL_LANGUAGES = new Set(SUPPORTED_LANGUAGES.filter((l) => l.rtl).map((l) => l.code));

export function isRTL(lang: string): boolean {
  return RTL_LANGUAGES.has(lang as LanguageCode);
}

/** Lazy-load a locale bundle. Returns null if already loaded or unknown. */
async function loadLocale(lang: string): Promise<void> {
  if (i18n.hasResourceBundle(lang, 'translation')) return;

  let bundle: { default: Record<string, unknown> };
  switch (lang) {
    case 'en':
      bundle = await import('./locales/en');
      break;
    case 'es':
      bundle = await import('./locales/es');
      break;
    case 'fr':
      bundle = await import('./locales/fr.json');
      break;
    case 'ar':
      bundle = await import('./locales/ar');
      break;
    default:
      return;
  }
  i18n.addResourceBundle(lang, 'translation', bundle.default, true, true);
}

i18n.use(initReactI18next).init({
  // Start with no resources — bundles are loaded on demand
  resources: {},
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  // i18next pluralization uses the `_one`, `_other` (etc.) suffix convention.
  // Arabic has 6 plural forms; i18next handles them via the `ar` plural rule.
  pluralSeparator: '_',
});

// Eagerly load the default language so the app is ready on first render
void loadLocale('en').then(() => {
  i18n.addResourceBundle('en', 'translation', {}, true, false);
  // Re-trigger so components re-render with the loaded bundle
  void i18n.reloadResources(['en']);
});

/** Change language, lazy-loading the bundle first, then applying RTL. */
export async function changeLanguage(lang: LanguageCode): Promise<void> {
  await loadLocale(lang);
  await i18n.changeLanguage(lang);
}

export { loadLocale };
export default i18n;
