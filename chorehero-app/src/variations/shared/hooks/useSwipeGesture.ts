import { useState, useRef } from 'react';
import { Animated, PanResponder, Dimensions } from 'react-native';

export interface SwipeGestureProps {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

const { width: screenWidth } = Dimensions.get('window');

export const useSwipeGesture = ({ onSwipeLeft, onSwipeRight, threshold = 50 }: SwipeGestureProps) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20;
    },
    onPanResponderGrant: () => {
      Animated.spring(scale, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    },
    onPanResponderMove: (evt, gestureState) => {
      translateX.setValue(gestureState.dx);
      translateY.setValue(gestureState.dy);
      rotation.setValue(gestureState.dx * 0.1);
    },
    onPanResponderRelease: (evt, gestureState) => {
      const { dx, vx } = gestureState;
      
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
      
      if (Math.abs(dx) > threshold || Math.abs(vx) > 0.5) {
        if (dx > 0) {
          // Swipe right
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: screenWidth,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(rotation, {
              toValue: 20,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            if (onSwipeRight) {
              onSwipeRight();
            }
            resetPosition();
          });
        } else {
          // Swipe left
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: -screenWidth,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(rotation, {
              toValue: -20,
              duration: 300,
              useNativeDriver: true,
            }),
          ]).start(() => {
            if (onSwipeLeft) {
              onSwipeLeft();
            }
            resetPosition();
          });
        }
      } else {
        // Return to center
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.spring(rotation, {
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  });

  const resetPosition = () => {
    translateX.setValue(0);
    translateY.setValue(0);
    rotation.setValue(0);
    scale.setValue(1);
  };

  return {
    panResponder,
    translateX,
    translateY,
    scale,
    rotation,
    resetPosition
  };
};