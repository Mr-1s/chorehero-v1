import React, { useCallback, useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../context/MessageContext';
import { useAuth } from '../hooks/useAuth';
import { notificationService } from '../services/notificationService';
import { jobQuoteService } from '../services/jobQuoteService';
import { getRoleStackTopRouteName } from '../navigation/mainTabsRouteUtils';
import {
  MAIN_TAB_BAR_BOTTOM_INSET_MIN,
  MAIN_TAB_BAR_INNER_HEIGHT,
} from '../navigation/mainTabsChromeLayout';

const { width } = Dimensions.get('window');
const BRAND_TEAL = '#26B7C9';
const shouldHideLabels = width < 360;

type TabParamList = {
  Home: undefined;
  Content: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  CleanerProfile: { cleanerId: string };
};

type FloatingNavigationProps = {
  navigation: BottomTabNavigationProp<TabParamList, any>;
  currentScreen: keyof TabParamList;
  /** `solid` matches cleaner chrome (white bar, no heavy blur). `transparent` floats over full-bleed video. */
  variant?: 'solid' | 'glass' | 'transparent';
  blurIntensity?: number;
  glassOpacity?: number;
};

const ACTIVE_PILL_BG = 'rgba(38, 183, 201, 0.14)';

const FloatingNavigation: React.FC<FloatingNavigationProps> = ({
  navigation,
  currentScreen,
  variant = 'solid',
  blurIntensity = 20,
  glassOpacity = 0.85,
}) => {
  const { unreadCount } = useMessages();
  const { user, isCustomer } = useAuth();
  const [hasBookingAlert, setHasBookingAlert] = useState(false);
  const [newQuotesCount, setNewQuotesCount] = useState(0);
  const insets = useSafeAreaInsets();
  const resolveNavigatorFor = (name: string) => {
    let current: any = navigation;
    while (current) {
      const routeNames = current?.getState?.()?.routeNames || [];
      if (routeNames.includes(name)) {
        return current;
      }
      current = current?.getParent?.();
    }
    return navigation as any;
  };
  const safeNavigate = (name: keyof TabParamList, params?: any) => {
    const targetNav = resolveNavigatorFor(name as string) as {
      getState?: () => unknown;
      navigate: (n: string, p?: any) => void;
    } | null;
    if (!targetNav?.navigate) return;
    if (targetNav.getState) {
      const current = getRoleStackTopRouteName(targetNav.getState() as any, false);
      if (current && String(current) === String(name)) {
        if (params?.scrollToTop) {
          // fall through — re-dispatch for Videos (Content) scroll-to-top
        } else {
          return;
        }
      }
    }
    targetNav.navigate(name as string, params);
  };

  const refreshBookingAlerts = useCallback(async () => {
    if (!user?.id) {
      setHasBookingAlert(false);
      return;
    }
    try {
      const notifications = await notificationService.getNotificationsForUser(user.id);
      const hasUnreadBooking = notifications.some(
        note => note.type === 'booking' && !note.read
      );
      setHasBookingAlert(hasUnreadBooking);
    } catch {
      setHasBookingAlert(false);
    }
  }, [user?.id]);

  const refreshNewQuotesCount = useCallback(async () => {
    if (!user?.id || !isCustomer) {
      setNewQuotesCount(0);
      return;
    }
    try {
      const res = await jobQuoteService.getCustomerQuotes(user.id);
      if (res.success && res.data) setNewQuotesCount(res.data.length);
    } catch {
      // leave previous count; transient failure
    }
  }, [user?.id, isCustomer]);

  useEffect(() => {
    void refreshBookingAlerts();
  }, [refreshBookingAlerts, unreadCount, currentScreen]);

  useEffect(() => {
    void refreshNewQuotesCount();
  }, [refreshNewQuotesCount, currentScreen]);

  // Re-pull badge state every time the host tab regains focus. Pushing
  // NotificationsScreen on the root stack does not change `currentScreen`,
  // so without this the dot stays stale after the user reads notifications.
  useFocusEffect(
    useCallback(() => {
      void refreshBookingAlerts();
      void refreshNewQuotesCount();
      return undefined;
    }, [refreshBookingAlerts, refreshNewQuotesCount])
  );
  const isTransparent = variant === 'transparent';
  /**
   * Video feed tab: fully transparent chrome (no BlurView on Android — expo-blur often renders a dark slab).
   * Other customer tabs use the solid white shell.
   */
  const useTransparentVideoNav = isTransparent;
  const useSolidShell = variant === 'solid' || variant === 'glass';
  const safeBottomPadding = Math.max(insets.bottom, MAIN_TAB_BAR_BOTTOM_INSET_MIN);

  const getIconName = (screen: keyof TabParamList) => {
    const isActive = currentScreen === screen;
    switch (screen) {
      case 'Content':
        return isActive ? 'play' : 'play-outline';
      case 'Discover':
        return isActive ? 'compass' : 'compass-outline';
      case 'Bookings':
        return isActive ? 'calendar' : 'calendar-outline';
      case 'Messages':
        return isActive ? 'chatbubble' : 'chatbubble-outline';
      case 'Profile':
        return isActive ? 'person' : 'person-outline';
      default:
        return 'ellipse';
    }
  };

  const renderTab = (
    screen: keyof TabParamList,
    label: string,
    options?: { badgeCount?: number; showDot?: boolean; onPress?: () => void; flex?: number }
  ) => {
    const isActive = currentScreen === screen;
    const onVideo = useTransparentVideoNav;
    const color = isActive ? BRAND_TEAL : '#64748B';
    const labelColor = isActive ? BRAND_TEAL : '#64748B';
    const pillBg = ACTIVE_PILL_BG;
    return (
      <TouchableOpacity
        key={screen}
        style={[styles.tabItem, options?.flex ? { flex: options.flex } : null]}
        activeOpacity={1}
        onPress={options?.onPress ?? (() => safeNavigate(screen))}
      >
        <View
          style={[
            styles.iconPill,
            isActive && (variant === 'solid' || useTransparentVideoNav) && { backgroundColor: pillBg },
          ]}
        >
          <Ionicons name={getIconName(screen)} size={26} color={color} />
          {options?.badgeCount && options.badgeCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{options.badgeCount > 9 ? '9+' : options.badgeCount}</Text>
            </View>
          ) : options?.showDot ? (
            <View style={styles.dotBadge} />
          ) : null}
        </View>
        {!shouldHideLabels && (
          <Text
            style={[
              styles.tabLabel,
              {
                color: labelColor,
                fontWeight: isActive ? '700' : '500',
                // Subtle lift over full-bleed video without the old white “ghost” treatment.
                textShadowColor: onVideo ? 'rgba(255,255,255,0.5)' : 'transparent',
                textShadowOffset: { width: 0, height: 0.5 },
                textShadowRadius: onVideo ? 3 : 0,
              },
            ]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.1}
          >
            {label}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[styles.navigationWrapper, { height: MAIN_TAB_BAR_INNER_HEIGHT + safeBottomPadding }]}
      pointerEvents="box-none"
    >
      <View
        style={[styles.navigationContainer, variant === 'transparent' && styles.navigationContainerTransparent]}
        pointerEvents="auto"
      >
        {useTransparentVideoNav ? (
          <View style={[styles.blurContainer, styles.transparentVideoNav, { paddingBottom: safeBottomPadding }]}>
            <View style={styles.navigationContent}>
              {renderTab('Content', 'Videos', {
                onPress: () => safeNavigate('Content', { scrollToTop: currentScreen === 'Content' }),
              })}
              {renderTab('Discover', 'Discover')}
              {renderTab('Bookings', 'Bookings', {
                badgeCount: newQuotesCount,
                showDot: hasBookingAlert && newQuotesCount === 0,
                flex: 1.05,
              })}
              {renderTab('Messages', 'Messages', { badgeCount: unreadCount })}
              {renderTab('Profile', 'Profile')}
            </View>
          </View>
        ) : (
          <BlurView
            intensity={useSolidShell && !isTransparent ? 0 : blurIntensity}
            tint="light"
            style={[
              styles.blurContainer,
              styles.blurGlass,
              { paddingBottom: safeBottomPadding },
              useSolidShell && !isTransparent
                ? {
                    backgroundColor: '#FFFFFF',
                    borderTopWidth: 1,
                    borderTopColor: '#F1F5F9',
                  }
                : null,
            ]}
          >
            <View style={styles.navigationContent}>
              {renderTab('Content', 'Videos', {
                onPress: () => safeNavigate('Content', { scrollToTop: currentScreen === 'Content' }),
              })}
              {renderTab('Discover', 'Discover')}
              {renderTab('Bookings', 'Bookings', {
                badgeCount: newQuotesCount,
                showDot: hasBookingAlert && newQuotesCount === 0,
                flex: 1.05,
              })}
              {renderTab('Messages', 'Messages', { badgeCount: unreadCount })}
              {renderTab('Profile', 'Profile')}
            </View>
          </BlurView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navigationWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 10,
  },
  navigationContainer: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 10,
    overflow: 'hidden',
  },
  navigationContainerTransparent: {
    borderWidth: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    backgroundColor: 'transparent',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: 'visible',
  },
  blurContainer: {
    flex: 1,
  },
  blurGlass: {
    backgroundColor: '#FFFFFF',
  },
  /** Full transparency over video — avoids Android BlurView dark fallback. */
  transparentVideoNav: {
    backgroundColor: 'transparent',
  },
  navigationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    minHeight: 48,
  },
  iconPill: {
    width: 60,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 3,
    letterSpacing: -0.1,
    includeFontPadding: false,
  },
  dotBadge: {
    position: 'absolute',
    right: 10,
    top: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND_TEAL,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    right: 4,
    top: -2,
    backgroundColor: BRAND_TEAL,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default FloatingNavigation; 