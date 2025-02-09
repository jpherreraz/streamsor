"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStreamKey = void 0;
const database_1 = require("firebase-admin/database");
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("../config");
// Get user's stream key
exports.getStreamKey = (0, https_1.onCall)(config_1.functionConfig, async (request) => {
    try {
        const auth = request.auth;
        if (!auth?.uid) {
            throw new Error('Authentication required');
        }
        const db = (0, database_1.getDatabase)();
        const userRef = db.ref(`users/${auth.uid}`);
        const snapshot = await userRef.get();
        if (!snapshot.exists()) {
            throw new Error('User not initialized');
        }
        const userData = snapshot.val();
        return { streamKey: userData.streamKey };
    }
    catch (error) {
        console.error('Error getting stream key:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to get stream key');
    }
});
//# sourceMappingURL=getStreamKey.js.map