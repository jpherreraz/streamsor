import { defineSecret } from 'firebase-functions/params';

export const cloudflareAccountId = defineSecret('CLOUDFLARE_ACCOUNT_ID');
export const cloudflareApiToken = defineSecret('CLOUDFLARE_API_TOKEN');

export const functionConfig = {
  cors: true,
  maxInstances: 10,
  region: 'us-central1',
  secrets: [cloudflareAccountId, cloudflareApiToken]
};

// Helper function to check Cloudflare with retry logic
export const checkCloudflareWithRetry = async (liveInputId: string, maxRetries = 3, delayMs = 1000) => {
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`, {
                headers: {
                    'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.result;
        } catch (error) {
            retries++;
            if (retries === maxRetries) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}; 