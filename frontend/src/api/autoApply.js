import client from './client';

export const autoApplyAPI = {
    // Add single vacancy to the queue
    addToQueue: async (vacancyId) => {
        // Handle both single ID and array
        if (Array.isArray(vacancyId)) {
            console.log('[API] Adding bulk vacancies:', vacancyId.length);
            const response = await client.post('/auto-apply/queue/bulk', { vacancy_ids: vacancyId });
            console.log('[API] Bulk add response:', response.status, response.data);
            return response.data;
        }
        console.log('[API] Adding single vacancy:', vacancyId);
        const response = await client.post('/auto-apply/queue', { vacancy_id: vacancyId });
        console.log('[API] Single add response:', response.status, response.data);
        return response.data;
    },

    // Bulk add vacancies to queue (explicit)
    addToQueueBulk: async (vacancyIds) => {
        console.log('[API] addToQueueBulk called with', vacancyIds?.length, 'IDs');
        const response = await client.post('/auto-apply/queue/bulk', { vacancy_ids: vacancyIds });
        console.log('[API] Bulk response:', response.data);
        return response.data;
    },

    // Get statuses for all enqueued vacancies
    getStatuses: async () => {
        const response = await client.get('/auto-apply/status');
        console.log('[API] getStatuses returned', Object.keys(response.data || {}).length, 'statuses');
        return response.data;
    },

    // Get full queue for AutoApply page
    getQueue: async () => {
        const response = await client.get('/auto-apply/queue');
        console.log('[API] getQueue returned', response.data?.queue?.length || 0, 'items');
        return response.data;
    }
};

