import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { Txt } from './Typography';

type Variant = 'neutral' | 'brand' | 'success' | 'warning' | 'info' | 'accent';

interface Props {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: Variant;
}

const palette: Record<Variant, { bg: string; fg: string }> = {
  neutral: { bg: COLORS.surfaceAlt, fg: COLORS.text.secondary },
  brand: { bg: COLORS.primarySoft, fg: COLORS.primaryDark },
  success: { bg: '#ECFDF5', fg: '#047857' },
  warning: { bg: '#FEF3C7', fg: '#92400E' },
  info: { bg: '#DBEAFE', fg: '#1D4ED8' },
  accent: { bg: COLORS.accentSoft, fg: '#92400E' },
};

export const Chip: React.FC<Props> = ({ label, icon, variant = 'neutral' }) => {
  const { bg, fg } = palette[variant];
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} style={{ marginRight: 4 }} /> : null}
      <Txt variant="caption" style={{ color: fg }}>{label}</Txt>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
});
