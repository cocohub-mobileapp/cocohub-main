import axios from 'axios';

const API_URL = '/api/insurance/claims';

export const postClaim = async (formData: FormData) => {
  try {
    const response = await axios.post(API_URL, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to submit claim');
  }
};