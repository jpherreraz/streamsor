import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';
import { functionConfig } from '../config';
import { cloudflareAccountId, cloudflareApiToken } from '../stream/checkCloudflareWithRetry';
import { CloudflareVideo, ProcessedVideo } from './types';

// Get all Cloudflare videos with user data from Firestore
export const getActiveStreams = onCall(functionConfig, async (request) => {
    try {
        const auth = request.auth;
        console.log('Getting videos with auth:', auth?.uid);
        console.log('Fetching videos from Cloudflare with account:', cloudflareAccountId.value());
        
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream`, {
            headers: {
                'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            console.error('Cloudflare API acting sus:', response.status);
            throw new Error('Cloudflare API not bussin rn');
        }

        const data = await response.json();
        if (!data.success || !Array.isArray(data.result)) {
            console.error('Cloudflare response ain\'t it chief:', data);
            throw new Error('Cloudflare data format acting sus fr fr');
        }

        // Get the Firestore reference
        const db = admin.firestore();

        // Process videos and fetch user data from Firestore
        const videos = await Promise.all(data.result.map(async (video: CloudflareVideo): Promise<ProcessedVideo> => {
            const liveInputId = video.liveInput;
            let userData = null;

            console.log('Processing video:', {
                videoId: video.uid,
                liveInputId,
                meta: video.meta
            });

            if (liveInputId) {
                // Get user data from Firestore using liveInputId
                const userDoc = await db.collection('users').doc(liveInputId).get();
                if (userDoc.exists) {
                    userData = userDoc.data();
                    console.log('SHEEEESH found that user data fr fr:', {
                        videoId: video.uid,
                        liveInputId,
                        userData: userData ? {
                            uploadedBy: userData.uploadedBy,
                            email: userData.email,
                            profilePicture: userData.profilePicture,
                            streamTitle: userData.streamTitle,
                            streamCategory: userData.streamCategory,
                            // don't log sensitive stuff like stream key
                        } : null
                    });
                } else {
                    console.log('No user data found in Firestore for liveInputId:', liveInputId);
                }
            }

            return {
                uid: video.uid,
                title: userData?.streamTitle || video.meta?.name || 'Untitled Stream',
                thumbnail: video.thumbnail,
                playbackUrl: video.playback?.hls,
                createdAt: video.created,
                duration: video.duration,
                views: 0, // we can add view tracking later fr fr
                uploader: {
                    id: userData?.uploadedBy,
                    email: userData?.email || 'Unknown User',
                    photoURL: userData?.profilePicture || null
                }
            } as ProcessedVideo;
        }));

        console.log(`Successfully mapped ${videos.length} videos no cap fr fr`);
        return videos;
    } catch (error) {
        console.error('Error in getCloudflareVideos:', error);
        throw new Error('Failed to fetch videos fr fr');
    }
}); 