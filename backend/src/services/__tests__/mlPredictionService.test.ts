import { predictSymptoms, getProvider, predictFallback } from '../mlPredictionService';

describe('mlPredictionService', () => {
  describe('getProvider', () => {
    afterEach(() => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.HUGGINGFACE_API_KEY;
    });

    it('returns fallback when no API keys are configured', () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.HUGGINGFACE_API_KEY;
      expect(getProvider()).toBe('fallback');
    });

    it('returns openai when OPENAI_API_KEY is set', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.HUGGINGFACE_API_KEY;
      expect(getProvider()).toBe('openai');
    });
  });

  describe('predictFallback', () => {
    it('returns emergency urgency for life-threatening keywords', () => {
      const result = predictFallback({
        petId: '1',
        species: 'dog',
        breed: 'Labrador',
        symptoms: 'My dog is having a seizure and difficulty breathing',
      });
      expect(result.urgency).toBe('emergency');
      expect(result.probableConditions.length).toBeGreaterThan(0);
      expect(result.recommendedActions.length).toBeGreaterThan(0);
      expect(result.disclaimer).toContain('informational only');
    });

    it('returns moderate urgency for common symptoms', () => {
      const result = predictFallback({
        petId: '1',
        species: 'cat',
        breed: 'Persian',
        symptoms: 'Not eating for 2 days and seems lethargic',
      });
      expect(result.urgency).toBe('moderate');
    });

    it('returns low urgency for mild symptoms', () => {
      const result = predictFallback({
        petId: '1',
        species: 'dog',
        breed: 'Poodle',
        symptoms: 'Seems a bit quiet today',
      });
      expect(result.urgency).toBe('low');
    });

    it('always includes a disclaimer', () => {
      const result = predictFallback({
        petId: '1',
        species: 'dog',
        breed: 'Labrador',
        symptoms: 'mild cough',
      });
      expect(result.disclaimer).toBeTruthy();
      expect(result.disclaimer.length).toBeGreaterThan(20);
    });

    it('always returns at least one condition and one action', () => {
      const result = predictFallback({
        petId: '1',
        species: 'cat',
        breed: 'Mixed',
        symptoms: 'something unusual',
      });
      expect(result.probableConditions.length).toBeGreaterThan(0);
      expect(result.recommendedActions.length).toBeGreaterThan(0);
    });
  });

  describe('predictSymptoms (fallback mode)', () => {
    it('returns a valid prediction when no API keys are configured', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.HUGGINGFACE_API_KEY;

      const result = await predictSymptoms({
        petId: '1',
        species: 'dog',
        breed: 'Labrador',
        symptoms: 'vomiting and lethargic',
      });

      expect(result.urgency).toBe('moderate');
      expect(result.probableConditions).toBeInstanceOf(Array);
      expect(result.recommendedActions).toBeInstanceOf(Array);
      expect(result.disclaimer).toBeTruthy();
    });
  });
});
