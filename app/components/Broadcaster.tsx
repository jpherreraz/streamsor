import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { getDatabase, onValue, ref } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useEffect, useState } from 'react';
import { Alert, Clipboard, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button, Dialog, Portal, SegmentedButtons, TextInput } from 'react-native-paper';
import { auth } from '../firebase';

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

const STREAM_CATEGORIES = [
  { label: 'Gaming', value: 'gaming' },
  { label: 'Just Chatting', value: 'just-chatting' },
  { label: 'Art', value: 'art' },
  { label: 'Software & Game Dev', value: 'software-dev' }
];

export default function Broadcaster() {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('gaming');
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('gaming');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [streamKey, setStreamKey] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const functions = getFunctions();
  const database = getDatabase();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

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

          // Load initial title and category from database
          const userRef = ref(database, `users/${user.uid}`);
          onValue(userRef, (snapshot) => {
            const userData = snapshot.val();
            if (userData) {
              setTitle(userData.title || '');
              setCategory(userData.category || 'gaming');
              setEditTitle(userData.title || '');
              setEditCategory(userData.category || 'gaming');
            }
          });
        } catch (error) {
          console.error('Error initializing user:', error);
        }
      } else {
        setStreamKey(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleEditPress = () => {
    setEditTitle(title);
    setEditCategory(category);
    setTitleError(null);
    setShowEditDialog(true);
  };

  const handleUpdateStreamInfo = async () => {
    if (!isAuthenticated) {
      setShowAuthPrompt(true);
      return;
    }

    if (!editTitle.trim()) {
      setTitleError('Title cannot be empty');
      return;
    }

    try {
      const updateTitleFn = httpsCallable(functions, 'updateStreamTitle');
      await updateTitleFn({ title: editTitle.trim(), category: editCategory });
      setTitle(editTitle.trim());
      setCategory(editCategory);
      setShowEditDialog(false);
      Alert.alert('Success', 'Stream info updated successfully');
      setTitleError(null);
    } catch (error: any) {
      console.error('Error updating stream info:', error);
      Alert.alert('Error', error.message || 'Failed to update stream info');
    }
  };

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

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setString(text);
      Alert.alert('Success', 'Copied to clipboard');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  const getCategoryLabel = (value: string) => {
    return STREAM_CATEGORIES.find(cat => cat.value === value)?.label || value;
  };

  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const handleCategorySelect = (value: string) => {
    setEditCategory(value);
    closeMenu();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Stream Settings</Text>
      </View>

      {isAuthenticated ? (
        <View style={styles.content}>
          <View style={styles.streamInfoContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Stream Info</Text>
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEditPress}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Title</Text>
              <Text style={styles.infoText}>{title || 'No title set'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.label}>Category</Text>
              <Text style={styles.infoText}>{getCategoryLabel(category)}</Text>
            </View>
          </View>

          <View style={styles.streamKeyContainer}>
            <Text style={styles.sectionTitle}>Stream Key</Text>
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
          style={[styles.dialog, { backgroundColor: '#fff' }]}
        >
          <Dialog.Title style={styles.dialogTitle}>Authentication Required</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>Please login to access stream settings</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button 
              textColor="#007AFF"
              onPress={() => {
                setShowAuthPrompt(false);
                router.push('/auth');
              }}
            >
              Login
            </Button>
            <Button 
              textColor="#FF3B30"
              onPress={() => setShowAuthPrompt(false)}
            >
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showEditDialog}
          onDismiss={() => setShowEditDialog(false)}
          style={[styles.dialog, { backgroundColor: '#fff' }]}
        >
          <Dialog.Title style={styles.dialogTitle}>Edit Stream Info</Dialog.Title>
          <Dialog.Content>
            <View style={styles.dialogContent}>
              <View style={styles.inputContainer}>
                <Text style={styles.dialogLabel}>Title</Text>
                <TextInput
                  style={[styles.titleInput, { backgroundColor: '#f5f5f5' }]}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Enter your stream title"
                  error={!!titleError}
                  mode="outlined"
                  outlineColor="#ccc"
                  activeOutlineColor="#007AFF"
                  textColor="#000"
                  placeholderTextColor="#666"
                />
                {titleError && (
                  <Text style={styles.errorText}>{titleError}</Text>
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.dialogLabel}>Category</Text>
                <SegmentedButtons
                  value={editCategory}
                  onValueChange={setEditCategory}
                  buttons={STREAM_CATEGORIES}
                  style={styles.categoryButtons}
                  theme={{
                    colors: {
                      primary: '#007AFF',
                      secondaryContainer: '#007AFF',
                      onSecondaryContainer: '#FFFFFF',
                      onSurface: '#000000',
                    }
                  }}
                  density="medium"
                />
              </View>
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button 
              textColor="#FF3B30"
              onPress={() => setShowEditDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              textColor="#007AFF"
              onPress={handleUpdateStreamInfo}
            >
              Save
            </Button>
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
  streamInfoContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#1a1a1a',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoRow: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginTop: 4,
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
      default: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
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
      default: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  loginPrompt: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  dialog: {
    borderRadius: 12,
    elevation: 24,
    maxWidth: 560,
    width: '90%',
    alignSelf: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: {
          width: 0,
          height: 8,
        },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      },
    }),
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  dialogText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  dialogLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  dialogContent: {
    paddingTop: 16,
    paddingHorizontal: 4,
  },
  inputContainer: {
    marginBottom: 20,
  },
  titleInput: {
    fontSize: 16,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 5,
  },
  categoryButtons: {
    marginTop: 8,
  },
}); 