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
exports.cleanupStaleStreams = void 0;
const admin = __importStar(require("firebase-admin"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const checkCloudflareWithRetry_1 = require("./checkCloudflareWithRetry");
// Cleanup stale streams every hour
exports.cleanupStaleStreams = (0, scheduler_1.onSchedule)('every 1 hours', async (event) => {
    try {
        const db = admin.firestore();
        const usersSnapshot = await db.collection('users').get();
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            if (!userData.liveInputId)
                continue;
            try {
                // Check if the stream is still valid in Cloudflare
                const result = await (0, checkCloudflareWithRetry_1.checkCloudflareWithRetry)(userData.liveInputId);
                if (!result) {
                    console.log(`Stream ${userData.liveInputId} not found in Cloudflare, cleaning up...`);
                    await userDoc.ref.update({
                        liveInputId: admin.firestore.FieldValue.delete(),
                        updatedAt: admin.firestore.Timestamp.now()
                    });
                }
            }
            catch (error) {
                console.error(`Error checking stream ${userData.liveInputId}:`, error);
            }
        }
        console.log('Stream cleanup completed fr fr 🧹');
    }
    catch (error) {
        console.error('Error in cleanupStaleStreams:', error);
        throw error;
    }
});
//# sourceMappingURL=cleanupStaleStreams.js.map