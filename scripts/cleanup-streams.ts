import { cert, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const serviceAccount = {
  "type": "service_account",
  "project_id": "streamsor-6fb0e",
  "private_key_id": "e0c0c9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c9c9",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC9QZ6B7xX6+Yjq\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@streamsor-6fb0e.iam.gserviceaccount.com",
  "client_id": "xxxxxxxxxxxxxxxxxxxxx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40streamsor-6fb0e.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

const app = initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://streamsor-6fb0e-default-rtdb.firebaseio.com'
});

const database = getDatabase(app);

async function cleanupStreams() {
  try {
    const streamsRef = database.ref('streams');
    const snapshot = await streamsRef.once('value');
    
    if (snapshot.exists()) {
      const updates: { [key: string]: any } = {};
      snapshot.forEach((childSnapshot) => {
        updates[`streams/${childSnapshot.key}`] = {
          ...childSnapshot.val(),
          isLive: false,
          endedAt: Date.now()
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