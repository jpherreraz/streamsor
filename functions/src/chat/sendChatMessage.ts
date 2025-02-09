import { getDatabase } from 'firebase-admin/database';
import { onCall } from 'firebase-functions/v2/https';
import { functionConfig } from '../config';

// Send chat message function
export const sendChatMessage = onCall(functionConfig, async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new Error('Authentication required');
  }

  const { streamId, text, username } = request.data;
  if (!streamId || !text || !username) {
    throw new Error('Missing required fields');
  }

  const db = getDatabase();
  const chatRef = db.ref(`chats/${streamId}/messages`).push();
  
  const message = {
    text: text.trim(),
    username,
    userId: auth.uid,
    timestamp: Date.now()
  };

  await chatRef.set(message);
  return { success: true };
}); 