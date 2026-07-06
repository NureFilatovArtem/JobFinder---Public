// Form Analyzer Service - Uses Gemini AI to analyze job application forms
// Returns JSON action plans for the Chrome extension to execute

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

class FormAnalyzerService {
    constructor() {
        // Load all available API keys
        this.keys = [
            process.env.GEMINI_API_KEY_1,
            process.env.GEMINI_API_KEY_2,
            process.env.GEMINI_API_KEY2,
            process.env.GEMINI_API_KEY_3,
            process.env.GEMINI_API_KEY_4,
            process.env.GEMINI_API_KEY_5
        ].filter(key => key && !key.includes('your_gemini'));

        this.currentKeyIndex = 0;
        this.failedKeys = new Set();

        console.log(`FormAnalyzerService initialized with ${this.keys.length} API keys`);
    }

    getCurrentKey() {
        return this.keys[this.currentKeyIndex];
    }

    rotateKey() {
        this.failedKeys.add(this.currentKeyIndex);
        this.currentKeyIndex = (this.currentKeyIndex + 1) % this.keys.length;

        if (this.failedKeys.size >= this.keys.length) {
            console.log('All Gemini keys tried, resetting...');
            this.failedKeys.clear();
        }

        console.log(`Rotated to Gemini key index: ${this.currentKeyIndex}`);
    }

    /**
     * Analyze job application page HTML and return action plan
     * @param {string} html - The page HTML content
     * @param {string} pageUrl - The URL of the job page
     * @param {object} userProfile - User's profile data (name, email, phone, etc.)
     * @returns {Promise<object>} Action plan JSON
     */
    async analyzeForm(html, pageUrl, userProfile = {}) {
        if (this.keys.length === 0) {
            throw new Error('No Gemini API keys configured');
        }

        // Truncate HTML to avoid token limits (keep first 50KB)
        const truncatedHtml = html.length > 50000 ? html.substring(0, 50000) : html;

        const maxRetries = this.keys.length * 2;
        let attempts = 0;

        while (attempts < maxRetries) {
            try {
                const key = this.getCurrentKey();
                if (!key) {
                    this.rotateKey();
                    attempts++;
                    continue;
                }

                const genAI = new GoogleGenerativeAI(key);
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

                const prompt = this.buildAnalysisPrompt(truncatedHtml, pageUrl, userProfile);

                console.log(`Analyzing form from ${pageUrl} using key ${this.currentKeyIndex + 1}...`);

                const generatePromise = model.generateContent(prompt);
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Gemini timeout after 30 seconds')), 30000)
                );

                const result = await Promise.race([generatePromise, timeoutPromise]);
                const response = await result.response;
                const text = response.text();

                // Parse JSON response
                const actionPlan = this.parseActionPlan(text);
                console.log(`Form analysis complete: ${actionPlan.action_plan.length} actions, captcha: ${actionPlan.captcha_detected}`);

                return actionPlan;

            } catch (error) {
                console.error(`Gemini key ${this.currentKeyIndex + 1} error:`, error.message);

                if (error.message.includes('quota') ||
                    error.message.includes('rate limit') ||
                    error.message.includes('429') ||
                    error.message.includes('RESOURCE_EXHAUSTED')) {
                    this.rotateKey();
                } else {
                    this.rotateKey();
                }

                attempts++;

                if (attempts >= maxRetries) {
                    throw new Error(`Form analysis failed after ${attempts} attempts: ${error.message}`);
                }
            }
        }

        throw new Error('Form analysis failed: All Gemini keys exhausted');
    }

    buildAnalysisPrompt(html, pageUrl, userProfile) {
        return `You are a web automation expert. Analyze this job application page HTML and identify all form fields that need to be filled.

Page URL: ${pageUrl}

User Profile Data Available:
- name: "${userProfile.name || 'John Doe'}"
- email: "${userProfile.email || 'user@example.com'}"
- phone: "${userProfile.phone || '+32 XXX XXX XXX'}"
- resume_url: Available (PDF file)

HTML Content:
\`\`\`html
${html}
\`\`\`

Analyze the form and return ONLY a valid JSON object (no markdown, no explanation) following this exact schema:

{
  "action_plan": [
    {"type": "input", "selector": "CSS_SELECTOR", "value_key": "user.name"},
    {"type": "input", "selector": "CSS_SELECTOR", "value_key": "user.email"},
    {"type": "input", "selector": "CSS_SELECTOR", "value_key": "user.phone"},
    {"type": "upload", "selector": "CSS_SELECTOR", "value_key": "user.resume"},
    {"type": "click", "selector": "CSS_SELECTOR", "description": "Submit button"}
  ],
  "captcha_detected": false,
  "form_type": "direct_apply",
  "requires_login": false,
  "external_redirect": null,
  "notes": "Any important observations"
}

Rules:
1. type can be: "input", "textarea", "select", "checkbox", "radio", "upload", "click"
2. value_key maps to user profile fields: "user.name", "user.email", "user.phone", "user.resume"
3. For select dropdowns, include "options" array if visible
4. form_type: "direct_apply", "external_link", "email_only", "login_required"
5. If CAPTCHA is detected (reCAPTCHA, hCaptcha, etc.), set captcha_detected: true
6. Use specific, robust CSS selectors (prefer id > name > class > tag)
7. Order actions in the sequence they should be executed
8. Include the submit button as the last click action

Return ONLY the JSON object, nothing else.`;
    }

    parseActionPlan(text) {
        try {
            let jsonText = text.trim();

            // Remove markdown code blocks if present
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```\n?/g, '');
            }

            const parsed = JSON.parse(jsonText);

            // Validate required fields
            if (!Array.isArray(parsed.action_plan)) {
                throw new Error('action_plan must be an array');
            }

            // Ensure all required fields exist
            return {
                action_plan: parsed.action_plan.map(action => ({
                    type: action.type || 'input',
                    selector: action.selector || '',
                    value_key: action.value_key || null,
                    description: action.description || null,
                    options: action.options || null
                })),
                captcha_detected: parsed.captcha_detected || false,
                form_type: parsed.form_type || 'unknown',
                requires_login: parsed.requires_login || false,
                external_redirect: parsed.external_redirect || null,
                notes: parsed.notes || null
            };

        } catch (parseError) {
            console.error('Failed to parse Gemini response:', parseError.message);
            console.error('Response text (first 500 chars):', text.substring(0, 500));

            // Return a fallback indicating analysis failed
            return {
                action_plan: [],
                captcha_detected: false,
                form_type: 'parse_error',
                requires_login: false,
                external_redirect: null,
                notes: `Parse error: ${parseError.message}`,
                raw_response: text.substring(0, 1000)
            };
        }
    }
}

module.exports = new FormAnalyzerService();
