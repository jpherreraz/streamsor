import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { functionConfig } from '../config';

// Check live input IDs
export const checkLiveInputIds = onCall(functionConfig, async (request) => {
  try {
    const firestore = admin.firestore();
    const usersSnapshot = await firestore.collection('users').get();
    
    const userLiveInputs = usersSnapshot.docs.map(doc => ({
      docId: doc.id,
      data: doc.data()
    }));

    console.log('Found users:', userLiveInputs);
    
    return {
      success: true,
      users: userLiveInputs
    };
  } catch (error) {
    console.error('Error checking live input IDs:', error);
    throw new Error('Failed to check live input IDs no cap');
  }
}); 