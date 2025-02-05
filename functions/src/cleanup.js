const admin = require('firebase-admin');

// Initialize Firebase Admin
const app = admin.initializeApp();

// Initialize database
const db = admin.database();

async function cleanupStreams() {
    console.log('Starting cleanup of all streams...');
    try {
        // Get all streams
        const streamsRef = db.ref('streams');
        const streamsSnapshot = await streamsRef.once('value');
        if (!streamsSnapshot.exists()) {
            console.log('No streams found in database.');
            process.exit(0);
        }
        const updates = {};
        let count = 0;
        // Add all streams and their chats to be deleted
        streamsSnapshot.forEach((streamSnapshot) => {
            const streamId = streamSnapshot.key;
            if (streamId) {
                updates[`streams/${streamId}`] = null;
                updates[`chats/${streamId}`] = null;
                count++;
            }
        });
        console.log(`Found ${count} streams to delete...`);
        // Delete all streams and chats in one atomic update
        await db.ref().update(updates);
        console.log(`Successfully deleted ${count} streams and their associated chats.`);
    }
    catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    }
    process.exit(0);
}
cleanupStreams();
