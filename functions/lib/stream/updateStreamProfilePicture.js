"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateStreamProfilePicture = void 0;
const database_1 = require("firebase-admin/database");
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("../config");
// Update stream profile picture
exports.updateStreamProfilePicture = (0, https_1.onCall)(config_1.functionConfig, async (request) => {
    const auth = request.auth;
    if (!auth?.uid) {
        throw new Error('Authentication required');
    }
    const { photoURL } = request.data;
    if (!photoURL || typeof photoURL !== 'string') {
        throw new Error('Valid photo URL is required');
    }
    const db = (0, database_1.getDatabase)();
    const userRef = db.ref(`users/${auth.uid}`);
    // Get user's live input ID
    const userSnapshot = await userRef.get();
    if (!userSnapshot.exists() || !userSnapshot.val().liveInputId) {
        throw new Error('Stream setup not found');
    }
    const liveInputId = userSnapshot.val().liveInputId;
    try {
        // Get existing stream data first
        const streamRef = db.ref(`streams/${liveInputId}`);
        const streamSnapshot = await streamRef.get();
        const existingStreamData = streamSnapshot.exists() ? streamSnapshot.val() : {};
        // Update profile picture in Cloudflare
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config_1.cloudflareAccountId.value()}/stream/live_inputs/${liveInputId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${config_1.cloudflareApiToken.value()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                meta: {
                    ...existingStreamData.meta,
                    uploaderPhotoURL: photoURL,
                    uploadedBy: auth.uid
                }
            })
        });
        const data = await response.json();
        if (!data.success) {
            console.error('Cloudflare update failed:', data.errors);
            throw new Error('Failed to update stream info');
        }
        // Update profile picture in both stream and user data
        const updates = {};
        // Preserve existing stream data while updating profile picture
        updates[`streams/${liveInputId}`] = {
            ...existingStreamData,
            photoURL,
            updatedAt: Date.now()
        };
        // Update user data
        updates[`users/${auth.uid}`] = {
            ...userSnapshot.val(),
            photoURL,
            updatedAt: Date.now()
        };
        // Apply all updates atomically
        await db.ref().update(updates);
        return { success: true };
    }
    catch (error) {
        console.error('Error updating stream info:', error);
        throw new Error('Failed to update stream info');
    }
});
//# sourceMappingURL=updateStreamProfilePicture.js.map