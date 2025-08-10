import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Cleaner } from '../types/user';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../utils/constants';
import { routeToMessage, MessageParticipant } from '../utils/messageRouting';

const { width: screenWidth } = Dimensions.get('window');

interface CleanerCardProps {
  cleaner: Cleaner;
  distance?: number;
  onProfilePress?: () => void;
  onBookPress?: () => void;
  onMessagePress?: () => void;
  isBookingEnabled?: boolean;
  navigation?: any; // Add navigation prop for message routing
}

export const CleanerCard: React.FC<CleanerCardProps> = ({
  cleaner,
  distance,
  onProfilePress,
  onBookPress,
  onMessagePress,
  isBookingEnabled = true,
  navigation,
}) => {
  // Format distance for display
  const formatDistance = (distanceKm?: number): string => {
    if (!distanceKm) return '';
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m away`;
    }
    return `${distanceKm.toFixed(1)}km away`;
  };

  // Format rating for display
  const formatRating = (rating: number): string => {
    return rating > 0 ? rating.toFixed(1) : 'New';
  };

  // Get verification badge
  const getVerificationBadge = () => {
    if (cleaner.verification_status === 'verified') {
      return (
        <View style={styles.verificationBadge}>
          <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
          <Text style={styles.verificationText}>Verified</Text>
        </View>
      );
    }
    return null;
  };

  // Get specialties display
  const getSpecialtiesText = (): string => {
    if (!cleaner.specialties || cleaner.specialties.length === 0) {
      return 'General cleaning';
    }
    
    if (cleaner.specialties.length <= 2) {
      return cleaner.specialties.join(', ');
    }
    
    return `${cleaner.specialties.slice(0, 2).join(', ')} +${cleaner.specialties.length - 2}`;
  };

  return (
    <View style={styles.container}>
      {/* Gradient overlay for readability */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
        style={styles.gradient}
      />
      
      {/* Main content */}
      <View style={styles.content}>
        {/* Top section - compact info */}
        <View style={styles.topSection}>
          {distance !== undefined && (
            <View style={styles.distanceBadge}>
              <Ionicons name="location" size={14} color={COLORS.text.inverse} />
              <Text style={styles.distanceText}>{formatDistance(distance)}</Text>
            </View>
          )}
        </View>

        {/* Bottom section - main info */}
        <View style={styles.bottomSection}>
          {/* Cleaner info */}
          <TouchableOpacity 
            style={styles.cleanerInfo}
            onPress={onProfilePress}
            activeOpacity={0.7}
          >
            {/* Profile picture */}
            <View style={styles.profileSection}>
              <View style={styles.profilePictureContainer}>
                {cleaner.avatar_url ? (
                  <Image 
                    source={{ uri: cleaner.avatar_url }} 
                    style={styles.profilePicture}
                  />
                ) : (
                  <View style={styles.profilePlaceholder}>
                    <Ionicons name="person" size={24} color={COLORS.text.disabled} />
                  </View>
                )}
              </View>
              
              {/* Basic info */}
              <View style={styles.basicInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.cleanerName} numberOfLines={1}>
                    {cleaner.name}
                  </Text>
                  {getVerificationBadge()}
                </View>
                
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.ratingText}>
                    {formatRating(cleaner.rating_average)}
                  </Text>
                  <Text style={styles.jobsText}>
                    • {cleaner.total_jobs} jobs
                  </Text>
                </View>
                
                <Text style={styles.specialtiesText} numberOfLines={1}>
                  {getSpecialtiesText()}
                </Text>
                
                <Text style={styles.rateText}>
                  ${cleaner.hourly_rate}/hr
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            {/* Message button */}
            {(onMessagePress || navigation) && (
              <TouchableOpacity 
                style={styles.messageButton}
                onPress={() => {
                  if (onMessagePress) {
                    onMessagePress();
                  } else if (navigation) {
                    const participant: MessageParticipant = {
                      id: cleaner.id,
                      name: cleaner.name,
                      avatar: cleaner.avatar_url || '',
                      role: 'cleaner',
                    };
                    routeToMessage({
                      participant,
                      navigation,
                    });
                  }
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubble" size={20} color={COLORS.text.inverse} />
              </TouchableOpacity>
            )}
            
            {/* Book button */}
            {onBookPress && (
              <TouchableOpacity 
                style={[
                  styles.bookButton,
                  !isBookingEnabled && styles.bookButtonDisabled
                ]}
                onPress={isBookingEnabled ? onBookPress : undefined}
                activeOpacity={isBookingEnabled ? 0.7 : 1}
              >
                <Text style={styles.bookButtonText}>
                  {isBookingEnabled ? 'Book Now' : 'Unavailable'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    justifyContent: 'flex-end',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl + 20, // Extra space for safe area
  },
  topSection: {
    position: 'absolute',
    top: SPACING.xl,
    right: SPACING.lg,
    alignItems: 'flex-end',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.lg,
  },
  distanceText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    marginLeft: SPACING.xs,
  },
  bottomSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cleanerInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: SPACING.sm,
  },
  profilePictureContainer: {
    marginRight: SPACING.md,
  },
  profilePicture: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.text.inverse,
  },
  profilePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.text.inverse,
  },
  basicInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  cleanerName: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginRight: SPACING.sm,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  verificationText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.semibold,
    marginLeft: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  ratingText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    marginLeft: SPACING.xs,
  },
  jobsText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.sm,
    opacity: 0.8,
    marginLeft: SPACING.xs,
  },
  specialtiesText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.sm,
    opacity: 0.9,
    marginBottom: SPACING.xs,
  },
  rateText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  actionButtons: {
    alignItems: 'center',
  },
  messageButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  bookButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    minWidth: 100,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    backgroundColor: COLORS.text.disabled,
  },
  bookButtonText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
});