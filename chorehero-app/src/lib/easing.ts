/**
 * Custom easing functions for react-native-reanimated animations
 */

export const easeOutCubic = (t: number): number => {
  'worklet';
  return 1 - Math.pow(1 - t, 3);
};

export const easeOutBack = (t: number, s = 1.70158): number => {
  'worklet';
  const t1 = t - 1;
  return t1 * t1 * ((s + 1) * t1 + s) + 1;
};
