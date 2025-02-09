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
const admin = __importStar(require("firebase-admin"));
const app_1 = require("firebase-admin/app");
// Initialize Firebase Admin
(0, app_1.initializeApp)();
async function cleanup() {
    try {
        const db = admin.firestore();
        // Get all collections
        const collections = await db.listCollections();
        // Delete all collections except 'users'
        for (const collection of collections) {
            if (collection.id !== 'users') {
                const snapshot = await collection.get();
                const batch = db.batch();
                snapshot.docs.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                console.log(`Deleted collection ${collection.id} fr fr`);
            }
        }
        // Clean up users collection to only have liveInputId docs
        const usersSnapshot = await db.collection('users').get();
        const batch = db.batch();
        usersSnapshot.docs.forEach((doc) => {
            // If the doc ID is not a liveInputId (it's probably a uid), delete it
            if (!doc.id.match(/^[a-f0-9]{32}$/)) {
                batch.delete(doc.ref);
                console.log(`Deleted invalid user doc ${doc.id} no cap`);
            }
        });
        await batch.commit();
        console.log('Firestore cleanup bussin fr fr 🧹');
        process.exit(0);
    }
    catch (error) {
        console.error('Error cleaning up Firestore:', error);
        process.exit(1);
    }
}
cleanup();
//# sourceMappingURL=cleanup.js.map