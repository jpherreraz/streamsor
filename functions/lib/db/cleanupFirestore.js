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
exports.cleanupFirestore = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
exports.cleanupFirestore = functions.https.onCall(async (request) => {
    try {
        const db = admin.firestore();
        // Get all collections
        const collections = await db.listCollections();
        // Delete all collections except 'users'
        for (const collection of collections) {
            if (collection.id !== 'users') {
                const snapshot = await collection.get();
                // Delete in batches of 500
                const batches = [];
                let batch = db.batch();
                let count = 0;
                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                    count++;
                    if (count === 500) {
                        batches.push(batch.commit());
                        batch = db.batch();
                        count = 0;
                    }
                });
                if (count > 0) {
                    batches.push(batch.commit());
                }
                await Promise.all(batches);
                console.log(`Deleted collection ${collection.id} fr fr`);
            }
        }
        // Clean up users collection to only have liveInputId docs
        const usersSnapshot = await db.collection('users').get();
        // Delete in batches of 500
        const batches = [];
        let batch = db.batch();
        let count = 0;
        usersSnapshot.docs.forEach((doc) => {
            // If the doc ID is not a liveInputId (it's probably a uid), delete it
            if (!doc.id.match(/^[a-f0-9]{32}$/)) {
                batch.delete(doc.ref);
                count++;
                if (count === 500) {
                    batches.push(batch.commit());
                    batch = db.batch();
                    count = 0;
                }
                console.log(`Marked invalid user doc ${doc.id} for deletion no cap`);
            }
        });
        if (count > 0) {
            batches.push(batch.commit());
        }
        await Promise.all(batches);
        console.log('All invalid docs deleted fr fr');
        return { message: 'Firestore cleanup bussin fr fr 🧹' };
    }
    catch (error) {
        console.error('Error cleaning up Firestore:', error);
        throw new functions.https.HttpsError('internal', 'cleanup failed fr fr');
    }
});
//# sourceMappingURL=cleanupFirestore.js.map