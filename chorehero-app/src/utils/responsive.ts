/**
 * Responsive sizing utilities for all devices.
 * Scales across phones (320px–430px), phablets, tablets, foldables.
 * Reads dimensions at call time so rotation/resize updates correctly.
 */

import { Dimensions, PixelRatio } from 'react-native';

const getWindow = () => Dimensions.get('window');

/**
 * Width percentage – scales with any screen width (phones, tablets, foldables).
 */
export const wp = (widthPercent: string | number): number => {
  const { width } = getWindow();
  const value = typeof widthPercent === 'number' ? widthPercent : parseFloat(String(widthPercent));
  return PixelRatio.roundToNearestPixel((width * value) / 100);
};

/**
 * Height percentage – scales with any screen height.
 */
export const hp = (heightPercent: string | number): number => {
  const { height } = getWindow();
  const value = typeof heightPercent === 'number' ? heightPercent : parseFloat(String(heightPercent));
  return PixelRatio.roundToNearestPixel((height * value) / 100);
};

/**
 * Scale from base width (375) – useful for fixed design sizes.
 * Works across 320px phones to 1024px tablets.
 */
export const w = (size: number, baseWidth: number = 375): number => {
  const { width } = getWindow();
  const scale = width / baseWidth;
  return PixelRatio.roundToNearestPixel(size * Math.min(Math.max(scale, 0.8), 2));
};

/**
 * Scale from base height (667) – for vertical sizing.
 */
export const h = (size: number, baseHeight: number = 667): number => {
  const { height } = getWindow();
  const scale = height / baseHeight;
  return PixelRatio.roundToNearestPixel(size * Math.min(Math.max(scale, 0.8), 2));
};

export const responsive = {
  wp,
  hp,
  w,
  h,
  spacing: {
    xs: wp('1%'),
    sm: wp('2.5%'),
    md: wp('5%'),
    lg: wp('7%'),
    xl: wp('10%'),
  },
  fontSize: {
    xs: wp('3%'),
    sm: wp('3.5%'),
    base: wp('4%'),
    lg: wp('4.5%'),
    xl: wp('5.5%'),
    '2xl': wp('6.5%'),
  },
};
