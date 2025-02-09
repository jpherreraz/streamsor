import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { fetch } from 'undici';
import { functionConfig } from '../config';
import { cloudflareAccountId, cloudflareApiToken } from './checkCloudflareWithRetry';

interface CloudflareResponse {
    success: boolean;
    result?: {
        uid: string;
        rtmps: {
            url: string;
            streamKey: string;
        };
    };
    errors?: Array<{
        code: number;
        message: string;
    }>;
}

// Initialize user's stream setup
export const initializeUser = functions.https.onCall(functionConfig, async (request) => {
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'no cap, you need to be authenticated fr fr');
        }

        console.log('Creating new stream setup for user:', request.auth.uid);

        // Check if user already has a stream setup
        const db = admin.firestore();
        const existingStreams = await db.collection('users')
            .where('uploadedBy', '==', request.auth.uid)
            .limit(1)
            .get();

        if (!existingStreams.empty) {
            console.log('User already has a stream setup');
            const streamDoc = existingStreams.docs[0];
            return {
                message: 'stream setup already exists fr fr 🔥',
                liveInputId: streamDoc.id,
                rtmpsUrl: streamDoc.data().rtmpsUrl,
                streamKey: streamDoc.data().streamKey
            };
        }

        // Create live input in Cloudflare
        console.log('Creating new live input in Cloudflare...');
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                meta: {
                    name: 'New Stream',
                    category: 'just-chatting',
                    uploadedBy: request.auth.uid
                },
                recording: {
                    mode: 'automatic',
                    timeoutSeconds: 0,
                    requireSignedURLs: false
                }
            })
        });

        if (!response.ok) {
            console.error('Cloudflare API error:', response.status, await response.text());
            throw new functions.https.HttpsError('internal', 'Cloudflare API not bussin rn');
        }

        const data = await response.json() as CloudflareResponse;
        console.log('Cloudflare response:', data);

        if (!data.success || !data.result) {
            console.error('Invalid Cloudflare response:', data);
            throw new functions.https.HttpsError('internal', 'Cloudflare API acting sus fr fr');
        }

        const liveInputId = data.result.uid;
        const rtmpsUrl = data.result.rtmps.url;
        const streamKey = data.result.rtmps.streamKey;

        // Update user document with new stream info
        console.log('Updating Firestore with stream info...');
        await db.collection('users').doc(liveInputId).set({
            liveInputId,
            streamTitle: 'New Stream',
            streamCategory: 'just-chatting',
            email: request.auth.token.email || null,
            profilePicture: request.auth.token.picture || null,
            uploadedBy: request.auth.uid,
            rtmpsUrl,
            streamKey,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
        });

        console.log('Stream setup completed successfully!');
        return {
            message: 'stream setup bussin fr fr 🔥',
            liveInputId,
            rtmpsUrl,
            streamKey
        };
    } catch (error) {
        console.error('Error in initializeUser:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'server acting sus rn');
    }
}); 