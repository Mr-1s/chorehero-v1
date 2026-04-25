import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigationState } from '@react-navigation/native';
import { useMainTabsInterfaceRole } from './mainTabsInterfaceRole';
import FloatingNavigation from '../components/FloatingNavigation';
import CleanerFloatingNavigation from '../components/CleanerFloatingNavigation';
import {
  getRoleStackTopRouteName,
  isFloatingTabBarVisible,
  wrapNavigationForNestedMainTabs,
} from './mainTabsRouteUtils';

export type MainTabsChromeProps = {
  /** Navigation for the `MainTabs` root screen — can target nested role stack routes (Content, Jobs, …). */
  roleStackNavigation: unknown;
};

/**
 * Single floating tab bar for the main app shell. Rendered above the role stack in
 * `MainTabsScreen` so it does not unmount/remount on screen changes (no flicker).
 */
const MainTabsChrome: React.FC<MainTabsChromeProps> = ({ roleStackNavigation }) => {
  const { interfaceIsCleaner } = useMainTabsInterfaceRole();
  const navState = useNavigationState((s) => s);
  const show = isFloatingTabBarVisible(navState, interfaceIsCleaner);
  const current = (getRoleStackTopRouteName(navState, interfaceIsCleaner) ??
    (interfaceIsCleaner ? 'Dashboard' : 'Content')) as any;
  const navigation = useMemo(
    () => wrapNavigationForNestedMainTabs(roleStackNavigation as any),
    [roleStackNavigation]
  );

  if (!show) return null;

  /** Frosted / see-through bar on the video feed tab; solid white on other customer tabs. */
  const customerBarVariant: 'transparent' | 'solid' = current === 'Content' ? 'transparent' : 'solid';

  return (
    <View style={styles.layer} pointerEvents="box-none">
      {interfaceIsCleaner ? (
        <CleanerFloatingNavigation navigation={navigation} currentScreen={current as any} />
      ) : (
        <FloatingNavigation
          navigation={navigation}
          currentScreen={current}
          variant={customerBarVariant}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
  },
});

export default MainTabsChrome;
