"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStreamKey = void 0;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const config_1 = require("../config");
exports.getStreamKey = (0, https_1.onCall)(config_1.functionConfig, async (request) => {
    if (!request.auth) {
        throw new Error('Not authenticated fr fr');
    }
    const db = (0, firestore_1.getFirestore)();
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists) {
        throw new Error('User not found fr fr');
    }
    const userData = userDoc.data();
    if (!userData?.streamKey) {
        throw new Error('No stream key found fr fr');
    }
    return { streamKey: userData.streamKey };
});
//# sourceMappingURL=streamKey.js.map