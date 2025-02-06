import crypto from 'crypto';
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { defineSecret } from 'firebase-functions/params';
import { onValueWritten } from 'firebase-functions/v2/database';
import { HttpsOptions, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// Initialize Firebase Admin
initializeApp();

const cloudflareAccountId = defineSecret('CLOUDFLARE_ACCOUNT_ID');
const cloudflareApiToken = defineSecret('CLOUDFLARE_API_TOKEN');

const RATE_LIMIT_BACKOFF = {
  initialDelay: 1000,
  maxDelay: 10000,
  maxAttempts: 3,
  requestDelay: 5000 // Increased from 2s to 5s
};

// Add cache for Cloudflare responses
const cloudflareCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 10000; // Increased from 5s to 10s

// Add helper function for exponential backoff
async function checkCloudflareWithRetry(url: string, token: string, attempt = 1): Promise<Response> {
  try {
    // Check cache first
    const cacheKey = url;
    const cached = cloudflareCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Using cached response for:', url);
      return new Response(JSON.stringify(cached.data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (response.ok) {
      // Cache successful responses
      const data = await response.clone().json();
      cloudflareCache.set(cacheKey, { data, timestamp: Date.now() });
    }

    if (response.status === 429 && attempt < RATE_LIMIT_BACKOFF.maxAttempts) {
      const delay = Math.min(
        RATE_LIMIT_BACKOFF.initialDelay * Math.pow(2, attempt - 1),
        RATE_LIMIT_BACKOFF.maxDelay
      );
      console.log(`Rate limited (attempt ${attempt}), waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return checkCloudflareWithRetry(url, token, attempt + 1);
    }

    return response;
  } catch (error) {
    console.error('Error in checkCloudflareWithRetry:', error);
    throw error;
  }
}

interface CloudflareResponse {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  messages?: Array<{ code: number; message: string }>;
  result?: {
    uid: string;
    rtmps: {
      url: string;
      streamKey: string;
    };
    rtmpsPlayback?: {
      url: string;
      streamKey: string;
    };
    srt?: {
      url: string;
      streamId: string;
      passphrase: string;
    };
    srtPlayback?: {
      url: string;
      streamId: string;
      passphrase: string;
    };
    webRTC?: {
      url: string;
    };
    webRTCPlayback?: {
      url: string;
    };
    playback: {
      hls: string;
      dash: string;
    };
    created?: string;
    modified?: string;
    meta?: {
      name?: string;
      live?: boolean;
    };
    status?: {
      current: {
        state: string;
        reason: string;
        ingestProtocol: string;
        statusEnteredAt: string;
        statusLastSeen: string;
      };
      history: Array<any>;
    };
    recording?: {
      mode: string;
      requireSignedURLs: boolean;
      allowedOrigins: any;
      hideLiveViewerCount: boolean;
    };
    deleteRecordingAfterDays?: number | null;
  };
}

const functionConfig: HttpsOptions = {
  cors: [
    'http://localhost:8081',
    'http://localhost:19006',
    'https://streamsor-6fb0e.web.app',
    'https://streamsor-6fb0e.firebaseapp.com'
  ],
  maxInstances: 10,
  region: 'us-central1',
  secrets: [cloudflareAccountId, cloudflareApiToken]
};

// Function to generate a random stream key
function generateStreamKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = '';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `live_${key}`;
}

// Initialize user with permanent stream setup
export const initializeUser = onCall(functionConfig, async (request) => {
  try {
    const auth = request.auth;
    if (!auth?.uid) {
      throw new Error('Authentication required');
    }

    console.log('Initializing user:', auth.uid);

    const db = getDatabase();
    const userRef = db.ref(`users/${auth.uid}`);
    
    // Check if user already has a stream setup
    const snapshot = await userRef.get();
    if (snapshot.exists() && snapshot.val().streamKey && snapshot.val().liveInputId) {
      console.log('Found existing user setup:', {
        userId: auth.uid,
        liveInputId: snapshot.val().liveInputId,
        streamKey: snapshot.val().streamKey,
        rtmps: snapshot.val().rtmps
      });
      
      // Verify the live input exists and has correct key
      try {
        console.log('Verifying live input with Cloudflare...');
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${snapshot.val().liveInputId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${cloudflareApiToken.value()}`,
              'Content-Type': 'application/json',
            }
          }
        );

        const data = await response.json() as CloudflareResponse;
        console.log('Cloudflare live input check response:', JSON.stringify(data, null, 2));
        
        if (!data.success) {
          console.log('Live input not found or error, creating new one...');
          throw new Error('Live input not found');
        }

        if (data.success && data.result) {
          // Live input exists, use its stream key
          console.log('Live input exists, using Cloudflare stream key');
          if (data.result.rtmps?.streamKey !== snapshot.val().streamKey) {
            console.log('Updating local stream key to match Cloudflare');
            // Update our local stream key to match Cloudflare's
            await userRef.update({
              streamKey: data.result.rtmps.streamKey,
              updatedAt: Date.now()
            });
          }

          // Ensure stream entry exists
          const streamRef = db.ref(`streams/${snapshot.val().liveInputId}`);
          await streamRef.update({
            id: snapshot.val().liveInputId,
            liveInputId: snapshot.val().liveInputId,
            userId: auth.uid,
            title: data.result.meta?.name || `${auth.token.email}'s Stream`,
            streamerName: auth.token.email || 'Anonymous',
            status: 'offline',
            viewerCount: 0,
            playback: {
              hls: `https://customer-36l16wkxbq7p6vgy.cloudflarestream.com/${snapshot.val().liveInputId}/manifest/video.m3u8`,
              dash: `https://customer-36l16wkxbq7p6vgy.cloudflarestream.com/${snapshot.val().liveInputId}/manifest/video.mpd`
            },
            updatedAt: Date.now()
          });

          return { success: true };
        }
      } catch (error) {
        console.error('Error verifying live input:', error);
      }
    }

    console.log('Creating new stream setup for user:', auth.uid);

    // Create permanent live input
    console.log('Creating new live input in Cloudflare...');
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cloudflareApiToken.value()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        meta: { name: `${auth.token.email}'s Stream` },
        recording: { mode: "automatic" }
      })
    });

    const data = await response.json() as CloudflareResponse;
    console.log('Cloudflare create live input response:', JSON.stringify(data, null, 2));
    
    if (!data.success || !data.result) {
      console.error('Failed to create live input:', data.errors);
      throw new Error('Failed to create permanent live input');
    }

    const liveInputId = data.result.uid;
    const streamKey = data.result.rtmps.streamKey;

    // Save user data with stream information from Cloudflare
    const userData = {
      streamKey,
      liveInputId,
      rtmps: {
        url: 'rtmps://live.cloudflare.com:443/live'
      },
      playback: {
        hls: `https://customer-36l16wkxbq7p6vgy.cloudflarestream.com/${liveInputId}/manifest/video.m3u8`,
        dash: `https://customer-36l16wkxbq7p6vgy.cloudflarestream.com/${liveInputId}/manifest/video.mpd`
      },
      createdAt: Date.now()
    };
    
    console.log('Saving user data:', userData);
    await userRef.set(userData);

    // Create initial stream entry
    const streamRef = db.ref(`streams/${liveInputId}`);
    await streamRef.set({
      id: liveInputId,
      liveInputId,
      userId: auth.uid,
      title: `${auth.token.email}'s Stream`,
      streamerName: auth.token.email || 'Anonymous',
      status: 'offline',
      viewerCount: 0,
      playback: userData.playback,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    return { success: true };
  } catch (error) {
    console.error('Error initializing user:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to initialize user');
  }
});

