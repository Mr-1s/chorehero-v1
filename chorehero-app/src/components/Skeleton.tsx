import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SPACING, BORDER_RADIUS } from '../utils/constants';

interface SkeletonBlockProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: any;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ width = '100%', height = 16, radius = BORDER_RADIUS.lg, style }) => {
  return <View style={[styles.block, { width, height, borderRadius: radius }, style]} />;
};

export const SkeletonAvatar: React.FC<{ size?: number; style?: any }> = ({ size = 40, style }) => {
  return <View style={[styles.block, { width: size, height: size, borderRadius: size / 2 }, style]} />;
};

export const SkeletonList: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  return (
    <View style={{ gap: SPACING.md }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ gap: SPACING.sm }}>
          <SkeletonBlock height={14} width="70%" />
          <SkeletonBlock height={12} width="90%" />
          <SkeletonBlock height={12} width="60%" />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
});

export default SkeletonBlock;


