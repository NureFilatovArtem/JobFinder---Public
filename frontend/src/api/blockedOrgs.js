import client from './client';

export const blockedOrgsAPI = {
    getAll: async () => {
        const response = await client.get('/blocked-organizations');
        return response.data;
    },

    block: async (companyName, reason = null) => {
        const response = await client.post('/blocked-organizations', {
            companyName,
            reason
        });
        return response.data;
    },

    unblock: async (blockedOrgId) => {
        const response = await client.delete(`/blocked-organizations/${blockedOrgId}`);
        return response.data;
    }
};
