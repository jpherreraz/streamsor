import * as admin from 'firebase-admin';
import { cleanupFirestore } from './db/cleanupFirestore';
import { initializeUser } from './stream/initializeUser';
import { updateStreamEmail, updateStreamProfilePicture, updateStreamTitle } from './stream/update';
import { getUserData } from './users/getUserData';
import { updateUserData } from './users/updateUserData';
import { deleteAllVideos } from './video/deleteAllVideos';
import { getCloudflareVideos } from './video/getCloudflareVideos';

// Initialize that Firebase admin SDK no cap
admin.initializeApp();

// Export them functions fr fr
export * from './video';
export {
  cleanupFirestore,
  deleteAllVideos,
  getCloudflareVideos,
  getUserData,
  initializeUser,
  updateStreamEmail,
  updateStreamProfilePicture,
  updateStreamTitle,
  updateUserData
};

