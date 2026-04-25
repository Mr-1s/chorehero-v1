import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/constants';

type Variant = 'display' | 'h1' | 'h2' | 'title' | 'body' | 'bodySm' | 'caption' | 'label';
type Tone = 'primary' | 'secondary' | 'muted' | 'inverse' | 'accent' | 'brand';

interface Props extends TextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: '400' | '500' | '600' | '700' | '800';
}

const variants: Record<Variant, { fontSize: number; lineHeight: number; letterSpacing?: number; fontWeight?: any }> = {
  display: { fontSize: 32, lineHeight: 38, letterSpacing: -0.5, fontWeight: '700' },
  h1: { fontSize: 24, lineHeight: 30, letterSpacing: -0.3, fontWeight: '700' },
  h2: { fontSize: 20, lineHeight: 26, letterSpacing: -0.2, fontWeight: '600' },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodySm: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  label: { fontSize: 11, lineHeight: 14, letterSpacing: 0.6, fontWeight: '700' },
};

const tones: Record<Tone, string> = {
  primary: COLORS.text.primary,
  secondary: COLORS.text.secondary,
  muted: COLORS.text.muted,
  inverse: COLORS.text.inverse,
  accent: COLORS.accent,
  brand: COLORS.primary,
};

export const Txt: React.FC<Props> = ({ variant = 'body', tone = 'primary', weight, style, children, ...rest }) => {
  const v = variants[variant];
  return (
    <Text {...rest} style={[v, { color: tones[tone] }, weight ? { fontWeight: weight } : null, style]}>
      {children}
    </Text>
  );
};
