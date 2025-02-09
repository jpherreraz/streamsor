import * as admin from 'firebase-admin';
import { initializeApp } from 'firebase-admin/app';

// Initialize Firebase Admin
initializeApp();

async function cleanup() {
    try {
        const db = admin.firestore();
        
        // Get all collections
        const collections = await db.listCollections();
        
        // Delete all collections except 'users'
        for (const collection of collections) {
            if (collection.id !== 'users') {
                const snapshot = await collection.get();
                const batch = db.batch();
                
                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                
                await batch.commit();
                console.log(`Deleted collection ${collection.id} fr fr`);
            }
        }

        // Clean up users collection to only have liveInputId docs
        const usersSnapshot = await db.collection('users').get();
        const batch = db.batch();
        
        usersSnapshot.docs.forEach((doc) => {
            // If the doc ID is not a liveInputId (it's probably a uid), delete it
            if (!doc.id.match(/^[a-f0-9]{32}$/)) {
                batch.delete(doc.ref);
                console.log(`Deleted invalid user doc ${doc.id} no cap`);
            }
        });
        
        await batch.commit();
        
        console.log('Firestore cleanup bussin fr fr 🧹');
        process.exit(0);
    } catch (error) {
        console.error('Error cleaning up Firestore:', error);
        process.exit(1);
    }
}

cleanup(); 