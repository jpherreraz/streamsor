"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkCloudflareWithRetry = exports.functionConfig = exports.cloudflareApiToken = exports.cloudflareAccountId = void 0;
const params_1 = require("firebase-functions/params");
exports.cloudflareAccountId = (0, params_1.defineSecret)('CLOUDFLARE_ACCOUNT_ID');
exports.cloudflareApiToken = (0, params_1.defineSecret)('CLOUDFLARE_API_TOKEN');
exports.functionConfig = {
    cors: true,
    maxInstances: 10,
    region: 'us-central1',
    secrets: [exports.cloudflareAccountId, exports.cloudflareApiToken]
};
// Helper function to check Cloudflare with retry logic
const checkCloudflareWithRetry = async (liveInputId, maxRetries = 3, delayMs = 1000) => {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${exports.cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`, {
                headers: {
                    'Authorization': `Bearer ${exports.cloudflareApiToken.value()}`,
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.result;
        }
        catch (error) {
            retries++;
            if (retries === maxRetries) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
};
exports.checkCloudflareWithRetry = checkCloudflareWithRetry;
//# sourceMappingURL=checkCloudflareWithRetry.js.map