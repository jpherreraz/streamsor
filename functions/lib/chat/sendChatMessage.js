"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendChatMessage = void 0;
const database_1 = require("firebase-admin/database");
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("../config");
// Send chat message function
exports.sendChatMessage = (0, https_1.onCall)(config_1.functionConfig, async (request) => {
    const auth = request.auth;
    if (!auth) {
        throw new Error('Authentication required');
    }
    const { streamId, text, username } = request.data;
    if (!streamId || !text || !username) {
        throw new Error('Missing required fields');
    }
    const db = (0, database_1.getDatabase)();
    const chatRef = db.ref(`chats/${streamId}/messages`).push();
    const message = {
        text: text.trim(),
        username,
        userId: auth.uid,
        timestamp: Date.now()
    };
    await chatRef.set(message);
    return { success: true };
});
//# sourceMappingURL=sendChatMessage.js.map