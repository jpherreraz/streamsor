import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { checkCloudflareWithRetry } from './checkCloudflareWithRetry';

// Cleanup stale streams every hour
export const cleanupStaleStreams = onSchedule('every 1 hours', async (event) => {
    try {
        const db = admin.firestore();
        const usersSnapshot = await db.collection('users').get();

        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            if (!userData.liveInputId) continue;

            try {
                // Check if the stream is still valid in Cloudflare
                const result = await checkCloudflareWithRetry(userData.liveInputId);
                
                if (!result) {
                    console.log(`Stream ${userData.liveInputId} not found in Cloudflare, cleaning up...`);
                    await userDoc.ref.update({
                        liveInputId: admin.firestore.FieldValue.delete(),
                        updatedAt: admin.firestore.Timestamp.now()
                    });
                }
            } catch (error) {
                console.error(`Error checking stream ${userData.liveInputId}:`, error);
            }
        }

        console.log('Stream cleanup completed fr fr 🧹');
    } catch (error) {
        console.error('Error in cleanupStaleStreams:', error);
        throw error;
    }
}); 