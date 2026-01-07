import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../utils/constants';

type PillBadgeProps = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: 'filled' | 'outline';
  backgroundColor?: string;
  textColor?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

const PillBadge: React.FC<PillBadgeProps> = ({
  label,
  icon,
  variant = 'filled',
  backgroundColor = COLORS.primary,
  textColor,
  style,
  textStyle,
}) => {
  const isFilled = variant === 'filled';
  const effectiveBg = isFilled ? backgroundColor : 'transparent';
  const effectiveText = textColor || (isFilled ? (backgroundColor.includes('rgba') ? COLORS.text.primary : '#FFFFFF') : COLORS.text.primary);
  const effectiveBorder = isFilled ? 'rgba(229, 231, 235, 1)' : '#E5E7EB';

  return (
    <View style={[styles.container, { backgroundColor: effectiveBg, borderColor: effectiveBorder }, style]}> 
      {icon ? <Ionicons name={icon as any} size={12} color={effectiveText} style={styles.icon} /> : null}
      <Text numberOfLines={1} style={[styles.text, { color: effectiveText }, textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PillBadge;


