import type { EdgeInsets } from 'react-native-safe-area-context';

/** Inner tab row height (icons + labels), excluding safe-area padding inside the bar. */
export const MAIN_TAB_BAR_INNER_HEIGHT = 58;

/** Minimum bottom padding inside the chrome (matches FloatingNavigation / CleanerFloatingNavigation). */
export const MAIN_TAB_BAR_BOTTOM_INSET_MIN = 26;

/**
 * Total height of the hoisted floating tab bar from the bottom of the screen,
 * including safe-area padding inside the bar.
 */
export function getMainTabBarChromeHeight(bottomInset: number): number {
  return MAIN_TAB_BAR_INNER_HEIGHT + Math.max(bottomInset, MAIN_TAB_BAR_BOTTOM_INSET_MIN);
}

/** Optional: pass full insets when you only have the object. */
export function getMainTabBarChromeHeightFromInsets(insets: EdgeInsets): number {
  return getMainTabBarChromeHeight(insets.bottom);
}
