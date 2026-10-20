import ptBrJson from '../locales/pt-BR.json';
import enJson from '../locales/en.json';
import { SUPPORTED_LANGUAGES, isRTL } from '../index';

describe('Portuguese (BR) Language Translation (#41)', () => {
  it('registers Portuguese (BR) in SUPPORTED_LANGUAGES with LTR orientation', () => {
    const pt = SUPPORTED_LANGUAGES.find((l) => l.code === 'pt-BR');
    expect(pt).toBeDefined();
    expect(pt?.label).toBe('Português (BR)');
    expect(pt?.rtl).toBe(false);
    expect(isRTL('pt-BR')).toBe(false);
  });

  it('contains all top-level keys matching en.json', () => {
    const enKeys = Object.keys(enJson).sort();
    const ptKeys = Object.keys(ptBrJson).sort();
    expect(ptKeys).toEqual(enKeys);
  });

  it('translates navigation, emergency and pet triage terms accurately', () => {
    expect((ptBrJson as any).common.save).toBe('Salvar');
    expect((ptBrJson as any).common.cancel).toBe('Cancelar');
    expect((ptBrJson as any).home.title).toBe('Meus Pets');
    expect((ptBrJson as any).emergency.title).toBe('Emergência');
    expect((ptBrJson as any).symptomChecker.title).toBe('Avaliador de Sintomas com IA');
  });
});
