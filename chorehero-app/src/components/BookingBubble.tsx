import React, { memo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
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
  return (
    <View style={[styles.wrap, { height, marginHorizontal }]}> 
      <View style={styles.priceBlock}>
        <StabilizedText fontSize={isSmall ? 10 : 12} style={styles.priceLabel} numberOfLines={1}>Starting</StabilizedText>
        <StabilizedText fontSize={isSmall ? 16 : 20} style={styles.priceValue} numberOfLines={1}>${hourlyRate}/{isSmall ? 'h' : 'hr'}</StabilizedText>
      </View>

      <View style={styles.statsBlock}>
        <View style={styles.statItem}>
          <Ionicons name="star" size={isSmall ? 12 : 14} color="#FFA500"/>
          <StabilizedText fontSize={isSmall ? 10 : 12} style={styles.statText} numberOfLines={1}>{rating}</StabilizedText>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={isSmall ? 12 : 14} color="#6B7280"/>
          <StabilizedText fontSize={isSmall ? 10 : 12} style={styles.statText} numberOfLines={1}>{duration}</StabilizedText>
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
              height: isSmall ? 36 : 44,
              borderRadius: isSmall ? 18 : 20,
              paddingHorizontal: isSmall ? 10 : 12,
              minWidth: isSmall ? 112 : 130,
            },
          ]}
        > 
          <Ionicons name="calendar" size={isSmall ? 14 : 16} color="#FFFFFF"/>
          <StabilizedText fontSize={isSmall ? 14 : 16} style={styles.bookText}>Book Now</StabilizedText>
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
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    width: '100%',
  },
  priceBlock: {
    flexShrink: 1,
    minWidth: 0,
    marginRight: 6,
  },
  priceLabel: {
    color: '#6B7280',
    fontWeight: '600',
  },
  priceValue: {
    color: '#0A1A2A',
    fontWeight: '900',
  },
  statsBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    flex: 1,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  statText: {
    color: '#6B7280',
    fontWeight: '700',
    maxWidth: 80,
  },
  ctaBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  infoButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButton: {
    backgroundColor: '#00D4AA',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    minWidth: 120,
  },
  bookText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});


