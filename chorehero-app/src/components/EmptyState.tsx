import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export interface EmptyStateFeature {
  icon: string;
  text: string;
  color?: string;
}

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
  icon?: string;
  primary?: boolean;
}

export interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle: string;
  gradientColors?: readonly [string, string, ...string[]];
  features?: EmptyStateFeature[];
  actions?: EmptyStateAction[];
  showFeatures?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  gradientColors = ['#3ad3db', '#2BC8D4'] as const,
  features = [],
  actions = [],
  showFeatures = true,
}) => {
  return (
    <View style={styles.emptyState}>
      {/* Icon */}
      <View style={styles.emptyIconContainer}>
        <LinearGradient
          colors={gradientColors as any}
          style={styles.emptyIconGradient}
        >
          <Ionicons name={icon as any} size={64} color="#ffffff" />
        </LinearGradient>
      </View>

      {/* Title & Subtitle */}
      <Text style={styles.emptyStateTitle}>{title}</Text>
      <Text style={styles.emptyStateSubtitle}>{subtitle}</Text>

      {/* Features List */}
      {showFeatures && features.length > 0 && (
        <View style={styles.emptyStateFeatures}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons 
                name={feature.icon as any} 
                size={20} 
                color={feature.color || gradientColors[0]} 
              />
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Action Buttons */}
      {actions.length > 0 && (
        <View style={styles.emptyStateActions}>
          {actions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={action.primary ? styles.primaryCTA : styles.secondaryCTA}
              onPress={action.onPress}
            >
              {action.icon && (
                <Ionicons 
                  name={action.icon as any} 
                  size={18} 
                  color={action.primary ? "#ffffff" : gradientColors[0]} 
                />
              )}
              <Text style={action.primary ? styles.primaryCTAText : styles.secondaryCTAText}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 20,
  },
  emptyIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyStateFeatures: {
    alignItems: 'center',
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#475569',
    marginLeft: 12,
  },
  emptyStateActions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
  },
  primaryCTA: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#3ad3db',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryCTAText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  secondaryCTA: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3ad3db',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  secondaryCTAText: {
    color: '#3ad3db',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
});

// Predefined empty state configurations for common scenarios
export const EmptyStateConfigs = {
  // Dashboard empty states
  upcomingBookings: {
    icon: 'calendar-outline',
    title: 'No upcoming bookings',
    subtitle: 'Book your next cleaning service and relax while we handle the rest.',
    gradientColors: ['#3ad3db', '#2BC8D4'] as const,
    features: [
      { icon: 'flash', text: 'Book in 60 seconds', color: '#3ad3db' },
      { icon: 'shield-checkmark', text: 'Verified cleaners', color: '#3ad3db' },
      { icon: 'star', text: '5-star guarantee', color: '#3ad3db' },
    ],
  },
  
  recentActivity: {
    icon: 'time-outline',
    title: 'No recent activity',
    subtitle: 'Your booking history and updates will appear here once you start using the service.',
    gradientColors: ['#10b981', '#059669'] as const,
    features: [
      { icon: 'repeat', text: 'Easy rebooking', color: '#10b981' },
      { icon: 'star', text: 'Rate & review', color: '#10b981' },
      { icon: 'bookmark', text: 'Save favorites', color: '#10b981' },
    ],
  },

  savedServices: {
    icon: 'heart-outline',
    title: 'No saved services',
    subtitle: 'Save your favorite cleaning services and cleaners for quick rebooking.',
    gradientColors: ['#EC4899', '#DB2777'] as const,
    features: [
      { icon: 'repeat', text: 'Quick rebooking', color: '#EC4899' },
      { icon: 'bookmark', text: 'Save preferences', color: '#EC4899' },
      { icon: 'heart', text: 'Favorite cleaners', color: '#EC4899' },
    ],
  },

  // Cleaner dashboard empty states
  jobOpportunities: {
    icon: 'briefcase-outline',
    title: 'No job opportunities',
    subtitle: 'New cleaning jobs will appear here. Make sure your profile is complete to get more bookings.',
    gradientColors: ['#3B82F6', '#2563EB'] as const,
    features: [
      { icon: 'location', text: 'Local jobs', color: '#3B82F6' },
      { icon: 'cash', text: 'Competitive pay', color: '#3B82F6' },
      { icon: 'time', text: 'Flexible schedule', color: '#3B82F6' },
    ],
  },

  activeJobs: {
    icon: 'time-outline',
    title: 'No active jobs',
    subtitle: 'Your accepted jobs will appear here. Check the available jobs to start earning.',
    gradientColors: ['#0891b2', '#0E7490'] as const,
    features: [
      { icon: 'chatbubble', text: 'Customer chat', color: '#0891b2' },
      { icon: 'location', text: 'GPS navigation', color: '#0891b2' },
      { icon: 'checkmark', text: 'Easy completion', color: '#0891b2' },
    ],
  },

  // Messages empty states
  conversations: {
    icon: 'chatbubble-outline',
    title: 'No conversations',
    subtitle: 'Start chatting with your cleaners or customers. Messages will appear here.',
    gradientColors: ['#8B5CF6', '#7C3AED'] as const,
    features: [
      { icon: 'flash', text: 'Instant messaging', color: '#8B5CF6' },
      { icon: 'camera', text: 'Photo sharing', color: '#8B5CF6' },
      { icon: 'notifications', text: 'Real-time alerts', color: '#8B5CF6' },
    ],
  },

  // Profile empty states
  bookingHistory: {
    icon: 'calendar-outline',
    title: 'No booking history',
    subtitle: 'Your completed bookings and service history will be displayed here.',
    gradientColors: ['#10b981', '#059669'] as const,
    features: [
      { icon: 'repeat', text: 'Rebook easily', color: '#10b981' },
      { icon: 'star', text: 'Leave reviews', color: '#10b981' },
      { icon: 'receipt', text: 'View invoices', color: '#10b981' },
    ],
  },

  savedCleaners: {
    icon: 'people-outline',
    title: 'No saved cleaners',
    subtitle: 'Save your favorite cleaners to quickly book them again.',
    gradientColors: ['#F59E0B', '#D97706'] as const,
    features: [
      { icon: 'heart', text: 'Save favorites', color: '#F59E0B' },
      { icon: 'flash', text: 'Quick booking', color: '#F59E0B' },
      { icon: 'star', text: 'Top rated', color: '#F59E0B' },
    ],
  },

  // Cleaner-specific empty states
  cleanerVideos: {
    icon: 'videocam-outline',
    title: 'No videos uploaded',
    subtitle: 'Upload videos to showcase your cleaning skills and attract more customers.',
    gradientColors: ['#8B5CF6', '#7C3AED'] as const,
    features: [
      { icon: 'trending-up', text: 'Increase bookings', color: '#8B5CF6' },
      { icon: 'eye', text: 'Get more views', color: '#8B5CF6' },
      { icon: 'people', text: 'Build trust', color: '#8B5CF6' },
    ],
  },

  cleanerEarnings: {
    icon: 'wallet-outline',
    title: 'No earnings yet',
    subtitle: 'Complete your first job to start earning. Your payment history will appear here.',
    gradientColors: ['#10B981', '#059669'],
    features: [
      { icon: 'card', text: 'Weekly payouts', color: '#10B981' },
      { icon: 'trending-up', text: 'Track earnings', color: '#10B981' },
      { icon: 'receipt', text: 'Payment history', color: '#10B981' },
    ],
  },

  cleanerSchedule: {
    icon: 'calendar-outline',
    title: 'No bookings scheduled',
    subtitle: 'Accept job opportunities to fill your schedule and start earning.',
    gradientColors: ['#3B82F6', '#2563EB'] as const,
    features: [
      { icon: 'time', text: 'Flexible hours', color: '#3B82F6' },
      { icon: 'location', text: 'Choose your area', color: '#3B82F6' },
      { icon: 'cash', text: 'Earn per job', color: '#3B82F6' },
    ],
  },

  cleanerProfile: {
    icon: 'person-outline',
    title: 'Complete your profile',
    subtitle: 'Add your information, upload a video, and get verified to start receiving bookings.',
    gradientColors: ['#EC4899', '#DB2777'] as const,
    features: [
      { icon: 'videocam', text: 'Upload intro video', color: '#EC4899' },
      { icon: 'shield-checkmark', text: 'Get verified', color: '#EC4899' },
      { icon: 'star', text: 'Build ratings', color: '#EC4899' },
    ],
  },

  // Customer-specific empty states
  customerBookings: {
    icon: 'calendar-outline',
    title: 'No bookings yet',
    subtitle: 'Book your first cleaning service and experience the convenience of ChoreHero.',
    gradientColors: ['#3ad3db', '#2BC8D4'] as const,
    features: [
      { icon: 'flash', text: 'Book instantly', color: '#3ad3db' },
      { icon: 'shield-checkmark', text: 'Insured cleaners', color: '#3ad3db' },
      { icon: 'star', text: 'Satisfaction guaranteed', color: '#3ad3db' },
    ],
  },

  discoverCleaners: {
    icon: 'search-outline',
    title: 'No cleaners found',
    subtitle: 'Try adjusting your search filters or location to find available cleaners.',
    gradientColors: ['#F59E0B', '#D97706'] as const,
    features: [
      { icon: 'location', text: 'Expand search area', color: '#F59E0B' },
      { icon: 'time', text: 'Try different times', color: '#F59E0B' },
      { icon: 'filter', text: 'Adjust filters', color: '#F59E0B' },
    ],
  },

  videoFeed: {
    icon: 'play-outline',
    title: 'No videos available',
    subtitle: 'Check back later for cleaner videos, or browse our directory to find cleaners.',
    gradientColors: ['#8B5CF6', '#7C3AED'] as const,
    features: [
      { icon: 'people', text: 'Browse cleaners', color: '#8B5CF6' },
      { icon: 'location', text: 'Find nearby', color: '#8B5CF6' },
      { icon: 'refresh', text: 'Check back later', color: '#8B5CF6' },
    ],
  },
}; 