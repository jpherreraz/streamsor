import { AxiosError } from 'axios';
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

export const getActiveStreams = onRequest(
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
        
        // Get all live inputs
        const liveInputsResponse = await cloudflare.get<CloudflareResponse>('/live_inputs');
        console.log('Live inputs response:', JSON.stringify(liveInputsResponse.data, null, 2));
        
        if (!liveInputsResponse.data.success) {
          throw new Error('Failed to fetch live inputs');
        }

        const activeStreams = [];
        
        // For each live input, check if it has an active stream
        for (const input of liveInputsResponse.data.result) {
          try {
            // Get user info from Firestore
            const usersRef = db.collection('users');
            const userQuery = await usersRef.where('liveInputId', '==', input.uid).get();
            
            if (userQuery.empty) {
              console.log('No user found for live input', input.uid);
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
            
            // Check if the input has any active videos
            const videoResponse = await cloudflare.get<CloudflareResponse>(`/live_inputs/${input.uid}/videos`);
            console.log('Video response for input', input.uid, ':', JSON.stringify(videoResponse.data, null, 2));
            
            if (videoResponse.data.success && videoResponse.data.result.length > 0) {
              // Get the most recent video
              const video = videoResponse.data.result[0];
              console.log('Video status:', JSON.stringify(video.status, null, 2));
              console.log('Video playback URLs:', JSON.stringify(video.playback, null, 2));
              
              // Only include videos that are actually live and have playback URLs
              if (video.playback?.hls && video.status.state === 'live-inprogress') {
                const streamData = {
                  uid: video.uid,
                  title: userData.streamTitle || video.meta?.name || input.meta?.name || 'Untitled Stream',
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
                
                console.log('Adding active stream:', streamData);
                activeStreams.push(streamData);
              } else {
                console.log('Stream not ready or no playback URL:', {
                  state: video.status.state,
                  hasPlaybackUrl: !!video.playback?.hls
                });
              }
            }
          } catch (err) {
            // If it's a 404, that's fine - it just means no videos for this input
            if ((err as AxiosError).response?.status === 404) {
              console.log('No videos found for input', input.uid);
              continue;
            }
            console.error('Error checking video status for input', input.uid, ':', err);
          }
        }

        console.log('Returning active streams:', activeStreams);
        response.json({ data: activeStreams });
      } catch (error) {
        console.error('Error in getActiveStreams:', error);
        response.status(500).json({ error: 'Internal server error' });
      }
    });
  }
); 