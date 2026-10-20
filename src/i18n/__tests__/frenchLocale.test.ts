import frJson from '../locales/fr.json';
import enJson from '../locales/en.json';
import { SUPPORTED_LANGUAGES, loadLocale, isRTL } from '../index';

describe('French Language Translation (#40)', () => {
  it('registers French in SUPPORTED_LANGUAGES with LTR orientation', () => {
    const fr = SUPPORTED_LANGUAGES.find((l) => l.code === 'fr');
    expect(fr).toBeDefined();
    expect(fr?.label).toBe('Français');
    expect(fr?.rtl).toBe(false);
    expect(isRTL('fr')).toBe(false);
  });

  it('contains all top-level keys matching en.json', () => {
    const enKeys = Object.keys(enJson).sort();
    const frKeys = Object.keys(frJson).sort();
    expect(frKeys).toEqual(enKeys);
  });

  it('translates common navigation and triage actions accurately', () => {
    expect((frJson as any).common.save).toBe('Enregistrer');
    expect((frJson as any).common.cancel).toBe('Annuler');
    expect((frJson as any).home.title).toBe('Mes animaux');
    expect((frJson as any).emergency.title).toBe('Urgences');
    expect((frJson as any).symptomChecker.title).toBe('Assistant IA de symptômes');
  });
});
