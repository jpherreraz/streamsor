import { getDatabase } from 'firebase-admin/database';
import { onCall } from 'firebase-functions/v2/https';
import { functionConfig } from '../config';

// Get user's stream key
export const getStreamKey = onCall(functionConfig, async (request) => {
  try {
    const auth = request.auth;
    if (!auth?.uid) {
      throw new Error('Authentication required');
    }

    const db = getDatabase();
    const userRef = db.ref(`users/${auth.uid}`);
    const snapshot = await userRef.get();
    if (!snapshot.exists()) {
      throw new Error('User not initialized');
    }

    const userData = snapshot.val();
    return { streamKey: userData.streamKey };
  } catch (error) {
    console.error('Error getting stream key:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to get stream key');
  }
}); 