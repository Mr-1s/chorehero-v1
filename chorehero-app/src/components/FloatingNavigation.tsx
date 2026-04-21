import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../context/MessageContext';
import { useAuth } from '../hooks/useAuth';
import { notificationService } from '../services/notificationService';
import { jobQuoteService } from '../services/jobQuoteService';

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
  variant?: 'glass' | 'transparent';
  blurIntensity?: number;
  glassOpacity?: number;
};

const FloatingNavigation: React.FC<FloatingNavigationProps> = ({
  navigation,
  currentScreen,
  variant = 'glass',
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
    console.log('Tab Pressed:', name);
    const targetNav = resolveNavigatorFor(name as string);
    targetNav.navigate(name as any, params);
  };

  useEffect(() => {
    const loadBookingAlerts = async () => {
      if (!user?.id) {
        setHasBookingAlert(false);
        return;
      }
      const notifications = await notificationService.getNotificationsForUser(user.id);
      const hasUnreadBooking = notifications.some(
        note => note.type === 'booking' && !note.read
      );
      setHasBookingAlert(hasUnreadBooking);
    };
    loadBookingAlerts();
  }, [user?.id, unreadCount, currentScreen]);

  useEffect(() => {
    const loadNewQuotesCount = async () => {
      if (!user?.id || !isCustomer) {
        setNewQuotesCount(0);
        return;
      }
      const res = await jobQuoteService.getCustomerQuotes(user.id);
      if (res.success && res.data) setNewQuotesCount(res.data.length);
    };
    loadNewQuotesCount();
  }, [user?.id, isCustomer, currentScreen]);
  const isTransparent = variant === 'transparent';
  /** Dark “chrome” only when the tab bar floats over full-bleed video (transparent). Glass bars are always light. */
  const isDarkSurface = currentScreen === 'Content' && isTransparent;
  const safeBottomPadding = Math.max(insets.bottom, 26);
  const getButtonColor = (screen: keyof TabParamList) => {
    if (currentScreen === screen) {
      return BRAND_TEAL;
    }
    if (isTransparent) {
      return '#FFFFFF';
    }
    return isDarkSurface ? 'rgba(255, 255, 255, 0.6)' : '#444444';
  };

  const getTextStyle = (screen: keyof TabParamList) => {
    if (currentScreen === screen) {
      return isTransparent ? styles.activeButtonTextTransparent : styles.activeButtonText;
    }
    if (isTransparent) {
      return styles.navButtonTextTransparent;
    }
    return isDarkSurface ? styles.navButtonTextDark : styles.navButtonTextLight;
  };

  const getButtonStyle = (screen: keyof TabParamList) => {
    return currentScreen === screen ? styles.activeNavButton : styles.navButton;
  };

  const getIconStyle = (screen: keyof TabParamList) => {
    if (screen === 'Content' && currentScreen === 'Content') {
      return styles.activeContentIcon;
    }
    return styles.iconDefault;
  };

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
    const color = isActive
      ? BRAND_TEAL
      : isTransparent
        ? '#FFFFFF'
        : isDarkSurface
          ? 'rgba(255, 255, 255, 0.65)'
          : '#64748B';
    // Active label: white only on transparent overlay (video); glass/light surfaces use teal (readable on empty feed)
    const labelColor = isActive
      ? isTransparent
        ? '#FFFFFF'
        : BRAND_TEAL
      : isTransparent
        ? '#FFFFFF'
        : isDarkSurface
          ? 'rgba(255, 255, 255, 0.7)'
          : '#64748B';
    return (
      <TouchableOpacity
        key={screen}
        style={[styles.tabItem, options?.flex ? { flex: options.flex } : null]}
        activeOpacity={0.7}
        onPress={options?.onPress ?? (() => safeNavigate(screen))}
      >
        <View style={[styles.iconPill, isActive && styles.iconPillActive]}>
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
            style={[styles.tabLabel, { color: labelColor, fontWeight: isActive ? '700' : '500' }]}
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
      style={[styles.navigationWrapper, { height: 58 + safeBottomPadding }]}
      pointerEvents="box-none"
    >
      <View
        style={[styles.navigationContainer, variant === 'transparent' && styles.navigationContainerTransparent]}
        pointerEvents="auto"
      >
        <BlurView
          intensity={isTransparent ? 0 : isDarkSurface ? blurIntensity : 0}
          tint={isTransparent ? 'default' : isDarkSurface ? 'dark' : 'light'}
          style={[
            styles.blurContainer,
            variant === 'transparent' ? styles.blurTransparent : styles.blurGlass,
            { paddingBottom: safeBottomPadding },
            variant === 'glass'
              ? {
                  backgroundColor: isDarkSurface
                    ? 'rgba(0, 0, 0, 0.85)'
                    : '#FFFFFF',
                  borderTopWidth: 1,
                  borderTopColor: isDarkSurface ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                }
              : null,
          ]}
        >
          <View style={styles.navigationContent}>
            {renderTab('Content', 'Chores', {
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
  blurTransparent: {
    backgroundColor: 'rgba(255, 255, 255, 0)',
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
  iconPillActive: {
    backgroundColor: '#E6FAFB',
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