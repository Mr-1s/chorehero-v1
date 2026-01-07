/**
 * MetricCard - Consistent metric display card for cleaner app
 * Used in: Content tab stats, Profile performance metrics
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { cleanerTheme } from '../../utils/theme';
import PressableScale from './PressableScale';

const { colors, typography, spacing, radii, shadows } = cleanerTheme;

interface MetricCardProps {
  value: string | number;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onPress?: () => void;
  delay?: number; // For staggered animation
  style?: ViewStyle;
  compact?: boolean; // Smaller variant for grid layouts
}

const MetricCard: React.FC<MetricCardProps> = ({
  value,
  label,
  icon,
  iconColor = colors.primary,
  onPress,
  delay = 0,
  style,
  compact = false,
}) => {
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 100 }));
    opacity.value = withDelay(delay, withSpring(1));
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const content = (
    <Animated.View style={[styles.container, compact && styles.containerCompact, style, animatedStyle]}>
      {icon && (
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
          <Ionicons name={icon} size={compact ? 18 : 22} color={iconColor} />
        </View>
      )}
      <Text style={[styles.value, compact && styles.valueCompact]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );

  if (onPress) {
    return (
      <PressableScale onPress={onPress} style={shadows.card}>
        {content}
      </PressableScale>
    );
  }

  return <View style={shadows.card}>{content}</View>;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
    ...shadows.card,
  },
  containerCompact: {
    padding: spacing.md,
    minHeight: 90,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: typography.metricLarge.fontSize,
    fontWeight: typography.metricLarge.fontWeight,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  valueCompact: {
    fontSize: typography.metricMedium.fontSize,
  },
  label: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: typography.labelSmall.fontWeight,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 11,
  },
});

export default MetricCard;