// Regenerate stream key
export const regenerateStreamKey = onCall(functionConfig, async (request) => {
  try {
    const auth = request.auth;
    if (!auth?.uid) {
      throw new Error('Authentication required');
    }

    const db = getDatabase();
    const userRef = db.ref(`users/${auth.uid}`);
    
    // Get current user data
    const snapshot = await userRef.get();
    if (!snapshot.exists()) {
      throw new Error('User not initialized');
    }
    
    const userData = snapshot.val();
    if (!userData.liveInputId) {
      throw new Error('No live input found');
    }

    // Generate new stream key
    const streamKey = generateStreamKey();

    // Update the live input with new stream key
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${userData.liveInputId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${cloudflareApiToken.value()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamKey: streamKey
        })
      }
    );

    const data = await response.json() as CloudflareResponse;
    if (!data.success) {
      throw new Error('Failed to update stream key');
    }

    // Update the stream key in database
    await userRef.update({
      streamKey,
      updatedAt: Date.now()
    });

    return { streamKey };
  } catch (error) {
    console.error('Error regenerating stream key:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to regenerate stream key');
  }
});

// Get user's stream key
export const getStreamKey = onCall(functionConfig, async (request) => {
  try {
    const auth = request.auth;
    if (!auth?.uid) {
      throw new Error('Authentication required');
    }

    const db = getDatabase();
    const userRef = db.ref(`users/${auth.uid}`);
    const snapshot = await userRef.get();
    
    if (!snapshot.exists()) {
      throw new Error('User not initialized');
    }

    const userData = snapshot.val();
    return { streamKey: userData.streamKey };
  } catch (error) {
    console.error('Error getting stream key:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to get stream key');
  }
});

