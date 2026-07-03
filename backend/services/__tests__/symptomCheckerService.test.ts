import {
  analyzeSymptoms,
  hasSymptomInput,
  normalizeSymptoms,
  VETERINARY_DISCLAIMER,
} from '../symptomCheckerService';

describe('symptomCheckerService', () => {
  it('normalizes selected symptoms and free text aliases', () => {
    const symptoms = normalizeSymptoms({
      symptoms: ['Vomiting'],
      freeText: 'My dog is weak and has no appetite.',
    });

    expect(symptoms).toEqual(expect.arrayContaining(['vomiting', 'lethargy', 'not_eating']));
  });

  it('flags breathing difficulty as an emergency red flag', () => {
    const result = analyzeSymptoms({
      species: 'dog',
      breed: 'French Bulldog',
      symptoms: ['difficulty_breathing'],
      freeText: 'Labored breathing after a short walk.',
    });

    expect(result.disclaimer).toBe(VETERINARY_DISCLAIMER);
    expect(result.urgency).toBe('emergency');
    expect(result.redFlags.length).toBeGreaterThan(0);
    expect(result.conditions.some((condition) => condition.id === 'respiratory-illness')).toBe(
      true,
    );
  });

  it('returns digestive guidance for vomiting and diarrhea', () => {
    const result = analyzeSymptoms({
      species: 'dog',
      breed: 'Beagle',
      symptoms: ['vomiting', 'diarrhea'],
      freeText: 'Loose stool after a food change.',
    });

    expect(result.urgency).toBe('soon');
    expect(result.conditions[0]).toMatchObject({
      id: 'gastrointestinal-upset',
      likelihood: 'high',
    });
  });

  it('uses breed risk context when symptoms overlap known breed conditions', () => {
    const result = analyzeSymptoms({
      species: 'dog',
      breed: 'Labrador Retriever',
      symptoms: ['limping'],
      freeText: 'Favoring the back leg after exercise.',
    });

    expect(result.breedRisks).toEqual(
      expect.arrayContaining(['Labrador Retriever: hip dysplasia']),
    );
    expect(result.conditions[0].rationale.join(' ')).toContain('Labrador Retriever');
  });

  it('detects emergency urinary free-text patterns', () => {
    const result = analyzeSymptoms({
      species: 'cat',
      symptoms: ['urination_changes'],
      freeText: 'Straining in the litter box and cannot pee.',
    });

    expect(result.urgency).toBe('emergency');
    expect(result.redFlags.join(' ')).toContain('urinate');
  });

  it('recognizes whether enough symptom input exists', () => {
    expect(hasSymptomInput({})).toBe(false);
    expect(hasSymptomInput({ freeText: 'not eating' })).toBe(true);
    expect(hasSymptomInput({ symptoms: ['coughing'] })).toBe(true);
  });
});
