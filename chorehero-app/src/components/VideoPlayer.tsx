import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { VideoView, VideoPlayer as ExpoVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

interface VideoPlayerProps {
  videoUrl: string;
  onPlaybackStatusUpdate?: (player: ExpoVideoPlayer) => void;
  onLoad?: () => void;
  onLoadStart?: () => void;
  onError?: (error: string) => void;
  style?: any;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  onPlaybackStatusUpdate,
  onLoad,
  onLoadStart,
  onError,
  style,
  autoPlay = false,
  muted = false,
  loop = false,
  controls = true,
}) => {
  const [player, setPlayer] = useState<ExpoVideoPlayer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const statusInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize player
    const videoPlayer = new ExpoVideoPlayer(videoUrl, true);
    videoPlayer.muted = muted;
    videoPlayer.loop = loop;
    
    setPlayer(videoPlayer);
      setIsLoading(false);
    
    if (onLoad) {
      onLoad();
    }
    
    if (autoPlay) {
      videoPlayer.play();
      setIsPlaying(true);
    }

    // Status updates
    if (onPlaybackStatusUpdate) {
      statusInterval.current = setInterval(() => {
        onPlaybackStatusUpdate(videoPlayer);
      }, 1000);
    }

    // Cleanup
    return () => {
      if (statusInterval.current) {
        clearInterval(statusInterval.current);
      }
      videoPlayer.release();
    };
  }, [videoUrl, autoPlay, muted, loop, onLoad, onPlaybackStatusUpdate]);

  const togglePlayPause = () => {
    if (!player) return;

    if (isPlaying) {
      player.pause();
        } else {
      player.play();
        }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!player) return;
    
    player.muted = !player.muted;
  };

  if (hasError) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color="#ef4444" />
          <Text style={styles.errorText}>Failed to load video</Text>
        </View>
      </View>
    );
    }

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="large" color="#0891b2" />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <VideoView
        style={styles.video}
        player={player!}
        allowsFullscreen
        allowsPictureInPicture
        contentFit="cover"
      />
      
      {controls && (
        <View style={styles.controlsContainer}>
          <BlurView intensity={80} style={styles.controlsBlur}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={togglePlayPause}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"} 
                size={32} 
                color="white" 
              />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.muteButton}
              onPress={toggleMute}
            >
            <Ionicons
                name={muted ? "volume-mute" : "volume-high"} 
                size={24} 
                color="white" 
            />
          </TouchableOpacity>
          </BlurView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  controlsBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    overflow: 'hidden',
  },
  playButton: {
    padding: 10,
  },
  muteButton: {
    padding: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
});

export default VideoPlayer;