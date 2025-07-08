import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Cleaner } from '../../shared/types';
import { theme } from '../../shared/theme';
import { useSwipeGesture } from '../../shared/hooks/useSwipeGesture';
import { QuickBookButton } from './QuickBookButton';

interface SwipeCardProps {
  cleaner: Cleaner;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onTap: () => void;
  onQuickBook: () => void;
  onDoubleTab?: () => void;
}

export const SwipeCard: React.FC<SwipeCardProps> = ({
  cleaner,
  onSwipeLeft,
  onSwipeRight,
  onTap,
  onQuickBook,
  onDoubleTab
}) => {
  const { gestureHandler, translateX, translateY, scale, rotation } = useSwipeGesture({
    onSwipeLeft,
    onSwipeRight,
    threshold: 60 // Lower threshold for faster swiping
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
        { rotate: `${rotation.value}deg` }
      ]
    };
  });

  return (
    <PanGestureHandler onGestureEvent={gestureHandler}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <TouchableOpacity onPress={onTap} style={styles.cardContent}>
          {/* Video Thumbnail */}
          <View style={styles.videoContainer}>
            <Image source={{ uri: cleaner.videoThumbnail }} style={styles.videoThumbnail} />
            <View style={styles.playButton}>
              <Ionicons name="play" size={20} color={theme.colors.white} />
            </View>
            
            {/* Express Clean Badge */}
            {cleaner.expressClean && (
              <View style={styles.expressCleanBadge}>
                <Ionicons name="flash" size={16} color={theme.colors.white} />
                <Text style={styles.expressCleanText}>Express</Text>
              </View>
            )}
            
            {/* Availability Badge */}
            {cleaner.availability.includes('today') && (
              <View style={styles.availabilityBadge}>
                <Text style={styles.availabilityText}>Available Now</Text>
              </View>
            )}
          </View>

          {/* Cleaner Info - Minimal */}
          <View style={styles.info}>
            <View style={styles.header}>
              <View style={styles.nameContainer}>
                <Text style={styles.name}>{cleaner.name}</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color={theme.colors.warning} />
                  <Text style={styles.rating}>{cleaner.rating}</Text>
                  <Text style={styles.distance}> • {cleaner.distance}</Text>
                </View>
              </View>
              <Text style={styles.price}>${cleaner.price}/hr</Text>
            </View>

            {/* Quick Details */}
            <View style={styles.quickDetails}>
              <View style={styles.quickDetailItem}>
                <Ionicons name="time" size={14} color={theme.colors.success} />
                <Text style={styles.quickDetailText}>
                  {cleaner.responseTime}
                </Text>
              </View>
              <View style={styles.quickDetailItem}>
                <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
                <Text style={styles.quickDetailText}>
                  {cleaner.completedJobs} jobs
                </Text>
              </View>
            </View>

            {/* Quick Book Button */}
            <QuickBookButton
              onPress={onQuickBook}
              price={cleaner.price}
              available={cleaner.availability.includes('today')}
              isExpress={cleaner.expressClean}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    ...theme.shadows.md
  },
  cardContent: {
    overflow: 'hidden',
    borderRadius: theme.borderRadius.xl
  },
  videoContainer: {
    position: 'relative',
    height: 180,
    backgroundColor: theme.colors.gray[100]
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -25 }, { translateY: -25 }]
  },
  expressCleanBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.xs
  },
  expressCleanText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.white,
    fontWeight: '600'
  },
  availabilityBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full
  },
  availabilityText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.white,
    fontWeight: '600'
  },
  info: {
    padding: theme.spacing.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm
  },
  nameContainer: {
    flex: 1
  },
  name: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  rating: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray[700],
    marginLeft: theme.spacing.xs
  },
  distance: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[600]
  },
  price: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.primary
  },
  quickDetails: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md
  },
  quickDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  quickDetailText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[600]
  }
});