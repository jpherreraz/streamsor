import { defineSecret } from 'firebase-functions/params';
import { HttpsOptions } from 'firebase-functions/v2/https';

export const cloudflareAccountId = defineSecret('CLOUDFLARE_ACCOUNT_ID');
export const cloudflareApiToken = defineSecret('CLOUDFLARE_API_TOKEN');

// Shared function config with CORS enabled fr fr
export const functionConfig: HttpsOptions = {
    cors: true, // Allow all origins no cap fr fr
    maxInstances: 10,
    timeoutSeconds: 540, // 9 minutes timeout cuz we ain't Mortis rushing in
    minInstances: 0, // No minimum instances to save costs
    memory: '512MiB', // More memory for better performance fr fr
    region: 'us-central1',
    secrets: [cloudflareAccountId, cloudflareApiToken]
};

// Rate limit backoff config with more generous limits
export const RATE_LIMIT_BACKOFF = {
    initialDelay: 2000, // Start with 2s delay
    maxDelay: 30000, // Max 30s delay
    maxAttempts: 5, // Try up to 5 times
    requestDelay: 3000 // 3s between requests
};

// Add cache for Cloudflare responses
export const CACHE_TTL = 10000;

// Helper function for exponential backoff
export async function checkCloudflareWithRetry(url: string, token: string, attempt = 1): Promise<Response> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
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

    if (!response.ok && attempt < RATE_LIMIT_BACKOFF.maxAttempts) {
      const delay = Math.min(
        RATE_LIMIT_BACKOFF.initialDelay * Math.pow(2, attempt - 1),
        RATE_LIMIT_BACKOFF.maxDelay
      );
      console.log(`Request failed (attempt ${attempt}), waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return checkCloudflareWithRetry(url, token, attempt + 1);
    }

    return response;
  } catch (error) {
    console.error('Error in checkCloudflareWithRetry:', error);
    if (attempt < RATE_LIMIT_BACKOFF.maxAttempts) {
      const delay = Math.min(
        RATE_LIMIT_BACKOFF.initialDelay * Math.pow(2, attempt - 1),
        RATE_LIMIT_BACKOFF.maxDelay
      );
      console.log(`Network error (attempt ${attempt}), waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return checkCloudflareWithRetry(url, token, attempt + 1);
    }
    throw error;
  }
} 