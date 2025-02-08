import { Video } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import { httpsCallable } from 'firebase/functions';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
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
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const renderVideoPlayer = () => {
    if (Platform.OS === 'web') {
      return (
        <div 
          ref={videoContainerRef}
          className="video-container"
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => {
            setShowControls(false);
            setShowVolumeSlider(false);
          }}
          onClick={togglePlayPause}
          style={{
            position: 'relative',
            width: '100%',
            paddingTop: '56.25%', // 16:9 aspect ratio
            backgroundColor: '#000',
            overflow: 'hidden',
          }}
        >
          <video
            ref={videoRef}
            src={video?.playbackUrl}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              backgroundColor: '#000',
            }}
            playsInline
            autoPlay
            muted={isMuted}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          
          {/* Gradient overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '120px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
              pointerEvents: 'none',
            }}
          />
          
          {/* Controls */}
          <div
            className={`player-controls ${showControls ? 'visible' : ''}`}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '16px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              opacity: showControls ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={togglePlayPause}
                className="control-button"
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
                }}
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button
                  onClick={toggleMute}
                  className="control-button"
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
                  className="volume-slider-container"
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
                      const slider = e.currentTarget;
                      const handleDrag = (moveEvent: MouseEvent) => {
                        const rect = slider.getBoundingClientRect();
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
                      className="volume-slider-handle"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={toggleFullscreen}
                className="control-button"
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

          <style>
            {`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
              .video-container {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }
              .video-container:fullscreen {
                border-radius: 0;
              }
              .video-container:fullscreen video {
                width: 100vw;
                height: 100vh;
              }
              .control-button:hover {
                opacity: 1 !important;
              }
              .player-controls.visible {
                opacity: 1;
              }
              @media (hover: hover) {
                .video-container:not(:hover) .player-controls {
                  opacity: 0;
                }
              }
              .volume-slider-handle:hover {
                transform: translate(-50%, -50%) scale(1.2) !important;
              }
              .volume-slider-container:hover .volume-slider-handle {
                transform: translate(-50%, -50%) scale(1.2);
              }
            `}
          </style>
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
}); 