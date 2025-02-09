import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { functionConfig } from '../config';

// Delete all streams except the current user's
export const deleteAllStreamsExcept = functions.https.onCall(functionConfig, async (request) => {
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'no cap, you need to be authenticated fr fr');
        }

        const db = admin.firestore();
        let deletedCount = 0;

        // Get the user's stream
        const userStreams = await db.collection('users')
            .where('uploadedBy', '==', request.auth.uid)
            .limit(1)
            .get();

        if (userStreams.empty) {
            throw new functions.https.HttpsError('not-found', 'no stream found for this user fr fr');
        }

        const userStreamId = userStreams.docs[0].id;

        // Delete all other streams
        const allStreams = await db.collection('users').get();
        const batch = db.batch();

        allStreams.forEach(doc => {
            if (doc.id !== userStreamId) {
                batch.delete(doc.ref);
                deletedCount++;
            }
        });

        await batch.commit();

        console.log(`Successfully deleted ${deletedCount} streams, keeping user's stream`);
        return {
            success: true,
            message: `Successfully deleted ${deletedCount} streams, keeping user's stream`,
            deletedCount
        };

    } catch (error) {
        console.error('Error deleting streams:', error);
        throw new functions.https.HttpsError('internal', 'failed to delete streams fr fr');
    }
}); 