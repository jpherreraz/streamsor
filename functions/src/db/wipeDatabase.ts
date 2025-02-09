import * as admin from 'firebase-admin';

export const wipeDatabase = async () => {
    try {
        const db = admin.firestore();
        
        // Get all collections
        const collections = await db.listCollections();
        
        // Delete each collection
        for (const collection of collections) {
            const batch = db.batch();
            const snapshot = await collection.get();
            
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
        }
        
        console.log('Database wiped successfully no cap fr fr 🧹');
    } catch (error) {
        console.error('Bruh moment while wiping database:', error);
        throw error;
    }
}; 