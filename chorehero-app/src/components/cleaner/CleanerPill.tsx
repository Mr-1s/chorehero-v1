/**
 * CleanerPill - Reusable pill/chip component for cleaner screens
 * 
 * Variants:
 * - filled: Solid primary or accent color, white text
 * - outline: White bg, colored border + text
 * - muted: Light tint background, colored text
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cleanerTheme } from '../../utils/theme';

const { colors, typography, radii, shadows } = cleanerTheme;

export interface CleanerPillProps {
  /** Text content */
  children: string;
  /** Visual variant */
  variant?: 'filled' | 'outline' | 'muted';
  /** Color scheme */
  color?: 'primary' | 'teal' | 'grey' | 'success' | 'error';
  /** Optional icon name (Ionicons) */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Icon position */
  iconPosition?: 'left' | 'right';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Press handler (makes it tappable) */
  onPress?: () => void;
  /** Custom container style */
  style?: ViewStyle;
  /** Custom text style */
  textStyle?: TextStyle;
  /** Disabled state */
  disabled?: boolean;
}

const CleanerPill: React.FC<CleanerPillProps> = ({
  children,
  variant = 'filled',
  color = 'primary',
  icon,
  iconPosition = 'left',
  size = 'md',
  onPress,
  style,
  textStyle,
  disabled = false,
}) => {
  // Get color values based on color prop
  const getColorValues = () => {
    switch (color) {
      case 'primary':
        return {
          main: colors.primary,
          dark: colors.primaryDark,
          light: '#FFF4E4',
          text: colors.primary,
        };
      case 'teal':
        return {
          main: colors.accentTeal,
          dark: '#0EA5A5',
          light: '#E0F7FA',
          text: colors.accentTeal,
        };
      case 'grey':
        return {
          main: '#6B7280',
          dark: '#4B5563',
          light: '#F3F4F6',
          text: '#6B7280',
        };
      case 'success':
        return {
          main: colors.success,
          dark: '#059669',
          light: '#D1FAE5',
          text: colors.success,
        };
      case 'error':
        return {
          main: colors.error,
          dark: '#DC2626',
          light: '#FEE2E2',
          text: colors.error,
        };
      default:
        return {
          main: colors.primary,
          dark: colors.primaryDark,
          light: '#FFF4E4',
          text: colors.primary,
        };
    }
  };

  const colorValues = getColorValues();

  // Get styles based on variant
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'filled':
        return {
          container: {
            backgroundColor: colorValues.main,
            borderWidth: 0,
          },
          text: {
            color: '#FFFFFF',
          },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: '#FFFFFF',
            borderWidth: 1.5,
            borderColor: colorValues.main,
          },
          text: {
            color: colorValues.text,
          },
        };
      case 'muted':
        return {
          container: {
            backgroundColor: colorValues.light,
            borderWidth: 0,
          },
          text: {
            color: colorValues.text,
          },
        };
      default:
        return {
          container: {
            backgroundColor: colorValues.main,
          },
          text: {
            color: '#FFFFFF',
          },
        };
    }
  };

  // Get size styles
  const getSizeStyles = (): { container: ViewStyle; text: TextStyle; iconSize: number } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            paddingHorizontal: 8,
            paddingVertical: 4,
            minHeight: 24,
          },
          text: {
            fontSize: 11,
          },
          iconSize: 12,
        };
      case 'md':
        return {
          container: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            minHeight: 32,
          },
          text: {
            fontSize: 13,
          },
          iconSize: 14,
        };
      case 'lg':
        return {
          container: {
            paddingHorizontal: 16,
            paddingVertical: 10,
            minHeight: 40,
          },
          text: {
            fontSize: 14,
          },
          iconSize: 18,
        };
      default:
        return {
          container: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            minHeight: 32,
          },
          text: {
            fontSize: 13,
          },
          iconSize: 14,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const containerStyle: ViewStyle = {
    ...styles.container,
    ...variantStyles.container,
    ...sizeStyles.container,
    opacity: disabled ? 0.5 : 1,
    ...style,
  };

  const labelStyle: TextStyle = {
    ...styles.text,
    ...variantStyles.text,
    ...sizeStyles.text,
    ...textStyle,
  };

  const iconColor = variantStyles.text.color as string;

  const content = (
    <>
      {icon && iconPosition === 'left' && (
        <Ionicons
          name={icon}
          size={sizeStyles.iconSize}
          color={iconColor}
          style={styles.iconLeft}
        />
      )}
      <Text style={labelStyle}>{children}</Text>
      {icon && iconPosition === 'right' && (
        <Ionicons
          name={icon}
          size={sizeStyles.iconSize}
          color={iconColor}
          style={styles.iconRight}
        />
      )}
    </>
  );

  if (onPress && !disabled) {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={disabled}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{content}</View>;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: 4,
  },
  iconRight: {
    marginLeft: 4,
  },
});

export default CleanerPill;

