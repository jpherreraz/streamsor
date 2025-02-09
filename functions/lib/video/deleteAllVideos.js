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
exports.deleteAllVideos = void 0;
const functions = __importStar(require("firebase-functions"));
const checkCloudflareWithRetry_1 = require("../stream/checkCloudflareWithRetry");
// fr fr this function boutta delete all videos no cap
exports.deleteAllVideos = functions.https.onRequest(async (request, response) => {
    try {
        console.log('finna get all them videos first');
        const listResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${checkCloudflareWithRetry_1.cloudflareAccountId.value()}/stream`, {
            headers: {
                'Authorization': `Bearer ${checkCloudflareWithRetry_1.cloudflareApiToken.value()}`,
                'Content-Type': 'application/json',
            },
        });
        if (!listResponse.ok) {
            console.error('Cloudflare API acting sus:', listResponse.status);
            throw new Error('Cloudflare API not bussin rn');
        }
        const data = await listResponse.json();
        if (!data.success || !Array.isArray(data.result)) {
            console.error('Cloudflare response ain\'t it chief:', data);
            throw new Error('Cloudflare data format acting sus fr fr');
        }
        console.log(`found ${data.result.length} videos to delete`);
        // delete each video one by one no cap
        const deletePromises = data.result.map(async (video) => {
            console.log(`finna delete video ${video.uid}`);
            const deleteResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${checkCloudflareWithRetry_1.cloudflareAccountId.value()}/stream/${video.uid}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${checkCloudflareWithRetry_1.cloudflareApiToken.value()}`,
                },
            });
            if (!deleteResponse.ok) {
                console.error(`failed to delete video ${video.uid}:`, deleteResponse.status);
                return false;
            }
            return true;
        });
        const results = await Promise.all(deletePromises);
        const successCount = results.filter(Boolean).length;
        response.json({
            success: true,
            message: `deleted ${successCount} out of ${data.result.length} videos fr fr`
        });
    }
    catch (error) {
        console.error('deletion failed no cap:', error);
        response.status(500).json({
            success: false,
            error: 'failed to delete videos, check logs for more info'
        });
    }
});
//# sourceMappingURL=deleteAllVideos.js.map