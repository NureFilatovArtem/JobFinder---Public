import axios from 'axios';

const API_BASE = '/api';

export const profileAPI = {
  get: async () => {
    const response = await axios.get(`${API_BASE}/profile`);
    return response.data;
  },

  update: async (profile) => {
    const response = await axios.post(`${API_BASE}/profile`, profile);
    return response.data;
  }
};
