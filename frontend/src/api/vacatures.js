import axios from 'axios';

const API_BASE = '/api';

export const vacaturesAPI = {
  getAll: async (status, options = {}) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (options.autoApplyOnly) params.append('autoApplyOnly', 'true');
    const qs = params.toString();
    const url = qs ? `${API_BASE}/vacatures?${qs}` : `${API_BASE}/vacatures`;
    const response = await axios.get(url);
    return response.data;
  },

  getById: async (id) => {
    const response = await axios.get(`${API_BASE}/vacatures/${id}`);
    return response.data;
  },

  create: async (vacature) => {
    const response = await axios.post(`${API_BASE}/vacatures`, vacature);
    return response.data;
  },

  createBulk: async (vacatures) => {
    const response = await axios.post(`${API_BASE}/vacatures/bulk`, { vacatures });
    return response.data;
  },

  updateMotivation: async (id, motivation) => {
    const response = await axios.put(`${API_BASE}/vacatures/${id}/motivation`, { motivation });
    return response.data;
  },

  updateStatus: async (id, status) => {
    const response = await axios.patch(`${API_BASE}/vacatures/${id}/status`, { status });
    return response.data;
  },

  // Helper for marking as interesting (uses status update)
  markAsInteresting: async (id, isInteresting) => {
    const status = isInteresting ? 'interessant' : 'gevonden';
    return await vacaturesAPI.updateStatus(id, status);
  },

  matchAll: async (options) => {
    const response = await axios.post(`${API_BASE}/vacatures/match-all`, options);
    return response.data;
  }
};
