import fetch from 'node-fetch';

// Get environment variables
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Function to create a new live input from Cloudflare
async function createLiveInput(streamKey: string): Promise<any> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          meta: { streamKey },
          recording: { mode: "automatic" }
        })
      }
    );

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || 'Failed to create live input');
    }

    return data.result;
  } catch (error) {
    console.error('Error creating live input:', error);
    throw error;
  }
}

// Function to get live input status
async function getLiveInputStatus(uid: string): Promise<any> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs/${uid}`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
        }
      }
    );

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || 'Failed to get live input status');
    }

    return data.result;
  } catch (error) {
    console.error('Error getting live input status:', error);
    throw error;
  }
}

// Function to delete a live input
async function deleteLiveInput(uid: string): Promise<void> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs/${uid}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`
        }
      }
    );

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.errors?.[0]?.message || 'Failed to delete live input');
    }
  } catch (error) {
    console.error('Error deleting live input:', error);
    throw error;
  }
}

export {
  createLiveInput, deleteLiveInput, getLiveInputStatus
};
