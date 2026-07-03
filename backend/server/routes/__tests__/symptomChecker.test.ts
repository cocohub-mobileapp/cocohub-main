import express from 'express';
import request from 'supertest';

import symptomCheckerRouter from '../symptomChecker';

const app = express();
app.use(express.json());
app.use('/api/symptom-checker', symptomCheckerRouter);

describe('symptomChecker routes', () => {
  it('lists supported symptom options', async () => {
    const response = await request(app).get('/api/symptom-checker/symptoms');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'vomiting', label: 'Vomiting' })]),
    );
  });

  it('rejects empty symptom checks', async () => {
    const response = await request(app).post('/api/symptom-checker/check').send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a symptom analysis result', async () => {
    const response = await request(app)
      .post('/api/symptom-checker/check')
      .send({
        species: 'dog',
        breed: 'Labrador Retriever',
        symptoms: ['limping'],
        freeText: 'Favoring one back leg.',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.urgency).toBe('soon');
    expect(response.body.data.disclaimer).toContain('This is not veterinary advice');
  });
});
