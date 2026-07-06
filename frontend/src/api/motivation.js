import axios from 'axios';

const API_BASE = '/api';

export const motivationAPI = {
  generate: async (vacatureIds, profile) => {
    const response = await axios.post(`${API_BASE}/motivation`, {
      vacatureIds,
      profile
    });
    return response.data;
  }
};
