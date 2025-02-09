const admin = require('firebase-admin');
const serviceAccount = require('../src/serviceAccount.json');

// init that firebase admin sdk no cap
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function yeetAllVideos() {
    try {
        const result = await admin.functions().httpsCallable('deleteAllVideos')();
        console.log('videos got yeeted successfully:', result.data.message);
    } catch (error) {
        console.error('failed to yeet videos fr fr:', error);
    } finally {
        process.exit();
    }
}

yeetAllVideos(); 