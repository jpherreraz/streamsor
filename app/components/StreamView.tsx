import { router } from 'expo-router';
import { httpsCallable } from 'firebase/functions';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Image, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
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

const LiveBadge = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.liveBadgeContainer}>
      <Animated.View 
        style={[
          styles.liveDot,
          {
            opacity: pulseAnim,
            transform: [{
              scale: pulseAnim
            }]
          }
        ]} 
      />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
};

const ShimmerEffect = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();

    return () => shimmer.stop();
  }, []);

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        {
          opacity: shimmerAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 0.7],
          }),
          backgroundColor: '#fff',
        },
      ]}
    />
  );
};

export default function StreamView() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const { user } = useAuth();

  // Calculate number of columns based on available width
  // Account for sidebar (240px) on web
  const availableWidth = Platform.OS === 'web' ? width - 240 : width;
  // Each card should be at least 300px wide
  const numColumns = Math.max(1, Math.floor((availableWidth - 32) / 300)); // Account for container padding (16px * 2)
  const cardWidth = (availableWidth - (32 + (8 * (numColumns - 1)))) / numColumns; // Account for padding and gaps

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

  const renderVideo = ({ item }: { item: Video }) => (
    <TouchableOpacity 
      style={[styles.videoCard, { width: cardWidth }]}
      onPress={() => handleVideoPress(item.uid)}
    >
      <View style={styles.thumbnailContainer}>
        <Image 
          source={{ uri: item.thumbnail }} 
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <LiveBadge />
      </View>
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

  const renderLoadingSkeleton = () => {
    const skeletonItems = Array(6).fill(0);
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Live Streams</Text>
        <View style={styles.skeletonGrid}>
          {skeletonItems.map((_, index) => (
            <View 
              key={index} 
              style={[styles.videoCard, styles.skeletonCard, { width: cardWidth }]}
            >
              <View style={styles.thumbnailContainer}>
                <View style={[styles.thumbnail, styles.skeletonThumbnail]}>
                  <ShimmerEffect />
                </View>
              </View>
              <View style={styles.videoInfo}>
                <View style={[styles.skeletonText, { width: '80%', height: 20, marginBottom: 8, overflow: 'hidden' }]}>
                  <ShimmerEffect />
                </View>
                <View style={styles.uploaderInfo}>
                  <View style={[styles.uploaderPhoto, styles.skeletonAvatar, { overflow: 'hidden' }]}>
                    <ShimmerEffect />
                  </View>
                  <View style={[styles.skeletonText, { width: '60%', height: 16, overflow: 'hidden' }]}>
                    <ShimmerEffect />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return renderLoadingSkeleton();
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Live Streams</Text>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  if (videos.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Live Streams</Text>
        <View style={styles.centered}>
          <Text>No livestreams found</Text>
        </View>
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
    backgroundColor: '#fff',
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  listContainer: {
    padding: 8,
  },
  row: {
    gap: 8,
  },
  list: {
    flex: 1,
  },
  videoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#f5f5f5',
  },
  videoInfo: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  uploaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploaderPhoto: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  uploaderEmail: {
    fontSize: 14,
    color: '#666',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 16,
    textAlign: 'center',
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skeletonCard: {
    opacity: 1,
  },
  skeletonThumbnail: {
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
  },
  skeletonText: {
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  skeletonAvatar: {
    backgroundColor: '#e0e0e0',
  },
  liveBadgeContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
}); 