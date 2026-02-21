/**
 * Responsive sizing utilities
 * Use these instead of fixed pixel values for cross-device consistency.
 * Implemented with React Native's Dimensions/PixelRatio to avoid package import issues.
 */

import { Dimensions, PixelRatio } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Converts width percentage to dp (e.g. wp('4%') = 4% of screen width).
 */
export const wp = (widthPercent: string | number): number => {
  const value = typeof widthPercent === 'number' ? widthPercent : parseFloat(String(widthPercent));
  return PixelRatio.roundToNearestPixel((screenWidth * value) / 100);
};

/**
 * Converts height percentage to dp (e.g. hp('2%') = 2% of screen height).
 */
export const hp = (heightPercent: string | number): number => {
  const value = typeof heightPercent === 'number' ? heightPercent : parseFloat(String(heightPercent));
  return PixelRatio.roundToNearestPixel((screenHeight * value) / 100);
};

export const responsive = {
  wp,
  hp,
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
