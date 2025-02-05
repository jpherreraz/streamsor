const admin = require('firebase-admin');

// Initialize Firebase Admin with emulator settings
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
const app = admin.initializeApp({
  projectId: 'demo-live-streaming',
  credential: admin.credential.cert({
    projectId: 'demo-live-streaming',
    clientEmail: 'fake@example.com',
    privateKey: 'fake-key'
  })
});

const db = admin.firestore();

async function cleanupStreams() {
  try {
    // Get all active streams
    const streamsSnapshot = await db.collection('streams')
      .where('isLive', '==', true)
      .get();
    
    // Batch update to mark all streams as inactive
    const batch = db.batch();
    streamsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { 
        isLive: false,
        endedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    await batch.commit();
    console.log(`Marked ${streamsSnapshot.size} streams as inactive`);
    
  } catch (error) {
    console.error('Error cleaning up streams:', error);
  }
  
  // Exit the process
  process.exit(0);
}

cleanupStreams(); 