/**
 * Gemini AI Provider
 * Uses Gemini 1.5 Flash for content generation (test mode)
 */

const AIProvider = require('./AIProvider');

class GeminiProvider extends AIProvider {
    constructor(geminiService) {
        super();
        this.gemini = geminiService;
    }

    async generateContent({ assetType, userProfile, vacancy, userInput = {} }) {
        const prompt = this.buildPrompt(assetType, userProfile, vacancy, userInput);

        try {
            const model = this.gemini._getModel().model;
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Gemini generation error:', error);
            throw new Error(`Gemini API error: ${error.message}`);
        }
    }

    buildPrompt(assetType, userProfile, vacancy, userInput) {
        const prompts = {
            resume: this.buildResumePrompt,
            cover_letter: this.buildCoverLetterPrompt,
            follow_up: this.buildFollowUpPrompt
        };

        if (!prompts[assetType]) {
            throw new Error(`Unknown asset type: ${assetType}`);
        }

        return prompts[assetType].call(this, userProfile, vacancy, userInput);
    }

    buildResumePrompt(userProfile, vacancy, userInput) {
        return `Generate a professional ATS-friendly resume for this job application.

**Job Details:**
- Title: ${vacancy.title}
- Company: ${vacancy.company_name}
- Description: ${userInput.pasted_job_description || vacancy.description || 'N/A'}
- Required Skills: ${vacancy.required_skills?.join(', ') || 'N/A'}

**Candidate Profile:**
- Name: ${userProfile.name}
- Email: ${userProfile.email}
- Phone: ${userProfile.phone || 'N/A'}
- Skills: ${userProfile.skills?.join(', ') || 'N/A'}
- Languages: ${userProfile.languages?.join(', ') || 'N/A'}

**User-Provided Information:**
${userInput.experience_summary ? `Experience Summary: ${userInput.experience_summary}` : ''}
${userInput.achievements ? `Key Achievements:\n${userInput.achievements}` : ''}
${userInput.work_history ? `Work History:\n${userInput.work_history}` : ''}

**Instructions:**
Generate a complete, professional resume in plain text format with these sections:
1. Contact Information
2. Professional Summary (2-3 sentences, tailored to the job)
3. Skills (emphasize skills matching the job requirements)
4. Work Experience (if provided)
5. Education (if provided)

Use markdown formatting for headers. Keep it concise and ATS-friendly.`;
    }

    buildCoverLetterPrompt(userProfile, vacancy, userInput) {
        return `Generate a professional cover letter for this job application.

**Job Details:**
- Title: ${vacancy.title}
- Company: ${vacancy.company_name}
- Description: ${userInput.pasted_job_description || vacancy.description || 'N/A'}

**Candidate:**
- Name: ${userProfile.name}
- Skills: ${userProfile.skills?.join(', ') || 'N/A'}

**User Input:**
${userInput.motivation ? `Motivation: ${userInput.motivation}` : ''}
${userInput.why_fit ? `Why I'm a fit: ${userInput.why_fit}` : ''}

**Instructions:**
Write a compelling cover letter (3-4 paragraphs) that:
1. Expresses genuine interest in the position
2. Highlights relevant skills and experience
3. Explains why the candidate is a good fit
4. Includes a professional closing

Use professional but warm tone. Format with proper business letter structure.`;
    }

    buildFollowUpPrompt(userProfile, vacancy, userInput) {
        return `Generate a professional follow-up email for a job application.

**Job Details:**
- Title: ${vacancy.title}
- Company: ${vacancy.company_name}

**Candidate:**
- Name: ${userProfile.name}

**User Input:**
${userInput.follow_up_message ? `Message: ${userInput.follow_up_message}` : ''}

**Instructions:**
Write a brief, professional follow-up email (2-3 paragraphs) that:
1. References the application submission
2. Reiterates interest in the position
3. Politely inquires about the application status
4. Thanks the recipient for their time

Keep it concise and respectful. Include a subject line.`;
    }

    getName() {
        return 'GeminiProvider';
    }
}

module.exports = GeminiProvider;
