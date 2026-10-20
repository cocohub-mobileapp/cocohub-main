import request from 'supertest';
import app from '../../app';
import { classifySymptoms } from '../predictions';

describe('AI Symptom Checker Predictions Route (#31)', () => {
  it('correctly classifies emergency symptoms', () => {
    const result = classifySymptoms('dog', 'Golden Retriever', 'My dog collapsed and is having a seizure');
    expect(result.urgency).toBe('emergency');
    expect(result.probableConditions[0].condition).toContain('Emergency');
    expect(result.recommendedActions.length).toBeGreaterThan(0);
  });

  it('correctly classifies high urgency symptoms', () => {
    const result = classifySymptoms('dog', 'Labrador', 'Persistent vomiting with blood in stool');
    expect(result.urgency).toBe('high');
    expect(result.recommendedActions[0]).toContain('same-day');
  });

  it('correctly classifies moderate urgency symptoms', () => {
    const result = classifySymptoms('cat', 'Persian', 'Mild coughing and lethargy since yesterday');
    expect(result.urgency).toBe('moderate');
  });

  it('correctly classifies low urgency symptoms', () => {
    const result = classifySymptoms('dog', 'Poodle', 'Sneezed once, otherwise playing normally');
    expect(result.urgency).toBe('low');
  });

  it('POST /api/predictions/symptoms returns 400 when symptoms are missing', async () => {
    const res = await request(app).post('/api/predictions/symptoms').send({ petId: 'p1' });
    expect(res.status).toBe(400);
  });

  it('POST /api/predictions/symptoms returns 200 with structured analysis', async () => {
    const res = await request(app)
      .post('/api/predictions/symptoms')
      .send({ petId: 'p1', species: 'dog', breed: 'Beagle', symptoms: 'Scratching ears frequently' });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.urgency).toBe('moderate');
    expect(res.body.data.probableConditions).toBeInstanceOf(Array);
  });
});
