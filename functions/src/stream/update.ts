import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onCall } from 'firebase-functions/v2/https';
import { checkCloudflareWithRetry, functionConfig } from '../config';

const cloudflareAccountId = defineSecret('CLOUDFLARE_ACCOUNT_ID');
const cloudflareApiToken = defineSecret('CLOUDFLARE_API_TOKEN');

// Update stream title and category
export const updateStreamTitle = onCall(functionConfig, async (request) => {
  try {
    console.log('Starting updateStreamTitle with data:', request.data);
    
    const auth = request.auth;
    if (!auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'no cap, you need to be authenticated fr fr');
    }

    const { title, category, liveInputId } = request.data;
    console.log('Received params:', { title, category, liveInputId });
    
    if (!title || typeof title !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'bruh where the title at? 💀');
    }

    if (!category || !['gaming', 'just-chatting', 'art', 'software-dev'].includes(category)) {
      throw new functions.https.HttpsError('invalid-argument', 'that category ain\'t it chief');
    }

    if (!liveInputId) {
      throw new functions.https.HttpsError('invalid-argument', 'yo where the liveInputId at? 🤔');
    }

    const db = admin.firestore();
    console.log('Checking user doc:', liveInputId);
    
    // Update Cloudflare first with retry logic
    console.log('Updating Cloudflare...');
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const response = await checkCloudflareWithRetry(
          `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`,
          cloudflareApiToken.value()
        );

        if (!response.ok) {
          console.error('Cloudflare API error:', response.status);
          if (retryCount === maxRetries - 1) {
            throw new functions.https.HttpsError('internal', 'Failed to update stream info no cap');
          }
          retryCount++;
          continue;
        }

        const data = await response.json();
        console.log('Cloudflare response:', data);
        
        if (!data.success) {
          console.error('Cloudflare update failed:', data.errors);
          if (retryCount === maxRetries - 1) {
            throw new functions.https.HttpsError('internal', 'Failed to update stream info no cap');
          }
          retryCount++;
          continue;
        }

        break; // Success, exit retry loop
      } catch (error) {
        console.error(`Attempt ${retryCount + 1} failed:`, error);
        if (retryCount === maxRetries - 1) {
          throw new functions.https.HttpsError('internal', 'server acting mad sus rn fr fr');
        }
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1))); // Exponential backoff
      }
    }

    console.log('Updating Firestore...');
    // Update user doc with new stream info in a single write
    await db.collection('users').doc(liveInputId).update({
      streamTitle: title,
      streamCategory: category,
      updatedAt: admin.firestore.Timestamp.now()
    });

    console.log('Update successful!');
    return { message: 'stream update bussin fr fr ✨' };
  } catch (error) {
    console.error('Top level error in updateStreamTitle:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'server acting mad sus rn fr fr');
  }
});

// Update stream profile picture
export const updateStreamProfilePicture = onCall(functionConfig, async (request) => {
  try {
    console.log('Starting updateStreamProfilePicture with data:', request.data);
    
    const auth = request.auth;
    if (!auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'no cap, you need to be authenticated fr fr');
    }

    const { photoURL, liveInputId } = request.data;
    console.log('Received params:', { photoURL, liveInputId });
    
    if (!photoURL || typeof photoURL !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'bruh where the photo URL at? 💀');
    }

    if (!liveInputId) {
      throw new functions.https.HttpsError('invalid-argument', 'yo where the liveInputId at? 🤔');
    }

    const db = admin.firestore();
    console.log('Checking user doc:', liveInputId);
    
    // Update Cloudflare first
    console.log('Updating Cloudflare...');
    const response = await checkCloudflareWithRetry(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`,
      cloudflareApiToken.value()
    );

    if (!response.ok) {
      console.error('Cloudflare API error:', response.status);
      throw new functions.https.HttpsError('internal', 'Failed to update stream info no cap');
    }

    const data = await response.json();
    console.log('Cloudflare response:', data);
    
    if (!data.success) {
      console.error('Cloudflare update failed:', data.errors);
      throw new functions.https.HttpsError('internal', 'Failed to update stream info no cap');
    }

    console.log('Updating Firestore...');
    // Update user doc with new profile picture in a single write
    await db.collection('users').doc(liveInputId).update({
      profilePicture: photoURL,
      updatedAt: admin.firestore.Timestamp.now()
    });

    console.log('Update successful!');
    return { message: 'profile pic update bussin fr fr ✨' };
  } catch (error) {
    console.error('Top level error in updateStreamProfilePicture:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'server acting mad sus rn fr fr');
  }
});

// Update stream email
export const updateStreamEmail = onCall(functionConfig, async (request) => {
  try {
    console.log('Starting updateStreamEmail with data:', request.data);
    
    const auth = request.auth;
    if (!auth?.uid) {
      throw new functions.https.HttpsError('unauthenticated', 'no cap, you need to be authenticated fr fr');
    }

    const { email, liveInputId } = request.data;
    console.log('Received params:', { email, liveInputId });
    
    if (!email || typeof email !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'bruh where the email at? 💀');
    }

    if (!liveInputId) {
      throw new functions.https.HttpsError('invalid-argument', 'yo where the liveInputId at? 🤔');
    }

    const db = admin.firestore();
    console.log('Checking user doc:', liveInputId);
    
    // Update Cloudflare first
    console.log('Updating Cloudflare...');
    const response = await checkCloudflareWithRetry(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`,
      cloudflareApiToken.value()
    );

    if (!response.ok) {
      console.error('Cloudflare API error:', response.status);
      throw new functions.https.HttpsError('internal', 'Failed to update stream info no cap');
    }

    const data = await response.json();
    console.log('Cloudflare response:', data);
    
    if (!data.success) {
      console.error('Cloudflare update failed:', data.errors);
      throw new functions.https.HttpsError('internal', 'Failed to update stream info no cap');
    }

    console.log('Updating Firestore...');
    // Update user doc with new email in a single write
    await db.collection('users').doc(liveInputId).update({
      email: email,
      updatedAt: admin.firestore.Timestamp.now()
    });

    console.log('Update successful!');
    return { message: 'email update bussin fr fr ✨' };
  } catch (error) {
    console.error('Top level error in updateStreamEmail:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'server acting mad sus rn fr fr');
  }
});

// Only export the valid files
export * from './updateStreamEmail';
export * from './updateStreamProfilePicture';

