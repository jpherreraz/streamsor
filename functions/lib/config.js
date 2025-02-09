"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_TTL = exports.RATE_LIMIT_BACKOFF = exports.functionConfig = exports.cloudflareApiToken = exports.cloudflareAccountId = void 0;
exports.checkCloudflareWithRetry = checkCloudflareWithRetry;
const params_1 = require("firebase-functions/params");
exports.cloudflareAccountId = (0, params_1.defineSecret)('CLOUDFLARE_ACCOUNT_ID');
exports.cloudflareApiToken = (0, params_1.defineSecret)('CLOUDFLARE_API_TOKEN');
// Shared function config with CORS enabled fr fr
exports.functionConfig = {
    cors: true, // Allow all origins no cap
    maxInstances: 10,
    region: 'us-central1',
    secrets: [exports.cloudflareAccountId, exports.cloudflareApiToken]
};
exports.RATE_LIMIT_BACKOFF = {
    initialDelay: 1000,
    maxDelay: 10000,
    maxAttempts: 3,
    requestDelay: 5000 // Increased from 2s to 5s
};
// Add cache for Cloudflare responses
exports.CACHE_TTL = 10000; // 10 seconds
// Helper function for exponential backoff
async function checkCloudflareWithRetry(url, token, attempt = 1) {
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            }
        });
        if (response.status === 429 && attempt < exports.RATE_LIMIT_BACKOFF.maxAttempts) {
            const delay = Math.min(exports.RATE_LIMIT_BACKOFF.initialDelay * Math.pow(2, attempt - 1), exports.RATE_LIMIT_BACKOFF.maxDelay);
            console.log(`Rate limited (attempt ${attempt}), waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return checkCloudflareWithRetry(url, token, attempt + 1);
        }
        return response;
    }
    catch (error) {
        console.error('Error in checkCloudflareWithRetry:', error);
        throw error;
    }
}
//# sourceMappingURL=config.js.map