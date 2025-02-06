"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveStreams = exports.syncPublicUserData = exports.stopStream = exports.startStream = exports.sendChatMessage = exports.checkStreamStatus = exports.cleanupStaleStreams = exports.getStreamKey = exports.regenerateStreamKey = exports.initializeUser = void 0;
const crypto_1 = __importDefault(require("crypto"));
const app_1 = require("firebase-admin/app");
const database_1 = require("firebase-admin/database");
const params_1 = require("firebase-functions/params");
const database_2 = require("firebase-functions/v2/database");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
// Initialize Firebase Admin
(0, app_1.initializeApp)();
const cloudflareAccountId = (0, params_1.defineSecret)('CLOUDFLARE_ACCOUNT_ID');
const cloudflareApiToken = (0, params_1.defineSecret)('CLOUDFLARE_API_TOKEN');
const functionConfig = {
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
function generateStreamKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `live_${key}`;
}
// Initialize user with permanent stream setup
exports.initializeUser = (0, https_1.onCall)(functionConfig, async (request) => {
    try {
        const auth = request.auth;
        if (!auth?.uid) {
            throw new Error('Authentication required');
        }
        console.log('Initializing user:', auth.uid);
        const db = (0, database_1.getDatabase)();
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
                const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${snapshot.val().liveInputId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                        'Content-Type': 'application/json',
                    }
                });
                const data = await response.json();
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
            }
            catch (error) {
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
        const data = await response.json();
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
    }
    catch (error) {
        console.error('Error initializing user:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to initialize user');
    }
});
// Regenerate stream key
exports.regenerateStreamKey = (0, https_1.onCall)(functionConfig, async (request) => {
    try {
        const auth = request.auth;
        if (!auth?.uid) {
            throw new Error('Authentication required');
        }
        const db = (0, database_1.getDatabase)();
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
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${userData.liveInputId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                streamKey: streamKey
            })
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error('Failed to update stream key');
        }
        // Update the stream key in database
        await userRef.update({
            streamKey,
            updatedAt: Date.now()
        });
        return { streamKey };
    }
    catch (error) {
        console.error('Error regenerating stream key:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to regenerate stream key');
    }
});
// Get user's stream key
exports.getStreamKey = (0, https_1.onCall)(functionConfig, async (request) => {
    try {
        const auth = request.auth;
        if (!auth?.uid) {
            throw new Error('Authentication required');
        }
        const db = (0, database_1.getDatabase)();
        const userRef = db.ref(`users/${auth.uid}`);
        const snapshot = await userRef.get();
        if (!snapshot.exists()) {
            throw new Error('User not initialized');
        }
        const userData = snapshot.val();
        return { streamKey: userData.streamKey };
    }
    catch (error) {
        console.error('Error getting stream key:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to get stream key');
    }
});
// Automatically clean up stale streams every 5 minutes
exports.cleanupStaleStreams = (0, scheduler_1.onSchedule)('every 5 minutes', async (event) => {
    const db = (0, database_1.getDatabase)();
    const streamsRef = db.ref('streams');
    try {
        const snapshot = await streamsRef.once('value');
        const updates = {};
        for (const [streamId, stream] of Object.entries(snapshot.val() || {})) {
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
                    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                            'Content-Type': 'application/json',
                        },
                    });
                    const data = await response.json();
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
                            status: 'offline',
                            statusMessage: 'Stream is offline',
                            endedAt: Date.now(),
                            updatedAt: Date.now()
                        };
                    }
                }
                catch (error) {
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
    }
    catch (error) {
        console.error('Error cleaning up stale streams:', error);
    }
});
exports.checkStreamStatus = (0, https_1.onCall)(functionConfig, async (request) => {
    const db = (0, database_1.getDatabase)();
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
        const streamData = streamSnapshot.val();
        const now = Date.now();
        // Check stream status with Cloudflare
        console.log('Checking Cloudflare status for live input:', liveInputId);
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                'Content-Type': 'application/json',
            }
        });
        if (!response.ok) {
            console.error('Cloudflare API error:', response.status, response.statusText);
            // Mark stream as offline on API error
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
        // Check stream status using Cloudflare's status indicators
        // A stream is considered live if meta.live is true OR if status.current.state is 'connected'
        const isStreamLive = data.result.meta?.live === true ||
            data.result.status?.current?.state === 'connected';
        console.log('Stream status analysis:', {
            streamId,
            liveInputId,
            metaLive: data.result.meta?.live,
            streamState: data.result.status?.current?.state,
            isStreamLive,
            currentStatus: streamData.status
        });
        if (isStreamLive) {
            const updatedStreamData = {
                status: 'live',
                statusMessage: 'Stream is live',
                lastActive: now,
                startedAt: streamData.startedAt || now,
                updatedAt: now,
                liveInputId,
                playback: {
                    hls: `https://customer-36l16wkxbq7p6vgy.cloudflarestream.com/${liveInputId}/manifest/video.m3u8`,
                    dash: `https://customer-36l16wkxbq7p6vgy.cloudflarestream.com/${liveInputId}/manifest/video.mpd`
                }
            };
            await streamRef.update(updatedStreamData);
            return {
                status: 'live',
                message: 'Stream is live',
                playback: updatedStreamData.playback
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
    }
    catch (error) {
        console.error('Error in checkStreamStatus:', error);
        // On error, mark stream as offline
        if (streamRef) {
            const updatedData = {
                status: 'offline',
                statusMessage: 'Error checking stream status',
                updatedAt: Date.now()
            };
            await streamRef.update(updatedData);
        }
        return {
            status: 'offline',
            message: error instanceof Error ? error.message : 'Internal error checking stream status'
        };
    }
});
// Send chat message function
exports.sendChatMessage = (0, https_1.onCall)({
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
    const db = (0, database_1.getDatabase)();
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
exports.startStream = (0, https_1.onCall)(functionConfig, async (request) => {
    const { title, streamKey } = request.data;
    const userId = request.auth?.uid;
    if (!userId) {
        throw new Error('Unauthorized');
    }
    if (!title || !streamKey) {
        throw new Error('Missing required fields');
    }
    // Generate a unique stream ID
    const streamId = crypto_1.default.createHash('md5').update(`${userId}-${Date.now()}`).digest('hex');
    // Create stream in database
    const db = (0, database_1.getDatabase)();
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
exports.stopStream = (0, https_1.onCall)(functionConfig, async (request) => {
    const { streamId } = request.data;
    const userId = request.auth?.uid;
    if (!userId) {
        throw new Error('Unauthorized');
    }
    if (!streamId) {
        throw new Error('Missing streamId');
    }
    const db = (0, database_1.getDatabase)();
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
exports.syncPublicUserData = (0, database_2.onValueWritten)('/users/{userId}', async (event) => {
    const db = (0, database_1.getDatabase)();
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
    }
    catch (error) {
        console.error('Error syncing public user data:', error);
    }
});
// Add this new function to get active streams
exports.getActiveStreams = (0, https_1.onCall)({
    ...functionConfig,
    enforceAppCheck: false // Allow unauthenticated access
}, async (request) => {
    try {
        const db = (0, database_1.getDatabase)();
        const usersRef = db.ref('users');
        const snapshot = await usersRef.once('value');
        const users = snapshot.val() || {};
        console.log('Found users:', Object.keys(users).length);
        // Get all users with streaming capability
        const streamers = Object.entries(users)
            .filter(([_, userData]) => userData.liveInputId)
            .map(([uid, userData]) => ({
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
        // Check Cloudflare status for each streamer
        const activeStreams = await Promise.all(streamers.map(async (streamer) => {
            try {
                console.log('Checking Cloudflare status for streamer:', streamer.uid, streamer.liveInputId);
                const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${streamer.liveInputId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                        'Content-Type': 'application/json',
                    }
                });
                if (!response.ok) {
                    console.error('Cloudflare API error for', streamer.uid, ':', response.status, response.statusText);
                    return { ...streamer, status: 'offline' };
                }
                const data = await response.json();
                console.log('Cloudflare status check for', streamer.uid, ':', {
                    metaLive: data.result?.meta?.live,
                    currentState: data.result?.status?.current?.state,
                    statusLastSeen: data.result?.status?.current?.statusLastSeen
                });
                if (data.success && data.result) {
                    // A stream is considered live if Cloudflare reports it as live
                    // (either meta.live is true OR status.current.state is 'connected')
                    const isLive = data.result.meta?.live === true ||
                        data.result.status?.current?.state === 'connected';
                    console.log('Stream status determination:', {
                        streamerId: streamer.uid,
                        isLive,
                        finalStatus: isLive ? 'live' : 'offline'
                    });
                    if (isLive) {
                        // Update database status to match Cloudflare
                        const streamRef = db.ref(`streams/${streamer.liveInputId}`);
                        await streamRef.update({
                            status: 'live',
                            statusMessage: 'Stream is live',
                            lastActive: Date.now(),
                            updatedAt: Date.now()
                        });
                        return {
                            ...streamer,
                            status: 'live',
                            playback: {
                                hls: `https://customer-36l16wkxbq7p6vgy.cloudflarestream.com/${streamer.liveInputId}/manifest/video.m3u8`,
                                dash: `https://customer-36l16wkxbq7p6vgy.cloudflarestream.com/${streamer.liveInputId}/manifest/video.mpd`
                            }
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
                console.log('Stream not live for', streamer.uid);
                return { ...streamer, status: 'offline' };
            }
            catch (error) {
                console.error('Error checking stream status:', streamer.liveInputId, error);
                return { ...streamer, status: 'offline' };
            }
        }));
        const liveStreams = activeStreams.filter(stream => stream.status === 'live');
        console.log('Total streams:', activeStreams.length, 'Live streams:', liveStreams.length);
        console.log('Live streams:', liveStreams.map(s => ({ uid: s.uid, liveInputId: s.liveInputId })));
        return { streams: activeStreams };
    }
    catch (error) {
        console.error('Error getting active streams:', error);
        throw new Error('Failed to get active streams');
    }
});
//# sourceMappingURL=index.js.map