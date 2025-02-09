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
exports.setAdminClaims = exports.syncPublicUserData = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v2"));
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
// Sync user profile data from Auth to Firestore
exports.syncPublicUserData = functions.https.onCall(async (request) => {
    if (!request.auth) {
        throw new Error('Authentication required');
    }
    const { displayName, email, photoURL } = request.data;
    const uid = request.auth.uid;
    try {
        const db = admin.firestore();
        const userRef = db.collection('users').doc(uid);
        await userRef.set({
            displayName: displayName || null,
            email: email || null,
            photoURL: photoURL || null,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        return { success: true };
    }
    catch (error) {
        console.error('Error syncing user data:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to sync user data');
    }
});
// Set admin claims for a user
exports.setAdminClaims = functions.https.onCall(async (request) => {
    try {
        if (!request.auth?.token.admin) {
            throw new Error('Only existing admins can set admin claims fr fr!');
        }
        const { uid } = request.data;
        if (!uid) {
            throw new Error('User ID is required no cap!');
        }
        // Set admin claim
        await admin.auth().setCustomUserClaims(uid, { admin: true });
        console.log('Set admin claims for user:', uid);
        return {
            success: true,
            message: `User ${uid} is now an admin fr fr! 🔥`
        };
    }
    catch (error) {
        console.error('Failed to set admin claims:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to set admin claims');
    }
});
//# sourceMappingURL=auth.js.map