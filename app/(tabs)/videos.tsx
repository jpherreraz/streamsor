import { router } from 'expo-router';
import { httpsCallable } from 'firebase/functions';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { functions } from '../firebaseConfig';

interface Video {
  uid: string;
  title: string;
  thumbnail: string;
  playbackUrl: string;
  createdAt: string;
  uploader?: {
    photoURL?: string;
    email?: string;
  };
}

export default function VideosScreen() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        setError(null);
        const getCloudflareVideos = httpsCallable(functions, 'getCloudflareVideos');
        console.log('Calling getCloudflareVideos function...');
        const result = await getCloudflareVideos();
        console.log('Got videos:', result.data);
        setVideos(result.data as Video[]);
      } catch (error: any) {
        console.error('Error fetching videos:', error);
        setError(error?.message || 'Failed to load videos');
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  const handleVideoPress = (id: string) => {
    router.push(`/video/${id}`);
  };

  const renderVideo = ({ item }: { item: Video }) => (
    <TouchableOpacity 
      style={styles.videoCard}
      onPress={() => handleVideoPress(item.uid)}
    >
      <Image 
        source={{ uri: item.thumbnail }} 
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.videoInfo}>
        <View style={styles.infoContainer}>
          {item.uploader?.photoURL ? (
            <Image 
              source={{ uri: item.uploader.photoURL }} 
              style={styles.uploaderAvatar} 
            />
          ) : (
            <View style={[styles.uploaderAvatar, styles.uploaderAvatarPlaceholder]}>
              <Text style={styles.uploaderAvatarText}>
                {item.uploader?.email?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.textContent}>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.uploaderEmail} numberOfLines={1}>
              {item.uploader?.email || 'Unknown User'}
            </Text>
            <Text style={styles.date}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading videos...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (videos.length === 0) {
    return (
      <View style={styles.centered}>
        <Text>No videos found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Videos</Text>
      <FlatList
        data={videos}
        renderItem={renderVideo}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContainer}
        numColumns={1}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
  },
  listContainer: {
    padding: 8,
    gap: 8,
  },
  videoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    width: 320,
    marginBottom: 8,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16/9,
    backgroundColor: '#f0f0f0',
  },
  videoInfo: {
    padding: 8,
    backgroundColor: '#fff',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  textContent: {
    flex: 1,
    marginLeft: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1a1a1a',
  },
  uploaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  uploaderAvatarPlaceholder: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploaderAvatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  uploaderEmail: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  date: {
    fontSize: 11,
    color: '#666',
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
    marginHorizontal: 20,
    fontSize: 16,
  },
}); 