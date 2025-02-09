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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserData = exports.updateStreamTitle = exports.updateStreamProfilePicture = exports.updateStreamEmail = exports.initializeUser = exports.getUserData = exports.getCloudflareVideos = exports.deleteAllVideos = exports.cleanupFirestore = void 0;
const admin = __importStar(require("firebase-admin"));
const cleanupFirestore_1 = require("./db/cleanupFirestore");
Object.defineProperty(exports, "cleanupFirestore", { enumerable: true, get: function () { return cleanupFirestore_1.cleanupFirestore; } });
const initializeUser_1 = require("./stream/initializeUser");
Object.defineProperty(exports, "initializeUser", { enumerable: true, get: function () { return initializeUser_1.initializeUser; } });
const update_1 = require("./stream/update");
Object.defineProperty(exports, "updateStreamEmail", { enumerable: true, get: function () { return update_1.updateStreamEmail; } });
Object.defineProperty(exports, "updateStreamProfilePicture", { enumerable: true, get: function () { return update_1.updateStreamProfilePicture; } });
Object.defineProperty(exports, "updateStreamTitle", { enumerable: true, get: function () { return update_1.updateStreamTitle; } });
const getUserData_1 = require("./users/getUserData");
Object.defineProperty(exports, "getUserData", { enumerable: true, get: function () { return getUserData_1.getUserData; } });
const updateUserData_1 = require("./users/updateUserData");
Object.defineProperty(exports, "updateUserData", { enumerable: true, get: function () { return updateUserData_1.updateUserData; } });
const deleteAllVideos_1 = require("./video/deleteAllVideos");
Object.defineProperty(exports, "deleteAllVideos", { enumerable: true, get: function () { return deleteAllVideos_1.deleteAllVideos; } });
const getCloudflareVideos_1 = require("./video/getCloudflareVideos");
Object.defineProperty(exports, "getCloudflareVideos", { enumerable: true, get: function () { return getCloudflareVideos_1.getCloudflareVideos; } });
// Initialize that Firebase admin SDK no cap
admin.initializeApp();
// Export them functions fr fr
__exportStar(require("./video"), exports);
//# sourceMappingURL=index.js.map