import { useWindowDimensions } from 'react-native';

export const CONTENT_MAX_WIDTH = 680;
const BASE_W = 390;
const BASE_H = 844; // reserved for future vertical scaling

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 360;
  const isTablet = Math.min(width, height) >= 768;
  const scale = (size: number) => (width / BASE_W) * size;
  const mscale = (size: number, factor = 0.5) => size + (scale(size) - size) * factor;
  return { width, height, isSmallPhone, isTablet, mscale };
}




