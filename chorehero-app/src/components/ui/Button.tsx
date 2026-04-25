import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, TouchableOpacityProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { Txt } from './Typography';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'accent';
type Size = 'sm' | 'md' | 'lg';

interface Props extends TouchableOpacityProps {
  label: string;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  fullWidth?: boolean;
}

const sizes: Record<Size, { h: number; px: number; font: number }> = {
  sm: { h: 36, px: 12, font: 13 },
  md: { h: 44, px: 16, font: 14 },
  lg: { h: 52, px: 20, font: 15 },
};

export const Button: React.FC<Props> = ({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  fullWidth,
  disabled,
  style,
  ...rest
}) => {
  const s = sizes[size];
  const palette = {
    primary: { bg: COLORS.primary, fg: '#fff', border: COLORS.primary },
    secondary: { bg: 'transparent', fg: COLORS.primary, border: COLORS.primary },
    ghost: { bg: 'transparent', fg: COLORS.primary, border: 'transparent' },
    destructive: { bg: COLORS.error, fg: '#fff', border: COLORS.error },
    accent: { bg: COLORS.accent, fg: COLORS.text.primary, border: COLORS.accent },
  }[variant];

  return (
    <TouchableOpacity
      {...rest}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        styles.btn,
        {
          height: s.h,
          paddingHorizontal: s.px,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          opacity: disabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" />
      ) : (
        <View style={styles.inner}>
          {icon ? <Ionicons name={icon} size={s.font + 2} color={palette.fg} style={{ marginRight: 6 }} /> : null}
          <Txt numberOfLines={1} style={{ fontSize: s.font, fontWeight: '600', color: palette.fg }}>
            {label}
          </Txt>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
