import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { functionConfig } from '../config';

interface UserData {
    liveInputId: string;
    streamTitle?: string;
    streamCategory?: string;
    email?: string;
    profilePicture?: string;
    updatedAt: admin.firestore.Timestamp;
    createdAt: admin.firestore.Timestamp;
}

export const updateUserData = functions.https.onCall(functionConfig, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'no cap, you need to be authenticated fr fr');
    }

    const data = request.data as Partial<UserData>;
    if (!data.liveInputId) {
        throw new functions.https.HttpsError('invalid-argument', 'bruh where\'s the liveInputId at? 💀');
    }

    try {
        const db = admin.firestore();
        const userRef = db.collection('users').doc(data.liveInputId);
        const userDoc = await userRef.get();

        const now = admin.firestore.Timestamp.now();
        
        if (!userDoc.exists) {
            // New user just dropped
            await userRef.set({
                ...data,
                createdAt: now,
                updatedAt: now,
            });
            return { message: 'new user data just dropped fr fr 🔥' };
        } else {
            // Update that user data on god
            await userRef.update({
                ...data,
                updatedAt: now,
            });
            return { message: 'user data update bussin fr fr ✨' };
        }
    } catch (error) {
        console.error('nah fam, something ain\'t right:', error);
        throw new functions.https.HttpsError('internal', 'server acting sus rn');
    }
}); 