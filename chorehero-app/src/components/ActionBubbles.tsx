import React from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

type BubbleProps = {
  icon: keyof typeof Ionicons.glyphMap;
  count?: number | string;
  onPress?: () => void;
  isActive?: boolean;
  style?: any;
};

export const Bubble = ({ icon, count, onPress, isActive, style }: BubbleProps) => (
  <Pressable 
    style={[styles.bubbleContainer, style]} 
    onPress={async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress?.();
    }}
  >
    <BlurView intensity={95} style={styles.bubble}>
      <View style={styles.bubbleInner}>
        <Ionicons 
          name={icon} 
          size={28} 
          color={isActive ? "#ef4444" : "#fff"} 
        />
      </View>
    </BlurView>
    {!!count && <Text style={styles.count}>{count}</Text>}
  </Pressable>
);

type BubbleStackProps = {
  likes: number;
  comments: number;
  shares: number;
  isLiked: boolean;
  isSaved: boolean;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onFollow: () => void;
};

export const BubbleStack = ({ 
  likes, 
  comments, 
  shares, 
  isLiked, 
  isSaved,
  onLike, 
  onComment, 
  onShare, 
  onFollow 
}: BubbleStackProps) => (
  <View style={styles.stack}>
    <Bubble 
      icon={isLiked && isSaved ? "heart" : isLiked ? "heart-outline" : "heart-outline"} 
      count={formatCount(likes)} 
      onPress={onLike}
      isActive={isLiked}
      style={isLiked && isSaved ? styles.heartSaved : null}
    />
    <Bubble 
      icon="chatbubble" 
      count={formatCount(comments)} 
      onPress={onComment}
    />
    <Bubble 
      icon="share" 
      count={formatCount(shares)} 
      onPress={onShare}
    />
  </View>
);

const formatCount = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
};

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    right: 16,
    bottom: 200,
    gap: 16,
    zIndex: 20,
  },
  bubbleContainer: {
    alignItems: 'center',
  },
  bubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  bubbleInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  count: {
    position: 'absolute',
    bottom: -22,
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heartSaved: {
    transform: [{ scale: 1.1 }],
  },
}); 