/**
 * CleanerJobCard - Job opportunity card for cleaner screens
 * 
 * Displays job details with:
 * - Customer info (avatar, name, rating, job count)
 * - Service type pill
 * - Date/time, duration, distance pills
 * - Payment info with cleaner earnings
 * - Accept/Decline actions
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cleanerTheme } from '../../utils/theme';
import CleanerPill from './CleanerPill';

const { colors, typography, radii, shadows } = cleanerTheme;

export interface CleanerJobCardProps {
  /** Unique job ID */
  id: string;
  /** Customer information */
  customer: {
    name: string;
    avatar?: string;
    rating: number;
    jobCount: number;
  };
  /** Service details */
  service: {
    type: 'express' | 'standard' | 'deep';
    title: string;
    addOns?: string[];
  };
  /** Schedule details */
  schedule: {
    date: string;
    time: string;
    duration: number; // in minutes
  };
  /** Location details */
  location: {
    address: string;
    distance: number; // in miles
  };
  /** Payment details */
  payment: {
    total: number;
    cleanerEarnings: number;
    tip?: number;
  };
  /** Job status */
  status: 'available' | 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  /** Is instant book job */
  isInstant?: boolean;
  /** Special requests from customer */
  specialRequests?: string;
  /** Accept job callback */
  onAccept?: (id: string) => void;
  /** Decline job callback */
  onDecline?: (id: string) => void;
  /** Card press callback */
  onPress?: (id: string) => void;
  /** Is currently accepting (loading state) */
  isAccepting?: boolean;
  /** Animate card on mount */
  animateIn?: boolean;
  /** Animation delay */
  animationDelay?: number;
}

const PLACEHOLDER_AVATAR = 'https://via.placeholder.com/60/E5E7EB/6B7280?text=?';

const CleanerJobCard: React.FC<CleanerJobCardProps> = ({
  id,
  customer,
  service,
  schedule,
  location,
  payment,
  status,
  isInstant = false,
  specialRequests,
  onAccept,
  onDecline,
  onPress,
  isAccepting = false,
  animateIn = false,
  animationDelay = 0,
}) => {
  const fadeAnim = useRef(new Animated.Value(animateIn ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(animateIn ? 30 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animateIn) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          delay: animationDelay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          delay: animationDelay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [animateIn, animationDelay]);

  // Pulse glow animation for available jobs
  useEffect(() => {
    if (status === 'available') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, [status]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const getServiceTypeColor = () => {
    switch (service.type) {
      case 'express':
        return '#3B82F6';
      case 'standard':
        return colors.primary;
      case 'deep':
        return '#8B5CF6';
      default:
        return colors.primary;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'available':
        return colors.success;
      case 'confirmed':
        return colors.primary;
      case 'in_progress':
        return colors.accentTeal;
      case 'completed':
        return '#6B7280';
      case 'cancelled':
        return colors.error;
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'confirmed':
        return 'Confirmed';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 154, 38, 0.3)', 'rgba(255, 154, 38, 0.6)'],
  });

  const shadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.35],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
          borderColor: status === 'available' ? borderColor : 'rgba(255, 154, 38, 0.2)',
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => onPress?.(id)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onPress}
      >
        {/* Header: Customer Info + Badges */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image
              source={{ uri: customer.avatar || PLACEHOLDER_AVATAR }}
              style={styles.avatar}
            />
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{customer.name}</Text>
              <View style={styles.customerStats}>
                <View style={styles.statItem}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text style={styles.statText}>{customer.rating.toFixed(1)}</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="briefcase-outline" size={12} color="#6B7280" />
                  <Text style={styles.statText}>{customer.jobCount} jobs</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.headerRight}>
            {isInstant && (
              <View style={styles.instantBadge}>
                <Ionicons name="flash" size={12} color="#FFFFFF" />
                <Text style={styles.instantText}>Instant</Text>
              </View>
            )}
          </View>
        </View>

        {/* Service Info */}
        <View style={styles.serviceSection}>
          <View style={styles.pillRow}>
            <CleanerPill
              variant="muted"
              color="primary"
              size="sm"
            >
              {service.title}
            </CleanerPill>
            <CleanerPill
              variant="filled"
              color={status === 'available' ? 'success' : 'grey'}
              size="sm"
            >
              {getStatusLabel()}
            </CleanerPill>
          </View>

          {service.addOns && service.addOns.length > 0 && (
            <View style={styles.addOnsRow}>
              <Text style={styles.addOnsLabel}>Add-ons:</Text>
              <Text style={styles.addOnsText}>{service.addOns.join(', ')}</Text>
            </View>
          )}
        </View>

        {/* Schedule & Location Pills */}
        <View style={styles.detailsRow}>
          <CleanerPill variant="outline" color="grey" size="sm" icon="calendar-outline">
            {`${schedule.date} at ${schedule.time}`}
          </CleanerPill>
          <CleanerPill variant="outline" color="grey" size="sm" icon="time-outline">
            {`${schedule.duration} min`}
          </CleanerPill>
          <CleanerPill variant="outline" color="grey" size="sm" icon="location-outline">
            {`${location.distance} mi`}
          </CleanerPill>
        </View>

        {/* Address */}
        <View style={styles.addressRow}>
          <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="tail">
            {location.address}
          </Text>
        </View>

        {/* Special Requests */}
        {specialRequests && (
          <View style={styles.specialRequestsBox}>
            <View style={styles.specialRequestsHeader}>
              <Ionicons name="chatbubble-outline" size={14} color="#92400E" />
              <Text style={styles.specialRequestsLabel}>Special Requests</Text>
            </View>
            <Text style={styles.specialRequestsText}>{specialRequests}</Text>
          </View>
        )}

        {/* Payment & Actions */}
        <View style={styles.footer}>
          <View style={styles.paymentSection}>
            <Text style={styles.totalAmount}>${payment.total.toFixed(2)}</Text>
            <View style={styles.earningsRow}>
              <Ionicons name="wallet-outline" size={14} color={colors.primary} />
              <Text style={styles.earningsAmount}>
                You earn: ${payment.cleanerEarnings.toFixed(2)}
              </Text>
            </View>
            {payment.tip && payment.tip > 0 && (
              <Text style={styles.tipAmount}>+ ${payment.tip.toFixed(2)} tip</Text>
            )}
          </View>

          {/* Actions for Available Jobs */}
          {status === 'available' && (onAccept || onDecline) && (
            <View style={styles.actionsRow}>
              {onDecline && (
                <TouchableOpacity
                  style={styles.declineButton}
                  onPress={() => onDecline(id)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close" size={18} color={colors.error} />
                </TouchableOpacity>
              )}
              {onAccept && (
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => onAccept(id)}
                  activeOpacity={0.8}
                  disabled={isAccepting}
                >
                  {isAccepting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      <Text style={styles.acceptText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    ...shadows.soft,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  customerStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  instantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  instantText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  serviceSection: {
    marginBottom: 12,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  addOnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addOnsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: 6,
  },
  addOnsText: {
    fontSize: 12,
    color: colors.textPrimary,
    flex: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  addressRow: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  addressText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  specialRequestsBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  specialRequestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  specialRequestsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginLeft: 6,
  },
  specialRequestsText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  paymentSection: {
    flex: 1,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  earningsAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  tipAmount: {
    fontSize: 12,
    color: colors.success,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  declineButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 20,
    gap: 6,
    ...shadows.soft,
  },
  acceptText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CleanerJobCard;

