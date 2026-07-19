import express from 'express';
import { notifyVet } from '../controllers/telemedicineController';

const router = express.Router();

router.post('/notify-vet', notifyVet);

export default router;