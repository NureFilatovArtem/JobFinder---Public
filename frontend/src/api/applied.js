// API functions for applied vacatures
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export const appliedAPI = {
  // Get all applied vacatures
  getAll: async () => {
    const response = await axios.get(`${API_BASE_URL}/applied`);
    return response.data;
  },

  // Mark vacature as applied
  markAsApplied: async (vacatureId) => {
    const response = await axios.post(`${API_BASE_URL}/applied`, { vacatureId });
    return response.data;
  },

  // Check if vacature is applied
  isApplied: async (vacatureId) => {
    const response = await axios.get(`${API_BASE_URL}/applied/${vacatureId}`);
    return response.data;
  }
};

