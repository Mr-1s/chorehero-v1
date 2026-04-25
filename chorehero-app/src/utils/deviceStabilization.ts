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
const CTA_BAR_HEIGHT = 60;
const NAV_HEIGHT = 90;

export function getVideoFeedLayout(device: DeviceInfo) {
  const creatorPillTop = device.safeAreaTop + (device.isSmall ? 8 : 12);

  // Bottom stack: CTA bar (80px) above nav (90 + safe area)
  const safeBottom = Math.max(device.safeAreaBottom, 26);
  const navHeight = NAV_HEIGHT + safeBottom;
  const ctaBarBottom = navHeight; // CTA sits directly above nav
  const totalBottomOffset = ctaBarBottom + CTA_BAR_HEIGHT; // Space for CTA + nav

  // Place action rail above the CTA bar
  const actionRailBottom = totalBottomOffset + 40;

  return {
    creatorPill: {
      top: creatorPillTop,
      maxWidth: device.width - 140,
      height: device.isSmall ? 48 : 52,
    },
    actionRail: {
      bottom: actionRailBottom,
      right: 16,
      buttonSize: device.isSmall ? 36 : 40,
    },
    ctaBar: {
      height: CTA_BAR_HEIGHT,
      bottom: navHeight,
    },
    bookingSection: {
      bottom: totalBottomOffset,
      height: CTA_BAR_HEIGHT,
      marginHorizontal: device.isTablet ? 20 : device.isSmall ? 1 : 2,
    },
  };
}
