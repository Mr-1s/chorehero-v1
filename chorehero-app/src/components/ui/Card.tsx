import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { COLORS, SHADOWS } from '../../utils/constants';

interface Props extends ViewProps {
  padding?: number;
  elevation?: 'none' | 'e1' | 'e2' | 'e3';
}

export const Card: React.FC<Props> = ({ padding = 20, elevation = 'e2', style, children, ...rest }) => {
  const shadow = elevation === 'none' ? null : SHADOWS[elevation];
  return (
    <View {...rest} style={[styles.card, shadow as any, { padding }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
  },
});
