import * as admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import * as path from 'path';

// Initialize Firebase Admin with credentials
admin.initializeApp({
  credential: admin.credential.cert(path.join(__dirname, '../functions/src/serviceAccount.json')),
  databaseURL: 'https://streamsor-6fb0e-default-rtdb.firebaseio.com'
});

const database = getDatabase();

async function cleanupStreams() {
  try {
    const streamsRef = database.ref('streams');
    const snapshot = await streamsRef.once('value');
    
    if (snapshot.exists()) {
      const updates: { [key: string]: any } = {};
      snapshot.forEach((childSnapshot) => {
        updates[`streams/${childSnapshot.key}`] = {
          ...childSnapshot.val(),
          status: 'offline',
          statusMessage: 'Stream has ended',
          endedAt: Date.now(),
          updatedAt: Date.now()
        };
      });
      
      await database.ref().update(updates);
      console.log('All streams marked as inactive');
    }
  } catch (error) {
    console.error('Error cleaning up streams:', error);
  }
}

cleanupStreams().then(() => process.exit(0)); 