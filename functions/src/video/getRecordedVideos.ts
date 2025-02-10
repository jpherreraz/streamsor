import { Request, Response } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { cloudflareAccountId, cloudflareApiToken } from '../stream/checkCloudflareWithRetry';
import { getCloudflareAPI } from '../utils/cloudflare';
import cors = require('cors');

const corsHandler = cors({ origin: true });

interface CloudflareVideo {
  uid: string;
  status: {
    state: string;
  };
  meta?: {
    name?: string;
    uploadedBy?: string;
  };
  playback?: {
    hls?: string;
    dash?: string;
  };
  thumbnail?: string;
  created: string;
  modified: string;
  size: number;
  preview?: string;
  duration?: number;
  input?: {
    width?: number;
    height?: number;
  };
  liveInput?: string;
  readyToStream?: boolean;
}

interface CloudflareResponse {
  result: CloudflareVideo[];
  success: boolean;
  errors: any[];
  messages: any[];
}

export const getRecordedVideos = onRequest(
  {
    secrets: [cloudflareAccountId, cloudflareApiToken]
  },
  async (request: Request, response: Response) => {
    return corsHandler(request, response, async () => {
      try {
        // Initialize Firebase Admin if not already initialized
        if (getApps().length === 0) {
          initializeApp();
        }
        const db = getFirestore();
        
        const cloudflare = getCloudflareAPI();
        
        // Get all videos
        const videosResponse = await cloudflare.get<CloudflareResponse>('/');
        console.log('Videos response:', JSON.stringify(videosResponse.data, null, 2));
        
        if (!videosResponse.data.success) {
          throw new Error('Failed to fetch videos');
        }

        const recordedVideos = [];
        
        // For each video, get user info and add to response if it's ready to stream
        for (const video of videosResponse.data.result) {
          try {
            // Skip videos that are live or not ready to stream
            if (video.status.state === 'live-inprogress' || !video.readyToStream) {
              console.log('Skipping video', video.uid, 'because it is live or not ready');
              continue;
            }

            // Get user info from Firestore using liveInputId
            if (video.liveInput) {
              const usersRef = db.collection('users');
              const userQuery = await usersRef.where('liveInputId', '==', video.liveInput).get();
              
              if (userQuery.empty) {
                console.log('No user found for live input', video.liveInput);
                continue;
              }

              const userDoc = userQuery.docs[0];
              const userData = userDoc.data();
              
              // Log the raw user data to see exactly what we have
              console.log('Raw user data:', userData);
              
              // Try to get photoURL from different possible locations
              const photoURL = userData.photoURL || userData.profilePicture || userData.avatarUrl || null;
              console.log('Found user data:', {
                  userId: userDoc.id,
                email: userData.email,
                rawPhotoURL: userData.photoURL,
                processedPhotoURL: photoURL,
                streamTitle: userData.streamTitle,
                liveInputId: userData.liveInputId
              });

            // Only include videos that have playback URLs
            if (video.playback?.hls) {
              const videoData = {
                uid: video.uid,
                  title: userData.streamTitle || video.meta?.name || 'Untitled Video',
                thumbnail: video.thumbnail || '',
                playbackUrl: video.playback.hls,
                createdAt: video.created,
                  duration: video.duration,
                views: 0, // Cloudflare doesn't provide this yet
                  uploader: {
                    id: userDoc.id,
                  email: userData.email || 'unknown@streamsor.com',
                    photoURL: photoURL
                }
              };
              
                console.log('Adding recorded video:', videoData);
                recordedVideos.push(videoData);
              } else {
                console.log('Video has no playback URL:', video.uid);
              }
            }
          } catch (err) {
            console.error('Error checking video status:', err);
          }
        }

        console.log('Returning recorded videos:', recordedVideos);
        response.json({ data: recordedVideos });
      } catch (error) {
        console.error('Error in getRecordedVideos:', error);
        response.status(500).json({ error: 'Internal server error' });
      }
    });
  }
); 