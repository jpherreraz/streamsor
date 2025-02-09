"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.regenerateStreamKey = void 0;
const database_1 = require("firebase-admin/database");
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("../config");
// Function to generate a random stream key
function generateStreamKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `live_${key}`;
}
// Regenerate stream key
exports.regenerateStreamKey = (0, https_1.onCall)(config_1.functionConfig, async (request) => {
    try {
        const auth = request.auth;
        if (!auth?.uid) {
            throw new Error('Authentication required');
        }
        const db = (0, database_1.getDatabase)();
        const userRef = db.ref(`users/${auth.uid}`);
        // Get current user data
        const snapshot = await userRef.get();
        if (!snapshot.exists()) {
            throw new Error('User not initialized');
        }
        const userData = snapshot.val();
        if (!userData.liveInputId) {
            throw new Error('No live input found');
        }
        // Generate new stream key
        const streamKey = generateStreamKey();
        // Update the live input with new stream key
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config_1.cloudflareAccountId.value()}/stream/live_inputs/${userData.liveInputId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${config_1.cloudflareApiToken.value()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                streamKey: streamKey
            })
        });
        const data = await response.json();
        if (!data.success) {
            throw new Error('Failed to update stream key');
        }
        // Update the stream key in database
        await userRef.update({
            streamKey,
            updatedAt: Date.now()
        });
        return { streamKey };
    }
    catch (error) {
        console.error('Error regenerating stream key:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to regenerate stream key');
    }
});
//# sourceMappingURL=regenerateStreamKey.js.map