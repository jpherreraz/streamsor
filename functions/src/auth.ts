import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';
import { CallableRequest } from 'firebase-functions/v2/https';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

interface SyncUserData {
  displayName?: string;
  email?: string;
  photoURL?: string;
}

// Sync user profile data from Auth to Firestore
export const syncPublicUserData = functions.https.onCall<SyncUserData>(
  async (request: CallableRequest<SyncUserData>) => {
    if (!request.auth) {
      throw new Error('Authentication required');
    }

    const { displayName, email, photoURL } = request.data;
    const uid = request.auth.uid;

    try {
      const db = admin.firestore();
      const userRef = db.collection('users').doc(uid);
      
      await userRef.set({
        displayName: displayName || null,
        email: email || null,
        photoURL: photoURL || null,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return { success: true };
    } catch (error) {
      console.error('Error syncing user data:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to sync user data');
    }
  }
);

// Set admin claims for a user
export const setAdminClaims = functions.https.onCall(async (request) => {
  try {
    if (!request.auth?.token.admin) {
      throw new Error('Only existing admins can set admin claims fr fr!');
    }

    const { uid } = request.data;
    if (!uid) {
      throw new Error('User ID is required no cap!');
    }

    // Set admin claim
    await admin.auth().setCustomUserClaims(uid, { admin: true });
    console.log('Set admin claims for user:', uid);

    return { 
      success: true, 
      message: `User ${uid} is now an admin fr fr! 🔥` 
    };
  } catch (error) {
    console.error('Failed to set admin claims:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to set admin claims');
  }
}); 