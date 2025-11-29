/**
 * PressableScale - Reusable animated press wrapper
 * Scales to 0.97 on press with reduced shadow
 */

import React, { useCallback } from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  scaleValue?: number;
}

const springConfig = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

const PressableScale: React.FC<PressableScaleProps> = ({
  children,
  onPress,
  onLongPress,
  style,
  disabled = false,
  scaleValue = 0.97,
}) => {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, scaleValue]);
    const shadowOpacity = interpolate(pressed.value, [0, 1], [0.08, 0.03]);
    
    return {
      transform: [{ scale }],
      shadowOpacity,
    };
  });

  const handlePressIn = useCallback(() => {
    pressed.value = withSpring(1, springConfig);
  }, []);

  const handlePressOut = useCallback(() => {
    pressed.value = withSpring(0, springConfig);
  }, []);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export default PressableScale;

