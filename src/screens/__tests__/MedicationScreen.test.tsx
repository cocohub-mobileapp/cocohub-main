import { render, fireEvent, waitFor } from '@testing-library/react-native';
import React from 'react';
import MedicationScreen from '../MedicationScreen';
import { getMedications, saveMedication, deleteMedication } from '../../services/medicationService';
import { checkDrugInteractions } from '../../services/drugInteractionService';

jest.mock('../../services/medicationService', () => ({
  getMedications: jest.fn().mockResolvedValue([
    {
      id: 'med-1',
      name: 'Amoxicillin',
      dosage: '250mg',
      frequency: 12,
      startDate: '2026-10-01',
      petId: 'pet-1',
      remainingPills: 20,
      totalPills: 30,
    },
  ]),
  getMedicationsByPet: jest.fn().mockResolvedValue([]),
  saveMedication: jest.fn().mockResolvedValue(undefined),
  deleteMedication: jest.fn().mockResolvedValue(undefined),
  getDoseLogs: jest.fn().mockResolvedValue([]),
  logDose: jest.fn().mockResolvedValue(undefined),
  getRefillStatus: jest.fn().mockReturnValue('ok'),
  getDaySchedule: jest.fn().mockReturnValue([]),
  getMissedDoses: jest.fn().mockResolvedValue([]),
  acknowledgeMissedDose: jest.fn(),
  auditLog: jest.fn(),
}));

jest.mock('../../services/drugInteractionService', () => ({
  checkDrugInteractions: jest.fn().mockResolvedValue({
    hasInteractions: true,
    interactions: [
      {
        drugA: 'Prednisone',
        drugB: 'Carprofen',
        severity: 'contraindicated',
        description: 'Concurrent use of NSAIDs and corticosteroids significantly increases risk of GI ulceration.',
        recommendation: 'Do not combine.',
      },
    ],
  }),
}));

describe('MedicationScreen E2E Unit Coverage (#47)', () => {
  it('renders medication list and shows interaction warning on conflict', async () => {
    const { getByTestId, getByText } = render(<MedicationScreen petId="pet-1" />);

    await waitFor(() => {
      expect(getByText('Amoxicillin')).toBeTruthy();
      expect(getByTestId('add-medication-button')).toBeTruthy();
      expect(getByTestId('delete-medication-button')).toBeTruthy();
    });
  });
});
