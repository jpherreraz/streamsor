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
exports.initializeUser = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const undici_1 = require("undici");
const config_1 = require("../config");
const checkCloudflareWithRetry_1 = require("./checkCloudflareWithRetry");
// Initialize user's stream setup
exports.initializeUser = functions.https.onCall(config_1.functionConfig, async (request) => {
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'no cap, you need to be authenticated fr fr');
        }
        console.log('Creating new stream setup for user:', request.auth.uid);
        // Check if user already has a stream setup
        const db = admin.firestore();
        const existingStreams = await db.collection('users')
            .where('uploadedBy', '==', request.auth.uid)
            .limit(1)
            .get();
        if (!existingStreams.empty) {
            console.log('User already has a stream setup');
            const streamDoc = existingStreams.docs[0];
            return {
                message: 'stream setup already exists fr fr 🔥',
                liveInputId: streamDoc.id,
                rtmpsUrl: streamDoc.data().rtmpsUrl,
                streamKey: streamDoc.data().streamKey
            };
        }
        // Create live input in Cloudflare
        console.log('Creating new live input in Cloudflare...');
        const response = await (0, undici_1.fetch)(`https://api.cloudflare.com/client/v4/accounts/${checkCloudflareWithRetry_1.cloudflareAccountId.value()}/stream/live_inputs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${checkCloudflareWithRetry_1.cloudflareApiToken.value()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                meta: {
                    name: 'New Stream',
                    category: 'just-chatting',
                    uploadedBy: request.auth.uid
                },
                recording: {
                    mode: 'automatic',
                    timeoutSeconds: 0,
                    requireSignedURLs: false
                }
            })
        });
        if (!response.ok) {
            console.error('Cloudflare API error:', response.status, await response.text());
            throw new functions.https.HttpsError('internal', 'Cloudflare API not bussin rn');
        }
        const data = await response.json();
        console.log('Cloudflare response:', data);
        if (!data.success || !data.result) {
            console.error('Invalid Cloudflare response:', data);
            throw new functions.https.HttpsError('internal', 'Cloudflare API acting sus fr fr');
        }
        const liveInputId = data.result.uid;
        const rtmpsUrl = data.result.rtmps.url;
        const streamKey = data.result.rtmps.streamKey;
        // Update user document with new stream info
        console.log('Updating Firestore with stream info...');
        await db.collection('users').doc(liveInputId).set({
            liveInputId,
            streamTitle: 'New Stream',
            streamCategory: 'just-chatting',
            email: request.auth.token.email || null,
            profilePicture: request.auth.token.picture || null,
            uploadedBy: request.auth.uid,
            rtmpsUrl,
            streamKey,
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
        });
        console.log('Stream setup completed successfully!');
        return {
            message: 'stream setup bussin fr fr 🔥',
            liveInputId,
            rtmpsUrl,
            streamKey
        };
    }
    catch (error) {
        console.error('Error in initializeUser:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'server acting sus rn');
    }
});
//# sourceMappingURL=initializeUser.js.map