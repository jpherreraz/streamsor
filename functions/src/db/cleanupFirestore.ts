import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

export const cleanupFirestore = functions.https.onCall(async (request) => {
    try {
        const db = admin.firestore();
        
        // Get all collections
        const collections = await db.listCollections();
        
        // Delete all collections except 'users'
        for (const collection of collections) {
            if (collection.id !== 'users') {
                const snapshot = await collection.get();
                
                // Delete in batches of 500
                const batches = [];
                let batch = db.batch();
                let count = 0;
                
                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                    count++;
                    
                    if (count === 500) {
                        batches.push(batch.commit());
                        batch = db.batch();
                        count = 0;
                    }
                });
                
                if (count > 0) {
                    batches.push(batch.commit());
                }
                
                await Promise.all(batches);
                console.log(`Deleted collection ${collection.id} fr fr`);
            }
        }

        // Clean up users collection to only have liveInputId docs
        const usersSnapshot = await db.collection('users').get();
        
        // Delete in batches of 500
        const batches = [];
        let batch = db.batch();
        let count = 0;
        
        usersSnapshot.docs.forEach((doc) => {
            // If the doc ID is not a liveInputId (it's probably a uid), delete it
            if (!doc.id.match(/^[a-f0-9]{32}$/)) {
                batch.delete(doc.ref);
                count++;
                
                if (count === 500) {
                    batches.push(batch.commit());
                    batch = db.batch();
                    count = 0;
                }
                console.log(`Marked invalid user doc ${doc.id} for deletion no cap`);
            }
        });
        
        if (count > 0) {
            batches.push(batch.commit());
        }
        
        await Promise.all(batches);
        console.log('All invalid docs deleted fr fr');
        
        return { message: 'Firestore cleanup bussin fr fr 🧹' };
    } catch (error) {
        console.error('Error cleaning up Firestore:', error);
        throw new functions.https.HttpsError('internal', 'cleanup failed fr fr');
    }
}); 