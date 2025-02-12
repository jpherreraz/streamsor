import { getFirestore } from 'firebase-admin/firestore';
import * as functions from 'firebase-functions';

export const updateBio = functions.https.onCall(async (data, context) => {
  // Auth check
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You need to be logged in bestie! 💅'
    );
  }

  const { bio } = data;

  // Input validation
  if (!bio || typeof bio !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Bio must be a string bestie! 🤔'
    );
  }

  // Length validation
  if (bio.length > 500) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Bio too long bestie! Keep it under 500 characters! ✨'
    );
  }

  const trimmedBio = bio.trim();

  try {
    const db = getFirestore();
    await db.collection('users').doc(context.auth.uid).update({
      bio: trimmedBio,
      updatedAt: new Date(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error updating bio:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to update bio bestie! Try again? 😭'
    );
  }
}); 