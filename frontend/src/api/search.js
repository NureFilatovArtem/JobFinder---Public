import axios from 'axios';

const API_BASE = '/api';

export const searchAPI = {
  search: async (filters) => {
    const response = await axios.post(`${API_BASE}/search`, filters);
    return response.data;
  },

  searchAndSave: async (filters) => {
    const response = await axios.post(`${API_BASE}/search/save`, filters);
    return response.data;
  }
};

