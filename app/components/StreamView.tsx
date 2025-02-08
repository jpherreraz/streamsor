import { useRouter } from 'expo-router';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Stream {
  uid: string;
  id: string;
  liveInputId: string;
  displayName?: string;
  email?: string;
  status: 'live' | 'offline';
  title?: string;
  viewerCount: number;
  thumbnailUrl?: string;
  playback?: {
    hls: string;
    dash: string;
  };
  photoURL?: string;
}

export default function StreamView() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const functions = getFunctions();
  const refreshInterval = useRef<NodeJS.Timeout>();

  const fetchStreams = async () => {
    try {
      console.log('Fetching streams...');
      const getActiveStreams = httpsCallable(functions, 'getActiveStreams');
      const result = await getActiveStreams();
      const data = result.data as { streams: Stream[] };
      console.log('Got streams:', data.streams.length);
      console.log('Stream details:', data.streams.map(s => ({
        uid: s.uid,
        id: s.id,
        status: s.status,
        displayName: s.displayName || s.email
      })));
      setStreams(data.streams);
      setError(null);
    } catch (err) {
      console.error('Error fetching streams:', err);
      setError('Unable to load streams. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    console.log('StreamView mounted');
    
    // Initial fetch
    fetchStreams();

    // Set up periodic refresh
    refreshInterval.current = setInterval(fetchStreams, 10000);

    return () => {
      console.log('StreamView unmounting');
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, []);

  const handleStreamPress = (id: string) => {
    router.push(`/stream/${id}`);
  };

  if (isLoading) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.header}>Live Streams</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Loading streams...</Text>
        </View>
      </ScrollView>
    );
  }

  // Log all streams before filtering
  console.log('All streams before filtering:', streams.map(s => ({
    uid: s.uid,
    status: s.status,
    displayName: s.displayName || s.email
  })));

  const liveStreams = streams.filter(stream => {
    console.log('Stream status check:', {
      uid: stream.uid,
      status: stream.status
    });
    return stream.status === 'live';
  });

  console.log('Live streams after filtering:', liveStreams.length);

  if (error) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.header}>Live Streams</Text>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchStreams}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (liveStreams.length === 0) {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.header}>Live Streams</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No active streams right now</Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Live Streams</Text>
      <View style={styles.listContainer}>
        {liveStreams.map((stream) => (
          <TouchableOpacity 
            key={stream.uid} 
            style={styles.videoCard}
            onPress={() => handleStreamPress(stream.id)}
          >
            <Image
              source={{ 
                uri: `https://videodelivery.net/${stream.liveInputId}/thumbnails/thumbnail.jpg?height=270` 
              }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
            <View style={styles.videoInfo}>
              <View style={styles.infoContainer}>
                {stream.photoURL ? (
                  <Image 
                    source={{ uri: stream.photoURL }} 
                    style={styles.uploaderAvatar} 
                  />
                ) : (
                  <View style={[styles.uploaderAvatar, styles.uploaderAvatarPlaceholder]}>
                    <Text style={styles.uploaderAvatarText}>
                      {(stream.displayName || stream.email || 'A')?.[0]?.toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.textContent}>
                  <Text style={styles.title} numberOfLines={2}>
                    {stream.title || 'Untitled Stream'}
                  </Text>
                  <Text style={styles.uploaderEmail} numberOfLines={1}>
                    {stream.displayName || stream.email || 'Anonymous'}
                  </Text>
                  <View style={styles.viewerCount}>
                    <Text style={styles.viewerText}>
                      {stream.viewerCount} viewers
                    </Text>
                    <View style={styles.liveIndicator}>
                      <Text style={styles.liveText}>LIVE</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
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
  listContainer: {
    padding: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  videoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewerText: {
    fontSize: 11,
    color: '#666',
  },
  liveIndicator: {
    backgroundColor: '#ff0000',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#c62828',
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#c62828',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
}); 