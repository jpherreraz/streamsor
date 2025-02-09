import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v2';

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