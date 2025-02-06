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
  startedAt: number;
  status: 'live' | 'offline' | 'connecting';
  statusMessage?: string;
  lastActive?: number;
  lastChecked?: number;
  lastError?: string;
  lastErrorTime?: number;
  playback: boolean;
}

export default function StreamView() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const router = useRouter();
  const functions = getFunctions();
  const statusCheckInterval = useRef<NodeJS.Timeout>();
  const lastCheckTime = useRef<number>(0);

  const checkStreamStatuses = async (streamsList: Stream[]) => {
    // Prevent multiple simultaneous checks
    if (isChecking) return;
    
    // Add delay between checks
    const now = Date.now();
    if (now - lastCheckTime.current < 5000) return; // Minimum 5 seconds between checks
    
    setIsChecking(true);
    lastCheckTime.current = now;

    const checkStreamStatus = httpsCallable(functions, 'checkStreamStatus');
    try {
      console.log('Checking status for streams:', streamsList.map(s => ({
        id: s.id,
        streamerName: s.streamerName,
        status: s.status
      })));

      const updatedStreams = await Promise.all(
        streamsList.map(async (stream) => {
          try {
            const result = await checkStreamStatus({ streamId: stream.id });
            const status = result.data.status;
            const playback = result.data.playback;
            
            console.log('Stream status check result:', {
              streamId: stream.id,
              streamerName: stream.streamerName,
              status,
              currentStatus: stream.status,
              hasPlayback: !!playback,
              lastActive: stream.lastActive
            });

            // If Cloudflare reports the stream as live
            if (status === 'live') {
              return {
                ...stream,
                status: 'live',
                statusMessage: 'Stream is live',
                lastChecked: now,
                lastActive: now,
                playback: playback || stream.playback
              };
            }

            // If stream was recently active but Cloudflare says not live,
            // keep it for a short grace period
            const wasRecentlyActive = stream.lastActive && (now - stream.lastActive) < 15000;
            if (stream.status === 'live' && wasRecentlyActive) {
              return {
                ...stream,
                lastChecked: now
              };
            }

            // Otherwise, mark as offline
            return {
              ...stream,
              status: 'offline',
              statusMessage: 'Stream is offline',
              lastChecked: now
            };
          } catch (error) {
            console.error('Error checking stream status:', stream.id, error);
            // On error, preserve the stream state if it was recently active
            const wasRecentlyActive = stream.lastActive && (now - stream.lastActive) < 15000;
            if (stream.status === 'live' && wasRecentlyActive) {
              return {
                ...stream,
                lastChecked: now
              };
            }
            return {
              ...stream,
              status: 'offline',
              statusMessage: 'Error checking stream status',
              lastChecked: now
            };
          }
        })
      );

      // Keep only streams that are live or were recently active
      const validStreams = updatedStreams
        .filter((stream): stream is Stream => {
          const wasRecentlyActive = stream.lastActive && (now - stream.lastActive) < 15000;
          return stream.status === 'live' || wasRecentlyActive;
        })
        .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));
      
      console.log('Valid streams after status check:', validStreams.map(s => ({
        id: s.id,
        streamerName: s.streamerName,
        status: s.status,
        lastActive: s.lastActive
      })));
      
      setStreams(validStreams);
    } catch (error) {
      console.error('Error updating stream statuses:', error);
      setError('Unable to update stream statuses. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    const streamsRef = ref(database, 'streams');
    let isSubscribed = true;

    const unsubscribe = onValue(streamsRef, async (snapshot) => {
      if (!isSubscribed) return;

      const data = snapshot.val();
      if (data) {
        console.log('Raw streams data:', Object.entries(data).map(([id, stream]: [string, any]) => ({
          id,
          streamerName: stream.streamerName,
          status: stream.status
        })));

        const streamsList = Object.entries(data)
          .map(([id, stream]: [string, any]) => ({
            id,
            title: stream.title || 'Untitled Stream',
            streamerName: stream.streamerName || 'Anonymous',
            thumbnailUrl: stream.thumbnailUrl || '',
            viewerCount: stream.viewerCount || 0,
            status: stream.status || 'offline',
            statusMessage: stream.statusMessage || '',
            lastActive: stream.lastActive,
            startedAt: stream.startedAt,
            playback: stream.playback,
            ...stream,
          }))
          // Show streams that are live or were recently active
          .filter(stream => {
            const wasRecentlyActive = stream.lastActive && (Date.now() - stream.lastActive) < 15000;
            return stream.status === 'live' || wasRecentlyActive;
          })
          // Sort by most recently active
          .sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0));

        console.log('Filtered streams list:', streamsList.map(s => ({
          id: s.id,
          streamerName: s.streamerName,
          status: s.status,
          lastActive: s.lastActive
        })));

        if (streamsList.length > 0) {
          setStreams(streamsList);
          checkStreamStatuses(streamsList);
        } else {
          setStreams([]);
        }
      } else {
        setStreams([]);
      }
    });

    // Set up periodic status checks
    const interval = setInterval(() => {
      if (streams.length > 0) {
        checkStreamStatuses(streams);
      }
    }, 5000); // Check every 5 seconds

    return () => {
      isSubscribed = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleStreamPress = (streamId: string) => {
    router.push(`/stream/${streamId}`);
  };

  const getStreamStatus = (stream: Stream) => {
    // Only use the status field from Cloudflare
    return stream.status === 'live' ? 'live' : 'offline';
  };

  const getStatusColor = (status: string) => {
    return status === 'live' ? '#ff0000' : '#666';
  };

  const getStatusText = (status: string) => {
    return status === 'live' ? 'LIVE' : 'OFFLINE';
  };

  const getStatusMessage = (stream: Stream) => {
    // Use the same logic as getStreamStatus for consistency
    return stream.status === 'live' ? 'Stream is live' : 'Stream is offline';
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
        // Only show streams that are actually live
        streams
          .filter(stream => stream.status === 'live')
          .map((stream) => {
            const status = getStreamStatus(stream);
            const statusMessage = getStatusMessage(stream);
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
                  {statusMessage && (
                    <Text style={styles.statusMessage}>{statusMessage}</Text>
                  )}
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