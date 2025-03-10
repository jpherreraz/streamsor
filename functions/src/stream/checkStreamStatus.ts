import { getDatabase } from 'firebase-admin/database';
import { onCall } from 'firebase-functions/v2/https';
import { checkCloudflareWithRetry, cloudflareAccountId, cloudflareApiToken, functionConfig } from '../config';

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