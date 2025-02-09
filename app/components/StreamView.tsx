import { router } from 'expo-router';
import { httpsCallable } from 'firebase/functions';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { functions } from '../firebaseConfig';

interface Video {
  uid: string;
  title: string;
  thumbnail: string;
  playbackUrl: string;
  createdAt: string;
  duration?: number;
  views?: number;
  uploader: {
    id: string;
    email: string;
    photoURL: string | null;
  };
}

export default function VideosScreen() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const { user } = useAuth();

  // Calculate number of columns based on screen width
  // Each card should be at least 300px wide
  const numColumns = Math.max(1, Math.floor(width / 300));
  const cardWidth = (width - (16 + (8 * (numColumns - 1)))) / numColumns; // Account for padding and gaps

  useEffect(() => {
    console.log('[DEBUG] Auth state:', {
      isAuthenticated: !!user,
      userId: user?.uid,
      userEmail: user?.email
    });

    const fetchVideos = async () => {
      try {
        setError(null);
        console.log('[DEBUG] Fetching videos...');
        const getCloudflareVideos = httpsCallable<void, Video[]>(functions, 'getActiveStreams');
        const result = await getCloudflareVideos();
        console.log('[DEBUG] Videos response:', {
          count: result.data.length,
          firstVideo: result.data[0],
        });
        setVideos(result.data);
      } catch (error: any) {
        console.error('[DEBUG] Error fetching videos:', error);
        setError(error?.message || 'Failed to load videos');
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [user]);

  const handleVideoPress = (id: string) => {
    router.push(`/stream/${id}`);
  };

  const renderVideo = ({ item }: { item: Video }) => {
    console.log('[DEBUG] Rendering video card:', {
      id: item.uid,
      title: item.title,
      uploader: item.uploader
    });

    return (
      <TouchableOpacity 
        style={[styles.videoCard, { width: cardWidth }]}
        onPress={() => handleVideoPress(item.uid)}
      >
        <Image 
          source={{ uri: item.thumbnail }} 
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <View style={styles.videoInfo}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.uploaderInfo}>
            {item.uploader.photoURL && (
              <Image 
                source={{ uri: item.uploader.photoURL }} 
                style={styles.uploaderPhoto}
              />
            )}
            <Text style={styles.uploaderEmail} numberOfLines={1}>
              {item.uploader.email.split('@')[0]}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
      <Text style={styles.header}>Live Streams</Text>
      <FlatList
        data={videos}
        renderItem={renderVideo}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContainer}
        numColumns={numColumns}
        key={numColumns} // Force re-render when columns change
        columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
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
  },
  row: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  videoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16/9,
    backgroundColor: '#f0f0f0',
  },
  videoInfo: {
    padding: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
    marginHorizontal: 20,
    fontSize: 16,
  },
  uploaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  uploaderPhoto: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  uploaderEmail: {
    fontSize: 13,
    color: '#666',
    flex: 1,
    fontWeight: '500',
  },
}); 