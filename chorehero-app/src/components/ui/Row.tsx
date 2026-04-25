import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';
import { Txt } from './Typography';

interface Props {
  title: string;
  subtitle?: string;
  avatarUri?: string;
  avatarInitials?: string;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  /** When set, used for the leading icon; defaults to `COLORS.primary` (teal). */
  leadingIconColor?: string;
  /** Background of the small icon “pill”; defaults to `COLORS.primarySoft`. */
  iconLeadBackgroundColor?: string;
  trailing?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
}

export const Row: React.FC<Props> = ({
  title,
  subtitle,
  avatarUri,
  avatarInitials,
  leadingIcon,
  leadingIconColor,
  iconLeadBackgroundColor,
  trailing,
  chevron,
  onPress,
}) => {
  const Wrap: any = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress} activeOpacity={0.7} style={styles.row}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
      ) : avatarInitials ? (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Txt weight="700" style={{ color: COLORS.primaryDark }}>{avatarInitials}</Txt>
        </View>
      ) : leadingIcon ? (
        <View
          style={[
            styles.iconLead,
            iconLeadBackgroundColor ? { backgroundColor: iconLeadBackgroundColor } : null,
          ]}
        >
          <Ionicons
            name={leadingIcon}
            size={18}
            color={leadingIconColor ?? COLORS.primary}
          />
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        <Txt variant="title" numberOfLines={1}>{title}</Txt>
        {subtitle ? (
          <Txt variant="bodySm" tone="secondary" numberOfLines={1} style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>

      {trailing}
      {chevron ? <Ionicons name="chevron-forward" size={16} color={COLORS.text.muted} style={{ marginLeft: 8 }} /> : null}
    </Wrap>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    gap: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLead: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
