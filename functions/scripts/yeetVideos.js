import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get them env vars fr fr
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '..', '.env');
dotenv.config({ path: envPath });

// hardcode them secrets for testing fr fr
const CLOUDFLARE_ACCOUNT_ID = 'ad763a44ded8e093d6ef0941fa931078';
const CLOUDFLARE_API_TOKEN = 'o4qqksXK8as0TI0nqS_A8cru4LVAd6rWQGOlMW7t';

async function yeetAllVideos() {
    try {
        console.log('finna get all them videos first');
        console.log('using account ID:', CLOUDFLARE_ACCOUNT_ID);
        const listResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`, {
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });

        const responseText = await listResponse.text();
        console.log('API Response:', responseText);

        if (!listResponse.ok) {
            throw new Error(`Cloudflare API acting sus: ${listResponse.status} - ${responseText}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Failed to parse response: ${responseText}`);
        }

        if (!data.success || !Array.isArray(data.result)) {
            throw new Error('Cloudflare data format acting sus fr fr');
        }

        console.log(`found ${data.result.length} videos to yeet`);

        // delete each video one by one no cap
        for (const video of data.result) {
            console.log(`finna delete video ${video.uid}`);
            const deleteResponse = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${video.uid}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
                    },
                }
            );

            if (!deleteResponse.ok) {
                const deleteErrorText = await deleteResponse.text();
                console.error(`failed to delete video ${video.uid}:`, deleteResponse.status, deleteErrorText);
            } else {
                console.log(`yeeted video ${video.uid} fr fr`);
            }
        }

        console.log('all done! videos got yeeted successfully!');
    } catch (error) {
        console.error('failed to yeet videos fr fr:', error);
    }
}

yeetAllVideos(); 