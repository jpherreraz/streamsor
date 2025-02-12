import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { auth } from '../firebase';

export default function BioEditor() {
  const [bio, setBio] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const firestore = getFirestore();
  const functions = getFunctions();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        // Subscribe to user document
        const userDocRef = doc(firestore, 'users', user.uid);
        const unsubscribeDoc = onSnapshot(userDocRef, (snapshot) => {
          const userData = snapshot.data();
          if (userData) {
            setBio(userData.bio || '');
            setEditedBio(userData.bio || '');
          }
        });

        return () => unsubscribeDoc();
      } else {
        setUserId(null);
        setBio('');
        setEditedBio('');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!userId) {
      Alert.alert('Error', 'You need to be logged in to update your bio bestie! 🔐');
      return;
    }

    setIsLoading(true);
    try {
      const updateBioFn = httpsCallable(functions, 'updateBio');
      await updateBioFn({ bio: editedBio });
      setIsEditing(false);
      Alert.alert('Success', 'Bio updated successfully bestie! ✨');
    } catch (error: any) {
      console.error('Error updating bio:', error);
      Alert.alert('Error', error.message || 'Failed to update bio bestie! Try again? 😭');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedBio(bio);
    setIsEditing(false);
  };

  if (!userId) {
    return (
      <View style={styles.container}>
        <Text style={styles.loginPrompt}>
          Please login to edit your bio bestie! 💅
        </Text>
        <Button 
          mode="contained" 
          onPress={() => router.push('/auth')}
          style={styles.loginButton}
        >
          Login
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isEditing ? (
        <>
          <TextInput
            value={editedBio}
            onChangeText={setEditedBio}
            multiline
            numberOfLines={Platform.OS === 'web' ? 8 : 4}
            mode="outlined"
            placeholder="Tell us about yourself bestie! ✨"
            style={styles.input}
            maxLength={500}
          />
          <Text style={styles.charCount}>
            {editedBio.length}/500 characters
          </Text>
          <View style={styles.buttonContainer}>
            <Button 
              mode="outlined" 
              onPress={handleCancel}
              style={styles.button}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              mode="contained" 
              onPress={handleSave}
              style={styles.button}
              loading={isLoading}
              disabled={isLoading}
            >
              Save
            </Button>
          </View>
        </>
      ) : (
        <>
          <View style={styles.bioContainer}>
            <Text style={styles.bioText}>
              {bio || 'No bio yet bestie! Time to show off your personality! ✨'}
            </Text>
          </View>
          <Button 
            mode="contained" 
            onPress={() => setIsEditing(true)}
            style={styles.editButton}
          >
            Edit Bio
          </Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flex: 1,
    backgroundColor: '#fff',
  },
  bioContainer: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    marginBottom: 16,
    minHeight: Platform.OS === 'web' ? 200 : 100,
  },
  bioText: {
    fontSize: 16,
    color: '#1a1a1a',
    lineHeight: 24,
  },
  input: {
    backgroundColor: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  button: {
    minWidth: 100,
  },
  editButton: {
    alignSelf: 'flex-start',
  },
  loginPrompt: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  loginButton: {
    alignSelf: 'center',
  },
}); 