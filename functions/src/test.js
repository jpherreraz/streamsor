import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createRequire } from 'module';
import fetch from 'node-fetch';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = require(join(__dirname, '../serviceAccount.json'));
initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://streamsor-6fb0e-default-rtdb.firebaseio.com'
});

const FUNCTION_BASE_URL = 'https://us-central1-streamsor-6fb0e.cloudfunctions.net';

// Helper function to generate a stream key
function generateStreamKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let streamKey = '';
  for (let i = 0; i < 32; i++) {
    streamKey += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return streamKey;
}

async function testCloudFunctions() {
  try {
    // Create a test user
    const userEmail = `test${Date.now()}@example.com`;
    const userPassword = 'testPassword123!';
    const user = await getAuth().createUser({
      email: userEmail,
      password: userPassword,
    });

    console.log('Created test user:', user.uid);

    // Get ID token using the Firebase Auth REST API
    const customToken = await getAuth().createCustomToken(user.uid);
    const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyBNTNWagCvsTMk1sNm8Gx_C_GcTZJ3lZCs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to exchange custom token:', errorData);
      throw new Error('Failed to get ID token');
    }

    const data = await response.json();
    if (!data.idToken) {
      console.error('No ID token in response:', data);
      throw new Error('No ID token received');
    }

    const idToken = data.idToken;
    console.log('Successfully created ID token');

    // Test initializeUser function
    const streamKey = generateStreamKey();
    const initResponse = await fetch(`${FUNCTION_BASE_URL}/initializeUser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        data: {
          streamKey,
          createdAt: Date.now()
        }
      })
    });

    const responseText = await initResponse.text();
    console.log('Raw response:', responseText);
    console.log('Response status:', initResponse.status);
    console.log('Response headers:', Object.fromEntries(initResponse.headers.entries()));

    try {
      const initData = JSON.parse(responseText);
      console.log('Initialize user response:', initData);
    } catch (error) {
      console.error('Failed to parse response:', error);
      throw error;
    }

    // Test startStream function
    const startResponse = await fetch(`${FUNCTION_BASE_URL}/startStream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        data: {
          title: 'Test Stream',
          streamKey
        }
      })
    });

    const startData = await startResponse.json();
    console.log('Start stream response:', startData);

    // Test stopStream function
    const streamId = startData.result.streamId;
    const stopResponse = await fetch(`${FUNCTION_BASE_URL}/stopStream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        data: {
          streamId
        }
      })
    });

    const stopData = await stopResponse.json();
    console.log('Stop stream response:', stopData);

    // Clean up test user
    await getAuth().deleteUser(user.uid);
    console.log('Deleted test user');

  } catch (error) {
    console.error('Test failed:', error);
  }
  console.log('Tests completed');
}

testCloudFunctions(); 