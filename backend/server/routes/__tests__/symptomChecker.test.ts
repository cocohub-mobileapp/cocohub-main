import express from 'express';
import request from 'supertest';

import symptomCheckerRouter from '../symptomChecker';

const app = express();
app.use(express.json());
app.use('/api/symptom-checker', symptomCheckerRouter);

describe('Symptom checker routes', () => {
  it('returns symptom checklist options', async () => {
    const response = await request(app).get('/api/symptom-checker/symptoms');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(expect.arrayContaining(['Vomiting', 'Lethargy']));
  });

  it('analyzes selected symptoms and breed context', async () => {
    const response = await request(app)
      .post('/api/symptom-checker/check')
      .send({
        species: 'dog',
        breed: 'Labrador Retriever',
        selectedSymptoms: ['Ear shaking', 'Scratching'],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.urgency).toBe('low');
    expect(response.body.data.probableConditions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ condition: 'Labrador Retriever risk: ear infections' }),
      ]),
    );
  });

  it('rejects empty symptom requests', async () => {
    const response = await request(app).post('/api/symptom-checker/check').send({
      breed: 'Mixed',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('SYMPTOMS_REQUIRED');
  });
});
