/**
 * MetricCard - Consistent metric display card for cleaner app
 * Used in: Content tab stats, Profile performance metrics
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  gradientColors?: readonly [string, string];
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
  gradientColors,
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

  const useGradient = !!gradientColors;
  const Container = useGradient ? LinearGradient : View;
  const containerProps = useGradient
    ? {
        colors: gradientColors as [string, string],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
      }
    : {};

  const content = (
    <Animated.View style={[styles.container, compact && styles.containerCompact, style, animatedStyle]}>
      <Container
        {...containerProps}
        style={[styles.inner, useGradient && styles.innerGradient]}
      >
        {icon && (
          <View style={[
            styles.iconContainer,
            { backgroundColor: useGradient ? 'transparent' : `${iconColor}15` }
          ]}>
            <Ionicons name={icon} size={24} color={useGradient ? '#FFFFFF' : iconColor} />
          </View>
        )}
        <Text style={[
          styles.value,
          compact && styles.valueCompact,
          useGradient && styles.valueOnGradient
        ]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={[
          styles.label,
          compact && styles.labelCompact,
          useGradient && styles.labelOnGradient
        ]} numberOfLines={1}>
          {label}
        </Text>
      </Container>
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
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
    ...shadows.card,
  },
  containerCompact: {
    minHeight: 90,
  },
  inner: {
    flex: 1,
    width: '100%',
    borderRadius: radii.card,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerGradient: {
    overflow: 'hidden',
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
  valueOnGradient: {
    color: '#FFFFFF',
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
  labelOnGradient: {
    color: 'rgba(255,255,255,0.85)',
  },
});

export default MetricCard;

