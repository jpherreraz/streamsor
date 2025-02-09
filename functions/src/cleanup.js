const admin = require('firebase-admin');
const { getDatabase } = require('firebase-admin/database');

// Initialize Firebase Admin
admin.initializeApp({
  databaseURL: 'https://streamsor-6fb0e-default-rtdb.firebaseio.com'
});

async function deleteStreams() {
  try {
    const db = getDatabase();
    const streamsRef = db.ref('streams');
    
    const snapshot = await streamsRef.once('value');
    const updates = {};
    let deletedCount = 0;
    
    snapshot.forEach((childSnapshot) => {
      const streamId = childSnapshot.key;
      if (streamId !== 'b4cdf5276546a2e3bb2af5c823e73d36') {
        updates[streamId] = null;
        deletedCount++;
      }
    });
    
    await streamsRef.update(updates);
    console.log(`Successfully deleted ${deletedCount} streams, keeping b4cdf5276546a2e3bb2af5c823e73d36`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

deleteStreams();
