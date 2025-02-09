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
exports.getVideo = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("../config");
// Get video details
exports.getVideo = (0, https_1.onCall)({
    ...config_1.functionConfig,
    enforceAppCheck: false // Allow unauthenticated access
}, async (request) => {
    const { videoId } = request.data;
    if (!videoId) {
        throw new functions.https.HttpsError('invalid-argument', 'Video ID is required');
    }
    try {
        // Get video details from Cloudflare
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config_1.cloudflareAccountId.value()}/stream/${videoId}`, {
            headers: {
                'Authorization': `Bearer ${config_1.cloudflareApiToken.value()}`,
                'Content-Type': 'application/json',
            }
        });
        if (!response.ok) {
            console.error('Cloudflare API error:', response.status);
            throw new functions.https.HttpsError('not-found', 'Video not found');
        }
        const data = await response.json();
        if (!data.success || !data.result) {
            console.error('Invalid Cloudflare response:', data);
            throw new functions.https.HttpsError('internal', 'Failed to fetch video data');
        }
        const video = data.result;
        // Get uploader details if available
        let uploaderData = null;
        if (video.meta?.uploadedBy) {
            const uploaderSnapshot = await admin.database().ref(`users/${video.meta.uploadedBy}`).once('value');
            uploaderData = uploaderSnapshot.val();
        }
        return {
            uid: video.uid,
            title: video.meta?.name || 'Untitled Video',
            playbackUrl: video.playback?.hls,
            thumbnail: video.thumbnail,
            createdAt: video.created,
            uploader: uploaderData ? {
                email: uploaderData.email,
                photoURL: uploaderData.photoURL
            } : undefined
        };
    }
    catch (error) {
        console.error('Error fetching video:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to fetch video');
    }
});
//# sourceMappingURL=getVideo.js.map