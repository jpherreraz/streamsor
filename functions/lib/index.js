"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendChatMessage = exports.checkStreamStatus = exports.cleanupStaleStreams = exports.getStreamKey = exports.regenerateStreamKey = exports.initializeUser = void 0;
const app_1 = require("firebase-admin/app");
const database_1 = require("firebase-admin/database");
const params_1 = require("firebase-functions/params");
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
            isLive: false,
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
        const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000); // 30 minutes ago
        for (const childSnapshot of Object.values(snapshot.val() || {})) {
            const stream = childSnapshot;
            // Only check streams that are marked as live and started more than 30 minutes ago
            if (stream.isLive && stream.startedAt < thirtyMinutesAgo) {
                try {
                    // Check Cloudflare stream status
                    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${stream.streamId}`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                            'Content-Type': 'application/json',
                        },
                    });
                    const data = await response.json();
                    // If the stream is not receiving data, mark it as inactive
                    if (!data.success || !data.result || !data.result.meta?.live) {
                        updates[`streams/${stream.streamId}`] = {
                            ...stream,
                            isLive: false,
                            endedAt: Date.now()
                        };
                    }
                }
                catch (error) {
                    console.error(`Error checking stream ${stream.streamId} status:`, error);
                }
            }
        }
        if (Object.keys(updates).length > 0) {
            await db.ref().update(updates);
            console.log(`Marked ${Object.keys(updates).length} stale streams as inactive`);
        }
    }
    catch (error) {
        console.error('Error cleaning up stale streams:', error);
    }
});
exports.checkStreamStatus = (0, https_1.onCall)(functionConfig, async (request) => {
    try {
        const streamId = request.data?.streamId;
        if (!streamId) {
            console.error('No streamId provided');
            return { status: 'error', message: 'Stream ID is required', isLive: false };
        }
        console.log('Checking stream status for stream:', streamId);
        let streamData = null;
        try {
            // Get stream data from database
            const db = (0, database_1.getDatabase)();
            const streamRef = db.ref(`streams/${streamId}`);
            const streamSnapshot = await streamRef.get();
            if (!streamSnapshot.exists()) {
                console.log('Stream not found:', streamId);
                return { status: 'ended', message: 'Stream not found', isLive: false };
            }
            streamData = streamSnapshot.val();
            const liveInputId = streamData?.liveInputId || streamId;
            // If stream is initializing, keep it in starting state
            const streamAge = Date.now() - (streamData.startedAt || streamData.createdAt || Date.now());
            if (streamAge < 30000 && streamData.isLive) {
                return {
                    status: 'starting',
                    message: 'Stream is starting...',
                    isLive: true
                };
            }
            // If stream was recently active, keep it in connecting state
            const lastActive = streamData.lastActive || streamData.updatedAt || streamData.startedAt || streamData.createdAt;
            if (lastActive && Date.now() - lastActive < 30000 && streamData.isLive) {
                return {
                    status: 'connecting',
                    message: 'Checking stream connection...',
                    isLive: true
                };
            }
            // Check stream status with Cloudflare
            console.log('Checking Cloudflare status for live input:', liveInputId);
            let response;
            try {
                response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                        'Content-Type': 'application/json',
                    },
                });
            }
            catch (fetchError) {
                console.error('Network error checking stream status:', fetchError);
                // If the stream was previously live or is initializing, keep it in connecting state
                if (streamData?.isLive || streamAge < 30000) {
                    return {
                        status: 'connecting',
                        message: 'Checking stream connection...',
                        isLive: true
                    };
                }
                return {
                    status: 'error',
                    message: 'Network error checking stream status',
                    isLive: false
                };
            }
            if (!response.ok) {
                console.error('Cloudflare API error:', response.status, response.statusText);
                // If the stream was previously live or is initializing, mark as connecting
                if (streamData?.isLive || streamAge < 30000) {
                    return {
                        status: 'connecting',
                        message: 'Checking stream connection...',
                        isLive: true
                    };
                }
                return {
                    status: 'error',
                    message: `API error: ${response.status} ${response.statusText}`,
                    isLive: false
                };
            }
            let data;
            try {
                data = await response.json();
            }
            catch (jsonError) {
                console.error('Error parsing Cloudflare response:', jsonError);
                if (streamData?.isLive || streamAge < 30000) {
                    return {
                        status: 'connecting',
                        message: 'Checking stream status...',
                        isLive: true
                    };
                }
                return {
                    status: 'error',
                    message: 'Error reading stream status',
                    isLive: false
                };
            }
            console.log('Cloudflare stream status response:', JSON.stringify(data, null, 2));
            if (!data.success || !data.result) {
                console.log('Stream not active in Cloudflare:', data.errors || 'Unknown error');
                // If the stream was previously live or is initializing, give it some time to reconnect
                if (streamData?.isLive || streamAge < 30000) {
                    const disconnectionTime = Date.now() - (lastActive || Date.now());
                    if (disconnectionTime < 30000) { // Less than 30 seconds
                        return {
                            status: 'connecting',
                            message: 'Stream reconnecting...',
                            isLive: true
                        };
                    }
                }
                // Mark stream as ended in database
                await streamRef.update({
                    isLive: false,
                    status: 'ended',
                    endedAt: Date.now(),
                    lastActive: Date.now()
                });
                return {
                    status: 'ended',
                    message: data.errors?.[0]?.message || 'Stream has ended',
                    isLive: false
                };
            }
            // Check if the stream is actually receiving data
            const streamState = data.result.status?.current?.state;
            const streamReason = data.result.status?.current?.reason;
            const isReceivingData = streamState === 'connected';
            console.log('Stream state:', streamState, 'reason:', streamReason, 'receiving data:', isReceivingData);
            if (isReceivingData) {
                // Stream is live and receiving data
                const updatedStreamData = {
                    isLive: true,
                    status: 'live',
                    lastActive: Date.now(),
                    viewerCount: streamData.viewerCount || 0,
                    updatedAt: Date.now()
                };
                // Update stream status
                await streamRef.update(updatedStreamData);
                return {
                    status: 'live',
                    message: 'Stream is live',
                    isLive: true
                };
            }
            else {
                // Stream exists but not receiving data
                if (streamData?.isLive || streamAge < 30000) {
                    // Check if this is a temporary disconnection
                    const disconnectionTime = Date.now() - (lastActive || Date.now());
                    console.log('Stream disconnection time:', disconnectionTime);
                    if (disconnectionTime < 30000) { // Less than 30 seconds
                        // Temporary disconnection, keep stream marked as live
                        console.log('Temporary disconnection detected:', streamId);
                        return {
                            status: 'connecting',
                            message: streamReason ? `Reconnecting: ${streamReason}` : 'Stream reconnecting...',
                            isLive: true
                        };
                    }
                    else {
                        // Stream has been disconnected for too long, mark as ended
                        console.log('Stream ended due to inactivity:', streamId);
                        const endedData = {
                            isLive: false,
                            status: 'ended',
                            endedAt: Date.now(),
                            lastActive: Date.now(),
                            updatedAt: Date.now()
                        };
                        await streamRef.update(endedData);
                        return {
                            status: 'ended',
                            message: 'Stream ended due to inactivity',
                            isLive: false
                        };
                    }
                }
                // If stream exists but is not live, check if it's starting up
                if (streamState === 'ready' || streamAge < 30000) {
                    return {
                        status: 'starting',
                        message: 'Stream is starting...',
                        isLive: true
                    };
                }
                // If we have a specific reason from Cloudflare, use it
                if (streamReason) {
                    return {
                        status: 'error',
                        message: `Stream error: ${streamReason}`,
                        isLive: false
                    };
                }
                return {
                    status: 'ended',
                    message: 'Stream not active',
                    isLive: false
                };
            }
        }
        catch (error) {
            console.error('Error checking stream status:', error);
            // If there was an error but the stream was previously live or is initializing, don't end it immediately
            const streamAge = Date.now() - (streamData?.startedAt || streamData?.createdAt || Date.now());
            if (streamData?.isLive || streamAge < 30000) {
                return {
                    status: 'connecting',
                    message: 'Checking stream connection...',
                    isLive: true
                };
            }
            return {
                status: 'error',
                message: error instanceof Error ? error.message : 'Failed to check stream status',
                isLive: false
            };
        }
    }
    catch (error) {
        console.error('Error in checkStreamStatus:', error);
        return {
            status: 'error',
            message: error instanceof Error ? error.message : 'Internal error checking stream status',
            isLive: false
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
//# sourceMappingURL=index.js.map