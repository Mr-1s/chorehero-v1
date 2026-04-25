import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCleanerStore, selectTotalUnreadMessages } from '../store/cleanerStore';
import { cleanerTheme } from '../utils/theme';
import { getRoleStackTopRouteName } from '../navigation/mainTabsRouteUtils';

const { width } = Dimensions.get('window');
const BRAND_ORANGE = cleanerTheme.colors.primary;
const { shadows: cleanerNavShadows } = cleanerTheme;
const shouldHideLabels = width < 360;

type CleanerTabParamList = {
  Dashboard: undefined;
  Jobs: undefined;
  Content: undefined;
  Messages: undefined;
  Profile: undefined;
  VideoUpload: undefined;
  Home: undefined;
  JobsScreen: undefined;
  EarningsScreen: undefined;
  ScheduleScreen: undefined;
  NotificationsScreen: undefined;
};

type CleanerFloatingNavigationProps = {
  navigation: BottomTabNavigationProp<CleanerTabParamList, any>;
  currentScreen: keyof CleanerTabParamList;
  unreadCount?: number;
};

const CleanerFloatingNavigation: React.FC<CleanerFloatingNavigationProps> = ({
  navigation,
  currentScreen,
  unreadCount = 0,
}) => {
  const insets = useSafeAreaInsets();
  const availableBookings = useCleanerStore((state) => state.availableBookings);
  const totalUnread = useCleanerStore(selectTotalUnreadMessages);
  const messagesUnread = unreadCount || totalUnread;
  const jobsUnread = availableBookings.length;
  const safeBottomPadding = Math.max(insets.bottom, 26);

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
  const safeNavigate = (name: keyof CleanerTabParamList) => {
    const targetNav = resolveNavigatorFor(name as string) as {
      getState?: () => unknown;
      navigate: (n: string) => void;
    } | null;
    if (!targetNav?.navigate) return;
    if (targetNav.getState) {
      const current = getRoleStackTopRouteName(targetNav.getState() as any, true);
      if (current && String(current) === String(name)) {
        return;
      }
    }
    targetNav.navigate(name as string);
  };

  const getIconName = (screen: keyof CleanerTabParamList, focused: boolean): keyof typeof Ionicons.glyphMap => {
    switch (screen) {
      case 'Dashboard':
        return focused ? 'speedometer' : 'speedometer-outline';
      case 'Jobs':
        return focused ? 'briefcase' : 'briefcase-outline';
      case 'Content':
        return focused ? 'play' : 'play-outline';
      case 'Messages':
        return focused ? 'chatbubbles' : 'chatbubbles-outline';
      case 'Profile':
        return focused ? 'person' : 'person-outline';
      default:
        return 'bulb-outline';
    }
  };

  const renderTab = (
    screen: keyof CleanerTabParamList,
    label: string,
    options?: { badgeCount?: number; showDot?: boolean }
  ) => {
    const isActive = currentScreen === screen;
    const color = isActive ? BRAND_ORANGE : '#64748B';
    const labelColor = isActive ? BRAND_ORANGE : '#64748B';
    return (
      <TouchableOpacity
        key={String(screen)}
        style={styles.tabItem}
        activeOpacity={1}
        onPress={() => safeNavigate(screen)}
      >
        <View
          style={[
            styles.iconPill,
            isActive && styles.iconPillActive,
            isActive && cleanerNavShadows.card,
          ]}
        >
          {isActive ? (
            <LinearGradient
              colors={['rgba(255, 165, 47, 0.22)', 'rgba(255, 120, 40, 0.08)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}
          <Ionicons
            name={getIconName(screen, isActive)}
            size={26}
            color={color}
            style={styles.iconPillIcon}
          />
          {options?.badgeCount != null && options.badgeCount > 0 ? (
            <View style={[styles.badge, styles.pillIconOverlay]}>
              <Text style={styles.badgeText}>{options.badgeCount > 9 ? '9+' : options.badgeCount}</Text>
            </View>
          ) : options?.showDot ? (
            <View style={[styles.dotBadge, styles.pillIconOverlay]} />
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
    <View style={[styles.navigationWrapper, { height: 58 + safeBottomPadding }]} pointerEvents="box-none">
      <View style={styles.navigationContainer} pointerEvents="auto">
        <BlurView
          intensity={0}
          tint="light"
          style={[
            styles.blurContainer,
            styles.blurGlass,
            {
              paddingBottom: safeBottomPadding,
              backgroundColor: '#FFFFFF',
              borderTopWidth: 1,
              borderTopColor: '#F1F5F9',
            },
          ]}
        >
          <View style={styles.navigationContent}>
            {renderTab('Dashboard', 'Dashboard')}
            {renderTab('Content', 'Content')}
            {renderTab('Jobs', 'Jobs', { badgeCount: jobsUnread })}
            {renderTab('Messages', 'Messages', {
              badgeCount: messagesUnread > 0 ? messagesUnread : undefined,
            })}
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
  blurContainer: {
    flex: 1,
  },
  blurGlass: {
    backgroundColor: '#FFFFFF',
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
    overflow: 'hidden',
  },
  iconPillActive: {
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 40, 0.35)',
  },
  iconPillIcon: {
    zIndex: 1,
  },
  pillIconOverlay: {
    zIndex: 2,
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
    backgroundColor: BRAND_ORANGE,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    right: 4,
    top: -2,
    backgroundColor: BRAND_ORANGE,
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

export default CleanerFloatingNavigation;
