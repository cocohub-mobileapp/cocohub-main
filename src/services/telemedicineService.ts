import axios from 'axios';

export const notifyVet = async (vetId: string, consultationId: string) => {
  try {
    const response = await axios.post(`/api/telemedicine/notify-vet`, { vetId, consultationId });
    return response.data;
  } catch (error) {
    console.error('Failed to notify vet:', error);
    throw error;
  }
};