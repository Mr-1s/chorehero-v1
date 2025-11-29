/**
 * CleanerStatTile - Metric display component for cleaner screens
 * 
 * Used for displaying stats like:
 * - "3x More Views"
 * - "$125.50 Today"
 * - "4.8 Rating"
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cleanerTheme } from '../../utils/theme';

const { colors, typography, radii, shadows } = cleanerTheme;

export interface CleanerStatTileProps {
  /** Icon name (Ionicons) */
  icon: keyof typeof Ionicons.glyphMap;
  /** Main value (e.g., "3x", "$125.50", "4.8") */
  value: string | number;
  /** Label below value (e.g., "More Views", "Today", "Rating") */
  label: string;
  /** Icon/accent color */
  color?: string;
  /** Custom container style */
  style?: ViewStyle;
  /** Animate on mount */
  animateIn?: boolean;
  /** Animation delay in ms */
  animationDelay?: number;
}

const CleanerStatTile: React.FC<CleanerStatTileProps> = ({
  icon,
  value,
  label,
  color = colors.primary,
  style,
  animateIn = false,
  animationDelay = 0,
}) => {
  const fadeAnim = useRef(new Animated.Value(animateIn ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(animateIn ? 20 : 0)).current;

  useEffect(() => {
    if (animateIn) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          delay: animationDelay,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          delay: animationDelay,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [animateIn, animationDelay]);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Icon Circle */}
      <View style={[styles.iconCircle, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>

      {/* Value */}
      <Text style={styles.value}>{value}</Text>

      {/* Label */}
      <Text style={styles.label}>{label}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.soft,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default CleanerStatTile;

