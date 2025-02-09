const admin = require('firebase-admin');
const serviceAccount = require('../src/serviceAccount.json');

// init that firebase admin sdk no cap
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
});

// get the functions instance for our region
const functions = require('firebase-functions');
const region = 'us-central1';

async function yeetAllVideos() {
    try {
        // call the function directly through the functions SDK
        const result = await admin.firestore().runTransaction(async (transaction) => {
            const functionRef = admin.firestore().collection('functions').doc('deleteAllVideos');
            const functionCall = await functionRef.create({
                created: admin.firestore.FieldValue.serverTimestamp(),
                status: 'pending'
            });
            
            return new Promise((resolve, reject) => {
                setTimeout(async () => {
                    try {
                        const doc = await functionRef.get();
                        if (doc.exists && doc.data().status === 'completed') {
                            resolve(doc.data().result);
                        } else {
                            reject(new Error('Function execution timeout or failed'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                }, 30000); // wait up to 30 seconds
            });
        });
        
        console.log('videos got yeeted successfully:', result.message);
    } catch (error) {
        console.error('failed to yeet videos fr fr:', error);
    } finally {
        process.exit();
    }
}

yeetAllVideos(); 