import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StabilizedText from './StabilizedText';

type BookingBubbleProps = {
  hourlyRate: number;
  rating: number;
  duration: string;
  isSmall?: boolean;
  onToggleInfo?: () => void;
  onBook?: () => void;
  height: number;
  marginHorizontal: number;
};

function BookingBubbleBase(props: BookingBubbleProps) {
  const { hourlyRate, rating, duration, isSmall, onToggleInfo, onBook, height, marginHorizontal } = props;
  const { width } = useWindowDimensions();
  const compact = isSmall || width < 360;
  return (
    <View style={[styles.wrap, { height, marginHorizontal }]}> 
      {/* Price */}
      <View style={styles.priceBlock}>
        <StabilizedText fontSize={compact ? 10 : 12} style={styles.priceLabel} numberOfLines={1}>Starting</StabilizedText>
        <StabilizedText fontSize={compact ? 16 : 20} style={styles.priceValue} numberOfLines={1}>
          {hourlyRate > 0 ? `$${hourlyRate}/${compact ? 'h' : 'hr'}` : 'Contact'}
        </StabilizedText>
      </View>

      {/* Rating Only */}
      <View style={styles.statsBlock}>
        <View style={styles.statItem}>
          <Ionicons name="star" size={compact ? 16 : 18} color="#FFA500"/>
          <StabilizedText fontSize={compact ? 15 : 17} style={styles.statText} numberOfLines={1}>
            {rating > 0 ? rating : 'New'}
          </StabilizedText>
        </View>
      </View>

      <View style={styles.ctaBlock}>
        <TouchableOpacity
          onPress={onToggleInfo}
          activeOpacity={0.85}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Show service details"
          style={[styles.infoButton, { width: isSmall ? 32 : 40, height: isSmall ? 32 : 40, borderRadius: isSmall ? 16 : 20 }]}
        >
          <Ionicons name="information-outline" size={isSmall ? 16 : 18} color="#6B7280"/>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onBook}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Book now"
          style={[
            styles.bookButton,
            {
              height: compact ? 36 : 44,
              borderRadius: compact ? 18 : 20,
              paddingHorizontal: compact ? 10 : 12,
              minWidth: compact ? 112 : 130,
            },
          ]}
        > 
          <Ionicons name="calendar" size={compact ? 14 : 16} color="#FFFFFF"/>
          <StabilizedText fontSize={compact ? 14 : 16} style={styles.bookText}>Book Now</StabilizedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const BookingBubble = memo(BookingBubbleBase);
export default BookingBubble;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(58, 211, 219, 0.3)',
    width: '100%',
    // Enhanced depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  priceBlock: {
    flexShrink: 0,
  },
  priceLabel: {
    color: '#6B7280',
    fontWeight: '600',
  },
  priceValue: {
    color: '#1F2937',
    fontWeight: '800',
  },
  statsBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    color: '#374151',
    fontWeight: '700',
  },
  ctaBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  infoButton: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  bookButton: {
    backgroundColor: '#3AD3DB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    shadowColor: '#3AD3DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});


