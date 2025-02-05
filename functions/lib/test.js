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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
const auth_1 = require("firebase-admin/auth");
const module_1 = require("module");
const node_fetch_1 = __importDefault(require("node-fetch"));
const path = __importStar(require("path"));
const customRequire = (0, module_1.createRequire)(__dirname);
const serviceAccount = customRequire(path.join(__dirname, '../../serviceAccount.json'));
// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://streamsor-6fb0e-default-rtdb.firebaseio.com'
});
const FUNCTION_BASE_URL = 'https://us-central1-streamsor-6fb0e.cloudfunctions.net';
// Helper function to generate a stream key
function generateStreamKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let streamKey = '';
    for (let i = 0; i < 32; i++) {
        streamKey += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return streamKey;
}
async function testCloudFunctions() {
    try {
        // Create a test user
        const userEmail = `test${Date.now()}@example.com`;
        const userPassword = 'testPassword123!';
        const user = await (0, auth_1.getAuth)().createUser({
            email: userEmail,
            password: userPassword,
        });
        console.log('Created test user:', user.uid);
        // Get custom token for authentication
        const customToken = await (0, auth_1.getAuth)().createCustomToken(user.uid);
        console.log('Created custom token');
        // Exchange custom token for ID token
        const tokenResponse = await (0, node_fetch_1.default)(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyBNTNWagCvsTMk1sNm8Gx_C_GcTZJ3lZCs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: customToken,
                returnSecureToken: true
            })
        });
        const tokenData = await tokenResponse.json();
        if (!tokenData.idToken) {
            throw new Error('Failed to get ID token: ' + JSON.stringify(tokenData));
        }
        const idToken = tokenData.idToken;
        console.log('Exchanged custom token for ID token');
        // Test initializeUser function
        const streamKey = generateStreamKey();
        const initResponse = await (0, node_fetch_1.default)(`${FUNCTION_BASE_URL}/initializeUser`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                data: {
                    streamKey,
                    createdAt: Date.now()
                }
            })
        });
        const responseText = await initResponse.text();
        console.log('Raw response:', responseText);
        console.log('Response status:', initResponse.status);
        console.log('Response headers:', Object.fromEntries(initResponse.headers.entries()));
        try {
            const initData = JSON.parse(responseText);
            console.log('Initialize user response:', initData);
        }
        catch (error) {
            console.error('Failed to parse response:', error);
            throw error;
        }
        // Test startStream function
        const startResponse = await (0, node_fetch_1.default)(`${FUNCTION_BASE_URL}/startStream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                data: {
                    title: 'Test Stream',
                    streamKey
                }
            })
        });
        const startData = await startResponse.json();
        console.log('Start stream response:', startData);
        // Test stopStream function
        const streamId = startData.result.streamId;
        const stopResponse = await (0, node_fetch_1.default)(`${FUNCTION_BASE_URL}/stopStream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                data: {
                    streamId
                }
            })
        });
        const stopData = await stopResponse.json();
        console.log('Stop stream response:', stopData);
        // Clean up - delete test user
        await (0, auth_1.getAuth)().deleteUser(user.uid);
        console.log('Deleted test user');
    }
    catch (error) {
        console.error('Test failed:', error);
    }
}
testCloudFunctions().then(() => {
    console.log('Tests completed');
    process.exit(0);
}).catch((error) => {
    console.error('Tests failed:', error);
    process.exit(1);
});
//# sourceMappingURL=test.js.map