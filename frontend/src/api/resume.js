import client from './client';

export const resumeAPI = {
    // Fetch user's resume
    get: async () => {
        const response = await client.get('/resume');
        return response.data;
    },

    // Upload PDF and extract text
    upload: async (file) => {
        const formData = new FormData();
        formData.append('resume', file);

        const response = await client.post('/resume/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // Generate resume from structured data
    generate: async (data) => {
        const response = await client.post('/resume/generate', data);
        return response.data;
    },

    // Update resume data
    update: async (data) => {
        const response = await client.put('/resume', data);
        return response.data;
    },

    // Regenerate PDF from current data
    regeneratePDF: async () => {
        const response = await client.post('/resume/regenerate-pdf', {});
        return response.data;
    },

    // Upload profile photo
    uploadPhoto: async (file) => {
        const formData = new FormData();
        formData.append('photo', file);

        const response = await client.post('/resume/photo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    // Toggle show/hide photo
    togglePhoto: async (showPhoto) => {
        const response = await client.put('/resume/photo-toggle', { show_photo: showPhoto });
        return response.data;
    },

    // Generate AI skill descriptions from work experience context
    generateSkillDescriptions: async (skills, work_experience, projects) => {
        const response = await client.post('/resume/generate-skill-descriptions', { skills, work_experience, projects });
        return response.data;
    },

    // Delete resume
    delete: async () => {
        const response = await client.delete('/resume');
        return response.data;
    }
};
