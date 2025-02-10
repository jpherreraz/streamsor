import { initializeApp } from 'firebase-admin/app';
import { cleanupFirestore } from './db/cleanupFirestore';
import { initializeUser } from './stream/initializeUser';
import { updateStreamEmail } from './stream/updateStreamEmail';
import { updateStreamProfilePicture } from './stream/updateStreamProfilePicture';
import { updateStreamTitle } from './stream/updateStreamTitle';
import { updateUserData } from './users/updateUserData';
import { deleteAllVideos } from './video/deleteAllVideos';
import { getActiveStreams } from './video/getActiveStreams';
import { getRecordedVideos } from './video/getRecordedVideos';
import { getVideo } from './video/getVideo';
import { migrateVideoMetadata } from './video/migrateVideoMetadata';

// Initialize Firebase Admin if not already initialized
if (!process.env.FIREBASE_CONFIG) {
  initializeApp();
}

// Export them functions fr fr
export * from './auth';
export * from './stream';
export * from './video';
export {
    cleanupFirestore, deleteAllVideos, getActiveStreams,
    getRecordedVideos,
    getVideo, initializeUser, migrateVideoMetadata, updateStreamEmail,
    updateStreamProfilePicture,
    updateStreamTitle,
    updateUserData
};

