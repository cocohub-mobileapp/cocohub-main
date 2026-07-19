import { fetch } from 'cross-fetch';
import { API_URL } from './config';

export const generatePDF = async (): Promise<string> => {
  try {
    const response = await fetch(`${API_URL}/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        petInfo: {
          name: 'Buddy',
          species: 'Dog',
          breed: 'Golden Retriever',
          age: 5,
        },
        healthScore: 85,
        weightChart: [
          { date: '2023-01-01', weight: 25 },
          { date: '2023-02-01', weight: 26 },
          { date: '2023-03-01', weight: 27 },
        ],
        activeMedications: ['Vitamin C', 'Antibiotics'],
        upcomingAppointments: [
          { date: '2023-10-15', time: '10:00 AM', description: 'Annual Checkup' },
        ],
        recentRecords: [
          { date: '2023-09-01', description: 'Vaccination' },
          { date: '2023-08-15', description: 'Dental Cleaning' },
        ],
      })
    });

    if (response.ok) {
      const { url } = await response.json();
      return url;
    } else {
      throw new Error('Failed to generate PDF');
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};