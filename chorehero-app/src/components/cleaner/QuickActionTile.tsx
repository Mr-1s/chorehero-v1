/**
 * QuickActionTile - Compact vertical tile for quick actions
 * Used in Profile tab for navigation shortcuts
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Match customer quick action sizing
const TILE_WIDTH = (SCREEN_WIDTH - 56) / 2;
import { cleanerTheme } from '../../utils/theme';
import PressableScale from './PressableScale';

const { colors, typography, spacing, radii, shadows } = cleanerTheme;

interface QuickActionTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  gradientColors?: readonly [string, string];
  iconColor?: string;
  labelColor?: string;
  onPress: () => void;
  style?: ViewStyle;
}

const QuickActionTile: React.FC<QuickActionTileProps> = ({
  icon,
  label,
  gradientColors,
  iconColor,
  labelColor,
  onPress,
  style,
}) => {
  const useGradient = !!gradientColors;

  const Container = useGradient ? LinearGradient : View;
  const containerProps = useGradient
    ? {
        colors: gradientColors as [string, string],
        start: { x: 0, y: 0 },
        end: { x: 1, y: 1 },
      }
    : {};

  return (
    <PressableScale 
      onPress={onPress} 
      style={styles.container}
      scaleValue={0.95}
    >
      <Container
        {...containerProps}
        style={[styles.tile, useGradient && styles.tileGradientContainer, style]}
      >
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, useGradient && styles.iconCircleOnGradient]}>
            <Ionicons
              name={icon}
              size={24}
              color={useGradient ? '#FFFFFF' : iconColor || colors.primary}
            />
          </View>
        </View>
        <Text style={[
          styles.label,
          useGradient && styles.labelOnGradient,
          !useGradient && labelColor ? { color: labelColor } : null,
        ]} numberOfLines={2}>
          {label}
        </Text>
      </Container>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  container: {
    width: TILE_WIDTH,
  },
  tile: {
    backgroundColor: colors.cardBg,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  tileGradientContainer: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleOnGradient: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 2,
  },
  labelOnGradient: {
    color: '#FFFFFF',
  },
});

export default QuickActionTile;

