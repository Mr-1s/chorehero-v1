/**
 * JobCard - Unified job card component for cleaner app
 * 
 * Variants:
 * - available: Orange left accent, Accept/Decline buttons
 * - active: Yellow accent, Start Traveling/In Progress buttons
 * - history: Muted, no CTAs
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  FadeInUp,
} from 'react-native-reanimated';
import { cleanerTheme } from '../../utils/theme';
import type { Booking } from '../../types/cleaner';
import Chip from './Chip';
import PressableScale from './PressableScale';

const { colors, typography, spacing, radii, shadows } = cleanerTheme;

type JobCardVariant = 'available' | 'active' | 'history';

interface JobCardProps {
  booking: Booking;
  variant: JobCardVariant;
  onPress?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  onStartTraveling?: () => void;
  onMarkArrived?: () => void;
  isAccepting?: boolean;
  delay?: number;
}

const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (isToday) return `Today at ${timeStr}`;
  if (isTomorrow) return `Tomorrow at ${timeStr}`;
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  }) + ` at ${timeStr}`;
};

const getServiceColor = (serviceType: string): string => {
  if (serviceType.toLowerCase().includes('deep')) return '#7C3AED';
  if (serviceType.toLowerCase().includes('express')) return '#10B981';
  return colors.primary;
};

const getStatusChip = (status: string, variant: JobCardVariant) => {
  switch (status) {
    case 'offered':
      return <Chip label="Available" variant="status" color="success" size="sm" />;
    case 'accepted':
      return <Chip label="Confirmed" variant="status" color="primary" size="sm" />;
    case 'on_the_way':
      return <Chip label="En Route" variant="status" color="primary" size="sm" />;
    case 'in_progress':
      return <Chip label="In Progress" variant="status" color="primary" size="sm" />;
    case 'completed':
      return <Chip label="Completed" variant="muted" color="grey" size="sm" />;
    default:
      return null;
  }
};

const JobCard: React.FC<JobCardProps> = ({
  booking,
  variant,
  onPress,
  onAccept,
  onDecline,
  onStartTraveling,
  onMarkArrived,
  isAccepting = false,
  delay = 0,
}) => {
  const accentColor = variant === 'available' ? colors.primary : 
                      variant === 'active' ? '#F59E0B' : colors.borderSubtle;
  
  const serviceColor = getServiceColor(booking.serviceType);

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)}>
      <PressableScale onPress={onPress} style={styles.cardWrapper}>
        <View style={[styles.card, variant === 'history' && styles.cardMuted]}>
          {/* Left accent bar */}
          <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
          
          {/* Card gradient background */}
          {variant !== 'history' && (
            <LinearGradient
              colors={[colors.cardGradientStart, colors.cardGradientEnd]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}

          <View style={styles.content}>
            {/* Row 1: Customer info */}
            <View style={styles.customerRow}>
              <Image 
                source={{ uri: booking.customerAvatarUrl || 'https://via.placeholder.com/48' }}
                style={styles.avatar}
              />
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{booking.customerName}</Text>
                <View style={styles.customerMeta}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={styles.rating}>{booking.customerRating?.toFixed(1) || '5.0'}</Text>
                  <View style={styles.metaDot} />
                  <Ionicons name="briefcase-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.metaText}>{booking.customerTotalBookings || 0} jobs</Text>
                </View>
              </View>
              {booking.isInstant && (
                <Chip 
                  label="Instant" 
                  variant="filled" 
                  color="primary" 
                  icon="flash" 
                  size="sm" 
                />
              )}
            </View>

            {/* Row 2: Service type + Status */}
            <View style={styles.serviceRow}>
              <Chip 
                label={booking.serviceType} 
                variant="muted" 
                color="grey"
                style={{ backgroundColor: `${serviceColor}15` }}
                textStyle={{ color: serviceColor }}
              />
              {getStatusChip(booking.status, variant)}
            </View>

            {/* Row 3: Meta bar (date, duration, distance) */}
            <View style={styles.metaBar}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.metaItemText}>{formatTime(booking.scheduledAt)}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.metaItemText}>{booking.durationMinutes} min</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.metaItemText}>{booking.distanceMiles.toFixed(1)} mi</Text>
              </View>
            </View>

            {/* Row 4: Address */}
            <View style={styles.addressContainer}>
              <Text style={styles.addressText} numberOfLines={1}>
                {booking.addressLine1}
              </Text>
            </View>

            {/* Row 5: Special requests (if any) */}
            {booking.hasSpecialRequests && booking.specialRequestText && (
              <View style={styles.specialRequestContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color="#92400E" />
                <Text style={styles.specialRequestText} numberOfLines={2}>
                  {booking.specialRequestText}
                </Text>
              </View>
            )}

            {/* Row 6: Price + Actions */}
            <View style={styles.priceRow}>
              <View style={styles.priceInfo}>
                <Text style={styles.totalPrice}>${booking.totalPrice.toFixed(2)}</Text>
                <Text style={styles.earningsText}>
                  You earn: <Text style={styles.earningsAmount}>${booking.payoutToCleaner.toFixed(2)}</Text>
                </Text>
              </View>

              {/* Action buttons based on variant */}
              {variant === 'available' && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity 
                    style={styles.declineButton}
                    onPress={onDecline}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.declineButtonText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.acceptButton, isAccepting && styles.buttonDisabled]}
                    onPress={onAccept}
                    disabled={isAccepting}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.acceptButtonText}>
                      {isAccepting ? 'Accepting...' : 'Accept'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {variant === 'active' && booking.status === 'accepted' && (
                <TouchableOpacity 
                  style={styles.travelButton}
                  onPress={onStartTraveling}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#F59E0B', '#D97706']}
                    style={styles.travelButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="navigate" size={16} color="#FFFFFF" />
                    <Text style={styles.travelButtonText}>Start Traveling</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {variant === 'active' && booking.status === 'on_the_way' && (
                <TouchableOpacity 
                  style={styles.arrivedButton}
                  onPress={onMarkArrived}
                  activeOpacity={0.8}
                >
                  <Text style={styles.arrivedButtonText}>I've Arrived</Text>
                </TouchableOpacity>
              )}

              {variant === 'history' && (
                <View style={styles.completedInfo}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </PressableScale>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    overflow: 'hidden',
    ...shadows.card,
  },
  cardMuted: {
    opacity: 0.85,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: radii.card,
    borderBottomLeftRadius: radii.card,
  },
  content: {
    padding: spacing.lg,
    paddingLeft: spacing.lg + 4, // Account for accent bar
  },
  
  // Customer row
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: spacing.md,
    backgroundColor: colors.metaBg,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: typography.cardTitle.fontWeight,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  customerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: typography.labelSmall.fontWeight,
    color: colors.textSecondary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textMuted,
    marginHorizontal: 4,
  },
  metaText: {
    fontSize: typography.labelSmall.fontSize,
    color: colors.textMuted,
  },

  // Service row
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  // Meta bar
  metaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.metaBg,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaItemText: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: typography.labelSmall.fontWeight,
    color: colors.textSecondary,
  },

  // Address
  addressContainer: {
    backgroundColor: colors.borderLight,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  addressText: {
    fontSize: typography.label.fontSize,
    color: colors.textSecondary,
  },

  // Special requests
  specialRequestContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.specialRequestBg,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  specialRequestText: {
    flex: 1,
    fontSize: typography.label.fontSize,
    color: '#92400E',
    lineHeight: 18,
  },

  // Price row
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceInfo: {
    flex: 1,
  },
  totalPrice: {
    fontSize: typography.metricMedium.fontSize,
    fontWeight: typography.metricMedium.fontWeight,
    color: colors.textPrimary,
  },
  earningsText: {
    fontSize: typography.labelSmall.fontSize,
    color: colors.textSecondary,
    marginTop: 2,
  },
  earningsAmount: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Action buttons
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  declineButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    backgroundColor: colors.errorLight,
  },
  declineButtonText: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    color: colors.error,
  },
  acceptButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    ...shadows.orange,
  },
  acceptButtonText: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.textInverse,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Travel button
  travelButton: {
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  travelButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  travelButtonText: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.textInverse,
  },

  // Arrived button
  arrivedButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.success,
  },
  arrivedButtonText: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.textInverse,
  },

  // Completed info
  completedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  completedText: {
    fontSize: typography.label.fontSize,
    color: colors.success,
    fontWeight: '500',
  },
});

export default JobCard;

