import { useState, useCallback, useRef, useEffect } from 'react';
import { VideoPlayer } from 'expo-video';
import { PLATFORM_CONFIG } from '../utils/constants';

interface VideoPlayerState {
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  hasError: boolean;
  isBuffering: boolean;
  watchTime: number; // Total watch time for analytics
}

interface UseVideoPlayerProps {
  autoPlay?: boolean;
  startMuted?: boolean;
  onWatchTimeThreshold?: (watchTime: number, duration: number) => void;
  watchTimeThreshold?: number; // Threshold in seconds for analytics
}

export const useVideoPlayer = ({
  autoPlay = true,
  startMuted = true,
  onWatchTimeThreshold,
  watchTimeThreshold = 20, // 20 seconds default
}: UseVideoPlayerProps = {}) => {
  // Video state
  const [state, setState] = useState<VideoPlayerState>({
    isPlaying: false,
    isMuted: startMuted,
    currentTime: 0,
    duration: 0,
    isLoading: true,
    hasError: false,
    isBuffering: false,
    watchTime: 0,
  });

  // Refs for tracking
  const watchStartTimeRef = useRef<number | null>(null);
  const hasTriggeredThresholdRef = useRef(false);
  const lastPositionRef = useRef(0);

  // Update video state from player status
  const updateFromPlayer = useCallback((player: VideoPlayer) => {
    setState(prevState => {
      const newState = { ...prevState };

      try {
        newState.isPlaying = player.playing;
        newState.isMuted = player.muted;
        newState.currentTime = player.currentTime * 1000; // Convert to milliseconds
        newState.duration = player.duration * 1000; // Convert to milliseconds
        newState.isLoading = false;
        newState.hasError = false;

        // Calculate watch time
        if (player.playing && watchStartTimeRef.current !== null) {
          const currentPosition = player.currentTime * 1000;
          const lastPosition = lastPositionRef.current;
          
          // Only add time if video is progressing forward (not seeking)
          if (currentPosition > lastPosition) {
            const timeDiff = Math.min(currentPosition - lastPosition, 1000); // Max 1 second increment
            newState.watchTime = prevState.watchTime + timeDiff;
            
            // Check threshold
            if (
              !hasTriggeredThresholdRef.current &&
              newState.watchTime >= watchTimeThreshold * 1000 &&
              onWatchTimeThreshold &&
              newState.duration > 0
            ) {
              hasTriggeredThresholdRef.current = true;
              onWatchTimeThreshold(newState.watchTime / 1000, newState.duration / 1000);
            }
          }
          
          lastPositionRef.current = currentPosition;
        }
      } catch (error) {
        newState.hasError = true;
        newState.isLoading = false;
        newState.isPlaying = false;
      }

      return newState;
    });
  }, [onWatchTimeThreshold, watchTimeThreshold]);

  // Start watch time tracking
  const startWatchTime = useCallback(() => {
    watchStartTimeRef.current = Date.now();
  }, []);

  // Stop watch time tracking
  const stopWatchTime = useCallback(() => {
    watchStartTimeRef.current = null;
  }, []);

  // Reset video state
  const resetState = useCallback(() => {
    setState({
      isPlaying: false,
      isMuted: startMuted,
      currentTime: 0,
      duration: 0,
      isLoading: true,
      hasError: false,
      isBuffering: false,
      watchTime: 0,
    });
    watchStartTimeRef.current = null;
    hasTriggeredThresholdRef.current = false;
    lastPositionRef.current = 0;
  }, [startMuted]);

  // Toggle mute state
  const toggleMute = useCallback(() => {
    setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, []);

  // Set loading state
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  // Set error state
  const setError = useCallback((hasError: boolean) => {
    setState(prev => ({ ...prev, hasError, isLoading: false }));
  }, []);

  // Get progress percentage
  const getProgress = useCallback(() => {
    if (state.duration === 0) return 0;
    return state.currentTime / state.duration;
  }, [state.currentTime, state.duration]);

  // Get watch time percentage
  const getWatchTimeProgress = useCallback(() => {
    if (state.duration === 0) return 0;
    return state.watchTime / state.duration;
  }, [state.watchTime, state.duration]);

  // Format time for display
  const formatTime = useCallback((millis: number): string => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Check if video is watchable (meets minimum duration)
  const isWatchable = useCallback(() => {
    return state.duration >= 15000; // Minimum 15 seconds
  }, [state.duration]);

  // Check if video has been substantially watched
  const isSubstantiallyWatched = useCallback(() => {
    return getWatchTimeProgress() >= 0.7; // 70% watch time
  }, [getWatchTimeProgress]);

  // Handle video start
  useEffect(() => {
    if (state.isPlaying && !state.isBuffering) {
      startWatchTime();
    } else {
      stopWatchTime();
    }
  }, [state.isPlaying, state.isBuffering, startWatchTime, stopWatchTime]);

  return {
    // State
    ...state,
    
    // Actions
    updateFromPlayer,
    toggleMute,
    resetState,
    setLoading,
    setError,
    startWatchTime,
    stopWatchTime,
    
    // Computed values
    progress: getProgress(),
    watchTimeProgress: getWatchTimeProgress(),
    isWatchable: isWatchable(),
    isSubstantiallyWatched: isSubstantiallyWatched(),
    
    // Utilities
    formatTime,
    formattedCurrentTime: formatTime(state.currentTime),
    formattedDuration: formatTime(state.duration),
    formattedWatchTime: formatTime(state.watchTime),
  };
};

// Hook for video caching and preloading
export const useVideoCache = () => {
  const [cachedVideos, setCachedVideos] = useState<Set<string>>(new Set());
  const [preloadingVideos, setPreloadingVideos] = useState<Set<string>>(new Set());

  // Preload a video
  const preloadVideo = useCallback(async (videoUri: string) => {
    if (cachedVideos.has(videoUri) || preloadingVideos.has(videoUri)) {
      return; // Already cached or preloading
    }

    setPreloadingVideos(prev => new Set(prev).add(videoUri));

    try {
      // Note: expo-av doesn't have explicit preloading, but we can track what we've attempted to load
      // In a real implementation, you might use a more sophisticated caching mechanism
      
      // Simulate preload (in real app, this would trigger video metadata loading)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setCachedVideos(prev => new Set(prev).add(videoUri));
    } catch (error) {
      console.error('Video preload failed:', error);
    } finally {
      setPreloadingVideos(prev => {
        const newSet = new Set(prev);
        newSet.delete(videoUri);
        return newSet;
      });
    }
  }, [cachedVideos, preloadingVideos]);

  // Preload multiple videos
  const preloadVideos = useCallback(async (videoUris: string[]) => {
    const promises = videoUris.map(uri => preloadVideo(uri));
    await Promise.allSettled(promises);
  }, [preloadVideo]);

  // Clear cache
  const clearCache = useCallback(() => {
    setCachedVideos(new Set());
    setPreloadingVideos(new Set());
  }, []);

  // Check if video is cached
  const isCached = useCallback((videoUri: string) => {
    return cachedVideos.has(videoUri);
  }, [cachedVideos]);

  // Check if video is preloading
  const isPreloading = useCallback((videoUri: string) => {
    return preloadingVideos.has(videoUri);
  }, [preloadingVideos]);

  return {
    preloadVideo,
    preloadVideos,
    clearCache,
    isCached,
    isPreloading,
    cachedCount: cachedVideos.size,
    preloadingCount: preloadingVideos.size,
  };
};

// Hook for video analytics
export const useVideoAnalytics = () => {
  const [analytics, setAnalytics] = useState<Map<string, {
    watchTime: number;
    completionRate: number;
    lastWatched: Date;
    watchCount: number;
  }>>(new Map());

  // Track video watch
  const trackVideoWatch = useCallback((
    videoId: string,
    watchTimeSeconds: number,
    durationSeconds: number
  ) => {
    setAnalytics(prev => {
      const newAnalytics = new Map(prev);
      const existing = newAnalytics.get(videoId);
      
      newAnalytics.set(videoId, {
        watchTime: (existing?.watchTime || 0) + watchTimeSeconds,
        completionRate: durationSeconds > 0 ? watchTimeSeconds / durationSeconds : 0,
        lastWatched: new Date(),
        watchCount: (existing?.watchCount || 0) + 1,
      });
      
      return newAnalytics;
    });
  }, []);

  // Get analytics for video
  const getVideoAnalytics = useCallback((videoId: string) => {
    return analytics.get(videoId);
  }, [analytics]);

  // Get top watched videos
  const getTopWatchedVideos = useCallback((limit: number = 10) => {
    return Array.from(analytics.entries())
      .sort(([, a], [, b]) => b.watchTime - a.watchTime)
      .slice(0, limit);
  }, [analytics]);

  return {
    trackVideoWatch,
    getVideoAnalytics,
    getTopWatchedVideos,
    totalVideosWatched: analytics.size,
  };
};