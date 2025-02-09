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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendChatMessage = void 0;
const database_1 = require("firebase-admin/database");
const https_1 = require("firebase-functions/v2/https");
const functionConfig = {
    cors: true,
    maxInstances: 10,
    region: 'us-central1'
};
// Send chat message function
exports.sendChatMessage = (0, https_1.onCall)(functionConfig, async (request) => {
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
__exportStar(require("./sendChatMessage"), exports);
//# sourceMappingURL=index.js.map