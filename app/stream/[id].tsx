import { useLocalSearchParams } from 'expo-router';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import Hls from 'hls.js';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, View } from 'react-native';
import StreamChat from '../components/StreamChat';

interface Stream {
  uid: string;
  title: string;
  playbackUrl: string;
  thumbnail: string;
  createdAt: string;
  liveInputId?: string;
  uploader?: {
    id?: string;
    email?: string;
    photoURL?: string;
    displayName?: string;
  };
}

interface UserData {
  email?: string;
  displayName?: string;
  profilePicture?: string;
  streamTitle?: string;
}

export default function StreamScreen() {
  const { id } = useLocalSearchParams();
  const [stream, setStream] = useState<Stream | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [qualities, setQualities] = useState<Array<{
    height: number;
    bitrate: number;
    level: number;
    label: string;
  }>>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const functions = getFunctions();
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'quality' | null>(null);
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);

  console.log('Stream route ID:', id);

  useEffect(() => {
    const fetchStreamAndUser = async () => {
      try {
        console.log('Fetching stream data for ID:', id);
        const getActiveStreams = httpsCallable(functions, 'getActiveStreams');
        const result = await getActiveStreams();
        console.log('Streams data:', result.data);
        
        if (result.data) {
          const streams = result.data as Stream[];
          const streamData = streams.find(s => s.uid === id);
          if (streamData) {
            setStream(streamData);
            setError(null);

            // Get user data from Firestore using liveInputId
            if (streamData.liveInputId) {
              const db = getFirestore();
              const userDoc = await getDoc(doc(db, 'users', streamData.liveInputId));
              if (userDoc.exists()) {
                const userData = userDoc.data() as UserData;
                console.log('User data:', userData);
                setUserData(userData);
              }
            }
          } else {
            setError('Stream not found');
          }
        } else {
          setError('No streams found');
        }
      } catch (error: any) {
        console.error('Error fetching stream:', error);
        setError(error?.message || 'Failed to load stream');
      } finally {
        setLoading(false);
      }
    };

    fetchStreamAndUser();
  }, [id]);

  useEffect(() => {
    if (!stream?.playbackUrl || !videoRef.current) return;

    const streamUrl = stream.playbackUrl;
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
          backBufferLength: 90,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
          maxBufferSize: 60 * 1000 * 1000,
          startLevel: -1,
          debug: false,
          // More aggressive recovery settings
          manifestLoadingMaxRetry: 6,
          manifestLoadingRetryDelay: 1000,
          manifestLoadingMaxRetryTimeout: 30000,
          levelLoadingMaxRetry: 6,
          levelLoadingRetryDelay: 1000,
          levelLoadingMaxRetryTimeout: 30000,
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 1000,
          fragLoadingMaxRetryTimeout: 30000,
        });
        
        hlsRef.current = hls;
        
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('Network error, trying to recover...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('Media error, trying to recover...');
                hls.recoverMediaError();
                break;
              default:
                console.log('Fatal error, stopping playback');
                hls.destroy();
                hlsRef.current = null;
                setError('Failed to load stream');
                break;
            }
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          const availableQualities = hls.levels.map((level, index) => ({
            height: level.height,
            bitrate: level.bitrate,
            level: index,
            label: `${level.height}p`
          }));
          setQualities(availableQualities);
          setCurrentQuality('auto');
          
          video.play().catch((e) => {
            console.error('Failed to start playback:', e);
          });
        });

        return () => {
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
        };
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // For Safari - it has built-in HLS support
        video.src = streamUrl;
        video.play().catch(console.error);

        return () => {
          video.removeAttribute('src');
          video.load();
        };
      }
    }
  }, [stream?.playbackUrl]);

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;

    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !videoRef.current.muted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    // Store the previous volume before muting
    if (newMuted) {
      videoRef.current.volume = 0;
      setVolume(0);
    } else {
      // When unmuting, restore to previous volume or default to 1
      const newVolume = volume === 0 ? 1 : volume;
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const handleQualityChange = (level: number) => {
    if (!hlsRef.current) return;
    
    hlsRef.current.currentLevel = level;
    setCurrentQuality(level === -1 ? 'auto' : `${qualities[level].height}p`);
    setShowQualityMenu(false);
  };

  const handleVolumeChange = (newVolume: number) => {
    if (!videoRef.current) return;
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    videoRef.current.volume = clampedVolume;
    setVolume(clampedVolume);
    setIsMuted(clampedVolume === 0);
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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
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

  if (!stream) {
    return (
      <View style={styles.centered}>
        <Text>Stream not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif' }]}>
      <View style={styles.mainContent}>
        <View style={styles.videoContainer}>
          {Platform.OS === 'web' ? (
            <div 
              ref={videoContainerRef}
              className="video-container"
              onMouseMove={handleMouseMove}
              onMouseEnter={() => setShowControls(true)}
              onMouseLeave={() => {
                setShowControls(false);
                setShowQualityMenu(false);
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
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => {
                        setShowSettingsMenu(!showSettingsMenu);
                        setActiveSettingsTab(null);
                      }}
                      className="control-button"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        height: '32px',
                        padding: '0 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '14px',
                        opacity: 0.9,
                        transition: 'opacity 0.2s ease',
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                      </svg>
                    </button>
                    
                    {showSettingsMenu && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          right: 0,
                          marginBottom: '8px',
                          background: 'rgba(0, 0, 0, 0.95)',
                          borderRadius: '8px',
                          padding: '8px 0',
                          minWidth: '200px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        {activeSettingsTab === null ? (
                          <div
                            onClick={() => setActiveSettingsTab('quality')}
                            style={{
                              padding: '8px 16px',
                              color: '#fff',
                              fontSize: '14px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'background 0.2s ease',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                              </svg>
                              <span>Quality</span>
                            </div>
                            <div style={{ color: '#999', fontSize: '13px' }}>{currentQuality}</div>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                          </div>
                        ) : activeSettingsTab === 'quality' ? (
                          <>
                            <div
                              onClick={() => setActiveSettingsTab(null)}
                              style={{
                                padding: '8px 16px',
                                color: '#fff',
                                fontSize: '14px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                marginBottom: '4px',
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="15 18 9 12 15 6"></polyline>
                              </svg>
                              <span>Quality</span>
                            </div>
                            <div
                              onClick={() => handleQualityChange(-1)}
                              style={{
                                padding: '8px 16px',
                                color: '#fff',
                                fontSize: '14px',
                                cursor: 'pointer',
                                background: currentQuality === 'auto' ? 'rgba(255, 255, 255, 0.1)' : 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'background 0.2s ease',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                              onMouseLeave={e => e.currentTarget.style.background = currentQuality === 'auto' ? 'rgba(255, 255, 255, 0.1)' : 'none'}
                            >
                              {currentQuality === 'auto' && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                              )}
                              <span style={{ marginLeft: currentQuality === 'auto' ? 0 : '24px' }}>Auto</span>
                            </div>
                            {qualities.map((quality) => (
                              <div
                                key={quality.level}
                                onClick={() => handleQualityChange(quality.level)}
                                style={{
                                  padding: '8px 16px',
                                  color: '#fff',
                                  fontSize: '14px',
                                  cursor: 'pointer',
                                  background: currentQuality === quality.label ? 'rgba(255, 255, 255, 0.1)' : 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  transition: 'background 0.2s ease',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = currentQuality === quality.label ? 'rgba(255, 255, 255, 0.1)' : 'none'}
                              >
                                {currentQuality === quality.label && (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                  </svg>
                                )}
                                <span style={{ marginLeft: currentQuality === quality.label ? 0 : '24px' }}>{quality.label}</span>
                              </div>
                            ))}
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>

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
                  .quality-menu {
                    font-family: inherit;
                    letter-spacing: -0.01em;
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
          ) : (
            <video
              ref={videoRef}
              style={styles.video}
              playsInline
              controls
            />
          )}
        </View>
        <View style={styles.infoContainer}>
          <Text style={[styles.title, { fontFamily: 'inherit' }]}>{stream.title}</Text>
          <View style={styles.uploaderInfo}>
            {console.log('Rendering profile picture, URL:', stream.uploader?.photoURL)}
            {stream.uploader?.photoURL ? (
              <Image 
                source={{ uri: stream.uploader.photoURL }} 
                style={styles.uploaderAvatar}
                onError={(error) => console.error('Failed to load profile picture:', error)} 
              />
            ) : (
              <View style={[styles.uploaderAvatar, styles.uploaderAvatarPlaceholder]}>
                <Text style={styles.uploaderAvatarText}>
                  {stream.uploader?.email?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.uploaderTextInfo}>
              <Text style={[styles.uploaderName, { fontFamily: 'inherit' }]}>
                {stream.uploader?.email?.split('@')[0] || 'Unknown User'}
              </Text>
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
    height: '100vh',
  },
  mainContent: {
    flex: Platform.OS === 'web' ? 0.7 : 0.6,
    position: 'relative',
    height: '100%',
    overflow: 'hidden',
  },
  videoContainer: {
    width: '100%',
    height: 0,
    paddingBottom: '56.25%', // 16:9 aspect ratio
    position: 'relative',
    backgroundColor: '#000',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  uploaderAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploaderAvatarText: {
    color: '#fff',
    fontSize: 16,
  },
  uploaderTextInfo: {
    flexDirection: 'column',
  },
  uploaderName: {
    color: '#fff',
    fontSize: 18,
  },
  chatContainer: {
    flex: Platform.OS === 'web' ? 0.3 : 0.4,
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderTopWidth: Platform.OS === 'web' ? 0 : 1,
    borderColor: '#333',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ff0000',
    fontSize: 16,
    textAlign: 'center',
  },
}); 