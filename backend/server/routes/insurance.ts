import express, { Request, Response } from 'express';
import multer from'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

router.post('/claims', upload.any(), async (req: Request, res: Response) => {
  const { description, amount } = req.body;
  const attachments = req.files;

  if (!description ||!amount ||!attachments) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Simulate claim processing
  const claimId = Math.random().toString(36).substr(2, 9);
  const status ='submitted';

  // Save claim details to a database (not implemented here)
  // For simplicity, we'll just return a simulated response

  res.json({ id: claimId, status, description, amount, attachments: attachments.map((file: any) => file.path) });
});

export default router;