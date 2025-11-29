import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ActionBubbleProps {
  icon: keyof typeof Ionicons.glyphMap;
  count?: string | number;
  onPress?: () => void;
  accessibilityLabel?: string;
  isActive?: boolean;
}

const ActionBubble: React.FC<ActionBubbleProps> = ({ 
  icon, 
  count, 
  onPress, 
  accessibilityLabel,
  isActive = false
}) => {
  return (
    <View style={styles.bubbleContainer}>
      <TouchableOpacity 
        style={[
          styles.bubble,
          isActive && styles.activeBubble
        ]}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        activeOpacity={0.8}
      >
        <Ionicons 
          name={icon} 
          size={26} 
          color={isActive ? "#FFFFFF" : "#374151"} 
        />
      </TouchableOpacity>
      {count && (
        <Text style={styles.countLabel}>{count}</Text>
      )}
    </View>
  );
};

interface BubbleStackProps {
  onLikePress?: () => void;
  onBoostPress?: () => void;
  onSharePress?: () => void;
  likeCount?: string | number;
  boostCount?: string | number;
  liked?: boolean;
}

const BubbleStack: React.FC<BubbleStackProps> = ({
  onLikePress,
  onBoostPress,
  onSharePress,
  likeCount,
  boostCount,
  liked = false,
}) => {
  return (
    <View style={styles.stackContainer}>
      <ActionBubble
        icon={liked ? "heart" : "heart-outline"}
        count={likeCount}
        onPress={onLikePress}
        accessibilityLabel="Like"
        isActive={liked}
      />
      <ActionBubble
        icon="chatbubble-outline"
        count={boostCount}
        onPress={onBoostPress}
        accessibilityLabel="Comment"
      />
      <ActionBubble
        icon="share-outline"
        onPress={onSharePress}
        accessibilityLabel="Share"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  stackContainer: {
    alignItems: 'center',
    gap: 20,
  },
  bubbleContainer: {
    alignItems: 'center',
    gap: 4,
  },
  bubble: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  activeBubble: {
    backgroundColor: '#3ad3db',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.1 }],
  },
  countLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.3,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
});

export { ActionBubble, BubbleStack }; 