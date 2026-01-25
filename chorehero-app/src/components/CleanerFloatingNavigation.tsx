import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCleanerStore, selectTotalUnreadMessages } from '../store/cleanerStore';

const { width } = Dimensions.get('window');
const BRAND_TEAL = '#26B7C9';
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
  unreadCount = 0 
}) => {
  const insets = useSafeAreaInsets();
  const availableBookings = useCleanerStore(state => state.availableBookings);
  const totalUnread = useCleanerStore(selectTotalUnreadMessages);
  const messagesUnread = unreadCount || totalUnread;
  const jobsUnread = availableBookings.length;
  const isDarkSurface = false;
  const safeBottomPadding = Math.max(insets.bottom, 18);
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
    const targetNav = resolveNavigatorFor(name as string);
    targetNav.navigate(name as any);
  };
  const getButtonColor = (screen: keyof CleanerTabParamList) => {
    if (currentScreen === screen) {
      return BRAND_TEAL;
    }
    return isDarkSurface ? 'rgba(255, 255, 255, 0.7)' : 'rgba(68, 68, 68, 0.8)';
  };

  const getTextStyle = (screen: keyof CleanerTabParamList) => {
    if (currentScreen === screen) {
      return styles.activeButtonText;
    }
    return isDarkSurface ? styles.navButtonTextDark : styles.navButtonText;
  };

  const getButtonStyle = (screen: keyof CleanerTabParamList) => {
    return currentScreen === screen ? styles.activeNavButton : styles.navButton;
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

  return (
    <View
      style={[styles.navigationWrapper, { height: 86 + safeBottomPadding }]}
      pointerEvents="box-none"
    >
      <View style={styles.navigationContainer} pointerEvents="auto">
        <BlurView
          intensity={isDarkSurface ? 22 : 12}
          tint={isDarkSurface ? 'dark' : 'light'}
          style={[
            styles.blurContainer,
            styles.blurBackground,
            {
              paddingBottom: safeBottomPadding,
              backgroundColor: isDarkSurface ? 'rgba(0, 0, 0, 0.78)' : 'rgba(255, 255, 255, 0.92)',
              borderTopWidth: 1,
              borderTopColor: isDarkSurface ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB',
            },
          ]}
        >
          <View style={styles.navigationContent}>
          <TouchableOpacity 
            style={getButtonStyle('Dashboard')} 
            onPress={() => safeNavigate('Dashboard')}
          >
            <View style={styles.iconWrapper}>
              {currentScreen === 'Dashboard' && <View style={styles.activeIconGlow} />}
              <Ionicons 
                name={getIconName('Dashboard', currentScreen === 'Dashboard')} 
                size={28} 
                color={getButtonColor('Dashboard')} 
              />
            </View>
            {!shouldHideLabels && (
              <Text style={getTextStyle('Dashboard')} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                Dashboard
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={getButtonStyle('Content')} 
            onPress={() => safeNavigate('Content')}
          >
            <View style={styles.iconWrapper}>
              {currentScreen === 'Content' && <View style={styles.activeIconGlow} />}
              <Ionicons 
                name={getIconName('Content', currentScreen === 'Content')} 
                size={28} 
                color={getButtonColor('Content')} 
              />
            </View>
            {!shouldHideLabels && (
              <Text style={getTextStyle('Content')} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                Content
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={getButtonStyle('Jobs')} 
            onPress={() => safeNavigate('Jobs')}
          >
            <View style={styles.iconWrapper}>
              {currentScreen === 'Jobs' && <View style={styles.activeIconGlow} />}
              <Ionicons 
                name={getIconName('Jobs', currentScreen === 'Jobs')} 
                size={26} 
                color={getButtonColor('Jobs')} 
              />
              {jobsUnread > 0 && (
                <View style={styles.jobsBadge}>
                  <Text style={styles.jobsBadgeText}>
                    {jobsUnread > 9 ? '9+' : jobsUnread}
                  </Text>
                </View>
              )}
            </View>
            {!shouldHideLabels && (
              <Text style={getTextStyle('Jobs')} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                Jobs
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={getButtonStyle('Messages')} 
            onPress={() => safeNavigate('Messages')}
          >
            <View style={styles.iconWrapper}>
              {currentScreen === 'Messages' && <View style={styles.activeIconGlow} />}
              <Ionicons 
                name={getIconName('Messages', currentScreen === 'Messages')} 
                size={28} 
                color={getButtonColor('Messages')} 
              />
              {messagesUnread > 0 && <View style={styles.notificationDot} />}
            </View>
            {!shouldHideLabels && (
              <Text style={getTextStyle('Messages')} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                Messages
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={getButtonStyle('Profile')} 
            onPress={() => safeNavigate('Profile')}
          >
            <View style={styles.iconWrapper}>
              {currentScreen === 'Profile' && <View style={styles.activeIconGlow} />}
              <Ionicons 
                name={getIconName('Profile', currentScreen === 'Profile')} 
                size={28} 
                color={getButtonColor('Profile')} 
              />
            </View>
            {!shouldHideLabels && (
              <Text style={getTextStyle('Profile')} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                Profile
              </Text>
            )}
          </TouchableOpacity>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 24,
    overflow: 'hidden',
  },
  blurContainer: {
    flex: 1,
  },
  blurBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  navigationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    backgroundColor: 'transparent',
  },
  navButton: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 18,
    backgroundColor: 'transparent',
    marginHorizontal: 2,
  },
  activeNavButton: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 18,
    backgroundColor: 'transparent',
    marginHorizontal: 2,
  },
  activeButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: BRAND_TEAL,
    marginTop: 4,
    textAlign: 'center',
    includeFontPadding: false,
  },
  navButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(68, 68, 68, 0.8)',
    marginTop: 4,
    textAlign: 'center',
    includeFontPadding: false,
  },
  navButtonTextDark: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
    textAlign: 'center',
    includeFontPadding: false,
  },
  iconWrapper: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(38, 183, 201, 0.12)',
  },
  notificationDot: {
    position: 'absolute',
    right: -3,
    top: -2,
    backgroundColor: '#EF4444',
    borderRadius: 6,
    width: 10,
    height: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  jobsBadge: {
    position: 'absolute',
    right: -8,
    top: -6,
    backgroundColor: '#26B7C9',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    shadowColor: '#26B7C9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  jobsBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});

export default CleanerFloatingNavigation; 