import express from 'express';

import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import { ok } from '../response';
import { store } from '../store';

const router = express.Router();

router.use(authenticateJWT);

interface EarnedTokenBalance {
  assetCode: 'PETC' | 'VETH' | 'PAWP';
  balance: string;
  source: string;
}

function formatBalance(value: number): string {
  return value.toFixed(2);
}

router.get('/earned-balances', (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id ?? '';
  const pets = [...store.pets.values()].filter((pet) => pet.ownerId === userId);
  const petIds = new Set(pets.map((pet) => pet.id));

  const medicalRecordCount = [...store.medicalRecords.values()].filter((record) =>
    petIds.has(record.petId),
  ).length;
  const completedAppointmentCount = [...store.appointments.values()].filter(
    (appointment) => petIds.has(appointment.petId) && String(appointment.status) === 'COMPLETED',
  ).length;
  const activeReferralCredits = [...store.referralCredits.values()].filter(
    (credit) => credit.userId === userId && credit.status === 'active',
  );
  const premiumDays = activeReferralCredits.reduce((sum, credit) => sum + credit.amount, 0);

  const balances: EarnedTokenBalance[] = [
    {
      assetCode: 'PETC',
      balance: formatBalance(medicalRecordCount * 5 + pets.length * 10),
      source: 'Pet profiles and health activity',
    },
    {
      assetCode: 'VETH',
      balance: formatBalance(completedAppointmentCount * 3),
      source: 'Completed veterinary appointments',
    },
    {
      assetCode: 'PAWP',
      balance: formatBalance(premiumDays),
      source: 'Referral and loyalty rewards',
    },
  ];

  res.json(ok({ balances }));
});

export default router;
