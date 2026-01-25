import React, { useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../context/MessageContext';
import { useAuth } from '../hooks/useAuth';
import { notificationService } from '../services/notificationService';

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
  const { user } = useAuth();
  const [hasBookingAlert, setHasBookingAlert] = useState(false);
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
  const isTransparent = variant === 'transparent';
  const isDarkSurface = currentScreen === 'Content';
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

  return (
    <View
      style={[styles.navigationWrapper, { height: 90 + safeBottomPadding }]}
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
                  borderTopColor: '#EEEEEE',
                }
              : null,
          ]}
        >
          <View style={styles.navigationContent}>
          <TouchableOpacity 
            style={currentScreen === 'Content' ? styles.activeNavButton : styles.navButton} 
            onPress={() =>
              safeNavigate('Content', { scrollToTop: currentScreen === 'Content' })
            }
          >
            <View style={[styles.iconWrapper, getIconStyle('Content')]}>
              <Ionicons name={getIconName('Content')} size={26} color={getButtonColor('Content')} />
            </View>
            {!shouldHideLabels && (
              <Text style={getTextStyle('Content')} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                Chores
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={getButtonStyle('Discover')} 
            onPress={() => safeNavigate('Discover')}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name={getIconName('Discover')} size={26} color={getButtonColor('Discover')} />
            </View>
            {!shouldHideLabels && (
              <Text style={getTextStyle('Discover')} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                Discover
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[getButtonStyle('Bookings'), styles.centerNavButton]} 
            onPress={() => safeNavigate('Bookings')}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name={getIconName('Bookings')} size={26} color={getButtonColor('Bookings')} />
              {(hasBookingAlert || unreadCount > 0) && <View style={styles.dotBadge} />}
            </View>
            {!shouldHideLabels && (
              <Text style={getTextStyle('Bookings')} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                Bookings
              </Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={getButtonStyle('Messages')} 
            onPress={() => safeNavigate('Messages')}
          >
            <View style={styles.iconWrapper}>
              <Ionicons name={getIconName('Messages')} size={26} color={getButtonColor('Messages')} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
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
              <Ionicons name={getIconName('Profile')} size={26} color={getButtonColor('Profile')} />
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
    height: 90,
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
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  blurTransparent: {
    backgroundColor: 'rgba(255, 255, 255, 0)',
  },
  navigationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  navButton: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: 'transparent',
    marginHorizontal: 2,
    justifyContent: 'center',
  },
  centerNavButton: {
    flex: 1.1,
  },
  activeNavButton: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: 'transparent',
    marginHorizontal: 2,
    justifyContent: 'center',
  },
  activeButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND_TEAL,
    paddingTop: 5,
    textAlign: 'center',
    includeFontPadding: false,
  },
  activeButtonTextTransparent: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND_TEAL,
    paddingTop: 5,
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  navButtonTextLight: {
    fontSize: 12,
    fontWeight: '500',
    color: '#444444',
    paddingTop: 5,
    textAlign: 'center',
    includeFontPadding: false,
  },
  navButtonTextDark: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    paddingTop: 5,
    textAlign: 'center',
    includeFontPadding: false,
  },
  navButtonTextTransparent: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    paddingTop: 5,
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  iconWrapper: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  iconDefault: {
    transform: [{ scale: 1 }],
  },
  activeContentIcon: {
    transform: [{ scale: 1.1 }],
  },
  dotBadge: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  badge: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: '#FF4F5E',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#FF4F5E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default FloatingNavigation; 