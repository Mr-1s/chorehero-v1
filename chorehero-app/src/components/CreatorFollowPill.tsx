import React, { memo } from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StabilizedText from './StabilizedText';

type CreatorFollowPillProps = {
  avatarUrl?: string;
  username: string;
  serviceTitle: string;
  verified?: boolean;
  isFollowing: boolean;
  onPressProfile?: () => void;
  onToggleFollow?: () => void;
  height: number; // provided by layout for consistency
  maxWidth: number; // provided by layout for consistency
};

function CreatorFollowPillBase(props: CreatorFollowPillProps) {
  const {
    avatarUrl,
    username,
    serviceTitle,
    verified,
    isFollowing,
    onPressProfile,
    onToggleFollow,
    height,
    maxWidth,
  } = props;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPressProfile}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={`Open ${username} profile`}
      style={[styles.wrap, { height, maxWidth }]}
    >
      <View style={styles.avatarContainer}>
        <Image source={{ uri: avatarUrl || 'https://via.placeholder.com/50' }} style={styles.avatar} />
        {verified && (
          <View style={styles.badge}>
            <Ionicons name="checkmark" size={10} color="#FFFFFF" />
          </View>
        )}
      </View>

      <View style={styles.texts}>
        <StabilizedText fontSize={16} numberOfLines={1} style={styles.username}>
          {username}
        </StabilizedText>
        <StabilizedText fontSize={12} numberOfLines={1} style={styles.subtitle}>
          {serviceTitle}
        </StabilizedText>
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onToggleFollow}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={`${isFollowing ? 'Unfollow' : 'Follow'} ${username}`}
        style={[styles.followButton, isFollowing && styles.followActive]}
      >
        <StabilizedText fontSize={13} style={[styles.followText, isFollowing && styles.followTextActive]}>
          {isFollowing ? 'Following' : 'Follow'}
        </StabilizedText>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const CreatorFollowPill = memo(CreatorFollowPillBase);
export default CreatorFollowPill;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFFF2',
    borderRadius: 26,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 10,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#00D4AA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  texts: {
    flex: 1,
    minWidth: 0, // allow truncation
  },
  username: {
    color: '#0A1A2A',
    fontWeight: '800',
  },
  subtitle: {
    color: '#4B5563',
    fontWeight: '600',
    marginTop: 1,
  },
  followButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 18,
    height: 40, // ensure 44 total with hitSlop
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
  },
  followText: {
    color: '#00D4AA',
    fontWeight: '700',
  },
  followActive: {
    backgroundColor: '#00D4AA',
  },
  followTextActive: {
    color: '#FFFFFF',
  },
});


