import React, { useState, useRef, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, CommonActions } from '@react-navigation/native';

// Global error handler for auth token issues
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(' ');
  // Suppress specific refresh token errors from console
  if (message.includes('Invalid Refresh Token') || 
      message.includes('Refresh Token Not Found') ||
      message.includes('AuthApiError')) {
    console.log('🔄 Auth error suppressed:', message.split('AuthApiError')[0]);
    return;
  }
  originalConsoleError.apply(console, args);
};
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import SplashHero from './components/SplashHero';
import { LocationProvider } from './context/LocationContext';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { MessageProvider, useMessages } from './context/MessageContext';
import { EnhancedMessageProvider } from './context/EnhancedMessageContext';
import RoleBasedTabNavigator from './components/navigation/RoleBasedTabNavigator';
import CleanerProfileScreen from './screens/shared/CleanerProfileScreen';
import BookingConfirmationScreen from './screens/shared/BookingConfirmationScreen';
import BookingSummaryScreen from './screens/shared/BookingSummaryScreen';
import LiveTrackingScreen from './screens/shared/LiveTrackingScreen';
import IndividualChatScreen from './screens/shared/IndividualChatScreen';
import MessagesScreen from './screens/shared/MessagesScreen';
import RatingReviewScreen from './screens/shared/RatingReviewScreen';
import TipAndReviewScreen from './screens/shared/TipAndReviewScreen';
import HelpScreen from './screens/shared/HelpScreen';
import PrivacyScreen from './screens/shared/PrivacyScreen';
import NotificationsScreen from './screens/shared/NotificationsScreen';
import TermsScreen from './screens/shared/TermsScreen';
import AboutScreen from './screens/shared/AboutScreen';
import SettingsScreen from './screens/shared/SettingsScreen';
import AuthScreen from './screens/shared/AuthScreen';
import AccountTypeSelectionScreen from './screens/onboarding/AccountTypeSelectionScreen';
import CustomerOnboardingScreen from './screens/onboarding/CustomerOnboardingScreen';
import CleanerOnboardingScreen from './screens/onboarding/CleanerOnboardingScreen';
import LocationLockScreen from './screens/onboarding/LocationLockScreen';
import WaitlistScreen from './screens/onboarding/WaitlistScreen';
import NewBookingFlowScreen from './screens/booking/NewBookingFlowScreen';
import ServiceDetailScreen from './screens/shared/ServiceDetailScreen';
import EarningsScreen from './screens/cleaner/EarningsScreen';
import ScheduleScreen from './screens/cleaner/ScheduleScreen';
import VideoUploadScreen from './screens/cleaner/VideoUploadScreen';
import BookingCustomizationScreen from './screens/cleaner/BookingCustomizationScreen';
import PaymentScreen from './screens/shared/PaymentScreen';
import EditProfileScreen from './screens/shared/EditProfileScreen';
import VideoFeedScreen from './screens/shared/VideoFeedScreen';
import SavedVideosScreen from './screens/shared/SavedVideosScreen';
import LikedVideosScreen from './screens/shared/LikedVideosScreen';
import FollowListScreen from './screens/shared/FollowListScreen';
// Removed unused/legacy screens not present in current StackParamList
import { ToastProvider } from './components/Toast';
import { ThemeProvider, useTheme, HERO_THEME, CUSTOMER_THEME } from './context/ThemeContext';
import { useRoleFeatures } from './components/RoleBasedUI';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCleanerOnboardingOverride } from './utils/onboardingOverride';


// Import services for initialization
import { pushNotificationService } from './services/pushNotifications';
import { enhancedLocationService } from './services/enhancedLocationService';
import { jobStateManager } from './services/jobStateManager';
import { presenceService } from './services/presenceService';


type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
};

