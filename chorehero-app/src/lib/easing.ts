'worklet';

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const easeOutBack = (t: number, s = 1.70158) => {
  t = t - 1;
  return t * t * ((s + 1) * t + s) + 1;
};
