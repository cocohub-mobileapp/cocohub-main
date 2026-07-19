import express from 'express';
import { generatePDF } from '../services/pdfParserService';

const router = express.Router();

router.post('/generate-pdf', async (req, res) => {
  try {
    const pdfUrl = await generatePDF(req.body);
    res.json({ url: pdfUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;