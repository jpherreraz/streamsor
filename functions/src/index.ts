import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { defineSecret } from 'firebase-functions/params';
import { HttpsOptions, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// Initialize Firebase Admin
initializeApp();

const cloudflareAccountId = defineSecret('CLOUDFLARE_ACCOUNT_ID');
const cloudflareApiToken = defineSecret('CLOUDFLARE_API_TOKEN');

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
            isLive: false,
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
      isLive: false,
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

// Automatically clean up stale streams every 5 minutes
export const cleanupStaleStreams = onSchedule('every 5 minutes', async (event) => {
  const db = getDatabase();
  const streamsRef = db.ref('streams');
  
  try {
    const snapshot = await streamsRef.once('value');
    const updates: { [key: string]: any } = {};
    const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000); // 30 minutes ago
    
    for (const [streamId, stream] of Object.entries(snapshot.val() || {})) {
      const streamData = stream as any;
      console.log('Checking stale stream:', {
        streamId,
        liveInputId: streamData.liveInputId,
        isLive: streamData.isLive,
        startedAt: streamData.startedAt,
        lastActive: streamData.lastActive
      });

      // Only check streams that are marked as live
      if (streamData.isLive) {
        try {
          const liveInputId = streamData.liveInputId || streamId;
          console.log('Checking Cloudflare status for:', liveInputId);

          // Check Cloudflare stream status
          const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                'Content-Type': 'application/json',
              },
            }
          );

          const data = await response.json() as CloudflareResponse;
          console.log('Cloudflare response for stale check:', {
            streamId,
            liveInputId,
            success: data.success,
            metaLive: data.result?.meta?.live,
            streamState: data.result?.status?.current?.state,
            statusLastSeen: data.result?.status?.current?.statusLastSeen
          });
          
          // Check if stream is actually live
          const streamState = data.result?.status?.current?.state;
          const metaLive = data.result?.meta?.live;
          const statusLastSeen = data.result?.status?.current?.statusLastSeen;
          const lastSeenTime = statusLastSeen ? new Date(statusLastSeen).getTime() : 0;
          const timeSinceLastSeen = Date.now() - lastSeenTime;

          // Mark as inactive if:
          // 1. API call failed, OR
          // 2. No result from Cloudflare, OR
          // 3. Stream is not marked as live, OR
          // 4. Stream is not connected, OR
          // 5. No activity in last 30 seconds
          if (!data.success || 
              !data.result || 
              !metaLive || 
              streamState !== 'connected' ||
              timeSinceLastSeen > 30000) {
            console.log('Marking stream as inactive:', {
              streamId,
              reason: !data.success ? 'API failure' :
                      !data.result ? 'No result' :
                      !metaLive ? 'Not live' :
                      streamState !== 'connected' ? 'Not connected' :
                      'No recent activity'
            });
            updates[`streams/${streamId}`] = {
              ...streamData,
              isLive: false,
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
            isLive: false,
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
  try {
    const streamId = request.data?.streamId;
    if (!streamId) {
      console.error('No streamId provided');
      return { status: 'offline', message: 'Stream ID is required', isLive: false };
    }

    console.log('Checking stream status for stream:', streamId);

    // Get stream data from database
    const db = getDatabase();
    const streamRef = db.ref(`streams/${streamId}`);
    const streamSnapshot = await streamRef.get();

    if (!streamSnapshot.exists()) {
      console.log('Stream not found:', streamId);
      return { status: 'offline', message: 'Stream not found', isLive: false };
    }

    const streamData = streamSnapshot.val();
    const liveInputId = streamData?.liveInputId || streamId;
    const now = Date.now();

    // Check stream status with Cloudflare
    console.log('Checking Cloudflare status for live input:', liveInputId);
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cloudflareApiToken.value()}`,
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      console.error('Cloudflare API error:', response.status, response.statusText);
      // Mark stream as offline on API error
      const updatedData = {
        isLive: false,
        status: 'offline',
        statusMessage: 'Stream is offline',
        updatedAt: now
      };
      await streamRef.update(updatedData);
      return {
        status: 'offline',
        message: 'Stream is offline',
        isLive: false
      };
    }

    const data = await response.json() as CloudflareResponse;
    console.log('Detailed Cloudflare response analysis:', {
      streamId,
      liveInputId,
      success: data.success,
      hasResult: !!data.result,
      metaLive: data.result?.meta?.live,
      streamState: data.result?.status?.current?.state,
      streamReason: data.result?.status?.current?.reason,
      statusEnteredAt: data.result?.status?.current?.statusEnteredAt,
      statusLastSeen: data.result?.status?.current?.statusLastSeen,
      ingestProtocol: data.result?.status?.current?.ingestProtocol,
      currentDbState: {
        isLive: streamData.isLive,
        status: streamData.status,
        lastActive: streamData.lastActive ? new Date(streamData.lastActive).toISOString() : null
      },
      errors: data.errors,
      timestamp: new Date().toISOString()
    });

    if (!data.success || !data.result) {
      console.error('Invalid Cloudflare response:', data.errors);
      // Mark stream as offline on invalid response
      const updatedData = {
        isLive: false,
        status: 'offline',
        statusMessage: 'Stream is offline',
        updatedAt: now
      };
      await streamRef.update(updatedData);
      return {
        status: 'offline',
        message: 'Stream is offline',
        isLive: false
      };
    }

    // Check stream status using Cloudflare's status indicators
    const streamState = data.result.status?.current?.state;
    const streamReason = data.result.status?.current?.reason;
    const metaLive = data.result.meta?.live;
    const statusLastSeen = data.result.status?.current?.statusLastSeen;
    const lastSeenTime = statusLastSeen ? new Date(statusLastSeen).getTime() : 0;
    const timeSinceLastSeen = now - lastSeenTime;

    console.log('Stream status analysis:', {
      streamId,
      liveInputId,
      streamState,
      streamReason,
      metaLive,
      statusLastSeen,
      timeSinceLastSeen,
      currentStatus: streamData.status,
      currentIsLive: streamData.isLive
    });

    // Stream is considered live ONLY if ALL conditions are met:
    // 1. Cloudflare reports meta.live as true
    // 2. Stream state is 'connected'
    // 3. We've seen activity in the last 15 seconds
    // 4. No error reason is present
    const isStreamLive = metaLive === true && 
                        streamState === 'connected' && 
                        timeSinceLastSeen < 15000 &&
                        (!streamReason || streamReason === 'connected');

    if (isStreamLive) {
      const updatedStreamData = {
        isLive: true,
        status: 'live',
        statusMessage: 'Stream is live',
        lastActive: now,
        startedAt: streamData.startedAt || now,
        updatedAt: now,
        playback: {
          hls: `https://customer-36l16wkxbq7p6vgy.cloudflarestream.com/${liveInputId}/manifest/video.m3u8`,
          dash: `https://customer-36l16wkxbq7p6vgy.cloudflarestream.com/${liveInputId}/manifest/video.mpd`
        }
      };

      await streamRef.update(updatedStreamData);
      return {
        status: 'live',
        message: 'Stream is live',
        isLive: true,
        playback: updatedStreamData.playback
      };
    }

    // If we get here, stream is offline
    const updatedStreamData = {
      isLive: false,
      status: 'offline',
      statusMessage: 'Stream is offline',
      endedAt: now,
      updatedAt: now
    };

    await streamRef.update(updatedStreamData);
    return {
      status: 'offline',
      message: 'Stream is offline',
      isLive: false
    };
  } catch (error) {
    console.error('Error in checkStreamStatus:', error);
    // On error, mark stream as offline
    if (streamRef) {
      const updatedData = {
        isLive: false,
        status: 'offline',
        statusMessage: 'Error checking stream status',
        updatedAt: Date.now()
      };
      await streamRef.update(updatedData);
    }
    return {
      status: 'offline',
      message: error instanceof Error ? error.message : 'Internal error checking stream status',
      isLive: false
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