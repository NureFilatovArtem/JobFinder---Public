const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

class RotationalGeminiClient {
  constructor() {
    this.apiKeys = [
      process.env.GEMINI_API_KEY1,
      process.env.GEMINI_API_KEY2,
      process.env.GEMINI_API_KEY3,
      process.env.GEMINI_API_KEY4,
      process.env.GEMINI_API_KEY5
    ].filter(key => key); // Filter out undefined keys

    if (this.apiKeys.length === 0) {
      console.warn("⚠️ No GEMINI_API_KEYs found in environment variables!");
    } else {
      console.log(`✨ Loaded ${this.apiKeys.length} Gemini API keys for rotation.`);
    }

    this.currentKeyIndex = 0;
    this.models = this.apiKeys.map(key => {
      const genAI = new GoogleGenerativeAI(key);
      return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    });
  }

  _getModel() {
    if (this.models.length === 0) {
      throw new Error("No Gemini API keys available.");
    }
    const model = this.models[this.currentKeyIndex];
    const keyUsed = this.currentKeyIndex + 1; // 1-based index for logging

    // Rotate to next key
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.models.length;

    return { model, keyId: keyUsed };
  }

  /**
   * Generates a match score and explanation for a vacancy based on user profile.
   * @param {string} profileText - Text representation of user profile (skills, experience, etc.)
   * @param {string} vacancyText - Text representation of vacancy (title, description)
   * @returns {Promise<{score: number, reason: string}>}
   */
  async generateMatchScore(profileText, vacancyText, attempt = 0) {
    const MAX_RETRIES = 3;

    try {
      const { model, keyId } = this._getModel();
      console.log(`🤖 Scoring with Gemini 2.5 Flash (Key ${keyId})...`);

      const prompt = `You are an expert HR recruiter. Compare the Candidate Profile and Job Vacancy below.

CANDIDATE PROFILE:
${profileText}

JOB VACANCY:
${vacancyText}

Return ONLY a JSON object (no markdown):
{"score": <0-100>, "reason": "<one sentence, max 20 words>"}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

      try {
        const data = JSON.parse(jsonStr);
        return {
          score: typeof data.score === 'number' ? Math.round(data.score) : 0,
          reason: data.reason || 'AI analysis completed.'
        };
      } catch (parseError) {
        console.error('Failed to parse Gemini response:', text);
        return { score: 0, reason: 'Error parsing AI response' };
      }

    } catch (error) {
      // Handle rate limit: wait the suggested delay then retry with next key
      if (error.message?.includes('429') && attempt < MAX_RETRIES) {
        const delayMatch = error.message.match(/retryDelay":"(\d+)s"/);
        const waitSec = delayMatch ? parseInt(delayMatch[1]) + 2 : 45;
        console.log(`⏳ Rate limited (key exhausted). Waiting ${waitSec}s then retrying... (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, waitSec * 1000));
        return this.generateMatchScore(profileText, vacancyText, attempt + 1);
      }
      console.error('Gemini API Error:', error.message);
      throw error;
    }
  }
}

// Singleton instance
const geminiService = new RotationalGeminiClient();

module.exports = geminiService;
