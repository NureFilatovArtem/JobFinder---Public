/**
 * AI Provider Factory
 * Creates appropriate AI provider based on AI_MODE environment variable
 */

const MockProvider = require('./MockProvider');
const GeminiProvider = require('./GeminiProvider');
const OpenAIProvider = require('./OpenAIProvider');

class AIProviderFactory {
    /**
     * Create AI provider based on environment configuration
     * @returns {AIProvider}
     */
    static create() {
        const mode = process.env.AI_MODE || 'mock';

        console.log(`🤖 AI Provider Mode: ${mode.toUpperCase()}`);

        switch (mode.toLowerCase()) {
            case 'mock':
                const seed = parseInt(process.env.AI_MOCK_SEED) || 12345;
                return new MockProvider(seed);

            case 'test':
                try {
                    const geminiService = require('../geminiService');
                    return new GeminiProvider(geminiService);
                } catch (error) {
                    console.error('Failed to load Gemini service:', error);
                    throw new Error('Gemini service not available. Check GEMINI_API_KEY configuration.');
                }

            case 'prod':
                if (!process.env.OPENAI_API_KEY) {
                    throw new Error('OPENAI_API_KEY is required when AI_MODE=prod');
                }
                try {
                    const OpenAI = require('openai');
                    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                    return new OpenAIProvider(openai);
                } catch (error) {
                    console.error('Failed to initialize OpenAI:', error);
                    throw new Error('OpenAI initialization failed. Check OPENAI_API_KEY.');
                }

            default:
                console.warn(`Unknown AI_MODE: ${mode}, falling back to mock`);
                return new MockProvider();
        }
    }
}

module.exports = AIProviderFactory;
