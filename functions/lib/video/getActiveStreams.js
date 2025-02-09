"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getActiveStreams = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("../config");
const checkCloudflareWithRetry_1 = require("../stream/checkCloudflareWithRetry");
// Get all Cloudflare videos with user data from Firestore
exports.getActiveStreams = (0, https_1.onCall)(config_1.functionConfig, async (request) => {
    try {
        const auth = request.auth;
        console.log('Getting videos with auth:', auth?.uid);
        console.log('Fetching videos from Cloudflare with account:', checkCloudflareWithRetry_1.cloudflareAccountId.value());
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${checkCloudflareWithRetry_1.cloudflareAccountId.value()}/stream`, {
            headers: {
                'Authorization': `Bearer ${checkCloudflareWithRetry_1.cloudflareApiToken.value()}`,
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
        const videos = await Promise.all(data.result.map(async (video) => {
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
                }
                else {
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
            };
        }));
        console.log(`Successfully mapped ${videos.length} videos no cap fr fr`);
        return videos;
    }
    catch (error) {
        console.error('Error in getCloudflareVideos:', error);
        throw new Error('Failed to fetch videos fr fr');
    }
});
//# sourceMappingURL=getActiveStreams.js.map