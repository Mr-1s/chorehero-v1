import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Cleaner } from '../../shared/types';
import { theme } from '../../shared/theme';
import { useSwipeGesture } from '../../shared/hooks/useSwipeGesture';
import { TrustBadge } from './TrustBadge';

interface SwipeCardProps {
  cleaner: Cleaner;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onTap: () => void;
}

export const SwipeCard: React.FC<SwipeCardProps> = ({
  cleaner,
  onSwipeLeft,
  onSwipeRight,
  onTap
}) => {
  const { panResponder, translateX, translateY, scale, rotation } = useSwipeGesture({
    onSwipeLeft,
    onSwipeRight,
    threshold: 80
  });

  const animatedStyle = {
    transform: [
      { translateX },
      { translateY },
      { scale },
      { 
        rotate: rotation.interpolate({
          inputRange: [-100, 0, 100],
          outputRange: ['-10deg', '0deg', '10deg'],
          extrapolate: 'clamp'
        })
      }
    ]
  };

  return (
    <Animated.View style={[styles.card, animatedStyle]} {...panResponder.panHandlers}>
      <TouchableOpacity onPress={onTap} style={styles.cardContent}>
        {/* Video Thumbnail */}
        <View style={styles.videoContainer}>
          <Image source={{ uri: cleaner.videoThumbnail }} style={styles.videoThumbnail} />
          <View style={styles.playButton}>
            <Ionicons name="play" size={24} color={theme.colors.white} />
          </View>
          
          {/* Trust Indicators Overlay */}
          <View style={styles.trustOverlay}>
            <View style={styles.trustBadges}>
              {cleaner.verified && (
                <TrustBadge type="verified" size="small" />
              )}
              {cleaner.backgroundCheck && (
                <TrustBadge type="background-check" size="small" />
              )}
              {cleaner.insured && (
                <TrustBadge type="insured" size="small" />
              )}
            </View>
          </View>
        </View>

        {/* Cleaner Info */}
        <View style={styles.info}>
          <View style={styles.header}>
            <Image source={{ uri: cleaner.profileImage }} style={styles.avatar} />
            <View style={styles.nameContainer}>
              <Text style={styles.name}>{cleaner.name}</Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color={theme.colors.warning} />
                <Text style={styles.rating}>{cleaner.rating}</Text>
                <Text style={styles.reviews}>({cleaner.reviews} reviews)</Text>
              </View>
            </View>
            <Text style={styles.price}>${cleaner.price}/hr</Text>
          </View>

          {/* Professional Details */}
          <View style={styles.professionalDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="briefcase" size={14} color={theme.colors.gray[600]} />
              <Text style={styles.detailText}>{cleaner.yearsExperience} years experience</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="checkmark-done" size={14} color={theme.colors.success} />
              <Text style={styles.detailText}>{cleaner.completedJobs} jobs completed</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="time" size={14} color={theme.colors.primary} />
              <Text style={styles.detailText}>Responds in {cleaner.responseTime}</Text>
            </View>
          </View>

          {/* Security Features */}
          <View style={styles.securitySection}>
            <Text style={styles.securityTitle}>Security & Trust</Text>
            <View style={styles.securityFeatures}>
              <View style={styles.securityItem}>
                <Ionicons name="shield-checkmark" size={16} color={theme.colors.success} />
                <Text style={styles.securityText}>ID Verified</Text>
              </View>
              <View style={styles.securityItem}>
                <Ionicons name="document-text" size={16} color={theme.colors.primary} />
                <Text style={styles.securityText}>Background Check</Text>
              </View>
              <View style={styles.securityItem}>
                <Ionicons name="umbrella" size={16} color={theme.colors.secondary} />
                <Text style={styles.securityText}>Insured & Bonded</Text>
              </View>
            </View>
          </View>

          {/* Specialties */}
          <View style={styles.specialties}>
            {cleaner.specialties.slice(0, 3).map((specialty, index) => (
              <View key={index} style={styles.specialtyTag}>
                <Text style={styles.specialtyText}>{specialty}</Text>
              </View>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    ...theme.shadows.lg
  },
  cardContent: {
    overflow: 'hidden',
    borderRadius: theme.borderRadius.xl
  },
  videoContainer: {
    position: 'relative',
    height: 200,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -30 }, { translateY: -30 }]
  },
  trustOverlay: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md
  },
  trustBadges: {
    flexDirection: 'row',
    gap: theme.spacing.xs
  },
  info: {
    padding: theme.spacing.md
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: theme.spacing.md
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
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  rating: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.gray[700]
  },
  reviews: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[600]
  },
  price: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.primary
  },
  professionalDetails: {
    marginBottom: theme.spacing.md,
    gap: theme.spacing.xs
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  detailText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[700]
  },
  securitySection: {
    marginBottom: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.gray[50],
    borderRadius: theme.borderRadius.md
  },
  securityTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm
  },
  securityFeatures: {
    gap: theme.spacing.sm
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  securityText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[700],
    fontWeight: '500'
  },
  specialties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs
  },
  specialtyTag: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full
  },
  specialtyText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.white,
    fontWeight: '500'
  }
});