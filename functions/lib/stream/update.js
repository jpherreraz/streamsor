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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStreamEmail = exports.updateStreamProfilePicture = exports.updateStreamTitle = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const params_1 = require("firebase-functions/params");
const https_1 = require("firebase-functions/v2/https");
const cloudflareAccountId = (0, params_1.defineSecret)('CLOUDFLARE_ACCOUNT_ID');
const cloudflareApiToken = (0, params_1.defineSecret)('CLOUDFLARE_API_TOKEN');
const functionConfig = {
    cors: true,
    maxInstances: 10,
    region: 'us-central1',
    secrets: [cloudflareAccountId, cloudflareApiToken]
};
// Update stream title and category
exports.updateStreamTitle = (0, https_1.onCall)(functionConfig, async (request) => {
    try {
        console.log('Starting updateStreamTitle with data:', request.data);
        const auth = request.auth;
        if (!auth?.uid) {
            throw new functions.https.HttpsError('unauthenticated', 'no cap, you need to be authenticated fr fr');
        }
        const { title, category, liveInputId } = request.data;
        console.log('Received params:', { title, category, liveInputId });
        if (!title || typeof title !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'bruh where the title at? 💀');
        }
        if (!category || !['gaming', 'just-chatting', 'art', 'software-dev'].includes(category)) {
            throw new functions.https.HttpsError('invalid-argument', 'that category ain\'t it chief');
        }
        if (!liveInputId) {
            throw new functions.https.HttpsError('invalid-argument', 'yo where the liveInputId at? 🤔');
        }
        const db = admin.firestore();
        console.log('Checking user doc:', liveInputId);
        const userDoc = await db.collection('users').doc(liveInputId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'stream setup not found fr fr');
        }
        try {
            console.log('Updating Cloudflare...');
            // Update title in Cloudflare
            const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    meta: {
                        name: title,
                        category,
                        uploadedBy: auth.uid
                    }
                })
            });
            const data = await response.json();
            console.log('Cloudflare response:', data);
            if (!data.success) {
                console.error('Cloudflare update failed:', data.errors);
                throw new functions.https.HttpsError('internal', 'Failed to update stream info no cap');
            }
            console.log('Updating Firestore...');
            // Update user doc with new stream info
            await db.collection('users').doc(liveInputId).update({
                streamTitle: title,
                streamCategory: category,
                updatedAt: admin.firestore.Timestamp.now()
            });
            console.log('Update successful!');
            return { message: 'stream update bussin fr fr ✨' };
        }
        catch (error) {
            console.error('Error in Cloudflare/Firestore operations:', error);
            throw new functions.https.HttpsError('internal', 'server acting sus rn');
        }
    }
    catch (error) {
        console.error('Top level error in updateStreamTitle:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'server acting mad sus rn fr fr');
    }
});
// Update stream profile picture
exports.updateStreamProfilePicture = (0, https_1.onCall)(functionConfig, async (request) => {
    try {
        console.log('Starting updateStreamProfilePicture with data:', request.data);
        const auth = request.auth;
        if (!auth?.uid) {
            throw new functions.https.HttpsError('unauthenticated', 'no cap, you need to be authenticated fr fr');
        }
        const { photoURL, liveInputId } = request.data;
        console.log('Received params:', { photoURL, liveInputId });
        if (!photoURL || typeof photoURL !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'bruh where the photo URL at? 💀');
        }
        if (!liveInputId) {
            throw new functions.https.HttpsError('invalid-argument', 'yo where the liveInputId at? 🤔');
        }
        const db = admin.firestore();
        console.log('Checking user doc:', liveInputId);
        const userDoc = await db.collection('users').doc(liveInputId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'stream setup not found fr fr');
        }
        try {
            console.log('Updating Cloudflare...');
            // Update profile picture in Cloudflare
            const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    meta: {
                        uploaderPhotoURL: photoURL,
                        uploadedBy: auth.uid
                    }
                })
            });
            const data = await response.json();
            console.log('Cloudflare response:', data);
            if (!data.success) {
                console.error('Cloudflare update failed:', data.errors);
                throw new functions.https.HttpsError('internal', 'Failed to update stream info no cap');
            }
            console.log('Updating Firestore...');
            // Update user doc with new profile picture
            await db.collection('users').doc(liveInputId).update({
                profilePicture: photoURL,
                updatedAt: admin.firestore.Timestamp.now()
            });
            console.log('Update successful!');
            return { message: 'profile pic update bussin fr fr ✨' };
        }
        catch (error) {
            console.error('Error in Cloudflare/Firestore operations:', error);
            throw new functions.https.HttpsError('internal', 'server acting sus rn');
        }
    }
    catch (error) {
        console.error('Top level error in updateStreamProfilePicture:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'server acting mad sus rn fr fr');
    }
});
// Update stream email
exports.updateStreamEmail = (0, https_1.onCall)(functionConfig, async (request) => {
    try {
        console.log('Starting updateStreamEmail with data:', request.data);
        const auth = request.auth;
        if (!auth?.uid) {
            throw new functions.https.HttpsError('unauthenticated', 'no cap, you need to be authenticated fr fr');
        }
        const { email, liveInputId } = request.data;
        console.log('Received params:', { email, liveInputId });
        if (!email || typeof email !== 'string') {
            throw new functions.https.HttpsError('invalid-argument', 'bruh where the email at? 💀');
        }
        if (!liveInputId) {
            throw new functions.https.HttpsError('invalid-argument', 'yo where the liveInputId at? 🤔');
        }
        const db = admin.firestore();
        console.log('Checking user doc:', liveInputId);
        const userDoc = await db.collection('users').doc(liveInputId).get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'stream setup not found fr fr');
        }
        try {
            console.log('Updating Cloudflare...');
            // Update email in Cloudflare
            const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${cloudflareApiToken.value()}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    meta: {
                        uploaderEmail: email,
                        uploadedBy: auth.uid
                    }
                })
            });
            const data = await response.json();
            console.log('Cloudflare response:', data);
            if (!data.success) {
                console.error('Cloudflare update failed:', data.errors);
                throw new functions.https.HttpsError('internal', 'Failed to update stream info no cap');
            }
            console.log('Updating Firestore...');
            // Update user doc with new email
            await db.collection('users').doc(liveInputId).update({
                email: email,
                updatedAt: admin.firestore.Timestamp.now()
            });
            console.log('Update successful!');
            return { message: 'email update bussin fr fr ✨' };
        }
        catch (error) {
            console.error('Error in Cloudflare/Firestore operations:', error);
            throw new functions.https.HttpsError('internal', 'server acting sus rn');
        }
    }
    catch (error) {
        console.error('Top level error in updateStreamEmail:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'server acting mad sus rn fr fr');
    }
});
__exportStar(require("./updateStreamEmail"), exports);
__exportStar(require("./updateStreamProfilePicture"), exports);
__exportStar(require("./updateStreamTitle"), exports);
//# sourceMappingURL=update.js.map