import { Video as ExpoVideo, ResizeMode } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import { httpsCallable } from 'firebase/functions';
import Hls from 'hls.js';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ImageStyle, Platform, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { functions } from '../firebaseConfig';

interface Video {
  uid: string;
  title: string;
  thumbnail: string;
  playbackUrl: string;
  createdAt: string;
  duration?: number;
  views?: number;
  uploader?: {
    photoURL?: string;
    email?: string;
  };
}

export default function VideoScreen() {
  const { id } = useLocalSearchParams();
  const [video, setVideo] = useState<Video | null>(null);
  const [recommendedVideos, setRecommendedVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
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
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<string | null>(null);
  const [qualities, setQualities] = useState<Array<{
    height: number;
    bitrate: number;
    level: number;
    label: string;
  }>>([]);
  const [currentQuality, setCurrentQuality] = useState<string>('auto');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const playbackSpeeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  useEffect(() => {
    const fetchVideoAndRecommendations = async () => {
      try {
        setError(null);
        // Fetch all recorded videos
        const getRecordedVideos = httpsCallable(functions, 'getRecordedVideos');
        const result = await getRecordedVideos();
        const videos = result.data as Video[];
        
        // Find current video
        const video = videos.find(v => v.uid === id);
        if (!video) {
          throw new Error('Video not found');
        }
        setVideo(video);
        
        // Get recommended videos (all videos except current one)
        const recommendedVideos = videos
          .filter(v => v.uid !== id)
          .slice(0, 5); // Limit to 5 recommendations
        
        setRecommendedVideos(recommendedVideos);
      } catch (error: any) {
        console.error('Error fetching video:', error);
        setError(error?.message || 'Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    fetchVideoAndRecommendations();
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

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(error => {
            console.warn('Failed to autoplay:', error);
            // If autoplay fails, unmute and try again (browsers often require this)
            if (error.name === 'NotAllowedError') {
              setIsMuted(true);
              videoRef.current.muted = true;
              videoRef.current.play().catch(console.error);
            }
          });
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
      videoRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMutedState = !isMuted;
    videoRef.current.muted = newMutedState;
    setIsMuted(newMutedState);
    // Update volume when toggling mute
    if (newMutedState) {
      videoRef.current.volume = 0;
      setVolume(0);
    } else {
      // When unmuting, restore to previous volume or default to 1
      const newVolume = volume === 0 ? 1 : volume;
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
    }
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

  const initializeVideo = (video: HTMLVideoElement | null) => {
    if (!video) return;
    // Initialize video logic here
  };

  useEffect(() => {
    initializeVideo(videoRef.current);
  }, []);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderRecommendedVideo = (recommendedVideo: Video) => (
    <TouchableOpacity 
      key={recommendedVideo.uid}
      style={styles.recommendedVideoCard}
      onPress={() => {
        // Use window.location.href for a full page refresh to properly reset video player
        if (Platform.OS === 'web') {
          window.location.href = `/video/${recommendedVideo.uid}`;
        }
      }}
    >
      <View style={styles.recommendedThumbnailContainer}>
        <Image 
          source={{ uri: recommendedVideo.thumbnail }} 
          style={styles.recommendedThumbnail}
          resizeMode="cover"
        />
        {recommendedVideo.duration && (
          <View style={styles.recommendedDurationBadge}>
            <Text style={styles.recommendedDurationText}>
              {formatDuration(recommendedVideo.duration)}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.recommendedVideoInfo}>
        <Text style={styles.recommendedTitle} numberOfLines={2}>
          {recommendedVideo.title}
        </Text>
        <View style={styles.recommendedUploaderInfo}>
          {recommendedVideo.uploader?.photoURL && (
            <Image 
              source={{ uri: recommendedVideo.uploader.photoURL }} 
              style={styles.recommendedUploaderPhoto}
            />
          )}
          <Text style={styles.recommendedUploaderName} numberOfLines={1}>
            {recommendedVideo.uploader?.email?.split('@')[0] || 'Unknown User'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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
            setShowQualityMenu(false);
          }}
          onClick={togglePlayPause}
          style={{
            position: 'relative',
            width: '100%',
            paddingTop: '56.25%',
            backgroundColor: '#000',
            overflow: 'hidden',
            cursor: 'pointer',
          } as React.CSSProperties}
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
            } as React.CSSProperties}
            playsInline
            autoPlay
            muted={isMuted}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onWaiting={() => setIsBuffering(true)}
            onPlaying={() => setIsBuffering(false)}
          />
          {showControls && (
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '16px 24px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                opacity: showControls ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
            >
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '4px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '2px',
                  cursor: 'pointer',
                }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${(currentTime / duration) * 100}%`,
                      background: '#fff',
                      borderRadius: '2px',
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    value={currentTime}
                    onChange={(e) => handlePlaybackScrub(parseFloat(e.target.value))}
                    onMouseDown={() => setIsDraggingPlayback(true)}
                    onMouseUp={() => setIsDraggingPlayback(false)}
                    style={{
                      position: 'absolute',
                      top: '-8px',
                      left: 0,
                      width: '100%',
                      height: '20px',
                      opacity: 0,
                      cursor: 'pointer',
                    }}
                  />
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Text style={{ color: '#fff', fontSize: 14 }}>{formatTime(currentTime)}</Text>
                      <Text style={{ color: '#fff', fontSize: 14 }}> / </Text>
                      <Text style={{ color: '#fff', fontSize: 14 }}>{formatTime(duration)}</Text>
                    </div>

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
                            <>
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

                              <div
                                onClick={() => setActiveSettingsTab('speed')}
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
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                  </svg>
                                  <span>Playback Speed</span>
                                </div>
                                <div style={{ color: '#999', fontSize: '13px' }}>{playbackSpeed}x</div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                              </div>
                            </>
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
                          ) : activeSettingsTab === 'speed' ? (
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
                                <span>Playback Speed</span>
                              </div>
                              {playbackSpeeds.map((speed) => (
                                <div
                                  key={speed}
                                  onClick={() => handlePlaybackSpeedChange(speed)}
                                  style={{
                                    padding: '8px 16px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    background: playbackSpeed === speed ? 'rgba(255, 255, 255, 0.1)' : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'background 0.2s ease',
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                  onMouseLeave={e => e.currentTarget.style.background = playbackSpeed === speed ? 'rgba(255, 255, 255, 0.1)' : 'none'}
                                >
                                  {playbackSpeed === speed && (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  )}
                                  <span style={{ marginLeft: playbackSpeed === speed ? 0 : '24px' }}>{speed}x</span>
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
        <ExpoVideo
          source={{ uri: video?.playbackUrl || '' }}
          rate={1.0}
          volume={1.0}
          isMuted={false}
          resizeMode={ResizeMode.COVER}
          shouldPlay={true}
          isLooping={false}
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            backgroundColor: '#000',
          } as ViewStyle}
          useNativeControls
        />
      );
    }
  }

  const handleQualityChange = (level: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = level;
    setCurrentQuality(level === -1 ? 'auto' : `${qualities[level].height}p`);
    setShowSettingsMenu(false);
  };

  const handlePlaybackSpeedChange = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSettingsMenu(false);
  };

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
    <View style={[styles.container, Platform.OS === 'web' && { height: Platform.OS === 'web' ? '100%' : undefined }]}>
      <div style={{ 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
        flex: 1,
        display: 'flex',
        flexDirection: Platform.OS === 'web' ? 'row' : 'column',
      }}>
        <View style={styles.mainContent}>
          <View style={styles.videoContainer}>
            {renderVideoPlayer()}
            <View style={styles.infoContainer}>
              <Text style={[styles.title, { 
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif'
              }]}>{video.title}</Text>
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
                  <Text style={[styles.uploaderName, { 
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif'
                  }]}>
                    {video.uploader?.email || 'Unknown User'}
                  </Text>
                  <Text style={[styles.date, { 
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif'
                  }]}>
                    {new Date(video.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {Platform.OS === 'web' && (
          <View style={styles.recommendedContainer}>
            <Text style={styles.recommendedHeader}>Recommended Videos</Text>
            {recommendedVideos.map(renderRecommendedVideo)}
          </View>
        )}
      </div>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    color: '#1a1a1a',
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
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploaderAvatarText: {
    color: '#666',
    fontSize: 14,
  },
  uploaderTextInfo: {
    flexDirection: 'column',
  },
  uploaderName: {
    color: '#1a1a1a',
    fontSize: 16,
  },
  date: {
    color: '#666',
    fontSize: 14,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 16,
    textAlign: 'center',
  },
  webVideoContainer: {
    position: 'relative',
    width: '100%',
    paddingTop: '56.25%', // 16:9 aspect ratio
    backgroundColor: '#000', // Keep video container black for better viewing
    overflow: 'hidden',
  },
  webVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    backgroundColor: '#000', // Keep video background black
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
    color: '#fff', // Keep time text white for visibility on video
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
    backgroundColor: '#007AFF',
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
  recommendedContainer: {
    width: 400,
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#eee',
    padding: 16,
    height: Platform.OS === 'web' ? '100%' : undefined,
    overflow: 'auto',
  } as ViewStyle,
  recommendedHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  recommendedVideoCard: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
  },
  recommendedThumbnailContainer: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
  },
  recommendedThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
  } as ImageStyle,
  recommendedDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendedDurationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  recommendedVideoInfo: {
    padding: 12,
  },
  recommendedTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
    lineHeight: 20,
  },
  recommendedUploaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recommendedUploaderPhoto: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  recommendedUploaderName: {
    fontSize: 13,
    color: '#666',
  },
}); 