import { defineSecret } from 'firebase-functions/params';
import { HttpsOptions } from 'firebase-functions/v2/https';

export const cloudflareAccountId = defineSecret('CLOUDFLARE_ACCOUNT_ID');
export const cloudflareApiToken = defineSecret('CLOUDFLARE_API_TOKEN');

// Shared function config with CORS enabled fr fr
export const functionConfig: HttpsOptions = {
    cors: true, // Allow all origins no cap
    maxInstances: 10,
    region: 'us-central1',
    secrets: [cloudflareAccountId, cloudflareApiToken]
};

export const RATE_LIMIT_BACKOFF = {
  initialDelay: 1000,
  maxDelay: 10000,
  maxAttempts: 3,
  requestDelay: 5000 // Increased from 2s to 5s
};

// Add cache for Cloudflare responses
export const CACHE_TTL = 10000; // 10 seconds

// Helper function for exponential backoff
export async function checkCloudflareWithRetry(url: string, token: string, attempt = 1): Promise<Response> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (response.status === 429 && attempt < RATE_LIMIT_BACKOFF.maxAttempts) {
      const delay = Math.min(
        RATE_LIMIT_BACKOFF.initialDelay * Math.pow(2, attempt - 1),
        RATE_LIMIT_BACKOFF.maxDelay
      );
      console.log(`Rate limited (attempt ${attempt}), waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return checkCloudflareWithRetry(url, token, attempt + 1);
    }

    return response;
  } catch (error) {
    console.error('Error in checkCloudflareWithRetry:', error);
    throw error;
  }
} 