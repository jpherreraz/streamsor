import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';
import { cloudflareAccountId, cloudflareApiToken, functionConfig } from '../config';
import { VideoMetadata } from './types';

// Get video details
export const getVideo = onCall({
  ...functionConfig,
  enforceAppCheck: false // Allow unauthenticated access
}, async (request) => {
  const { videoId } = request.data;
  if (!videoId) {
    throw new functions.https.HttpsError('invalid-argument', 'Video ID is required');
  }

  try {
    // Get video details from Cloudflare
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/${videoId}`, {
      headers: {
        'Authorization': `Bearer ${cloudflareApiToken.value()}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.error('Cloudflare API error:', response.status);
      throw new functions.https.HttpsError('not-found', 'Video not found');
    }

    const data = await response.json();
    if (!data.success || !data.result) {
      console.error('Invalid Cloudflare response:', data);
      throw new functions.https.HttpsError('internal', 'Failed to fetch video data');
    }

    const video = data.result as VideoMetadata;

    // Get uploader details if available
    let uploaderData = null;
    if (video.meta?.uploadedBy) {
      const uploaderSnapshot = await admin.database().ref(`users/${video.meta.uploadedBy}`).once('value');
      uploaderData = uploaderSnapshot.val();
    }

    return {
      uid: video.uid,
      title: video.meta?.name || 'Untitled Video',
      playbackUrl: video.playback?.hls,
      thumbnail: video.thumbnail,
      createdAt: video.created,
      uploader: uploaderData ? {
        email: uploaderData.email,
        photoURL: uploaderData.photoURL
      } : undefined
    };
  } catch (error) {
    console.error('Error fetching video:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to fetch video');
  }
}); 