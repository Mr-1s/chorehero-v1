import { useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { HAPTIC_PATTERNS } from '../utils/constants';

type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

export const useHaptic = () => {
  const triggerHaptic = useCallback((type: HapticType) => {
    try {
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'selection':
          Haptics.selectionAsync();
          break;
        default:
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  }, []);

  const triggerCustomPattern = useCallback((pattern: Haptics.ImpactFeedbackStyle[]) => {
    try {
      pattern.forEach((feedback, index) => {
        setTimeout(() => {
          Haptics.impactAsync(feedback);
        }, index * 100);
      });
    } catch (error) {
      console.warn('Custom haptic pattern failed:', error);
    }
  }, []);

  const triggerCelebration = useCallback(() => {
    try {
      // Success notification followed by light impacts
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 100);
      
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, 200);
      
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 300);
    } catch (error) {
      console.warn('Celebration haptic failed:', error);
    }
  }, []);

  const triggerSpeedBooking = useCallback(() => {
    try {
      // Quick succession of light impacts for speed booking
      [0, 50, 100, 150].forEach((delay) => {
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }, delay);
      });
      
      // Final success notification
      setTimeout(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 200);
    } catch (error) {
      console.warn('Speed booking haptic failed:', error);
    }
  }, []);

  return {
    triggerHaptic,
    triggerCustomPattern,
    triggerCelebration,
    triggerSpeedBooking,
  };
}; 