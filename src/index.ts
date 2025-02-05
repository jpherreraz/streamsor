import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';

const cloudflareAccountId = defineSecret('CLOUDFLARE_ACCOUNT_ID');
const cloudflareApiToken = defineSecret('CLOUDFLARE_API_TOKEN');

interface CloudflareResponse {
  success: boolean;
  result: {
    uid: string;
  };
}

// Function config
const functionConfig = {
  cors: true,
};

export const startStream = onRequest({ 
  secrets: [cloudflareAccountId, cloudflareApiToken],
  ...functionConfig 
}, async (req, res) => {
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cloudflareApiToken.value()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meta: { name: "live_input" },
        recording: { mode: "automatic" }
      })
    });

    const data = await response.json() as CloudflareResponse;
    
    if (!data.success || !data.result) {
      throw new Error('Failed to create stream');
    }

    res.json({ streamId: data.result.uid });
  } catch (error) {
    console.error('Error creating stream:', error);
    res.status(500).json({ error: 'Failed to create stream' });
  }
}); 