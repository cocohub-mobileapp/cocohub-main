import { Request, Response } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import axios from 'axios';

const rateLimiter = new RateLimiterMemory({
  points: 10, // 10 requests per user per day
  duration: 86400, // 24 hours in seconds
});

const mlModelEndpoint = 'https://api.example.com/predict'; // Replace with your actual ML model endpoint

export const predictSymptoms = async (req: Request, res: Response) => {
  const { petId, species, breed, symptoms } = req.body;

  if (!petId ||!species ||!breed ||!symptoms) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await rateLimiter.consume(petId);
  } catch (rejRes) {
    return res.status(rejRes.statusCode || 429).json({ error: 'Rate limit exceeded' });
  }

  try {
    const response = await axios.post(mlModelEndpoint, { species, breed, symptoms });

    const { urgency, probableConditions, recommendedActions } = response.data;

    return res.json({ urgency, probableConditions, recommendedActions });
  } catch (error) {
    console.error('Error calling ML model:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};