/**
 * JobCard - Unified job card component for cleaner app
 * 
 * Variants:
 * - available: Orange left accent, Accept/Decline buttons
 * - active: Yellow accent, Start Traveling/In Progress buttons
 * - history: Muted, no CTAs
 */

import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
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
  onStartJob?: () => void;
  onMarkComplete?: () => void;
  /** Full-screen live map / tracking (active jobs on Jobs tab). */
  onOpenLiveMap?: () => void;
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

// Orange/amber gradient palette for cohesive theme
const SERVICE_COLORS = {
  deep: '#B45309',      // Dark amber for deep clean
  express: '#D97706',   // Medium amber for express
  standard: '#F59E0B',  // Bright amber for standard
  moveOut: '#92400E',   // Brown amber for move-out
  default: colors.primary, // Orange for default
};

const getServiceColor = (serviceType: string): string => {
  const type = serviceType.toLowerCase();
  if (type.includes('deep')) return SERVICE_COLORS.deep;
  if (type.includes('express')) return SERVICE_COLORS.express;
  if (type.includes('move')) return SERVICE_COLORS.moveOut;
  if (type.includes('standard')) return SERVICE_COLORS.standard;
  return SERVICE_COLORS.default;
};

const getStatusChip = (status: string, variant: JobCardVariant) => {
  switch (status) {
    case 'offered':
      return <Chip label="Available" variant="status" color="success" size="sm" />;
    case 'accepted':
      return <Chip label="Confirmed" variant="status" color="primary" size="sm" />;
    case 'on_the_way':
      return <Chip label="En Route" variant="status" color="primary" size="sm" />;
    case 'arrived':
      return <Chip label="Arrived" variant="status" color="primary" size="sm" />;
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
  onStartJob,
  onMarkComplete,
  onOpenLiveMap,
  isAccepting = false,
  delay = 0,
}) => {
  const accentColor = variant === 'available' ? colors.primary : 
                      variant === 'active' ? '#F59E0B' : colors.borderSubtle;
  
  const serviceColor = getServiceColor(booking.serviceType);

  const hasJobPin =
    typeof booking.jobLatitude === 'number' &&
    typeof booking.jobLongitude === 'number' &&
    Number.isFinite(booking.jobLatitude) &&
    Number.isFinite(booking.jobLongitude);

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)}>
      <PressableScale onPress={onPress} style={styles.cardWrapper}>
        <View style={[styles.card, variant === 'history' && styles.cardMuted]}>
          {/* Left accent bar */}
          <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

          <View style={styles.content}>
            {/* Row 1: Customer info */}
            <View style={styles.customerRow}>
              {booking.customerAvatarUrl ? (
                <Image source={{ uri: booking.customerAvatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={18} color={colors.textMuted} />
                </View>
              )}
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

            {(variant === 'active' || variant === 'history') && onPress && (
              <TouchableOpacity
                style={styles.viewJobCta}
                onPress={onPress}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="View job details"
              >
                <Ionicons name="document-text-outline" size={16} color={colors.primary} />
                <Text style={styles.viewJobCtaText}>View job details</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}

            <View style={styles.detailStack}>
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
              <View style={styles.detailDivider} />
              <Text style={styles.addressInStack} numberOfLines={2}>
                {booking.addressLine1}
              </Text>
              {booking.hasSpecialRequests && booking.specialRequestText && (
                <>
                  <View style={styles.detailDivider} />
                  <View
                    style={
                      booking.specialRequestText.startsWith('Job from quote')
                        ? styles.quoteRowInStack
                        : styles.specialRequestInner
                    }
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={14}
                      color={booking.specialRequestText.startsWith('Job from quote') ? colors.textMuted : '#92400E'}
                    />
                    <Text
                      style={
                        booking.specialRequestText.startsWith('Job from quote')
                          ? styles.quoteOriginText
                          : styles.specialRequestText
                      }
                      numberOfLines={3}
                    >
                      {booking.specialRequestText.startsWith('Job from quote')
                        ? 'Booked from your video quote'
                        : booking.specialRequestText}
                    </Text>
                  </View>
                </>
              )}
            </View>

            {variant === 'active' && hasJobPin && (
              <View style={styles.jobMapSection} pointerEvents="box-none">
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={styles.jobMap}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  pointerEvents="none"
                  initialRegion={{
                    latitude: booking.jobLatitude!,
                    longitude: booking.jobLongitude!,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                >
                  <Marker
                    coordinate={{
                      latitude: booking.jobLatitude!,
                      longitude: booking.jobLongitude!,
                    }}
                    title={booking.addressLine1}
                  />
                </MapView>
                {onOpenLiveMap && (
                  <TouchableOpacity
                    style={styles.liveMapButton}
                    onPress={onOpenLiveMap}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="map" size={16} color="#FFFFFF" />
                    <Text style={styles.liveMapButtonText}>Live map & tracking</Text>
                    <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={styles.priceAndActions}>
              <View style={styles.priceInfo}>
                <Text style={styles.totalPrice}>${booking.totalPrice.toFixed(2)}</Text>
                <Text style={styles.earningsText}>
                  You earn{' '}
                  <Text style={styles.earningsAmount}>${booking.payoutToCleaner.toFixed(2)}</Text>
                </Text>
              </View>

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
                  style={styles.arrivedButton}
                  onPress={onStartTraveling}
                  activeOpacity={0.8}
                >
                  <Ionicons name="navigate" size={16} color="#FFFFFF" />
                  <Text style={styles.arrivedButtonText}>Start Traveling</Text>
                </TouchableOpacity>
              )}

              {variant === 'active' && booking.status === 'on_the_way' && (
                <TouchableOpacity 
                  style={styles.arrivedButton}
                  onPress={onMarkArrived}
                  activeOpacity={0.8}
                >
                  <Text style={styles.arrivedButtonText}>{"I've arrived"}</Text>
                </TouchableOpacity>
              )}

              {variant === 'active' && booking.status === 'arrived' && onStartJob && (
                <TouchableOpacity 
                  style={styles.arrivedButton}
                  onPress={onStartJob}
                  activeOpacity={0.8}
                >
                  <Ionicons name="play" size={16} color="#FFFFFF" />
                  <Text style={styles.arrivedButtonText}>Start Job</Text>
                </TouchableOpacity>
              )}

              {variant === 'active' && booking.status === 'in_progress' && onMarkComplete && (
                <TouchableOpacity 
                  style={styles.completeButton}
                  onPress={onMarkComplete}
                  activeOpacity={0.8}
                >
                  <Text style={styles.completeButtonText}>Mark Complete</Text>
                </TouchableOpacity>
              )}

              {variant === 'history' && (
                <View style={styles.completedInfo}>
                  <View style={styles.completedRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#D97706" />
                    <Text style={styles.completedText}>Completed</Text>
                  </View>
                  <Text style={styles.payoutStatus}>Payout in ~24h</Text>
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
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
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
  viewJobCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.metaBg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  viewJobCtaText: {
    flex: 1,
    fontSize: typography.label.fontSize,
    fontWeight: '700' as const,
    color: colors.primary,
  },

  detailStack: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
    marginVertical: spacing.md,
  },
  addressInStack: {
    fontSize: typography.body.fontSize,
    lineHeight: 20,
    color: colors.textPrimary,
    fontWeight: '500' as const,
  },
  quoteRowInStack: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: spacing.xs,
    gap: spacing.sm,
  },
  specialRequestInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.specialRequestBg,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  // Meta bar
  metaBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.lg,
    rowGap: spacing.sm,
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

  addressText: {
    fontSize: typography.label.fontSize,
    color: colors.textSecondary,
  },
  jobMapSection: {
    borderRadius: radii.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  jobMap: {
    width: '100%',
    height: 120,
  },
  liveMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  liveMapButtonText: {
    flex: 1,
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  specialRequestText: {
    flex: 1,
    fontSize: typography.label.fontSize,
    color: '#92400E',
    lineHeight: 18,
  },
  quoteOriginText: {
    flex: 1,
    fontSize: typography.labelSmall.fontSize,
    color: colors.textMuted,
    lineHeight: 18,
  },
  completeButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: '#10B981',
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  completeButtonText: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  priceAndActions: {
    flexDirection: 'column',
    alignItems: 'stretch',
    width: '100%',
    marginTop: spacing.xs,
  },
  priceInfo: {
    marginBottom: spacing.sm,
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
    width: '100%',
    marginTop: spacing.sm,
    columnGap: spacing.sm,
  },
  declineButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#FBBF24',
    backgroundColor: '#FEF3C7',
  },
  declineButtonText: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    color: '#B45309',
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

  // Primary action button (same shape/color across active states)
  arrivedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignSelf: 'stretch',
  },
  arrivedButtonText: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.textInverse,
  },

  // Completed info
  completedInfo: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  completedText: {
    fontSize: typography.label.fontSize,
    color: '#D97706',
    fontWeight: '500',
  },
  payoutStatus: {
    fontSize: typography.labelSmall.fontSize,
    color: colors.textMuted,
    marginLeft: 20, // Align with text after icon
  },
});

export default JobCard;