// Automatically clean up stale streams every 15 minutes
export const cleanupStaleStreams = onSchedule('every 15 minutes', async (event) => {
  const db = getDatabase();
  const streamsRef = db.ref('streams');
  
  try {
    const snapshot = await streamsRef.once('value');
    const updates: { [key: string]: any } = {};
    
    for (const [streamId, stream] of Object.entries(snapshot.val() || {})) {
      const streamData = stream as any;
      console.log('Checking stale stream:', {
        streamId,
        liveInputId: streamData.liveInputId,
        status: streamData.status,
        startedAt: streamData.startedAt,
        lastActive: streamData.lastActive
      });

      // Only check streams that are marked as live
      if (streamData.status === 'live') {
        try {
          const liveInputId = streamData.liveInputId || streamId;
          console.log('Checking Cloudflare status for:', liveInputId);

          // Check Cloudflare stream status
          const response = await checkCloudflareWithRetry(
            `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`,
            cloudflareApiToken.value()
          );

          if (!response.ok) {
            if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
              // Skip this stream on temporary errors
              console.log('Temporary error, skipping stream:', streamId);
              continue;
            }
            console.error('Cloudflare API error for', streamId, ':', response.status);
            updates[`streams/${streamId}`] = {
              ...streamData,
              status: 'offline',
              statusMessage: 'Stream is offline',
              endedAt: Date.now(),
              updatedAt: Date.now()
            };
            continue;
          }

          const data = await response.json() as CloudflareResponse;
          
          // Check if stream is actually live
          const streamState = data.result?.status?.current?.state;
          const statusLastSeen = data.result?.status?.current?.statusLastSeen;
          const lastSeenTime = statusLastSeen ? new Date(statusLastSeen).getTime() : 0;
          const timeSinceLastSeen = Date.now() - lastSeenTime;

          // Mark as inactive if:
          // 1. API call failed (not temporary), OR
          // 2. No result from Cloudflare, OR
          // 3. Stream state is not 'connected' for more than 30 seconds, OR
          // 4. No activity in last 60 seconds
          if (!data.success || 
              !data.result || 
              (streamState !== 'connected' && timeSinceLastSeen > 30000) ||
              timeSinceLastSeen > 60000) {
            console.log('Marking stream as inactive:', {
              streamId,
              reason: !data.success ? 'API failure' :
                      !data.result ? 'No result' :
                      (streamState !== 'connected' && timeSinceLastSeen > 30000) ? 'Not connected' :
                      'No recent activity',
              state: streamState,
              lastSeen: statusLastSeen,
              timeSinceLastSeen
            });
            updates[`streams/${streamId}`] = {
              ...streamData,
              status: 'offline',
              statusMessage: 'Stream is offline',
              endedAt: Date.now(),
              updatedAt: Date.now()
            };
          }
        } catch (error) {
          console.error(`Error checking stream ${streamId} status:`, error);
          // On error, mark stream as offline
          updates[`streams/${streamId}`] = {
            ...streamData,
            status: 'offline',
            statusMessage: 'Error checking stream status',
            endedAt: Date.now(),
            updatedAt: Date.now()
          };
        }
      }
    }
    
    if (Object.keys(updates).length > 0) {
      console.log('Updating stale streams:', Object.keys(updates));
      await db.ref().update(updates);
      console.log(`Marked ${Object.keys(updates).length} stale streams as inactive`);
    }
  } catch (error) {
    console.error('Error cleaning up stale streams:', error);
  }
});

