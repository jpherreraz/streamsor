"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateVideoMetadata = void 0;
const database_1 = require("firebase-admin/database");
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("../config");
// Migration function to update existing videos with uploadedBy field
exports.migrateVideoMetadata = (0, https_1.onCall)({
    ...config_1.functionConfig,
    timeoutSeconds: 540, // 9 minutes to handle large video libraries
}, async (request) => {
    const auth = request.auth;
    if (!auth?.uid) {
        throw new Error('Authentication required');
    }
    try {
        console.log('Starting video metadata migration...');
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config_1.cloudflareAccountId.value()}/stream`, {
            headers: {
                'Authorization': `Bearer ${config_1.cloudflareApiToken.value()}`,
                'Content-Type': 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch videos: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.success || !Array.isArray(data.result)) {
            throw new Error('Failed to get videos from Cloudflare');
        }
        console.log(`Found ${data.result.length} videos to process`);
        // Get the database reference
        const db = (0, database_1.getDatabase)();
        const updates = [];
        for (const video of data.result) {
            if (!video.meta?.uploadedBy) {
                try {
                    // Try to find the uploader from various sources
                    let uploaderId = null;
                    // First check if video is in RTDB
                    const videoSnapshot = await db.ref(`videos/${video.uid}`).get();
                    if (videoSnapshot.exists()) {
                        const videoData = videoSnapshot.val();
                        uploaderId = videoData.userId || videoData.uploaderId;
                        console.log('Found uploader from videos collection:', uploaderId);
                    }
                    // Then check streams collection
                    if (!uploaderId) {
                        const streamSnapshot = await db.ref(`streams`).orderByChild('liveInputId').equalTo(video.uid).get();
                        if (streamSnapshot.exists()) {
                            const streams = streamSnapshot.val();
                            const stream = Object.values(streams)[0];
                            uploaderId = stream.userId || stream.streamerId;
                            console.log('Found uploader from streams collection:', uploaderId);
                        }
                    }
                    if (uploaderId) {
                        console.log(`Updating video ${video.uid} with uploaderId ${uploaderId}`);
                        const updateResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config_1.cloudflareAccountId.value()}/stream/${video.uid}`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${config_1.cloudflareApiToken.value()}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                meta: {
                                    ...video.meta,
                                    uploadedBy: uploaderId
                                }
                            })
                        });
                        if (!updateResponse.ok) {
                            console.error(`Failed to update video ${video.uid}:`, updateResponse.status);
                            continue;
                        }
                        updates.push({
                            videoId: video.uid,
                            uploaderId,
                            source: 'migration'
                        });
                    }
                    else {
                        console.log(`Could not determine uploader for video ${video.uid}`);
                    }
                }
                catch (error) {
                    console.error(`Error processing video ${video.uid}:`, error);
                    continue;
                }
                // Add a small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        console.log(`Migration complete. Updated ${updates.length} videos`);
        return {
            success: true,
            updatedVideos: updates.length,
            updates
        };
    }
    catch (error) {
        console.error('Migration error:', error);
        throw new Error('Failed to migrate video metadata');
    }
});
//# sourceMappingURL=migrateVideoMetadata.js.map