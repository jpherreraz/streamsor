import { onAuthStateChanged, signOut } from 'firebase/auth';
import { get, getDatabase, ref } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useEffect, useState } from 'react';
import { Alert, Clipboard, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';
import { auth } from '../firebase';
import Auth from './Auth';

interface StreamResponse {
  streamId: string;
  rtmps: {
    url: string;
    streamKey: string;
  };
  playback: {
    hls: string;
    dash: string;
  };
}

export default function Broadcaster() {
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'offline' | 'live'>('offline');
  const functions = getFunctions();

  // Check stream status periodically
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkStatus = async () => {
      try {
        // Get the user's stream ID from the database first
        const db = getDatabase();
        const userRef = ref(db, `users/${auth.currentUser?.uid}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val();
        
        if (!userData?.liveInputId) {
          console.log('No stream ID found for user');
          setStreamStatus('offline');
          return;
        }

        // Check current status with Cloudflare
        const checkStreamStatusFn = httpsCallable(functions, 'checkStreamStatus');
        const result = await checkStreamStatusFn({ 
          streamId: userData.liveInputId,
          liveInputId: userData.liveInputId 
        });
        const status = (result.data as any).status;
        
        console.log('Stream status check result:', {
          streamId: userData.liveInputId,
          status,
          streamData: userData
        });

        // Stream is live if Cloudflare reports it as live
        if (status === 'live') {
          console.log('Stream is live');
          setStreamStatus('live');
        } else {
          console.log('Stream is not live');
          setStreamStatus('offline');
        }
      } catch (error) {
        console.error('Error checking stream status:', error);
        setStreamStatus('offline');
      }
    };

    // Check immediately
    checkStatus();

    // Then check every 5 seconds
    const interval = setInterval(checkStatus, 5000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthenticated(!!user);
      if (user) {
        // Initialize user and get stream key
        try {
          const initUserFn = httpsCallable(functions, 'initializeUser');
          await initUserFn();
          
          const getStreamKeyFn = httpsCallable(functions, 'getStreamKey');
          const result = await getStreamKeyFn();
          setStreamKey((result.data as any).streamKey);
        } catch (error) {
          console.error('Error initializing user:', error);
        }
      } else {
        setStreamKey(null);
        setStreamStatus('offline');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleRegenerateKey = async () => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }

    try {
      const regenerateKeyFn = httpsCallable(functions, 'regenerateStreamKey');
      const result = await regenerateKeyFn();
      setStreamKey((result.data as any).streamKey);
      Alert.alert('Success', 'Stream key regenerated successfully');
    } catch (error: any) {
      console.error('Error regenerating stream key:', error);
      Alert.alert('Error', error.message || 'Failed to regenerate stream key');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowAuth(false);
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setString(text);
      Alert.alert('Success', 'Copied to clipboard');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  if (showAuth) {
    return <Auth onAuthSuccess={() => setShowAuth(false)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Stream Settings</Text>
        {isAuthenticated ? (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.loginButton} onPress={() => setShowAuth(true)}>
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        )}
      </View>

      {isAuthenticated ? (
        <View style={styles.content}>
          <View style={styles.streamKeyContainer}>
            <Text style={styles.label}>Your Stream Key:</Text>
            <View style={styles.streamKeyRow}>
              <Text style={styles.streamKey}>
                {streamKey ? '••••••••••••••••' : 'No stream key available'}
              </Text>
              {streamKey && (
                <>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => copyToClipboard(streamKey)}
                  >
                    <Text style={styles.buttonText}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.regenerateButton}
                    onPress={handleRegenerateKey}
                  >
                    <Text style={styles.buttonText}>Regenerate</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          <View style={styles.statusContainer}>
            <Text style={styles.label}>Stream Status:</Text>
            <Text style={[styles.status, styles[`status_${streamStatus}`]]}>
              {streamStatus.toUpperCase()}
            </Text>
          </View>

          <Text style={styles.instructions}>
            To start streaming:
            {'\n'}1. Open OBS Studio
            {'\n'}2. Go to Settings {'>'} Stream
            {'\n'}3. Select "Custom..." as Service
            {'\n'}4. Set Server to: rtmps://live.cloudflare.com:443/live
            {'\n'}5. Copy and paste your Stream Key
            {'\n'}6. Click "Start Streaming" in OBS when ready
            {'\n\n'}Note: Your stream key is persistent and will remain the same until you regenerate it.
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.loginPrompt}>Please login to view your stream settings</Text>
        </View>
      )}

      <Portal>
        <Dialog
          visible={showAuthPrompt}
          onDismiss={() => setShowAuthPrompt(false)}
          style={styles.dialog}
        >
          <Dialog.Title>Authentication Required</Dialog.Title>
          <Dialog.Content>
            <Text>Please login to access stream settings</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => {
              setShowAuthPrompt(false);
              setShowAuth(true);
            }}>
              Login
            </Button>
            <Button onPress={() => setShowAuthPrompt(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  streamKeyContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  streamKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streamKey: {
    flex: 1,
    fontSize: 16,
    fontFamily: Platform.select({
      web: 'monospace',
      default: 'Courier',
    }),
  },
  copyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  regenerateButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  instructions: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  loginPrompt: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      },
    }),
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  status: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 8,
    borderRadius: 4,
  },
  status_offline: {
    backgroundColor: '#f0f0f0',
    color: '#666',
  },
  status_live: {
    backgroundColor: '#4CAF50',
    color: '#fff',
  },
}); 