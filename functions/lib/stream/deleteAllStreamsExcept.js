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
exports.deleteAllStreamsExcept = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const config_1 = require("../config");
// Delete all streams except the current user's
exports.deleteAllStreamsExcept = functions.https.onCall(config_1.functionConfig, async (request) => {
    try {
        if (!request.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'no cap, you need to be authenticated fr fr');
        }
        const db = admin.firestore();
        let deletedCount = 0;
        // Get the user's stream
        const userStreams = await db.collection('users')
            .where('uploadedBy', '==', request.auth.uid)
            .limit(1)
            .get();
        if (userStreams.empty) {
            throw new functions.https.HttpsError('not-found', 'no stream found for this user fr fr');
        }
        const userStreamId = userStreams.docs[0].id;
        // Delete all other streams
        const allStreams = await db.collection('users').get();
        const batch = db.batch();
        allStreams.forEach(doc => {
            if (doc.id !== userStreamId) {
                batch.delete(doc.ref);
                deletedCount++;
            }
        });
        await batch.commit();
        console.log(`Successfully deleted ${deletedCount} streams, keeping user's stream`);
        return {
            success: true,
            message: `Successfully deleted ${deletedCount} streams, keeping user's stream`,
            deletedCount
        };
    }
    catch (error) {
        console.error('Error deleting streams:', error);
        throw new functions.https.HttpsError('internal', 'failed to delete streams fr fr');
    }
});
//# sourceMappingURL=deleteAllStreamsExcept.js.map