import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import 'react-native-get-random-values';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBNTNWagCvsTMk1sNm8Gx_C_GcTZJ3lZCs",
  authDomain: "streamsor-6fb0e.firebaseapp.com",
  databaseURL: "https://streamsor-6fb0e-default-rtdb.firebaseio.com",
  projectId: "streamsor-6fb0e",
  storageBucket: "streamsor-6fb0e.firebasestorage.app",
  messagingSenderId: "113590479979",
  appId: "1:113590479979:web:f53af60169cd91239cd52e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const database = getDatabase(app);
export const storage = getStorage(app);

export default app; 