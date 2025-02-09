import * as functions from 'firebase-functions';
import { cloudflareAccountId, cloudflareApiToken } from '../stream/checkCloudflareWithRetry';

// fr fr this function boutta delete all videos no cap
export const deleteAllVideos = functions.https.onRequest(async (request, response) => {
    try {
        console.log('finna get all them videos first');
        const listResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream`, {
            headers: {
                'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                'Content-Type': 'application/json',
            },
        });

        if (!listResponse.ok) {
            console.error('Cloudflare API acting sus:', listResponse.status);
            throw new Error('Cloudflare API not bussin rn');
        }

        const data = await listResponse.json();
        if (!data.success || !Array.isArray(data.result)) {
            console.error('Cloudflare response ain\'t it chief:', data);
            throw new Error('Cloudflare data format acting sus fr fr');
        }

        console.log(`found ${data.result.length} videos to delete`);

        // delete each video one by one no cap
        const deletePromises = data.result.map(async (video: any) => {
            console.log(`finna delete video ${video.uid}`);
            const deleteResponse = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/${video.uid}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                    },
                }
            );

            if (!deleteResponse.ok) {
                console.error(`failed to delete video ${video.uid}:`, deleteResponse.status);
                return false;
            }
            return true;
        });

        const results = await Promise.all(deletePromises);
        const successCount = results.filter(Boolean).length;

        response.json({
            success: true,
            message: `deleted ${successCount} out of ${data.result.length} videos fr fr`
        });

    } catch (error) {
        console.error('deletion failed no cap:', error);
        response.status(500).json({
            success: false,
            error: 'failed to delete videos, check logs for more info'
        });
    }
}); 