export const checkStreamStatus = onCall(functionConfig, async (request) => {
  const db = getDatabase();
  let streamRef: any;

  try {
    const streamId = request.data?.streamId;
    const liveInputId = request.data?.liveInputId;
    
    if (!streamId) {
      console.error('No streamId provided');
      return { status: 'offline', message: 'Stream ID is required' };
    }

    if (!liveInputId) {
      console.error('No liveInputId provided for stream:', streamId);
      return { status: 'offline', message: 'Live Input ID is required' };
    }

    console.log('Checking stream status:', {
      streamId,
      liveInputId,
      auth: request.auth?.uid
    });

    // Get stream data from database
    streamRef = db.ref(`streams/${streamId}`);
    const streamSnapshot = await streamRef.get();

    if (!streamSnapshot.exists()) {
      console.log('Stream not found:', streamId);
      return { status: 'offline', message: 'Stream not found' };
    }

    const streamData = streamSnapshot.val();
    const now = Date.now();

    // Check stream status with Cloudflare
    console.log('Checking stream status:', { streamId });
    const response = await checkCloudflareWithRetry(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`,
      cloudflareApiToken.value()
    );

    if (!response.ok) {
      console.error('Cloudflare API error:', response.status);
      if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
        // On rate limit or server error, keep existing status
        console.log('Temporary error, keeping existing status:', streamData.status);
        return {
          status: streamData.status || 'offline',
          message: 'Temporary error checking stream status',
          isTemporaryError: true,
          playback: streamData.playback
        };
      }
      // Only mark offline for permanent errors
      const updatedData = {
        status: 'offline',
        statusMessage: 'Stream is offline',
        updatedAt: now
      };
      await streamRef.update(updatedData);
      return {
        status: 'offline',
        message: 'Stream is offline'
      };
    }

    const data = await response.json() as CloudflareResponse;
    
    // Simplified logging
    console.log('Stream status:', {
      streamId,
      state: data.result?.status?.current?.state,
      lastSeen: data.result?.status?.current?.statusLastSeen
    });

    if (!data.success || !data.result) {
      console.error('Invalid Cloudflare response');
      // Keep existing status on invalid response
      return {
        status: streamData.status || 'offline',
        message: 'Error checking stream status',
        isTemporaryError: true,
        playback: streamData.playback
      };
    }

    // Check stream status using Cloudflare's status indicators
    const isStreamLive = data.result.status?.current?.state === 'connected';

    console.log('Stream status:', {
      streamId,
      state: data.result.status?.current?.state,
      lastSeen: data.result.status?.current?.statusLastSeen,
      isLive: isStreamLive,
      currentStatus: streamData.status
    });

    if (isStreamLive) {
      const playback = {
        hls: `https://customer-36l16wkxbq7p6vgy.cloudflarestream.com/${liveInputId}/manifest/video.m3u8`,
        dash: `https://customer-36l16wkxbq7p6vgy.cloudflarestream.com/${liveInputId}/manifest/video.mpd`
      };

      const updatedStreamData = {
        status: 'live',
        statusMessage: 'Stream is live',
        lastActive: now,
        startedAt: streamData.startedAt || now,
        updatedAt: now,
        liveInputId,
        playback
      };

      await streamRef.update(updatedStreamData);
      return {
        status: 'live',
        message: 'Stream is live',
        playback
      };
    }

    // If we get here, stream is offline
    const updatedStreamData = {
      status: 'offline',
      statusMessage: 'Stream is offline',
      endedAt: now,
      updatedAt: now,
      liveInputId
    };

    await streamRef.update(updatedStreamData);
    return {
      status: 'offline',
      message: 'Stream is offline'
    };
  } catch (error) {
    console.error('Error checking stream status:', error instanceof Error ? error.message : 'Unknown error');
    // On error, keep existing status if we have it
    if (streamRef) {
      try {
        const snapshot = await streamRef.get();
        if (snapshot.exists()) {
          const currentData = snapshot.val();
          return {
            status: currentData.status || 'offline',
            message: 'Error checking stream status',
            isTemporaryError: true,
            playback: currentData.playback
          };
        }
      } catch (dbError) {
        console.error('Error getting current stream data:', dbError);
      }
    }
    return {
      status: 'offline',
      message: 'Error checking stream status',
      isTemporaryError: true
    };
  }
});