type StackParamList = {
  AuthScreen: undefined;
  AccountTypeSelection: undefined;
  CustomerOnboarding: undefined;
  CleanerOnboarding: undefined;
  LocationLock: undefined;
  Waitlist: { zip: string; city?: string; state?: string };
  NewBookingFlow: {
    cleanerId?: string;
    serviceType?: string;
    serviceName?: string;
    basePrice?: number;
  };
  ServiceDetail: {
    serviceId: string;
    serviceName: string;
    category: string;
  };
  MainTabs: undefined;
  CleanerProfile: { cleanerId: string; activeTab?: 'videos' | 'services' | 'reviews' | 'about' };
  BookingConfirmation: {
    bookingId: string;
    service?: {
      title: string;
      duration: string;
      price: number;
    };
    cleaner?: {
      id: string;
      name: string;
      avatar: string;
      rating: number;
      eta: string;
    };
    address?: string;
    scheduledTime?: string;
  };
  BookingSummary: {
    cleanerId: string;
    cleanerName?: string;
    hourlyRate?: number;
    selectedService?: string;
    selectedTime?: string;
  };
  LiveTracking: { bookingId: string };
  IndividualChat: { cleanerId: string; bookingId: string };
  RatingReview: {
    bookingId: string;
    cleaner: {
      id: string;
      name: string;
      avatar: string;
    };
    service: {
      title: string;
      completedAt: string;
    };
  };
  TipAndReview: {
    bookingId: string;
    cleanerId: string;
    cleanerName: string;
    cleanerPhoto: string;
    serviceTitle: string;
    serviceCost: number;
  };
  HelpScreen: undefined;
  PrivacyScreen: undefined;
  NotificationsScreen: undefined;
  TermsScreen: undefined;
  AboutScreen: undefined;
  EarningsScreen: undefined;
  ScheduleScreen: undefined;
  VideoUpload: undefined;
  BookingCustomization: undefined;
  VideoFeed: {
    source?: 'main' | 'featured' | 'cleaner' | 'saved' | 'liked' | 'global';
    cleanerId?: string;
    initialVideoId?: string;
    videos?: any[];
  };
  SavedVideos: undefined;
  LikedVideos: undefined;
  FollowList: {
    userId: string;
    type?: 'followers' | 'following';
    userName?: string;
  };
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createStackNavigator<StackParamList>();

// Role-based tab navigator - replaces the static TabNavigator
const TabNavigator = RoleBasedTabNavigator;

const AppNavigator = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const navigationRef = useRef<any>(null);
  const [restoredRoute, setRestoredRoute] = useState<{ name: keyof StackParamList; params?: any } | null>(null);
  const [guestZip, setGuestZip] = useState<string | null>(null);
  const [cleanerOnboardingOverride, setCleanerOnboardingOverride] = useState(false);

  const inferredRole =
    user?.role ||
    (user?.cleaner_onboarding_state || user?.cleaner_onboarding_step ? 'cleaner' : 'customer');

  const isCustomerComplete =
    inferredRole === 'customer' &&
    ((user?.customer_onboarding_state === 'LOCATION_SET' ||
      user?.customer_onboarding_state === 'ACTIVE_CUSTOMER' ||
      user?.customer_onboarding_state === 'TRANSACTION_READY') ||
      !!guestZip);

  const isCleanerComplete =
    inferredRole === 'cleaner' &&
    (user.cleaner_onboarding_state === 'STAGING' ||
      user.cleaner_onboarding_state === 'LIVE' ||
      (user.cleaner_onboarding_step !== undefined && user.cleaner_onboarding_step >= 6) ||
      cleanerOnboardingOverride ||
      getCleanerOnboardingOverride());

  // Determine the correct initial route based on auth state and onboarding completion
  const getInitialRoute = (): keyof StackParamList => {
    if (!isAuthenticated) return "AuthScreen";
    if (inferredRole === 'customer' && !isCustomerComplete) {
      console.log('📋 Customer onboarding incomplete - routing to LocationLock');
      return "LocationLock";
    }
    if (inferredRole === 'cleaner' && !isCleanerComplete) {
      console.log('📋 Cleaner onboarding incomplete - routing to CleanerOnboarding');
      return "CleanerOnboarding";
    }
    // User is fully onboarded
    return "MainTabs";
  };

  // Restore last known route
  useEffect(() => {
    const loadLastRoute = async () => {
      try {
        const raw = await AsyncStorage.getItem('last_route');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.name) {
            setRestoredRoute(parsed);
          }
        }
        const storedZip = await AsyncStorage.getItem('guest_zip');
        if (storedZip) {
          setGuestZip(storedZip);
        }
        const storedCleanerOverride = await AsyncStorage.getItem('cleaner_onboarding_complete');
        setCleanerOnboardingOverride(storedCleanerOverride === 'true');
      } catch (error) {
        console.warn('⚠️ Failed to restore last route:', error);
      }
    };
    loadLastRoute();
  }, []);

  const getSafeRoute = () => {
    if (!isAuthenticated) {
      return { name: 'AuthScreen' };
    }
    const shouldBypassLocationLock =
      isAuthenticated &&
      user?.role === 'customer' &&
      (isCustomerComplete || !!guestZip);

    if (isCleanerComplete && restoredRoute?.name === 'CleanerOnboarding') {
      return { name: 'MainTabs' };
    }
    if (shouldBypassLocationLock && restoredRoute?.name === 'LocationLock') {
      return { name: 'MainTabs' };
    }
    if (
      restoredRoute?.name &&
      !['AuthScreen', 'AccountTypeSelection'].includes(restoredRoute.name)
    ) {
      return restoredRoute;
    }
    return { name: getInitialRoute() };
  };

  // Handle navigation when auth state changes (after loading)
  useEffect(() => {
    if (isLoading || !navigationRef.current) {
      return;
    }
    const nextRoute = getSafeRoute();
    if (nextRoute.name === 'MainTabs') {
      console.log('✅ User onboarding complete, navigating to MainTabs');
    }
    navigationRef.current.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: nextRoute.name, params: nextRoute.params }],
      })
    );
  }, [isLoading, isAuthenticated, user?.role, isCustomerComplete, isCleanerComplete, restoredRoute]);

  // Initialize services when user is authenticated
  React.useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return () => {
        presenceService.cleanup();
      };
    }
    initializeServices(user.id);
    return () => {
      presenceService.cleanup();
    };
  }, [isAuthenticated, user?.id]);

  if (isLoading) {
    return null;
  }

  const initializeServices = async (userId: string) => {
    try {
      // Initialize push notifications
      await pushNotificationService.initialize(userId);
      
      // Initialize location service
      await enhancedLocationService.initialize();

      // Initialize presence
      await presenceService.initialize(userId);

      console.log('Services initialized successfully');
    } catch (error) {
      console.error('Error initializing services:', error);
    }
  };

  const persistRoute = (state: any) => {
    try {
      const route = state?.routes?.[state.index];
      if (!route) return;
      const payload = { name: route.name, params: route.params };
      AsyncStorage.setItem('last_route', JSON.stringify(payload)).catch(() => {});
    } catch {
      // no-op
    }
  };

  return (
    <NavigationContainer ref={navigationRef} onStateChange={persistRoute}>
      <Stack.Navigator 
        screenOptions={{ headerShown: false }}
        initialRouteName="AuthScreen"
      >
          {/* Authentication Flow */}
          <Stack.Screen name="AuthScreen" component={AuthScreen} />
          <Stack.Screen name="AccountTypeSelection" component={AccountTypeSelectionScreen} />
          <Stack.Screen name="CustomerOnboarding" component={CustomerOnboardingScreen} />
          <Stack.Screen name="CleanerOnboarding" component={CleanerOnboardingScreen} />
          <Stack.Screen
            name="LocationLock"
            component={LocationLockScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen name="Waitlist" component={WaitlistScreen} />
          
          {/* Main App Flow */}
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          
          {/* Booking Flow */}
          <Stack.Screen name="NewBookingFlow" component={NewBookingFlowScreen} />
          <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
          
          {/* Other Screens */}
          <Stack.Screen name="CleanerProfile" component={CleanerProfileScreen} />
          <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
          <Stack.Screen name="BookingSummary" component={BookingSummaryScreen} />
          <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
          <Stack.Screen name="IndividualChat" component={IndividualChatScreen} />
          <Stack.Screen name="Messages" component={MessagesScreen} />
          <Stack.Screen name="RatingReview" component={RatingReviewScreen} />
          <Stack.Screen name="TipAndReview" component={TipAndReviewScreen} />
          <Stack.Screen name="HelpScreen" component={HelpScreen} />
          <Stack.Screen name="PrivacyScreen" component={PrivacyScreen} />
          <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} />
          <Stack.Screen name="TermsScreen" component={TermsScreen} />
          <Stack.Screen name="AboutScreen" component={AboutScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
          <Stack.Screen name="EarningsScreen" component={EarningsScreen} />
          <Stack.Screen name="ScheduleScreen" component={ScheduleScreen} />
          <Stack.Screen name="VideoUpload" component={VideoUploadScreen} />
          <Stack.Screen name="BookingCustomization" component={BookingCustomizationScreen} />
          <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
          <Stack.Screen name="EditProfileScreen" component={EditProfileScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="VideoFeed" component={VideoFeedScreen} />
          <Stack.Screen name="SavedVideos" component={SavedVideosScreen} />
          <Stack.Screen name="LikedVideos" component={LikedVideosScreen} />
          <Stack.Screen name="FollowList" component={FollowListScreen} />
          

        </Stack.Navigator>
      </NavigationContainer>
    );
};

export default function App() {
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  const handleSplashFinish = () => {
    setIsSplashVisible(false);
  };

  // Safety timeout: if onDone never fires, force transition after ~4000ms
  useEffect(() => {
    if (isSplashVisible) {
      const safetyTimeout = setTimeout(() => {
        setIsSplashVisible(false);
      }, 4000);
      return () => clearTimeout(safetyTimeout);
    }
  }, [isSplashVisible]);

  if (isSplashVisible) {
    return <SplashHero onDone={handleSplashFinish} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LocationProvider>
          <MessageProvider>
            <EnhancedMessageWrapper>
              <ThemeProvider initialTheme={HERO_THEME}>
                <RoleThemeObserver>
                  <ToastProvider>
                    <AppNavigator />
                  </ToastProvider>
                </RoleThemeObserver>
              </ThemeProvider>
            </EnhancedMessageWrapper>
          </MessageProvider>
        </LocationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// Wrapper to provide userId to EnhancedMessageProvider
const EnhancedMessageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  if (user?.id) {
    return (
      <EnhancedMessageProvider userId={user.id}>
        {children}
      </EnhancedMessageProvider>
    );
  }
  
  return <>{children}</>;
};

// Observes role and applies the correct theme dynamically
const RoleThemeObserver: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isCleaner } = useRoleFeatures();
  const { theme, setTheme } = useTheme();

  React.useEffect(() => {
    const target = isCleaner ? HERO_THEME : CUSTOMER_THEME;
    if (theme.name !== target.name) {
      setTheme(target);
    }
  }, [isCleaner]);

  return <>{children}</>;
};