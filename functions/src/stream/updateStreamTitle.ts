import { getDatabase } from 'firebase-admin/database';
import { onCall } from 'firebase-functions/v2/https';
import { cloudflareAccountId, cloudflareApiToken, functionConfig } from '../config';

interface StreamData {
  meta?: any;
  title?: string;
  category?: string;
  photoURL?: string;
  email?: string;
  streamerName?: string;
  updatedAt?: number;
}

interface DatabaseUpdates {
  [key: string]: Partial<StreamData>;
}

// Update stream title and category
export const updateStreamTitle = onCall(functionConfig, async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new Error('Authentication required');
  }

  const { title, category } = request.data;
  if (!title || typeof title !== 'string') {
    throw new Error('Valid title is required');
  }

  if (!category || !['gaming', 'just-chatting', 'art', 'software-dev'].includes(category)) {
    throw new Error('Valid category is required');
  }

  const db = getDatabase();
  const userRef = db.ref(`users/${auth.uid}`);

  // Get user's live input ID
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists() || !userSnapshot.val().liveInputId) {
    throw new Error('Stream setup not found');
  }

  const liveInputId = userSnapshot.val().liveInputId;

  try {
    // Get existing stream data first
    const streamRef = db.ref(`streams/${liveInputId}`);
    const streamSnapshot = await streamRef.get();
    const existingStreamData = streamSnapshot.exists() ? streamSnapshot.val() : {};

    // Update title in Cloudflare
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${cloudflareApiToken.value()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meta: {
          name: title,
          category,
          uploadedBy: auth.uid
        }
      })
    });

    const data = await response.json();
    if (!data.success) {
      console.error('Cloudflare update failed:', data.errors);
      throw new Error('Failed to update stream info');
    }

    // Update title and category in both stream and user data
    const updates: DatabaseUpdates = {};

    // Preserve existing stream data while updating title and category
    updates[`streams/${liveInputId}`] = {
      ...existingStreamData,
      title,
      category,
      updatedAt: Date.now()
    };

    // Update user data
    updates[`users/${auth.uid}`] = {
      ...userSnapshot.val(),
      title,
      category,
      updatedAt: Date.now()
    };

    // Apply all updates atomically
    await db.ref().update(updates);
    return { success: true };
  } catch (error) {
    console.error('Error updating stream info:', error);
    throw new Error('Failed to update stream info');
  }
}); 