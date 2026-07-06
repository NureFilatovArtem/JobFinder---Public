/**
 * Base AI Provider Interface
 * All AI providers must extend this class
 */

class AIProvider {
    /**
     * Generate content for asset type
     * @param {Object} params
     * @param {string} params.assetType - 'resume', 'cover_letter', 'follow_up'
     * @param {Object} params.userProfile - User data
     * @param {Object} params.vacancy - Job details
     * @param {Object} params.userInput - User-provided input (optional)
     * @returns {Promise<string>} Generated text content
     */
    async generateContent({ assetType, userProfile, vacancy, userInput = {} }) {
        throw new Error('generateContent must be implemented by subclass');
    }

    /**
     * Get provider name for logging
     * @returns {string}
     */
    getName() {
        throw new Error('getName must be implemented by subclass');
    }
}

module.exports = AIProvider;