// Send chat message function
export const sendChatMessage = onCall({
  cors: true, // This enables CORS for all origins in development
  maxInstances: 10,
  region: 'us-central1',
}, async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new Error('Authentication required');
  }

  const { streamId, text, username } = request.data;
  if (!streamId || !text || !username) {
    throw new Error('Missing required fields');
  }

  const db = getDatabase();
  const chatRef = db.ref(`chats/${streamId}/messages`).push();

  const message = {
    text: text.trim(),
    username,
    userId: auth.uid,
    timestamp: Date.now()
  };

  await chatRef.set(message);
  return { success: true };
});

export const startStream = onCall(functionConfig, async (request) => {
  const { title, streamKey } = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new Error('Unauthorized');
  }

  if (!title || !streamKey) {
    throw new Error('Missing required fields');
  }

  // Generate a unique stream ID
  const streamId = crypto.createHash('md5').update(`${userId}-${Date.now()}`).digest('hex');
  
  // Create stream in database
  const db = getDatabase();
  const streamRef = db.ref(`streams/${streamId}`);
  const userRef = db.ref(`users/${userId}`);
  
  const [userSnapshot] = await Promise.all([
    userRef.get()
  ]);

  const userData = userSnapshot.val();
  if (!userData) {
    throw new Error('User not found');
  }

  const streamData = {
    id: streamId,
    title,
    streamKey,
    streamerId: userId,
    streamerName: userData.displayName || 'Anonymous',
    status: 'connecting',
    statusMessage: 'Stream is starting...',
    startedAt: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await streamRef.set(streamData);

  return {
    streamId,
    message: 'Stream created successfully'
  };
});

export const stopStream = onCall(functionConfig, async (request) => {
  const { streamId } = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new Error('Unauthorized');
  }

  if (!streamId) {
    throw new Error('Missing streamId');
  }

  const db = getDatabase();
  const streamRef = db.ref(`streams/${streamId}`);
  const streamSnapshot = await streamRef.get();
  const streamData = streamSnapshot.val();

  if (!streamData) {
    throw new Error('Stream not found');
  }

  if (streamData.streamerId !== userId) {
    throw new Error('Unauthorized - not stream owner');
  }

  const updates = {
    status: 'offline',
    statusMessage: 'Stream has ended',
    endedAt: Date.now(),
    updatedAt: Date.now()
  };

  await streamRef.update(updates);

  return {
    message: 'Stream stopped successfully'
  };
});

export const syncPublicUserData = onValueWritten('/users/{userId}', async (event) => {
  const db = getDatabase();
  const userId = event.params.userId;
  
  try {
    if (!event.data.after.exists()) {
      // User was deleted, remove from public list
      await db.ref(`public/users/${userId}`).remove();
      return;
    }

    const userData = event.data.after.val();
    
    // Only sync necessary public data
    const publicUserData = {
      displayName: userData.displayName,
      email: userData.email,
      liveInputId: userData.liveInputId,
      status: userData.status || 'offline',
      title: userData.title,
      viewerCount: userData.viewerCount || 0,
      thumbnailUrl: userData.thumbnailUrl,
      playback: userData.playback
    };

    // Update public user data
    await db.ref(`public/users/${userId}`).update(publicUserData);
  } catch (error) {
    console.error('Error syncing public user data:', error);
  }
});

