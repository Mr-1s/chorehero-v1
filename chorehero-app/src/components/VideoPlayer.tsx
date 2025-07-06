import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../utils/constants';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface VideoPlayerProps {
  videoUri: string;
  isActive: boolean;
  onLoadStart?: () => void;
  onLoad?: () => void;
  onError?: (error: string) => void;
  onPlaybackStatusUpdate?: (status: AVPlaybackStatus) => void;
  shouldLoop?: boolean;
  isMuted?: boolean;
  onMuteToggle?: () => void;
  showControls?: boolean;
  autoPlay?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUri,
  isActive,
  onLoadStart,
  onLoad,
  onError,
  onPlaybackStatusUpdate,
  shouldLoop = true,
  isMuted = true,
  onMuteToggle,
  showControls = true,
  autoPlay = true,
}) => {
  // Refs
  const videoRef = useRef<Video>(null);
  
  // State
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(false);

  // Handle video status updates
  const handlePlaybackStatusUpdate = useCallback((newStatus: AVPlaybackStatus) => {
    setStatus(newStatus);
    
    if (newStatus.isLoaded) {
      setIsLoading(false);
      setHasError(false);
      
      // Auto-hide play button when playing
      if (newStatus.isPlaying) {
        setShowPlayButton(false);
      }
    } else if (newStatus.error) {
      setIsLoading(false);
      setHasError(true);
      onError?.(newStatus.error || 'Video playback error');
    }
    
    onPlaybackStatusUpdate?.(newStatus);
  }, [onPlaybackStatusUpdate, onError]);

  // Play/pause toggle
  const togglePlayPause = useCallback(async () => {
    if (!videoRef.current || !status?.isLoaded) return;

    try {
      if (status.isPlaying) {
        await videoRef.current.pauseAsync();
        setShowPlayButton(true);
      } else {
        await videoRef.current.playAsync();
        setShowPlayButton(false);
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
      Alert.alert('Error', 'Unable to control video playback');
    }
  }, [status]);

  // Mute toggle
  const toggleMute = useCallback(async () => {
    if (!videoRef.current || !status?.isLoaded) return;

    try {
      await videoRef.current.setIsMutedAsync(!isMuted);
      onMuteToggle?.();
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  }, [isMuted, onMuteToggle, status]);

  // Seek to position
  const seekTo = useCallback(async (positionMillis: number) => {
    if (!videoRef.current || !status?.isLoaded) return;

    try {
      await videoRef.current.setPositionAsync(positionMillis);
    } catch (error) {
      console.error('Error seeking video:', error);
    }
  }, [status]);

  // Handle video play/pause based on active state
  useEffect(() => {
    if (!videoRef.current || !status?.isLoaded) return;

    const handleActiveState = async () => {
      try {
        if (isActive && autoPlay) {
          await videoRef.current!.playAsync();
        } else {
          await videoRef.current!.pauseAsync();
          setShowPlayButton(true);
        }
      } catch (error) {
        console.error('Error handling active state:', error);
      }
    };

    handleActiveState();
  }, [isActive, autoPlay, status?.isLoaded]);

  // Handle video loading start
  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    onLoadStart?.();
  }, [onLoadStart]);

  // Handle video load complete
  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  }, [onLoad]);

  // Handle video error
  const handleError = useCallback((error: string) => {
    setIsLoading(false);
    setHasError(true);
    setShowPlayButton(false);
    onError?.(error);
  }, [onError]);

  // Retry loading video
  const retryLoad = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      setIsLoading(true);
      setHasError(false);
      await videoRef.current.unloadAsync();
      await videoRef.current.loadAsync(
        { uri: videoUri },
        {
          shouldPlay: isActive && autoPlay,
          isLooping: shouldLoop,
          isMuted,
        }
      );
    } catch (error) {
      console.error('Error retrying video load:', error);
      setHasError(true);
      setIsLoading(false);
    }
  }, [videoUri, isActive, autoPlay, shouldLoop, isMuted]);

  // Format time for display
  const formatTime = (millis: number): string => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const getProgress = (): number => {
    if (!status?.isLoaded || !status.durationMillis) return 0;
    return (status.positionMillis || 0) / status.durationMillis;
  };

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        style={styles.video}
        source={{ uri: videoUri }}
        resizeMode={ResizeMode.COVER}
        isLooping={shouldLoop}
        isMuted={isMuted}
        shouldPlay={isActive && autoPlay}
        onLoadStart={handleLoadStart}
        onLoad={handleLoad}
        onError={(error) => handleError(typeof error === 'string' ? error : 'Video load failed')}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        useNativeControls={false}
      />

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}

      {/* Error overlay */}
      {hasError && (
        <View style={styles.overlay}>
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={48} color={COLORS.error} />
            <Text style={styles.errorText}>Failed to load video</Text>
            <TouchableOpacity style={styles.retryButton} onPress={retryLoad}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Play button overlay */}
      {showPlayButton && !isLoading && !hasError && (
        <TouchableOpacity style={styles.playButtonOverlay} onPress={togglePlayPause}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={48} color={COLORS.text.inverse} />
          </View>
        </TouchableOpacity>
      )}

      {/* Controls overlay */}
      {showControls && status?.isLoaded && !isLoading && !hasError && (
        <View style={styles.controlsContainer}>
          {/* Mute button */}
          {onMuteToggle && (
            <TouchableOpacity style={styles.muteButton} onPress={toggleMute}>
              <Ionicons
                name={isMuted ? 'volume-mute' : 'volume-high'}
                size={24}
                color={COLORS.text.inverse}
              />
            </TouchableOpacity>
          )}

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${getProgress() * 100}%` },
                ]}
              />
            </View>
            
            {/* Time display */}
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>
                {formatTime(status.positionMillis || 0)} / {formatTime(status.durationMillis || 0)}
              </Text>
            </View>
          </View>

          {/* Play/pause button */}
          <TouchableOpacity style={styles.playPauseButton} onPress={togglePlayPause}>
            <Ionicons
              name={status.isPlaying ? 'pause' : 'play'}
              size={20}
              color={COLORS.text.inverse}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: screenWidth,
    height: screenHeight,
    backgroundColor: COLORS.text.primary,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  errorContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
  },
  errorText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.medium,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  retryButtonText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  playButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  muteButton: {
    padding: SPACING.sm,
    marginRight: SPACING.md,
  },
  progressContainer: {
    flex: 1,
    marginHorizontal: SPACING.md,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  timeContainer: {
    marginTop: SPACING.xs,
    alignItems: 'center',
  },
  timeText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  playPauseButton: {
    padding: SPACING.sm,
    marginLeft: SPACING.md,
  },
});