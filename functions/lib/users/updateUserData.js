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
exports.updateUserData = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions"));
const config_1 = require("../config");
exports.updateUserData = functions.https.onCall(config_1.functionConfig, async (request) => {
    if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'no cap, you need to be authenticated fr fr');
    }
    const data = request.data;
    if (!data.liveInputId) {
        throw new functions.https.HttpsError('invalid-argument', 'bruh where\'s the liveInputId at? 💀');
    }
    try {
        const db = admin.firestore();
        const userRef = db.collection('users').doc(data.liveInputId);
        const userDoc = await userRef.get();
        const now = admin.firestore.Timestamp.now();
        if (!userDoc.exists) {
            // New user just dropped
            await userRef.set({
                ...data,
                createdAt: now,
                updatedAt: now,
            });
            return { message: 'new user data just dropped fr fr 🔥' };
        }
        else {
            // Update that user data on god
            await userRef.update({
                ...data,
                updatedAt: now,
            });
            return { message: 'user data update bussin fr fr ✨' };
        }
    }
    catch (error) {
        console.error('nah fam, something ain\'t right:', error);
        throw new functions.https.HttpsError('internal', 'server acting sus rn');
    }
});
//# sourceMappingURL=updateUserData.js.map