import { I18nManager } from 'react-native';

// Mock react-native before importing locale utils
jest.mock('react-native', () => ({
  I18nManager: {
    isRTL: false,
    forceRTL: jest.fn(),
  },
}));

// Mock i18next so we don't need a full init in tests
jest.mock('../../i18n', () => {
  let currentLang = 'en';
  return {
    __esModule: true,
    default: {
      get language() {
        return currentLang;
      },
      changeLanguage: jest.fn(async (lang: string) => {
        currentLang = lang;
      }),
      hasResourceBundle: jest.fn(() => true),
      addResourceBundle: jest.fn(),
      reloadResources: jest.fn(async () => {}),
    },
    isRTL: (lang: string) => lang === 'ar' || lang === 'he',
    changeLanguage: jest.fn(async (lang: string) => {
      currentLang = lang;
    }),
    SUPPORTED_LANGUAGES: [
      { code: 'en', label: 'English', rtl: false },
      { code: 'es', label: 'Español', rtl: false },
      { code: 'fr', label: 'Français', rtl: false },
      { code: 'ar', label: 'العربية', rtl: true },
    ],
    RTL_LANGUAGES: new Set(['ar']),
  };
});

import { SUPPORTED_LANGUAGES, isRTL } from '../../i18n';
import { switchLanguage, currentIsRTL, getLocaleTag } from '../locale';

describe('locale utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (I18nManager as { isRTL: boolean }).isRTL = false;
  });

  describe('getLocaleTag', () => {
    it('returns en-US for English', () => {
      expect(getLocaleTag()).toBe('en-US');
    });

    it('returns fr-FR for French', async () => {
      await switchLanguage('fr');
      expect(getLocaleTag()).toBe('fr-FR');
    });
  });

  describe('switchLanguage', () => {
    it('calls forceRTL(true) when switching to Arabic', async () => {
      await switchLanguage('ar');
      expect(I18nManager.forceRTL).toHaveBeenCalledWith(true);
    });

    it('does not call forceRTL when direction is unchanged', async () => {
      (I18nManager as { isRTL: boolean }).isRTL = false;
      await switchLanguage('en');
      expect(I18nManager.forceRTL).not.toHaveBeenCalled();
    });

    it('calls forceRTL(false) when switching from RTL to LTR', async () => {
      (I18nManager as { isRTL: boolean }).isRTL = true;
      await switchLanguage('en');
      expect(I18nManager.forceRTL).toHaveBeenCalledWith(false);
    });
  });

  describe('currentIsRTL', () => {
    it('returns false for English', () => {
      expect(currentIsRTL()).toBe(false);
    });
  });
});

describe('i18n module', () => {
  it('exports the supported language entries', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('ar');
    expect(codes).toContain('en');
    expect(codes).toContain('es');
    expect(codes).toContain('fr');
  });

  it('marks Arabic as RTL', () => {
    expect(isRTL('ar')).toBe(true);
    expect(isRTL('en')).toBe(false);
    expect(isRTL('es')).toBe(false);
    expect(isRTL('fr')).toBe(false);
  });
});
