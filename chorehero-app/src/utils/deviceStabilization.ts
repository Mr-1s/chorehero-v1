import { Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Base design dimensions (iPhone 14/15 Pro)
const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;

export interface DeviceInfo {
  width: number;
  height: number;
  isSmall: boolean;
  isLarge: boolean;
  isTablet: boolean;
  scale: number;
  fontScale: number;
  safeAreaTop: number;
  safeAreaBottom: number;
}

export function useDeviceStabilization(): DeviceInfo {
  const { width, height, scale, fontScale } = Dimensions.get('window');
  const insets = useSafeAreaInsets();
  
  // Device categorization
  const isSmall = width < 375 || height < 667; // iPhone SE, small Android
  const isLarge = width > 428 || height > 926; // iPhone Pro Max, large Android
  const isTablet = Math.min(width, height) >= 768; // iPad, large tablets
  
  return {
    width,
    height,
    isSmall,
    isLarge,
    isTablet,
    scale,
    fontScale,
    safeAreaTop: insets.top,
    safeAreaBottom: insets.bottom,
  };
}

// Responsive scaling functions
export function responsiveWidth(size: number, device: DeviceInfo): number {
  if (device.isTablet) return Math.min(size * 1.2, 680); // Cap tablet width
  if (device.isSmall) return size * 0.95; // Slightly smaller on small devices
  if (device.isLarge) return size * 1.05; // Slightly larger on large devices
  return size;
}

export function responsiveHeight(size: number, device: DeviceInfo): number {
  const ratio = device.height / BASE_HEIGHT;
  if (device.isSmall) return size * Math.max(ratio, 0.9);
  if (device.isLarge) return size * Math.min(ratio, 1.1);
  return size;
}

export function responsiveFontSize(size: number, device: DeviceInfo): number {
  // Prevent system font scaling from breaking layout
  const baseSize = size / Math.max(device.fontScale, 1);
  if (device.isSmall) return baseSize * 0.95;
  if (device.isTablet) return baseSize * 1.1;
  return baseSize;
}

// Fixed positioning that adapts to safe areas
export function stabilizedPosition(
  position: { top?: number; bottom?: number; left?: number; right?: number },
  device: DeviceInfo
) {
  return {
    top: position.top !== undefined ? position.top + device.safeAreaTop : undefined,
    bottom: position.bottom !== undefined ? position.bottom + device.safeAreaBottom : undefined,
    left: position.left,
    right: position.right,
  };
}

// Video feed specific stabilization
export function getVideoFeedLayout(device: DeviceInfo) {
  const creatorPillTop = device.safeAreaTop + (device.isSmall ? 8 : 12);

  // Normalize bottom overlays relative to screen height and safe area
  const safeBottom = device.safeAreaBottom > 0 ? Math.min(device.safeAreaBottom, 16) : 0;
  const bookingHeight = device.isSmall ? 50 : 60;
  const bookingBottom = Math.round(
    (device.isTablet ? 0.10 : device.isLarge ? 0.12 : 0.13) * device.height
  ) + safeBottom;

  // Place action rail just above the booking section with consistent spacing
  const actionRailBottom = bookingBottom + bookingHeight + (device.isSmall ? 8 : 12);

  // Horizontal padding scales slightly with width and bumps on tablets
  const horizontalPadding = device.isTablet
    ? 24
    : Math.max(16, Math.round(device.width * 0.05));
  
  return {
    creatorPill: {
      top: creatorPillTop,
      maxWidth: device.width - 140,
      height: device.isSmall ? 48 : 52,
    },
    actionRail: {
      bottom: actionRailBottom,
      right: horizontalPadding,
      buttonSize: device.isTablet ? 48 : device.isLarge ? 44 : device.isSmall ? 36 : 40,
    },
    bookingSection: {
      bottom: bookingBottom,
      height: bookingHeight, // Smaller height on small devices
      marginHorizontal: device.isTablet ? 20 : device.isSmall ? 1 : 2,
    },
  };
}
