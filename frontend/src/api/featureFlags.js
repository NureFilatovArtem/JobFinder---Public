import client from './client';

/**
 * Feature Flags API
 */
export const featureFlagsAPI = {
    get: async (key) => {
        const res = await client.get(`/feature-flags/${key}`);
        return res.data;
    },

    set: async (key, value) => {
        const res = await client.put(`/feature-flags/${key}`, { value });
        return res.data;
    }
};

/**
 * Auto Apply Access API
 * Separate from feature flags — different concern.
 */
export const autoApplyAccessAPI = {
    check: async () => {
        const res = await client.get('/auto-apply/access');
        return res.data; // { hasAccess, featureEnabled, isPrivileged }
    }
};
