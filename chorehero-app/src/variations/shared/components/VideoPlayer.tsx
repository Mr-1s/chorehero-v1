import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer } from '../hooks/useVideoPlayer';
import { theme } from '../theme';
import { getRandomVideoUrl } from '../mockData';

interface VideoPlayerProps {
  source: string;
  thumbnail?: string;
  autoPlay?: boolean;
  muted?: boolean;
  showControls?: boolean;
  onVideoEnd?: () => void;
  style?: object;
  title?: string;
  description?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  source,
  thumbnail,
  autoPlay = false,
  muted = true,
  showControls = true,
  onVideoEnd,
  style,
  title,
  description
}) => {
  const [hasError, setHasError] = useState(false);
  const [fallbackSource, setFallbackSource] = useState(source);
  
  const {
    videoRef,
    state,
    togglePlayPause,
    toggleMute,
    onPlaybackStatusUpdate,
    enterFullscreen
  } = useVideoPlayer();

  const handleVideoError = () => {
    if (!hasError) {
      setHasError(true);
      const newSource = getRandomVideoUrl('primary');
      setFallbackSource(newSource);
      Alert.alert(
        'Video Loading Issue',
        'Using alternative video content for demonstration.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, style]}>
      {title && (
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {description && <Text style={styles.description}>{description}</Text>}
        </View>
      )}
      
      <Video
        ref={videoRef}
        source={{ uri: fallbackSource }}
        style={styles.video}
        useNativeControls={false}
        shouldPlay={autoPlay}
        isMuted={muted}
        isLooping={false}
        onPlaybackStatusUpdate={(status) => {
          onPlaybackStatusUpdate(status);
          if (status.isLoaded && status.didJustFinish && onVideoEnd) {
            onVideoEnd();
          }
        }}
        onError={handleVideoError}
        resizeMode={ResizeMode.COVER}
      />
      
      {showControls && (
        <View style={styles.controls}>
          <TouchableOpacity 
            style={styles.playButton}
            onPress={togglePlayPause}
          >
            <Ionicons
              name={state.isPlaying ? 'pause' : 'play'}
              size={24}
              color={theme.colors.white}
            />
          </TouchableOpacity>
          
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>
              {formatTime(state.position)} / {formatTime(state.duration)}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.muteButton}
            onPress={toggleMute}
          >
            <Ionicons
              name={state.isMuted ? 'volume-mute' : 'volume-high'}
              size={20}
              color={theme.colors.white}
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.fullscreenButton}
            onPress={enterFullscreen}
          >
            <Ionicons
              name="expand"
              size={20}
              color={theme.colors.white}
            />
          </TouchableOpacity>
        </View>
      )}
      
      {(state.isBuffering || !state.isLoaded) && (
        <View style={styles.bufferingContainer}>
          <View style={styles.loadingSpinner}>
            <Ionicons name="refresh" size={24} color={theme.colors.white} />
          </View>
          <Text style={styles.bufferingText}>Loading video...</Text>
        </View>
      )}

      {hasError && (
        <View style={styles.errorOverlay}>
          <View style={styles.errorContainer}>
            <Ionicons name="videocam-off" size={32} color={theme.colors.white} />
            <Text style={styles.errorText}>Demo Video</Text>
            <Text style={styles.errorSubtext}>Showing sample content</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: theme.colors.black,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden'
  },
  titleContainer: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md,
    zIndex: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm
  },
  title: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    marginBottom: theme.spacing.xs
  },
  description: {
    color: theme.colors.white,
    fontSize: theme.fontSize.sm,
    opacity: 0.9
  },
  video: {
    width: '100%',
    height: '100%'
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.md
  },
  playButton: {
    padding: theme.spacing.sm
  },
  timeContainer: {
    flex: 1
  },
  timeText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.sm
  },
  muteButton: {
    padding: theme.spacing.sm
  },
  fullscreenButton: {
    padding: theme.spacing.sm
  },
  bufferingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  loadingSpinner: {
    marginBottom: theme.spacing.sm
  },
  bufferingText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md
  },
  errorOverlay: {
    position: 'absolute',
    top: theme.spacing.lg,
    right: theme.spacing.md,
    backgroundColor: 'rgba(255, 107, 107, 0.9)',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    minWidth: 120
  },
  errorContainer: {
    alignItems: 'center'
  },
  errorText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    marginTop: theme.spacing.xs
  },
  errorSubtext: {
    color: theme.colors.white,
    fontSize: theme.fontSize.xs,
    opacity: 0.9,
    marginTop: theme.spacing.xs / 2
  }
});