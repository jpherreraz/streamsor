import { Video } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import { httpsCallable } from 'firebase/functions';
import Hls from 'hls.js';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';
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

export default function VideoScreen() {
  const { id } = useLocalSearchParams();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isDraggingPlayback, setIsDraggingPlayback] = useState(false);

  useEffect(() => {
    const fetchVideo = async () => {
      try {
        setError(null);
        const getCloudflareVideos = httpsCallable(functions, 'getCloudflareVideos');
        const result = await getCloudflareVideos();
        const videos = result.data as Video[];
        const video = videos.find(v => v.uid === id);
        
        if (!video) {
          throw new Error('Video not found');
        }
        
        console.log('Found video:', video);
        console.log('Uploader info:', video.uploader);
        console.log('Profile picture URL:', video.uploader?.photoURL);
        
        setVideo(video);
      } catch (error: any) {
        console.error('Error fetching video:', error);
        setError(error?.message || 'Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [id]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    if (Platform.OS === 'web') {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !video?.playbackUrl || !videoRef.current) return;

    const initHls = () => {
      if (Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }

        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });

        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MEDIA_ATTACHED, () => {
          hls.loadSource(video.playbackUrl);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Network error, trying to recover...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Media error, trying to recover...');
                hls.recoverMediaError();
                break;
              default:
                console.error('Fatal error, destroying HLS instance');
                hls.destroy();
                break;
            }
          }
        });

        hlsRef.current = hls;
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // For Safari, which has native HLS support
        videoRef.current.src = video.playbackUrl;
      }
    };

    initHls();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [video?.playbackUrl]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (Platform.OS === 'web') {
      clearTimeout((window as any).controlsTimeout);
      (window as any).controlsTimeout = setTimeout(() => {
        if (!showVolumeSlider) {
          setShowControls(false);
        }
      }, 3000);
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMutedState = !isMuted;
    videoRef.current.muted = newMutedState;
    setIsMuted(newMutedState);
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    videoRef.current.volume = clampedVolume;
    setVolume(clampedVolume);
    setIsMuted(clampedVolume === 0);
  };

  const toggleFullscreen = async () => {
    if (!videoContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await videoContainerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isDraggingPlayback) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handlePlaybackScrub = (newTime: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const renderVideoPlayer = () => {
    if (Platform.OS === 'web') {
      return (
        <div 
          ref={videoContainerRef}
          style={styles.webVideoContainer}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setShowControls(false)}
        >
          <video
            ref={videoRef}
            style={styles.webVideo}
            autoPlay
            playsInline
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => setIsBuffering(false)}
          />
          {showControls && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '16px 24px',
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
              opacity: showControls ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                width: '100%',
                marginBottom: 8,
                marginTop: 8,
              }}>
                <View style={[styles.playbackBarContainer, { marginBottom: 0 }]}>
                  <View style={styles.playbackBar}>
                    <View 
                      style={[
                        styles.playbackProgress, 
                        { width: `${(currentTime / duration) * 100}%` }
                      ]} 
                    />
                  </View>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    value={currentTime}
                    onChange={(e) => handlePlaybackScrub(parseFloat(e.target.value))}
                    onMouseDown={() => setIsDraggingPlayback(true)}
                    onMouseUp={() => setIsDraggingPlayback(false)}
                    style={styles.playbackSlider}
                  />
                </View>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                width: '100%',
                justifyContent: 'space-between',
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                  <button
                    onClick={togglePlayPause}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      width: '32px',
                      height: '32px',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.9,
                      transition: 'opacity 0.2s ease',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {isPlaying ? (
                        <>
                          <rect x="6" y="4" width="4" height="16"/>
                          <rect x="14" y="4" width="4" height="16"/>
                        </>
                      ) : (
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      )}
                    </svg>
                  </button>

                  <div 
                    style={{ 
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      marginLeft: 16,
                    }}
                    onMouseEnter={() => setShowVolumeSlider(true)}
                    onMouseLeave={() => setShowVolumeSlider(false)}
                  >
                    <button
                      onClick={toggleMute}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        width: '32px',
                        height: '32px',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.9,
                        transition: 'opacity 0.2s ease',
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {isMuted || volume === 0 ? (
                          <>
                            <path d="M11 5L6 9H2v6h4l5 4V5z" />
                            <line x1="23" y1="9" x2="17" y2="15" />
                            <line x1="17" y1="9" x2="23" y2="15" />
                          </>
                        ) : volume < 0.5 ? (
                          <>
                            <path d="M11 5L6 9H2v6h4l5 4V5z" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </>
                        ) : (
                          <>
                            <path d="M11 5L6 9H2v6h4l5 4V5z" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                          </>
                        )}
                      </svg>
                    </button>

                    <div
                      style={{
                        position: 'absolute',
                        left: '100%',
                        bottom: 0,
                        height: '32px',
                        width: showVolumeSlider ? '100px' : '0',
                        overflow: 'hidden',
                        transition: 'width 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: showVolumeSlider ? '12px' : '0',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: '88px',
                          height: '4px',
                          background: 'rgba(255, 255, 255, 0.2)',
                          borderRadius: '2px',
                          cursor: 'pointer',
                        }}
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const newVolume = Math.max(0, Math.min(1, x / rect.width));
                          handleVolumeChange(newVolume);
                        }}
                        onMouseDown={(e) => {
                          const sliderElement = e.currentTarget;
                          const handleDrag = (moveEvent: MouseEvent) => {
                            const rect = sliderElement.getBoundingClientRect();
                            const x = moveEvent.clientX - rect.left;
                            const newVolume = Math.max(0, Math.min(1, x / rect.width));
                            handleVolumeChange(newVolume);
                          };
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleDrag);
                            document.removeEventListener('mouseup', handleMouseUp);
                          };
                          
                          document.addEventListener('mousemove', handleDrag);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            height: '100%',
                            width: `${volume * 100}%`,
                            background: '#fff',
                            borderRadius: '2px',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            left: `${volume * 100}%`,
                            top: '50%',
                            width: '12px',
                            height: '12px',
                            background: '#fff',
                            borderRadius: '50%',
                            transform: 'translate(-50%, -50%)',
                            transition: 'transform 0.1s ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                  <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                  <Text style={styles.timeText}> / </Text>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>

                  <button
                    onClick={toggleFullscreen}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      width: '32px',
                      height: '32px',
                      padding: 0,
                      marginLeft: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.9,
                      transition: 'opacity 0.2s ease',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {isFullscreen ? (
                        <>
                          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                        </>
                      ) : (
                        <>
                          <path d="M15 3h6v6M14 10l7-7M9 21H3v-6M10 14l-7 7"/>
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
          {isBuffering && (
            <View style={styles.bufferingContainer}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </div>
      );
    } else {
      return (
        <Video
          source={{ uri: video?.playbackUrl || '' }}
          rate={1.0}
          volume={1.0}
          isMuted={false}
          resizeMode="contain"
          shouldPlay={true}
          isLooping={false}
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            backgroundColor: '#000',
          }}
          useNativeControls
        />
      );
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!video) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Video not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif' }]}>
      <View style={styles.mainContent}>
        <View style={styles.videoContainer}>
          {renderVideoPlayer()}
          <View style={styles.infoContainer}>
            <Text style={[styles.title, { fontFamily: 'inherit' }]}>{video.title}</Text>
            <View style={styles.uploaderInfo}>
              {console.log('Rendering profile picture, URL:', video.uploader?.photoURL)}
              {video.uploader?.photoURL ? (
                <Image 
                  source={{ uri: video.uploader.photoURL }} 
                  style={styles.uploaderAvatar}
                  onError={(error) => console.error('Failed to load profile picture:', error)} 
                />
              ) : (
                <View style={[styles.uploaderAvatar, styles.uploaderAvatarPlaceholder]}>
                  <Text style={styles.uploaderAvatarText}>
                    {video.uploader?.email?.[0]?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <View style={styles.uploaderTextInfo}>
                <Text style={[styles.uploaderName, { fontFamily: 'inherit' }]}>
                  {video.uploader?.email || 'Unknown User'}
                </Text>
                <Text style={[styles.date, { fontFamily: 'inherit' }]}>
                  {new Date(video.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    height: '100vh',
  },
  mainContent: {
    flex: 1,
    position: 'relative',
    height: '100%',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
    height: 'auto',
    minHeight: 0,
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
  uploaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  uploaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  uploaderAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploaderAvatarText: {
    color: '#fff',
    fontSize: 14,
  },
  uploaderTextInfo: {
    flexDirection: 'column',
  },
  uploaderName: {
    color: '#fff',
    fontSize: 16,
  },
  date: {
    color: '#999',
    fontSize: 14,
  },
  errorText: {
    color: '#ff0000',
    fontSize: 16,
    textAlign: 'center',
  },
  webVideoContainer: {
    position: 'relative',
    width: '100%',
    paddingTop: '56.25%', // 16:9 aspect ratio
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  webVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    backgroundColor: '#000',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  timeText: {
    color: '#fff',
    fontSize: 14,
    marginHorizontal: 8,
  },
  playbackBarContainer: {
    flex: 1,
    height: 20,
    position: 'relative',
  },
  playbackBar: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    transform: [{ translateY: -2 }],
  },
  playbackProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    backgroundColor: '#ff0000',
    borderRadius: 2,
  },
  playbackSlider: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
    cursor: 'pointer',
  },
  bufferingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
}); 