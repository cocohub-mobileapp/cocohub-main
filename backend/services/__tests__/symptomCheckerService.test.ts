import { analyzeSymptoms, symptomOptions } from '../symptomCheckerService';

describe('symptomCheckerService', () => {
  it('flags emergency red signs with immediate actions', () => {
    const analysis = analyzeSymptoms({
      species: 'dog',
      breed: 'French Bulldog',
      symptoms: 'Fast breathing, pale gums, and collapse after heat exposure',
    });

    expect(analysis.urgency).toBe('emergency');
    expect(analysis.probableConditions[0].condition).toBe('Emergency warning signs');
    expect(analysis.recommendedActions[0]).toContain('emergency veterinarian');
  });

  it('adds breed-specific context from the existing breed database', () => {
    const analysis = analyzeSymptoms({
      species: 'dog',
      breed: 'Labrador Retriever',
      selectedSymptoms: ['Ear shaking', 'Scratching'],
    });

    expect(analysis.urgency).toBe('low');
    expect(analysis.probableConditions.map((item) => item.condition)).toEqual(
      expect.arrayContaining(['Ear or skin irritation', 'Labrador Retriever risk: ear infections']),
    );
  });

  it('returns a useful general result for nonspecific symptoms', () => {
    const analysis = analyzeSymptoms({
      species: 'cat',
      symptoms: 'Seems a little different today',
    });

    expect(analysis.urgency).toBe('low');
    expect(analysis.probableConditions[0].condition).toBe('General health concern');
    expect(analysis.disclaimer).toContain('not veterinary advice');
  });

  it('exports symptom options for the checklist UI', () => {
    expect(symptomOptions).toEqual(expect.arrayContaining(['Vomiting', 'Fast breathing']));
  });
});