// Add this new function to get active streams
export const getActiveStreams = onCall({
  ...functionConfig,
  enforceAppCheck: false // Allow unauthenticated access
}, async (request) => {
  try {
    const db = getDatabase();
    const usersRef = db.ref('users');
    const snapshot = await usersRef.once('value');
    const users = snapshot.val() || {};

    console.log('Found users:', Object.keys(users).length);

    // Get all users with streaming capability
    const streamers = Object.entries(users)
      .filter(([_, userData]: [string, any]) => userData.liveInputId)
      .map(([uid, userData]: [string, any]) => ({
        uid,
        id: userData.liveInputId,
        liveInputId: userData.liveInputId,
        displayName: userData.displayName,
        email: userData.email,
        title: userData.title,
        viewerCount: userData.viewerCount || 0,
        thumbnailUrl: userData.thumbnailUrl,
        playback: userData.playback
      }));

    console.log('Found streamers with liveInputId:', streamers.length);

    // Add delay between requests to avoid rate limiting
    const checkStreamStatus = async (streamer: any) => {
      try {
        console.log('Checking Cloudflare status for streamer:', streamer.uid, streamer.liveInputId);
        
        const response = await checkCloudflareWithRetry(
          `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${streamer.liveInputId}`,
          cloudflareApiToken.value()
        );

        // Handle rate limiting and temporary errors
        if (!response.ok) {
          console.error('Cloudflare API error for', streamer.uid, ':', response.status, response.statusText);
          // Keep existing status on temporary errors
          const streamRef = db.ref(`streams/${streamer.liveInputId}`);
          const streamSnapshot = await streamRef.get();
          const streamData = streamSnapshot.exists() ? streamSnapshot.val() : null;
          return { 
            ...streamer, 
            status: streamData?.status || 'offline',
            playback: streamData?.playback,
            isTemporaryError: true
          };
        }

        const data = await response.json() as CloudflareResponse;
        console.log('🔥 ================== CLOUDFLARE RESPONSE START ==================');
        console.log('Streamer:', {
          uid: streamer.uid,
          liveInputId: streamer.liveInputId
        });
        console.log('Response:', JSON.stringify(data, null, 2));
        console.log('🔥 ================== CLOUDFLARE RESPONSE END ==================');
        
        if (data.success && data.result) {
          const isLive = data.result.status?.current?.state === 'connected';
          
          console.log('🎥 Stream Status:', {
            streamerId: streamer.uid,
            state: data.result.status?.current?.state,
            lastSeen: data.result.status?.current?.statusLastSeen,
            isLive,
            finalStatus: isLive ? 'live' : 'offline'
          });
          
          if (isLive) {
            // Update database status to match Cloudflare
            const streamRef = db.ref(`streams/${streamer.liveInputId}`);
            const playback = {
              hls: `https://customer-36l16wkxbq7p6vgy.cloudflarestream.com/${streamer.liveInputId}/manifest/video.m3u8`,
              dash: `https://customer-36l16wkxbq7p6vgy.cloudflarestream.com/${streamer.liveInputId}/manifest/video.mpd`
            };
            
            await streamRef.update({
              status: 'live',
              statusMessage: 'Stream is live',
              lastActive: Date.now(),
              updatedAt: Date.now(),
              playback
            });

            return {
              ...streamer,
              status: 'live',
              playback
            };
          }
        }
        
        // If not live, update database status
        const streamRef = db.ref(`streams/${streamer.liveInputId}`);
        await streamRef.update({
          status: 'offline',
          statusMessage: 'Stream is offline',
          updatedAt: Date.now()
        });

        return { ...streamer, status: 'offline' };
      } catch (error) {
        console.error('Error checking stream status:', streamer.liveInputId, error);
        // Keep existing status on error
        const streamRef = db.ref(`streams/${streamer.liveInputId}`);
        const streamSnapshot = await streamRef.get();
        const streamData = streamSnapshot.exists() ? streamSnapshot.val() : null;
        return { 
          ...streamer, 
          status: streamData?.status || 'offline',
          playback: streamData?.playback,
          isTemporaryError: true
        };
      }
    };

    // Process streamers with a delay between each
    const activeStreams = [];
    for (const streamer of streamers) {
      try {
        const result = await checkStreamStatus(streamer);
        activeStreams.push(result);
        // Add a larger delay between requests
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_BACKOFF.requestDelay));
      } catch (error) {
        console.error('Error checking streamer status:', streamer.uid, error);
        // Keep existing status on error
        const streamRef = db.ref(`streams/${streamer.liveInputId}`);
        const streamSnapshot = await streamRef.get();
        const currentStatus = streamSnapshot.exists() ? streamSnapshot.val().status : 'offline';
        activeStreams.push({ ...streamer, status: currentStatus });
        // Add extra delay after error
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_BACKOFF.requestDelay * 3));
      }
    }

    const liveStreams = activeStreams.filter(stream => stream.status === 'live');
    console.log('Total streams:', activeStreams.length, 'Live streams:', liveStreams.length);
    console.log('Live streams:', liveStreams.map(s => ({ uid: s.uid, liveInputId: s.liveInputId })));

    return { streams: activeStreams };
  } catch (error) {
    console.error('Error getting active streams:', error);
    throw new Error('Failed to get active streams');
  }
}); 