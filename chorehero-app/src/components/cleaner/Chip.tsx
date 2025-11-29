/**
 * Chip - Unified chip/pill component for cleaner app
 * 
 * Variants:
 * - filled: Solid background (orange when active)
 * - outline: Border only
 * - muted: Light background
 * - status: For job status badges
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cleanerTheme } from '../../utils/theme';
import PressableScale from './PressableScale';

const { colors, typography, spacing, radii } = cleanerTheme;

type ChipVariant = 'filled' | 'outline' | 'muted' | 'status';
type ChipColor = 'primary' | 'success' | 'error' | 'grey' | 'teal';

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  color?: ChipColor;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  size?: 'sm' | 'md';
  isActive?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const getColorPalette = (color: ChipColor, isActive: boolean) => {
  switch (color) {
    case 'primary':
      return {
        bg: isActive ? colors.primary : colors.cardBg,
        border: isActive ? colors.primary : colors.primaryBorder,
        text: isActive ? colors.textInverse : colors.primary,
      };
    case 'success':
      return {
        bg: isActive ? colors.success : colors.successLight,
        border: colors.success,
        text: isActive ? colors.textInverse : colors.success,
      };
    case 'error':
      return {
        bg: isActive ? colors.error : colors.errorLight,
        border: colors.errorBorder,
        text: isActive ? colors.textInverse : colors.error,
      };
    case 'teal':
      return {
        bg: isActive ? colors.accentTeal : '#E0F7FA',
        border: colors.accentTeal,
        text: isActive ? colors.textInverse : colors.accentTeal,
      };
    case 'grey':
    default:
      return {
        bg: colors.metaBg,
        border: colors.borderSubtle,
        text: colors.textSecondary,
      };
  }
};

const Chip: React.FC<ChipProps> = ({
  label,
  variant = 'filled',
  color = 'primary',
  icon,
  iconPosition = 'left',
  size = 'md',
  isActive = false,
  onPress,
  style,
  textStyle,
}) => {
  const palette = getColorPalette(color, isActive || variant === 'filled');
  
  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: size === 'sm' ? 24 : 28,
    paddingHorizontal: size === 'sm' ? 8 : 12,
    borderRadius: radii.pill,
    gap: 4,
  };

  switch (variant) {
    case 'filled':
      containerStyle.backgroundColor = palette.bg;
      break;
    case 'outline':
      containerStyle.backgroundColor = isActive ? palette.bg : colors.cardBg;
      containerStyle.borderWidth = 1;
      containerStyle.borderColor = palette.border;
      break;
    case 'muted':
      containerStyle.backgroundColor = color === 'primary' ? colors.primaryLight : colors.metaBg;
      break;
    case 'status':
      containerStyle.backgroundColor = palette.bg;
      containerStyle.paddingHorizontal = size === 'sm' ? 6 : 10;
      break;
  }

  const textColor = variant === 'outline' && !isActive ? palette.border : palette.text;
  const iconColor = textColor;

  const content = (
    <View style={[containerStyle, style]}>
      {icon && iconPosition === 'left' && (
        <Ionicons name={icon} size={size === 'sm' ? 12 : 14} color={iconColor} />
      )}
      <Text
        style={[
          styles.text,
          size === 'sm' && styles.textSmall,
          { color: textColor },
          textStyle,
        ]}
      >
        {label}
      </Text>
      {icon && iconPosition === 'right' && (
        <Ionicons name={icon} size={size === 'sm' ? 12 : 14} color={iconColor} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <PressableScale onPress={onPress} scaleValue={0.95}>
        {content}
      </PressableScale>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  text: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    lineHeight: typography.label.lineHeight,
  },
  textSmall: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: typography.labelSmall.fontWeight,
  },
});

export default Chip;

