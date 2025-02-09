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
exports.migrateToFirestore = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v2"));
exports.migrateToFirestore = functions.https.onCall(async (data, context) => {
    // Only allow admin users to run this migration
    if (!context.auth?.token.admin) {
        throw new Error('Only admins can run this migration fr fr!');
    }
    try {
        console.log('Starting migration...');
        const db = admin.firestore();
        const rtdb = admin.database();
        // Get all users from RTDB
        const usersSnapshot = await rtdb.ref('users').once('value');
        const users = usersSnapshot.val();
        console.log('Found users:', Object.keys(users || {}).length);
        // Migrate each user to the new structure
        for (const [, userData] of Object.entries(users || {})) {
            if (userData.liveInputId) {
                await db.collection('users').doc(userData.liveInputId).set({
                    email: userData.email || null,
                    displayName: userData.displayName || null,
                    photoURL: userData.photoURL || null,
                    streamSettings: {
                        title: userData.title || null,
                        streamKey: userData.streamKey || null,
                        rtmpsUrl: userData.rtmpsUrl || null,
                        playback: userData.playback || null
                    },
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log('Migrated user:', userData.liveInputId);
            }
        }
        // Migrate comments if they exist
        const commentsSnapshot = await rtdb.ref('comments').once('value');
        const comments = commentsSnapshot.val();
        if (comments) {
            const batch = db.batch();
            let count = 0;
            const maxBatchSize = 500;
            for (const [streamId, streamComments] of Object.entries(comments)) {
                for (const [, commentData] of Object.entries(streamComments)) {
                    const commentRef = db.collection('comments').doc();
                    batch.set(commentRef, {
                        ...commentData,
                        streamId,
                        createdAt: admin.firestore.Timestamp.fromMillis(commentData.timestamp || Date.now())
                    });
                    count++;
                    if (count >= maxBatchSize) {
                        await batch.commit();
                        console.log('Committed batch of comments:', count);
                        count = 0;
                    }
                }
            }
            if (count > 0) {
                await batch.commit();
                console.log('Committed final batch of comments:', count);
            }
        }
        console.log('Migration complete! We bussin now fr fr! 🔥');
        return { success: true, message: 'Migration complete! We bussin now fr fr! 🔥' };
    }
    catch (error) {
        console.error('Migration failed no cap:', error instanceof Error ? error.message : 'Unknown error');
        throw new Error(`Migration failed no cap: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
//# sourceMappingURL=migrate.js.map