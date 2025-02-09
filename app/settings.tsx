import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { getAuth, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Default banner as base64 to avoid CORS issues
const DEFAULT_BANNER = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABQODxIPDRQSEBIXFRQdHx4eHRoaHSQtJSEkLzYyLy8yMi8vLzI3Pj05Nz5FREVFRUdHR0dHR0dHR0dHR0dHR0f/2wBDARUXFyMeIx0tLUc3LzdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0f/wAARCAAKABQDASIAAhEBAxEB/8QAFwAAAwEAAAAAAAAAAAAAAAAAAAQFBv/EACUQAAIBAwQBBAMAAAAAAAAAAAECAwAEEQUSITFBBhNhcSKBkf/EABYBAQEBAAAAAAAAAAAAAAAAAAABA//EABoRAAMBAAMAAAAAAAAAAAAAAAABERIhUWH/2gAMAwEAAhEDEQA/ANJNcXGt3RhsWK26NtaQjBc+B8fnWrjjSGJIo1CogCqB0AKSz0+1sEK20QXPbHkn5NPRQBz6h0qG8t4h/Nxj7FZuws9jF7e4jnTwXQN/a01FDSMbf//Z';

export default function SettingsScreen() {
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(getAuth().currentUser);
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);

      if (user?.uid) {
        if (user.photoURL) {
          setProfileUrl(user.photoURL);
        }
        
        // Try to get banner URL if it exists
        const storage = getStorage();
        const bannerRef = storageRef(storage, `profile_banners/${user.uid}`);
        getDownloadURL(bannerRef).then(url => {
          setBannerUrl(url);
        }).catch((error) => {
          // Only set default banner if the error is 404 (not found)
          if (error.code === 'storage/object-not-found') {
            setBannerUrl(DEFAULT_BANNER);
          } else {
            console.error('Error fetching banner:', error);
          }
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const pickImage = async (type: 'profile' | 'banner') => {
    try {
      // Request permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant access to your photo library to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'profile' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        const uri = result.assets[0].uri;
        await uploadImage(uri, type);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const uploadImage = async (uri: string, type: 'profile' | 'banner') => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to upload images');
      return;
    }

    try {
      setUploading(true);

      // For web platform, we need to handle CORS
      let blob;
      if (Platform.OS === 'web') {
        // Create a new blob with proper content type
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();
        blob = new Blob([arrayBuffer], { type: 'image/jpeg' });
      } else {
        // For native platforms, we can use the URI directly
        const response = await fetch(uri);
        blob = await response.blob();
      }

      // Upload to Firebase Storage with metadata
      const storage = getStorage();
      const path = type === 'profile' ? 'profile_pictures' : 'profile_banners';
      const fileRef = storageRef(storage, `${path}/${user.uid}`);
      const metadata = {
        contentType: 'image/jpeg',
        cacheControl: 'public,max-age=7200',
        customMetadata: {
          'uploaded_by': user.uid,
          'uploaded_at': new Date().toISOString(),
          'type': type
        }
      };

      // Upload with retry logic
      let attempts = 0;
      const maxAttempts = 3;
      let lastError: any;

      while (attempts < maxAttempts) {
        try {
          await uploadBytes(fileRef, blob, metadata);
          
          // Get download URL with token
          const downloadUrl = await getDownloadURL(fileRef);

          // Update state and profile if needed
          if (type === 'profile') {
            await updateProfile(user, {
              photoURL: downloadUrl,
            });
            setProfileUrl(downloadUrl);
          } else {
            setBannerUrl(downloadUrl);
          }

          Alert.alert('Success', `${type === 'profile' ? 'Profile picture' : 'Profile banner'} updated successfully!`);
          return;
        } catch (error: any) {
          console.error(`Upload attempt ${attempts + 1} failed:`, error);
          lastError = error;
          attempts++;
          if (attempts < maxAttempts) {
            // Wait before retrying (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
          }
        }
      }

      // If we get here, all attempts failed
      throw lastError;
    } catch (error: any) {
      console.error('Error uploading image:', error);
      if (error?.code === 'storage/unauthorized') {
        Alert.alert('Error', 'You are not authorized to upload images. Please sign in again.');
        // Only sign out if it's a permanent auth error
        if (error?.message?.includes('not authenticated') || error?.message?.includes('invalid token')) {
          await auth.signOut();
          router.push('/auth');
        }
      } else if (error?.code === 'storage/canceled') {
        Alert.alert('Error', 'Upload was canceled. Please try again.');
      } else if (error?.code === 'storage/quota-exceeded') {
        Alert.alert('Error', 'Storage quota exceeded. Please contact support.');
      } else {
        Alert.alert('Error', 'Failed to upload image. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  const deleteProfilePicture = async () => {
    if (!auth.currentUser) {
      router.push('/auth');
      return;
    }

    try {
      setUploading(true);
      await updateProfile(auth.currentUser, {
        photoURL: null,
      });
      setProfileUrl(null);
      Alert.alert('Success', 'Profile picture removed successfully!');
    } catch (error) {
      console.error('Error removing profile picture:', error);
      Alert.alert('Error', 'Failed to remove profile picture. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const deleteBanner = async () => {
    if (!auth.currentUser) {
      router.push('/auth');
      return;
    }

    try {
      setUploading(true);
      setBannerUrl(DEFAULT_BANNER);
      Alert.alert('Success', 'Profile banner removed successfully!');
    } catch (error) {
      console.error('Error removing banner:', error);
      Alert.alert('Error', 'Failed to remove banner. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.loginPrompt}>Please login to access settings</Text>
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={() => router.push({
              pathname: '/auth',
              params: { redirect: '/settings' }
            })}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Settings</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Profile Picture</Text>
          <View style={styles.profileSection}>
            <View style={styles.profileRow}>
              <View style={styles.profilePictureContainer}>
                {profileUrl ? (
                  <Image 
                    source={{ uri: profileUrl }} 
                    style={styles.profilePicture}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.placeholderContainer}>
                    <MaterialIcons name="person" size={40} color="#666" />
                  </View>
                )}
              </View>
              <View style={styles.profileButtons}>
                <TouchableOpacity 
                  style={[styles.updateButton, uploading && styles.buttonDisabled]}
                  onPress={() => pickImage('profile')}
                  disabled={uploading}
                >
                  <MaterialIcons name="edit" size={16} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>
                    Update Profile Picture
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.deleteButton, (uploading || !profileUrl) && styles.buttonDisabled]}
                  onPress={deleteProfilePicture}
                  disabled={uploading || !profileUrl}
                >
                  <MaterialIcons name="delete" size={16} color="#FF3B30" style={styles.buttonIcon} />
                  <Text style={styles.deleteButtonText}>
                    Remove
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.uploadText}>
              {uploading ? 'Processing...' : 'Recommended size: 500x500 pixels'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Profile Banner</Text>
          <View style={styles.bannerSection}>
            <View style={styles.bannerRow}>
              <View style={styles.bannerContainer}>
                <Image 
                  source={{ uri: bannerUrl || DEFAULT_BANNER }} 
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.bannerButtons}>
                <TouchableOpacity 
                  style={[styles.updateButton, uploading && styles.buttonDisabled]}
                  onPress={() => pickImage('banner')}
                  disabled={uploading}
                >
                  <MaterialIcons name="edit" size={16} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>
                    Update Profile Banner
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.deleteButton, (uploading || !bannerUrl || bannerUrl === DEFAULT_BANNER) && styles.buttonDisabled]}
                  onPress={deleteBanner}
                  disabled={uploading || !bannerUrl || bannerUrl === DEFAULT_BANNER}
                >
                  <MaterialIcons name="delete" size={16} color="#FF3B30" style={styles.buttonIcon} />
                  <Text style={styles.deleteButtonText}>
                    Remove
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.uploadText}>
              {uploading ? 'Processing...' : 'Recommended size: 1920x1080 pixels'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'left',
  },
  profileSection: {
    alignItems: 'flex-start',
  },
  bannerSection: {
    width: '100%',
    gap: 8,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  bannerContainer: {
    flex: 1,
    height: 160,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
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
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerButtons: {
    gap: 8,
    width: 200,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  profileButtons: {
    gap: 8,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    gap: 8,
  },
  buttonIcon: {
    width: 16,
    height: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  profilePictureContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
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
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholderContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'left',
  },
  loginPrompt: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
}); 