/**
 * QuickActionTile - Compact vertical tile for quick actions
 * Used in Profile tab for navigation shortcuts
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { cleanerTheme } from '../../utils/theme';
import PressableScale from './PressableScale';

const { colors, typography, spacing, radii, shadows } = cleanerTheme;

interface QuickActionTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}

const QuickActionTile: React.FC<QuickActionTileProps> = ({
  icon,
  label,
  onPress,
  style,
}) => {
  const glowOpacity = useSharedValue(0);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handlePressIn = () => {
    glowOpacity.value = withSpring(1, { damping: 15 });
  };

  const handlePressOut = () => {
    glowOpacity.value = withSpring(0, { damping: 15 });
  };

  return (
    <PressableScale 
      onPress={onPress} 
      style={[styles.container, style]}
      scaleValue={0.95}
    >
      <View style={styles.tile}>
        <View style={styles.iconContainer}>
          {/* Orange glow on press */}
          <Animated.View style={[styles.iconGlow, glowStyle]} />
          <View style={styles.iconCircle}>
            <Ionicons name={icon} size={22} color={colors.primary} />
          </View>
        </View>
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '50%',
  },
  tile: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    ...shadows.soft,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: spacing.sm,
  },
  iconGlow: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    top: -4,
    left: -4,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: typography.label.fontWeight,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default QuickActionTile;

