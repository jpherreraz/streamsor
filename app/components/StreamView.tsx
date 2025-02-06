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
      {liveStreams.map((stream) => (
        <TouchableOpacity 
          key={stream.uid} 
          style={styles.streamCard}
          onPress={() => handleStreamPress(stream.id)}
        >
          <Image
            source={{ uri: stream.thumbnailUrl || 'https://placehold.co/400x200' }}
            style={styles.thumbnail}
          />
          <View style={styles.streamInfo}>
            <Text style={styles.title}>{stream.title || 'Untitled Stream'}</Text>
            <Text style={styles.streamerName}>{stream.displayName || stream.email || 'Anonymous'}</Text>
            <View style={styles.viewerCount}>
              <Text style={styles.viewerText}>
                {stream.viewerCount} viewers
              </Text>
              <View style={styles.liveIndicator}>
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.statusMessage}>Stream is live</Text>
          </View>
        </TouchableOpacity>
      ))}
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
  streamCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  thumbnail: {
    width: '100%',
    height: 200,
  },
  streamInfo: {
    padding: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  streamerName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewerText: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  liveIndicator: {
    backgroundColor: '#ff0000',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  initializingIndicator: {
    backgroundColor: '#FFA500',
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#ffebee',
    marginHorizontal: 16,
    marginBottom: 16,
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
    color: 'white',
    fontWeight: 'bold',
  },
  statusMessage: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic'
  },
}); 