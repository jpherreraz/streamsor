import { getFirestore } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { functionConfig } from '../config';

export const getStreamKey = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Not authenticated fr fr');
  }

  const db = getFirestore();
  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  
  if (!userDoc.exists) {
    throw new Error('User not found fr fr');
  }

  const userData = userDoc.data();
  if (!userData?.streamKey) {
    throw new Error('No stream key found fr fr');
  }

  return { streamKey: userData.streamKey };
});

