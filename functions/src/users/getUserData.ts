import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { functionConfig } from '../config';

export const getUserData = functions.https.onCall(functionConfig, async (request) => {
    const data = request.data as { liveInputId: string };
    if (!data.liveInputId) {
        throw new functions.https.HttpsError('invalid-argument', 'yo where the liveInputId at tho? 🤔');
    }

    try {
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(data.liveInputId).get();

        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'ain\'t no user here fam 💀');
        }

        return {
            ...userDoc.data(),
            message: 'user data secured fr fr 💯'
        };
    } catch (error) {
        console.error('bruh moment while fetching user:', error);
        throw new functions.https.HttpsError('internal', 'server throwing hands rn');
    }
}); 