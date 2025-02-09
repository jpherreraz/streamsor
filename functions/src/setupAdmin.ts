import * as admin from 'firebase-admin';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

// Initialize Firebase Admin
initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: 'https://streamsor-6fb0e-default-rtdb.firebaseio.com'
});

async function migrateDatabase() {
  try {
    console.log('Starting migration...');
    const db = admin.firestore();
    const rtdb = getDatabase();

    // Get all users from RTDB
    const usersSnapshot = await rtdb.ref('users').once('value');
    const users = usersSnapshot.val() as Record<string, any>;

    console.log('Found users:', Object.keys(users || {}).length);

    // Migrate each user to the new structure
    for (const [, userData] of Object.entries(users || {})) {
      if (userData.liveInputId) {
        await db.collection('users').doc(userData.liveInputId).set({
          email: userData.email || null,
          displayName: userData.displayName || null,
          photoURL: userData.photoURL || null,
          streamSettings: {
            title: userData.title || null,
            streamKey: userData.streamKey || null,
            rtmpsUrl: userData.rtmpsUrl || null,
            playback: userData.playback || null
          },
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('Migrated user:', userData.liveInputId);
      }
    }

    // Migrate comments if they exist
    const commentsSnapshot = await rtdb.ref('comments').once('value');
    const comments = commentsSnapshot.val() as Record<string, Record<string, any>>;

    if (comments) {
      const batch = db.batch();
      let count = 0;
      const maxBatchSize = 500;

      for (const [streamId, streamComments] of Object.entries(comments)) {
        for (const [, commentData] of Object.entries(streamComments)) {
          const commentRef = db.collection('comments').doc();
          batch.set(commentRef, {
            ...commentData,
            streamId,
            createdAt: admin.firestore.Timestamp.fromMillis(commentData.timestamp || Date.now())
          });

          count++;
          if (count >= maxBatchSize) {
            await batch.commit();
            console.log('Committed batch of comments:', count);
            count = 0;
          }
        }
      }

      if (count > 0) {
        await batch.commit();
        console.log('Committed final batch of comments:', count);
      }
    }

    console.log('Migration complete! We bussin now fr fr! 🔥');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed no cap:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

migrateDatabase(); 