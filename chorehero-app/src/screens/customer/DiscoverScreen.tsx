import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  ViewToken,
  Alert,
  RefreshControl,
  Text,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { VideoPlayer } from '../../components/VideoPlayer';
import { CleanerCard } from '../../components/CleanerCard';
import { useVideoPlayer, useVideoCache, useVideoAnalytics } from '../../hooks/useVideoPlayer';
import { useAuth } from '../../hooks/useAuth';
import { Cleaner } from '../../types/user';
import { COLORS, SPACING, TYPOGRAPHY } from '../../utils/constants';
import { supabase } from '../../services/supabase';
import { MOCK_CLEANERS, getRandomCleaningTip } from '../../utils/mockData';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface CleanerWithDistance extends Cleaner {
  distance_km: number;
  video_profile_url: string;
}

export const DiscoverScreen: React.FC = () => {
  // Hooks
  const { user } = useAuth();
  const { preloadVideos, clearCache } = useVideoCache();
  const { trackVideoWatch } = useVideoAnalytics();
  
  // State
  const [cleaners, setCleaners] = useState<CleanerWithDistance[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);

  // Refs
  const flatListRef = useRef<FlatList<CleanerWithDistance>>(null);
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 100,
  });

  // Add loading tip state for better UX
  const [currentTip, setCurrentTip] = useState(getRandomCleaningTip());

  // Load cleaners data
  const loadCleaners = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // TODO: Replace with actual API call
      // For now, use mock data with realistic cleaning content
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
      
      setCleaners(MOCK_CLEANERS);
      
      // Preload first few videos
      const videoUrls = MOCK_CLEANERS.slice(0, 3).map((cleaner: CleanerWithDistance) => cleaner.video_profile_url);
      await preloadVideos(videoUrls);
      
      // Update cleaning tip on refresh
      if (refresh) {
        setCurrentTip(getRandomCleaningTip());
      }
      
    } catch (err) {
      console.error('Error loading cleaners:', err);
      setError('Failed to load cleaners. Please try again.');
      Alert.alert(
        'Error',
        'Failed to load cleaners. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [preloadVideos]);

  // Load cleaners on mount
  useEffect(() => {
    loadCleaners();
  }, [loadCleaners]);

  // Handle viewability change (when user swipes to new video)
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const newIndex = viewableItems[0].index || 0;
        setCurrentIndex(newIndex);
        
        // Preload next few videos
        const startIndex = Math.max(0, newIndex);
        const endIndex = Math.min(cleaners.length, newIndex + 3);
        const videosToPreload = cleaners
          .slice(startIndex, endIndex)
          .map(cleaner => cleaner.video_profile_url);
        
        preloadVideos(videosToPreload);
      }
    },
    [cleaners, preloadVideos]
  );

  // Handle video watch analytics
  const handleVideoWatchThreshold = useCallback((watchTime: number, duration: number) => {
    if (currentIndex < cleaners.length) {
      const currentCleaner = cleaners[currentIndex];
      trackVideoWatch(currentCleaner.id, watchTime, duration);
    }
  }, [currentIndex, cleaners, trackVideoWatch]);

  // Navigate to cleaner profile
  const handleProfilePress = useCallback((cleaner: CleanerWithDistance) => {
    // TODO: Navigate to cleaner profile screen
    console.log('Navigate to profile:', cleaner.name);
  }, []);

  // Navigate to booking flow
  const handleBookPress = useCallback((cleaner: CleanerWithDistance) => {
    // TODO: Navigate to booking flow with selected cleaner
    console.log('Book cleaner:', cleaner.name);
  }, []);

  // Handle messaging
  const handleMessagePress = useCallback((cleaner: CleanerWithDistance) => {
    // TODO: Start chat with cleaner
    console.log('Message cleaner:', cleaner.name);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    clearCache();
    loadCleaners(true);
  }, [clearCache, loadCleaners]);

  // Render video item
  const renderVideoItem = useCallback(({ item, index }: { item: CleanerWithDistance; index: number }) => {
    const isActive = index === currentIndex;
    
    return (
      <View style={styles.videoContainer}>
        <VideoPlayer
          videoUri={item.video_profile_url}
          isActive={isActive}
          shouldLoop={true}
          isMuted={true}
          showControls={false}
          autoPlay={true}
          onPlaybackStatusUpdate={(status) => {
            // Handle video status updates if needed
          }}
          onError={(error) => {
            console.error('Video error for cleaner', item.name, ':', error);
          }}
        />
        
        <CleanerCard
          cleaner={item}
          distance={item.distance_km}
          onProfilePress={() => handleProfilePress(item)}
          onBookPress={() => handleBookPress(item)}
          onMessagePress={() => handleMessagePress(item)}
          isBookingEnabled={item.verification_status === 'verified'}
        />
      </View>
    );
  }, [currentIndex, handleProfilePress, handleBookPress, handleMessagePress]);

  // Loading state
  if (isLoading && cleaners.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Finding amazing cleaners near you...</Text>
        <Text style={styles.loadingTip}>{currentTip}</Text>
      </View>
    );
  }

  // Error state
  if (error && cleaners.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning" size={48} color={COLORS.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadCleaners()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty state
  if (cleaners.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people" size={48} color={COLORS.text.disabled} />
        <Text style={styles.emptyText}>No cleaners available in your area</Text>
        <Text style={styles.emptySubtext}>Try expanding your search radius</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadCleaners()}>
          <Text style={styles.retryButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <FlatList
        ref={flatListRef}
        data={cleaners}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={screenHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        getItemLayout={(_, index) => ({
          length: screenHeight,
          offset: screenHeight * index,
          index,
        })}
        removeClippedSubviews={true}
        maxToRenderPerBatch={2}
        windowSize={3}
        initialNumToRender={1}
      />
      
      {/* Optional: Add search/filter button */}
      <TouchableOpacity style={styles.searchButton}>
        <Ionicons name="options" size={24} color={COLORS.text.inverse} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.text.primary,
  },
  videoContainer: {
    width: screenWidth,
    height: screenHeight,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.xl,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  loadingTip: {
    color: COLORS.text.secondary,
    fontSize: TYPOGRAPHY.sizes.base,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: SPACING.xl,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.xl,
  },
  errorText: {
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.xl,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 25,
  },
  retryButtonText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  searchButton: {
    position: 'absolute',
    top: 60,
    right: SPACING.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});