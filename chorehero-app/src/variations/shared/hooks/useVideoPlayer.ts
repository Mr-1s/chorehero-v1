import { useState, useRef } from 'react';
import { AVPlaybackStatus, Video } from 'expo-av';

export interface VideoPlayerState {
  isPlaying: boolean;
  isLoaded: boolean;
  duration: number;
  position: number;
  isMuted: boolean;
  isFullscreen: boolean;
  isBuffering: boolean;
}

export const useVideoPlayer = () => {
  const videoRef = useRef<Video>(null);
  const [state, setState] = useState<VideoPlayerState>({
    isPlaying: false,
    isLoaded: false,
    duration: 0,
    position: 0,
    isMuted: true,
    isFullscreen: false,
    isBuffering: false
  });

  const play = async () => {
    if (videoRef.current) {
      await videoRef.current.playAsync();
      setState(prev => ({ ...prev, isPlaying: true }));
    }
  };

  const pause = async () => {
    if (videoRef.current) {
      await videoRef.current.pauseAsync();
      setState(prev => ({ ...prev, isPlaying: false }));
    }
  };

  const togglePlayPause = async () => {
    if (state.isPlaying) {
      await pause();
    } else {
      await play();
    }
  };

  const mute = async () => {
    if (videoRef.current) {
      await videoRef.current.setIsMutedAsync(true);
      setState(prev => ({ ...prev, isMuted: true }));
    }
  };

  const unmute = async () => {
    if (videoRef.current) {
      await videoRef.current.setIsMutedAsync(false);
      setState(prev => ({ ...prev, isMuted: false }));
    }
  };

  const toggleMute = async () => {
    if (state.isMuted) {
      await unmute();
    } else {
      await mute();
    }
  };

  const seekTo = async (position: number) => {
    if (videoRef.current) {
      await videoRef.current.setPositionAsync(position);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setState(prev => ({
        ...prev,
        isLoaded: true,
        isPlaying: status.isPlaying,
        duration: status.durationMillis || 0,
        position: status.positionMillis || 0,
        isMuted: status.isMuted,
        isBuffering: status.isBuffering || false
      }));
    }
  };

  const enterFullscreen = async () => {
    if (videoRef.current) {
      await videoRef.current.presentFullscreenPlayer();
      setState(prev => ({ ...prev, isFullscreen: true }));
    }
  };

  const exitFullscreen = async () => {
    if (videoRef.current) {
      await videoRef.current.dismissFullscreenPlayer();
      setState(prev => ({ ...prev, isFullscreen: false }));
    }
  };

  return {
    videoRef,
    state,
    play,
    pause,
    togglePlayPause,
    mute,
    unmute,
    toggleMute,
    seekTo,
    onPlaybackStatusUpdate,
    enterFullscreen,
    exitFullscreen
  };
};