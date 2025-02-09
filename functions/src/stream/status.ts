import { getDatabase } from 'firebase-admin/database';
import { defineSecret } from 'firebase-functions/params';
import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

interface StreamData {
  liveInputId: string;
  status: string;
  startedAt?: number;
  lastActive?: number;
  meta?: any;
  playback?: {
    hls: string;
    dash: string;
  };
  statusMessage?: string;
  endedAt?: number;
  updatedAt?: number;
}

const cloudflareAccountId = defineSecret('CLOUDFLARE_ACCOUNT_ID');
const cloudflareApiToken = defineSecret('CLOUDFLARE_API_TOKEN');

const functionConfig = {
  cors: true,
  maxInstances: 10,
  region: 'us-central1',
  secrets: [cloudflareAccountId, cloudflareApiToken]
};

// Helper function to check Cloudflare with retry logic
async function checkCloudflareWithRetry(url: string, token: string, attempt = 1) {
  const RATE_LIMIT_BACKOFF = {
    initialDelay: 1000,
    maxDelay: 10000,
    maxAttempts: 3,
    requestDelay: 5000
  };

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (response.status === 429 && attempt < RATE_LIMIT_BACKOFF.maxAttempts) {
      const delay = Math.min(RATE_LIMIT_BACKOFF.initialDelay * Math.pow(2, attempt - 1), RATE_LIMIT_BACKOFF.maxDelay);
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

// Check stream status
export const checkStreamStatus = onCall(functionConfig, async (request) => {
  const db = getDatabase();
  let streamRef;

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

    const streamData = streamSnapshot.val() as StreamData;
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
        console.log('Temporary error, keeping existing status:', streamData.status);
        return {
          status: streamData.status || 'offline',
          message: 'Temporary error checking stream status',
          isTemporaryError: true,
          playback: streamData.playback
        };
      }

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

    const data = await response.json();
    console.log('Stream status:', {
      streamId,
      state: data.result?.status?.current?.state,
      lastSeen: data.result?.status?.current?.statusLastSeen
    });

    if (!data.success || !data.result) {
      console.error('Invalid Cloudflare response');
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
    
    if (streamRef) {
      try {
        const snapshot = await streamRef.get();
        if (snapshot.exists()) {
          const currentData = snapshot.val() as StreamData;
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

// Automatically clean up stale streams every 15 minutes
export const cleanupStaleStreams = onSchedule('every 15 minutes', async (event) => {
  const db = getDatabase();
  const streamsRef = db.ref('streams');

  try {
    const snapshot = await streamsRef.once('value');
    const updates: Record<string, StreamData> = {};

    for (const [streamId, stream] of Object.entries<StreamData>(snapshot.val() || {})) {
      const streamData = stream;
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

          const data = await response.json();

          // Check if stream is actually live
          const streamState = data.result?.status?.current?.state;
          const statusLastSeen = data.result?.status?.current?.statusLastSeen;
          const lastSeenTime = statusLastSeen ? new Date(statusLastSeen).getTime() : 0;
          const timeSinceLastSeen = Date.now() - lastSeenTime;

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

export * from './checkStreamStatus';
export * from './cleanupStaleStreams';

