/**
 * CleanerAvatarChip - Avatar + text chip component
 * 
 * Used for displaying user/cleaner pairs like:
 * - "You & Sarah are booked ✨"
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { cleanerTheme } from '../../utils/theme';

const { colors, radii, shadows } = cleanerTheme;

const PLACEHOLDER_AVATAR = 'https://via.placeholder.com/150/FF9A26/FFFFFF?text=CH';

export interface CleanerAvatarChipProps {
  /** Left avatar URL */
  leftAvatar?: string;
  /** Right avatar URL (optional, for dual avatar) */
  rightAvatar?: string;
  /** Emoji to display (optional) */
  emoji?: string;
  /** Text content */
  text: string;
  /** Custom container style */
  style?: ViewStyle;
}

const CleanerAvatarChip: React.FC<CleanerAvatarChipProps> = ({
  leftAvatar,
  rightAvatar,
  emoji,
  text,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Avatar Stack */}
      <View style={styles.avatarStack}>
        <Image
          source={{ uri: leftAvatar || PLACEHOLDER_AVATAR }}
          style={[styles.avatar, styles.avatarLeft]}
        />
        {rightAvatar && (
          <Image
            source={{ uri: rightAvatar || PLACEHOLDER_AVATAR }}
            style={[styles.avatar, styles.avatarRight]}
          />
        )}
      </View>

      {/* Text */}
      <Text style={styles.text}>
        {text}
        {emoji && ` ${emoji}`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    ...shadows.soft,
  },
  avatarStack: {
    flexDirection: 'row',
    marginRight: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bg,
  },
  avatarLeft: {
    zIndex: 2,
  },
  avatarRight: {
    marginLeft: -10,
    zIndex: 1,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

export default CleanerAvatarChip;

