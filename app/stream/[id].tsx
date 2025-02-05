import { Video } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import { onValue, ref } from 'firebase/database';
import { getFunctions } from 'firebase/functions';
import Hls from 'hls.js';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import StreamChat from '../components/StreamChat';
import { database } from '../firebase';

interface Stream {
  id: string;
  title: string;
  streamerName: string;
  viewerCount: number;
  isLive: boolean;
  streamKey: string;
  playback?: {
    hls: string;
    dash: string;
  };
}

export default function StreamScreen() {
  const { id } = useLocalSearchParams();
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const functions = getFunctions();

  console.log('Stream route ID:', id);

  // Clear retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Check if stream is ready on Cloudflare
  const checkStreamReady = async (streamId: string) => {
    try {
      const response = await fetch(stream?.playback?.hls || '', { method: 'HEAD' });
      if (response.ok) {
        setIsStreamReady(true);
        return true;
      }
      return false;
    } catch (error) {
      console.log('Stream not ready yet, retrying...');
      return false;
    }
  };

  useEffect(() => {
    console.log('Fetching stream data for ID:', id);
    const streamRef = ref(database, `streams/${id}`);
    const unsubscribe = onValue(streamRef, async (snapshot) => {
      const data = snapshot.val();
      console.log('Stream data:', data);
      if (data) {
        setStream({
          id: id as string,
          ...data,
        });
        setError(null);

        // If stream is marked as live, start checking if it's ready
        if (data.isLive) {
          const isReady = await checkStreamReady(id as string);
          if (!isReady && !retryTimeoutRef.current) {
            // Retry every 2 seconds for up to 30 seconds
            let attempts = 0;
            const maxAttempts = 15;
            const checkInterval = 2000;

            const attemptConnection = async () => {
              attempts++;
              const ready = await checkStreamReady(id as string);
              
              if (ready) {
                if (retryTimeoutRef.current) {
                  clearTimeout(retryTimeoutRef.current);
                  retryTimeoutRef.current = null;
                }
              } else if (attempts < maxAttempts) {
                retryTimeoutRef.current = setTimeout(attemptConnection, checkInterval);
              } else {
                setError('Stream is not available. The broadcaster may still be setting up.');
              }
            };

            attemptConnection();
          }
        } else {
          setError('This stream has ended');
        }
      } else {
        setError('Stream not found');
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [id]);

  useEffect(() => {
    if (!stream?.id || !stream.playback?.hls || !isStreamReady) return;

    const streamUrl = stream.playback.hls;
    console.log('Attempting to load stream from:', streamUrl);

    if (Platform.OS === 'web' && videoRef.current) {
      const video = videoRef.current;

      // Cleanup previous HLS instance if it exists
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          maxBufferSize: 60 * 1000 * 1000,
          maxBufferHole: 0.5,
          highBufferWatchdogPeriod: 2,
          nudgeOffset: 0.1,
          nudgeMaxRetry: 5,
          recovery: {
            enabled: true,
            maxRetries: 3,
            retryDelay: 3000,
          },
          debug: false,
        });
        
        hlsRef.current = hls;
        
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('Fatal network error encountered, trying to recover...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('Fatal media error encountered, trying to recover...');
                hls.recoverMediaError();
                break;
              default:
                // Cannot recover
                hls.destroy();
                hlsRef.current = null;
                setError('Stream playback error. Please refresh the page.');
                break;
            }
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch((e) => {
            console.error('Failed to start playback:', e);
            setError('Failed to start playback. Please refresh the page.');
          });
        });

        // Add periodic check for stale stream
        const checkInterval = setInterval(() => {
          if (video.buffered.length) {
            const lastBufferedTime = video.buffered.end(video.buffered.length - 1);
            const liveDelay = video.duration - lastBufferedTime;
            
            if (liveDelay > 10) { // More than 10 seconds behind live
              console.log('Stream is behind, seeking to live edge...');
              video.currentTime = video.duration - 1;
            }
          }
        }, 5000);

        return () => {
          clearInterval(checkInterval);
          hls.destroy();
          hlsRef.current = null;
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('error', (e) => {
          console.error('Native HLS playback error:', e);
          setError('Stream playback error. Please refresh the page.');
        });
        video.play().catch((e) => {
          console.error('Failed to start playback:', e);
          setError('Failed to start playback. Please refresh the page.');
        });
      }
    }
  }, [stream?.id, stream?.playback?.hls, isStreamReady]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error || !stream) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || 'Stream not found'}</Text>
      </View>
    );
  }

  const renderVideoPlayer = () => {
    if (Platform.OS === 'web') {
      return (
        <video
          ref={videoRef}
          style={{
            width: '100%',
            aspectRatio: '16/9',
          }}
          controls
          playsInline
          onError={(e) => {
            console.error('Video playback error:', e);
            setError('Failed to play stream');
          }}
        />
      );
    }

    return (
      <Video
        source={{ uri: stream.playback?.hls || '' }}
        style={styles.video}
        shouldPlay
        useNativeControls
        resizeMode="contain"
        isLooping={false}
        onError={(error) => {
          console.error('Video playback error:', error);
          setError('Failed to play stream');
        }}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.mainContent}>
        <View style={styles.videoContainer}>
          {renderVideoPlayer()}
          <View style={styles.infoContainer}>
            <Text style={styles.title}>{stream.title}</Text>
            <View style={styles.streamerInfo}>
              <Text style={styles.streamerName}>{stream.streamerName}</Text>
              <View style={styles.viewerCount}>
                <Text style={styles.viewerText}>{stream.viewerCount} viewers</Text>
                <View style={styles.liveIndicator}>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.chatContainer}>
        <StreamChat streamId={id as string} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    backgroundColor: '#000',
  },
  mainContent: {
    flex: Platform.OS === 'web' ? 0.7 : 0.6,
  },
  videoContainer: {
    flex: 1,
  },
  chatContainer: {
    flex: Platform.OS === 'web' ? 0.3 : 0.4,
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderTopWidth: Platform.OS === 'web' ? 0 : 1,
    borderColor: '#333',
  },
  video: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  infoContainer: {
    padding: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  streamerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streamerName: {
    color: '#fff',
    fontSize: 16,
  },
  viewerCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewerText: {
    color: '#fff',
    marginRight: 8,
  },
  liveIndicator: {
    backgroundColor: '#ff0000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#ff0000',
    fontSize: 16,
    textAlign: 'center',
  },
}); 