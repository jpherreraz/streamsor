import * as admin from 'firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import * as fs from 'fs';
import * as path from 'path';

// Read service account file
const serviceAccountPath = path.join(__dirname, 'serviceAccount.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin with credentials
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  databaseURL: 'https://streamsor-6fb0e-default-rtdb.firebaseio.com'
});

async function checkRTDB() {
  try {
    console.log('Checking RTDB data...');
    const rtdb = getDatabase();
    
    // Get all data from RTDB
    const snapshot = await rtdb.ref().once('value');
    const data = snapshot.val();
    
    console.log('RTDB data:', JSON.stringify(data, null, 2));
    
    if (!data) {
      console.log('No data found in RTDB!');
    } else {
      console.log('Found data in RTDB:', {
        users: data.users ? Object.keys(data.users).length : 0,
        streams: data.streams ? Object.keys(data.streams).length : 0
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking RTDB:', error);
    process.exit(1);
  }
}

checkRTDB(); 