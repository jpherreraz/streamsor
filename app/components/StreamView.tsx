import { useRouter } from 'expo-router';
import { onValue, ref } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { database } from '../firebase';

interface Stream {
  id: string;
  title: string;
  streamerName: string;
  thumbnailUrl: string;
  viewerCount: number;
  isLive: boolean;
  startedAt: number;
  status: 'starting' | 'live' | 'ended';
}

export default function StreamView() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const router = useRouter();
  const functions = getFunctions();
  const statusCheckInterval = useRef<NodeJS.Timeout>();
  const lastCheckTime = useRef<number>(0);

  const checkStreamStatuses = async (streamsList: any[]) => {
    // Prevent multiple simultaneous checks
    if (isChecking) return;
    
    // Add delay between checks
    const now = Date.now();
    if (now - lastCheckTime.current < 5000) return; // Minimum 5 seconds between checks
    
    setIsChecking(true);
    lastCheckTime.current = now;

    const checkStreamStatus = httpsCallable(functions, 'checkStreamStatus');
    try {
      const updatedStreams = await Promise.all(
        streamsList.map(async (stream) => {
          try {
            const result = await checkStreamStatus({ streamId: stream.id });
            return {
              ...stream,
              status: result.data.status,
            };
          } catch (error) {
            console.error('Error checking stream status:', error);
            // Return stream with existing status if available, or 'starting' if not
            return {
              ...stream,
              status: stream.status || 'starting',
            };
          }
        })
      );

      console.log('Active streams with status:', updatedStreams);
      setStreams(updatedStreams.filter(stream => stream.status !== 'ended'));
      setError(null);
    } catch (error) {
      console.error('Error updating stream statuses:', error);
      // Keep existing streams but show error message
      setError('Unable to update stream statuses');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    const streamsRef = ref(database, 'streams');
    const unsubscribe = onValue(streamsRef, async (snapshot) => {
      const data = snapshot.val();
      if (data) {
        console.log('Raw stream data:', data);
        const streamsList = Object.entries(data)
          .map(([id, stream]: [string, any]) => ({
            id,
            ...stream,
          }))
          .filter(stream => stream.isLive);

        // Initial status check
        await checkStreamStatuses(streamsList);
      } else {
        setStreams([]);
      }
    });

    // Set up periodic status checks with a longer interval
    statusCheckInterval.current = setInterval(() => {
      if (streams.length > 0) {
        checkStreamStatuses(streams);
      }
    }, 30000); // Check every 30 seconds

    return () => {
      unsubscribe();
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
    };
  }, []);

  const handleStreamPress = (streamId: string) => {
    router.push(`/stream/${streamId}`);
  };

  const getStreamStatus = (stream: Stream) => {
    if (!stream.isLive) return 'ended';
    return stream.status || 'starting';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live':
        return '#ff0000';
      case 'starting':
        return '#FFA500';
      default:
        return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'live':
        return 'LIVE';
      case 'starting':
        return 'STARTING';
      default:
        return 'ENDED';
    }
  };

  const isStreamInitializing = (stream: Stream) => {
    const streamStartTime = stream.startedAt;
    const now = Date.now();
    // Consider a stream as "initializing" if it's less than 30 seconds old
    return now - streamStartTime < 30000;
  };

  if (streams.length === 0 && !error) {
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
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => checkStreamStatuses(streams)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {streams.length === 0 && !error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No active streams right now</Text>
        </View>
      ) : (
        streams.map((stream) => {
          const status = getStreamStatus(stream);
          return (
            <TouchableOpacity 
              key={stream.id} 
              style={styles.streamCard}
              onPress={() => handleStreamPress(stream.id)}
            >
              <Image
                source={{ uri: stream.thumbnailUrl }}
                style={styles.thumbnail}
              />
              <View style={styles.streamInfo}>
                <Text style={styles.title}>{stream.title}</Text>
                <Text style={styles.streamerName}>{stream.streamerName}</Text>
                <View style={styles.viewerCount}>
                  <Text style={styles.viewerText}>
                    {stream.viewerCount} viewers
                  </Text>
                  <View style={[
                    styles.liveIndicator,
                    { backgroundColor: getStatusColor(status) }
                  ]}>
                    <Text style={styles.liveText}>
                      {getStatusText(status)}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })
      )}
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
}); 