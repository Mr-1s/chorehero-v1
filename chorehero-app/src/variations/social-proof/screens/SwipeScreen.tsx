import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SwipeCard } from '../components/SwipeCard';
import { mockCleaners } from '../../shared/mockData';
import { theme } from '../../shared/theme';
import { Cleaner } from '../../shared/types';

interface SwipeScreenProps {
  onCleanerSelected: (cleaner: Cleaner) => void;
  onVideoPress: (cleaner: Cleaner) => void;
}

export const SwipeScreen: React.FC<SwipeScreenProps> = ({ onCleanerSelected, onVideoPress }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedCleaners, setLikedCleaners] = useState<Cleaner[]>([]);

  const currentCleaner = mockCleaners[currentIndex];

  const handleSwipeLeft = () => {
    if (currentIndex < mockCleaners.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSwipeRight = () => {
    if (currentCleaner) {
      setLikedCleaners([...likedCleaners, currentCleaner]);
      if (currentIndex < mockCleaners.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  const handleCardTap = () => {
    if (currentCleaner) {
      onVideoPress(currentCleaner);
    }
  };

  const handleTestimonialPlay = (videoUrl: string) => {
    Alert.alert('Playing Video', `Playing customer testimonial video: ${videoUrl}`);
  };

  const handleShare = () => {
    Alert.alert(
      'Share ChoreHero',
      'Invite friends to join ChoreHero and get $20 off your next clean!',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Share', onPress: () => {} }
      ]
    );
  };

  if (!currentCleaner) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="people" size={80} color={theme.colors.primary} />
          <Text style={styles.emptyTitle}>Community loves you!</Text>
          <Text style={styles.emptyDescription}>
            You've seen all the amazing cleaners in your area. Share ChoreHero with friends!
          </Text>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share" size={20} color={theme.colors.white} />
            <Text style={styles.shareButtonText}>Share & Earn $20</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community Favorites</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.likedButton}>
            <Ionicons name="heart" size={20} color={theme.colors.accent} />
            <Text style={styles.likedCount}>{likedCleaners.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareHeaderButton} onPress={handleShare}>
            <Ionicons name="share" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Social Proof Banner */}
      <View style={styles.socialBanner}>
        <View style={styles.socialBannerContent}>
          <Ionicons name="people" size={20} color={theme.colors.primary} />
          <Text style={styles.socialBannerText}>
            Join 10,000+ happy customers who love their cleaners
          </Text>
        </View>
        <View style={styles.socialBannerActions}>
          <TouchableOpacity style={styles.socialAction}>
            <Ionicons name="videocam" size={16} color={theme.colors.accent} />
            <Text style={styles.socialActionText}>Watch Reviews</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Swipe Cards */}
      <View style={styles.cardContainer}>
        <SwipeCard
          cleaner={currentCleaner}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          onTap={handleCardTap}
          onTestimonialPlay={handleTestimonialPlay}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSwipeLeft}>
          <Ionicons name="close" size={24} color={theme.colors.gray[600]} />
          <Text style={styles.skipText}>Pass</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.bookButton} onPress={() => onCleanerSelected(currentCleaner)}>
          <Ionicons name="calendar" size={24} color={theme.colors.white} />
          <Text style={styles.bookText}>Book</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.likeButton} onPress={handleSwipeRight}>
          <Ionicons name="heart" size={24} color={theme.colors.accent} />
          <Text style={styles.likeText}>Like</Text>
        </TouchableOpacity>
      </View>

      {/* Community Stats */}
      <View style={styles.communityStats}>
        <View style={styles.communityStatItem}>
          <Ionicons name="people" size={16} color={theme.colors.primary} />
          <Text style={styles.communityStatText}>10K+ customers</Text>
        </View>
        <View style={styles.communityStatItem}>
          <Ionicons name="star" size={16} color={theme.colors.warning} />
          <Text style={styles.communityStatText}>4.9 avg rating</Text>
        </View>
        <View style={styles.communityStatItem}>
          <Ionicons name="videocam" size={16} color={theme.colors.accent} />
          <Text style={styles.communityStatText}>500+ video reviews</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray[50]
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.gray[900]
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md
  },
  likedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  likedCount: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.accent
  },
  shareHeaderButton: {
    padding: theme.spacing.xs
  },
  socialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.primary + '20',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm
  },
  socialBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1
  },
  socialBannerText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[700],
    fontWeight: '500'
  },
  socialBannerActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  socialAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  socialActionText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.accent,
    fontWeight: '600'
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md
  },
  skipButton: {
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray[100],
    width: 70,
    height: 70
  },
  skipText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.xs
  },
  bookButton: {
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    width: 80,
    height: 80
  },
  bookText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.white,
    marginTop: theme.spacing.xs,
    fontWeight: '600'
  },
  likeButton: {
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.white,
    width: 70,
    height: 70,
    borderWidth: 2,
    borderColor: theme.colors.accent
  },
  likeText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.accent,
    marginTop: theme.spacing.xs,
    fontWeight: '600'
  },
  communityStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200]
  },
  communityStatItem: {
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  communityStatText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.gray[600]
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl
  },
  emptyTitle: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.gray[900],
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm
  },
  emptyDescription: {
    fontSize: theme.fontSize.md,
    color: theme.colors.gray[600],
    textAlign: 'center',
    marginBottom: theme.spacing.xl
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm
  },
  shareButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.white,
    fontWeight: '600'
  }
});