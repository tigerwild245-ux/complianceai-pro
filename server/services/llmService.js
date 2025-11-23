// PATH: server/services/llmService.js

const { logger } = require('../utils/logger'); 
// Assuming the actual Gemini SDK methods are imported or defined here (e.g., gemini.models.generateContent)

const MAX_RETRIES = 5;
const RATE_LIMIT_CODE = 429;

/**
 * Utility function to wait for a specific duration.
 * @param {number} ms - milliseconds to wait.
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Handles API calls with built-in exponential backoff for rate limiting (429) errors.
 * @param {Function} apiCall - The function that performs the actual LLM call.
 * @param {string} taskName - Descriptive name for logging.
 */
const retryWithBackoff = async (apiCall, taskName, requestId) => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Attempt the API call
            const result = await apiCall();
            return result; 

        } catch (error) {
            // Check for the specific Rate Limit error (429)
            const isRateLimit = error.status === RATE_LIMIT_CODE || error.message.includes(RATE_LIMIT_CODE);

            if (isRateLimit && attempt < MAX_RETRIES) {
                // Calculate backoff time: 2^attempt * 1000ms (1s, 2s, 4s, 8s, 16s...)
                const backoffTime = Math.pow(2, attempt) * 1000; 
                
                logger.warn(`[LLM Service] Rate limit hit for ${taskName}. Retrying in ${backoffTime / 1000}s (Attempt ${attempt}/${MAX_RETRIES})`, { requestId });
                
                await delay(backoffTime);
                continue; // Loop continues to the next attempt

            } else {
                // Re-throw if it's not a rate limit error or if max retries reached
                logger.error(`[LLM Service] Task failed after ${attempt} attempts: ${taskName}`, error, { requestId });
                throw error;
            }
        }
    }
};

// --- EXAMPLE INTEGRATION ---

const generateBio = async (subjectName, matches, requestId) => {
    const bioApiCall = async () => {
        // [Existing LLM logic goes here]
        // const prompt = buildBioPrompt(subjectName, matches);
        // return await gemini.models.generateContent(prompt);
        return "Generated Bio text"; // Placeholder for actual LLM call
    };

    return retryWithBackoff(bioApiCall, 'Bio Generation', requestId);
};

// ... other functions (generateAnalysis) should also use retryWithBackoff ...

module.exports = { 
    generateBio, 
    // ... other exports 
};