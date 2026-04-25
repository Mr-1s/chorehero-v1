import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
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
  if (message.includes('Network request failed')) {
    console.log('📶 Network request failed (offline or weak connection)');
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
import MainTabsChrome from './navigation/MainTabsChrome';
import CleanerProfileScreen from './screens/shared/CleanerProfileScreen';
import BookingConfirmedScreen from './screens/customer/BookingConfirmedScreen';
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
import WelcomeScreen from './screens/shared/WelcomeScreen';
import PhoneVerifyScreen from './screens/shared/PhoneVerifyScreen';
import ProfileTypeScreen from './screens/onboarding/ProfileTypeScreen';
import CustomerOnboardingScreen from './screens/onboarding/CustomerOnboardingScreen';
import CleanerOnboardingScreen from './screens/onboarding/CleanerOnboardingScreen';
import OnboardingCompleteScreen from './screens/onboarding/OnboardingCompleteScreen';
import LocationLockScreen from './screens/onboarding/LocationLockScreen';
import WaitlistScreen from './screens/onboarding/WaitlistScreen';
import UnifiedBookingScreen from './screens/booking/UnifiedBookingScreen';
import { UnifiedBookingParams } from './types/bookingFlow';
import ServiceDetailScreen from './screens/shared/ServiceDetailScreen';
import EarningsScreen from './screens/cleaner/EarningsScreen';
import PayoutSetupScreen from './screens/cleaner/PayoutSetupScreen';
import ScheduleScreen from './screens/cleaner/ScheduleScreen';
import VideoUploadScreen from './screens/cleaner/VideoUploadScreen';
import BookingCustomizationScreen from './screens/cleaner/BookingCustomizationScreen';
import PaymentScreen from './screens/shared/PaymentScreen';
import EditProfileScreen from './screens/shared/EditProfileScreen';
import VideoFeedScreen from './screens/shared/VideoFeedScreen';
import SavedVideosScreen from './screens/shared/SavedVideosScreen';
import LikedVideosScreen from './screens/shared/LikedVideosScreen';
import FollowListScreen from './screens/shared/FollowListScreen';
import PostJobScreen from './screens/customer/PostJobScreen';
import QuoteListScreen from './screens/customer/QuoteListScreen';
import QuoteAcceptScreen from './screens/customer/QuoteAcceptScreen';
import AdminDashboard from './screens/admin/AdminDashboard';
// Removed unused/legacy screens not present in current StackParamList
import { ToastProvider } from './components/Toast';
import { ThemeProvider, useTheme, HERO_THEME, CUSTOMER_THEME } from './context/ThemeContext';
import { StripeProvider } from '@stripe/stripe-react-native';
import { useRoleFeatures } from './components/RoleBasedUI';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCleanerOnboardingOverride } from './utils/onboardingOverride';
import { validateEnv } from './utils/validateEnv';

// Run boot-time env validation. In dev this throws and surfaces a red box.
// In prod it logs the missing keys and lets the UI degrade gracefully (e.g.
// PaymentScreen already guards Stripe).
validateEnv();
import { navigationRef } from './navigation/navigationRef';
import { getResetToMainTabsChoresAction } from './navigation/mainTabsContentNavigation';
import { resolveMainAppRole } from './navigation/mainTabsInterfaceRole';
import { pushNotificationService } from './services/pushNotifications';
import { enhancedLocationService } from './services/enhancedLocationService';
import { presenceService } from './services/presenceService';

/**
 * Only these root routes are safe to persist for cold start. Everything else is a push
 * above MainTabs — rehydrating as a single route leaves no stack to go "back" to.
 */
const ALLOW_PERSISTED_ROOT_ROUTE = new Set<string>([
  'MainTabs',
  'LocationLock',
  'Waitlist',
  'CustomerOnboarding',
  'CleanerOnboarding',
  'OnboardingComplete',
  'ProfileType',
  'AuthScreen',
  'Welcome',
  'PhoneVerify',
]);

type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
};

type StackParamList = {
  Welcome: undefined;
  AuthScreen: undefined;
  PhoneVerify: { phone: string };
  ProfileType: undefined;
  CustomerOnboarding: { zip?: string; city?: string; state?: string } | undefined;
  CleanerOnboarding: undefined;
  OnboardingComplete: undefined;
  LocationLock: undefined;
  Waitlist: { zip: string; city?: string; state?: string };
  UnifiedBooking: UnifiedBookingParams;
  ServiceDetail: {
    serviceId: string;
    serviceName: string;
    category: string;
  };
  MainTabs: undefined;
  CleanerProfile: { cleanerId: string; activeTab?: 'videos' | 'services' | 'reviews' | 'about' };
  BookingConfirmed: { bookingId: string };
  QuoteList: { jobId: string; viewerRole?: 'customer' | 'pro' };
  QuoteAccept: { jobId: string; quoteId: string };
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
  PayoutSetup: undefined;
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
  AdminDashboard: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createStackNavigator<StackParamList>();

// Role-based tab navigator - replaces the static TabNavigator
const TabNavigator = RoleBasedTabNavigator;

// Wrapper that keys MainTabs by user id - forces full remount when switching accounts (fixes stale state)
function MainTabsScreen({ navigation }: { navigation: object }) {
  const { user } = useAuth();
  return (
    <View style={stylesMainTabsShell.root}>
      <TabNavigator key={user?.id ?? 'anonymous'} />
      <MainTabsChrome roleStackNavigation={navigation} />
    </View>
  );
}

const stylesMainTabsShell = StyleSheet.create({
  root: { flex: 1 },
});

const AppNavigator = () => {
  const { isAuthenticated, user, isLoading, isGuestMode } = useAuth();
  const [restoredRoute, setRestoredRoute] = useState<{ name: keyof StackParamList; params?: any } | null>(null);
  const [guestZip, setGuestZip] = useState<string | null>(null);
  const [cleanerOnboardingOverride, setCleanerOnboardingOverride] = useState(false);
  const [pendingRole, setPendingRole] = useState<'customer' | 'cleaner' | null>(null);
  const [bootstrapReady, setBootstrapReady] = useState(false);

  const inferredRole = resolveMainAppRole(user, { pendingAuthRole: pendingRole });

  const isCustomerComplete =
    inferredRole === 'customer' &&
    ((user?.customer_onboarding_state === 'LOCATION_SET' ||
      user?.customer_onboarding_state === 'ACTIVE_CUSTOMER' ||
      user?.customer_onboarding_state === 'TRANSACTION_READY') ||
      !!guestZip);

  const isCleanerComplete =
    inferredRole === 'cleaner' &&
    (user?.cleaner_onboarding_state === 'STAGING' ||
      user?.cleaner_onboarding_state === 'LIVE' ||
      (user?.cleaner_onboarding_step !== undefined && user.cleaner_onboarding_step >= 2) ||
      cleanerOnboardingOverride ||
      getCleanerOnboardingOverride());

  // Determine the correct initial route based on auth state and onboarding completion
  const getInitialRoute = (): keyof StackParamList => {
    if (!isAuthenticated) return "Welcome";
    if (
      !user?.role &&
      !pendingRole &&
      !user?.cleaner_onboarding_state &&
      user?.cleaner_onboarding_step === undefined &&
      !user?.customer_onboarding_state &&
      user?.customer_onboarding_step === undefined
    ) {
      return "ProfileType";
    }
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

  // Bootstrap guest zip / role flags. Root `last_route` is cleared on every **new
  // process** (user fully closed the app): `loadLastRoute` only runs once per mount,
  // so a simple app switch to background does not re-run this — only a cold start.
  // That way reopening the app “refreshes” the navigation shell from `getInitialRoute()`.
  useEffect(() => {
    const loadLastRoute = async () => {
      try {
        await AsyncStorage.removeItem('last_route');
        setRestoredRoute(null);
        const storedZip = await AsyncStorage.getItem('guest_zip');
        if (storedZip) {
          setGuestZip(storedZip);
        }
        const storedPendingRole = await AsyncStorage.getItem('pending_auth_role');
        if (storedPendingRole === 'customer' || storedPendingRole === 'cleaner') {
          setPendingRole(storedPendingRole);
        }
        const storedCleanerOverride = await AsyncStorage.getItem('cleaner_onboarding_complete');
        setCleanerOnboardingOverride(storedCleanerOverride === 'true');
      } catch (error) {
        console.warn('⚠️ Failed to restore last route:', error);
      } finally {
        setBootstrapReady(true);
      }
    };
    loadLastRoute();
  }, []);

  type SafeRoute = { name: keyof StackParamList; params?: Record<string, unknown> };

  const getSafeRoute = (): SafeRoute => {
    if (!isAuthenticated) {
      if (isGuestMode) return { name: 'MainTabs' };
      return { name: 'Welcome' };
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
    // Only use restored route when user has chosen a role; new signups must see ProfileType
    const hasChosenRole = !!(user?.role || pendingRole);
    if (
      restoredRoute?.name &&
      !['Welcome', 'AuthScreen', 'ProfileType'].includes(restoredRoute.name) &&
      hasChosenRole
    ) {
      const n = String(restoredRoute.name);
      if (ALLOW_PERSISTED_ROOT_ROUTE.has(n)) {
        return { name: n as keyof StackParamList, params: restoredRoute.params };
      }
    }
    return { name: getInitialRoute() };
  };

  // Handle navigation when auth state changes (after initial mount)
  useEffect(() => {
    if (isLoading || !bootstrapReady || !navigationRef.current) {
      return;
    }
    const nextRoute = getSafeRoute();
    const state = navigationRef.current.getRootState();
    const current = state?.routes?.[state.index];
    const sameName = current?.name === nextRoute.name;
    const sameParams =
      JSON.stringify(current?.params ?? {}) === JSON.stringify(nextRoute.params ?? {});
    if (sameName && sameParams) {
      return;
    }
    if (nextRoute.name === 'MainTabs') {
      console.log('✅ User onboarding complete, navigating to MainTabs');
    }
    navigationRef.current.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: nextRoute.name, params: nextRoute.params }],
      })
    );
  }, [isLoading, bootstrapReady, isAuthenticated, isGuestMode, user?.role, pendingRole, isCustomerComplete, isCleanerComplete, restoredRoute]);

  async function initializeServices(userId: string) {
    try {
      await pushNotificationService.initialize(userId);
      await enhancedLocationService.initialize();
      await presenceService.initialize(userId);
      console.log('Services initialized successfully');
    } catch (error) {
      console.error('Error initializing services:', error);
    }
  }

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

  if (isLoading || !bootstrapReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#26B7C9" />
      </View>
    );
  }

  const initialRoute = getSafeRoute();

  const persistRoute = (state: any) => {
    try {
      const route = state?.routes?.[state.index];
      if (!route) return;
      const name = String(route.name);
      if (!ALLOW_PERSISTED_ROOT_ROUTE.has(name)) {
        AsyncStorage.setItem('last_route', JSON.stringify({ name: 'MainTabs' })).catch(
          () => {}
        );
        return;
      }
      const payload = { name: route.name, params: route.params };
      AsyncStorage.setItem('last_route', JSON.stringify(payload)).catch(() => {});
    } catch {
      // no-op
    }
  };

  /**
   * Root `VideoFeed` (duplicate of Chores) unmounts `MainTabs` and hides the tab bar.
   * Bounce back to `MainTabs` > `Content` with the same params.
   */
  const onNavigationStateChange = (state: any) => {
    persistRoute(state);
    try {
      const route = state?.routes?.[state?.index];
      if (route?.name === 'VideoFeed' && navigationRef.isReady()) {
        const p = route.params;
        queueMicrotask(() => {
          navigationRef.dispatch(getResetToMainTabsChoresAction(p));
        });
      }
    } catch {
      // no-op
    }
  };

  return (
    <NavigationContainer
      ref={navigationRef as any}
      onStateChange={onNavigationStateChange}
      initialState={{
        routes: [{ name: initialRoute.name, params: initialRoute.params }],
        index: 0,
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
          {/* Authentication Flow */}
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="AuthScreen" component={AuthScreen} />
          <Stack.Screen name="PhoneVerify" component={PhoneVerifyScreen} />
          <Stack.Screen name="ProfileType" component={ProfileTypeScreen} />
          <Stack.Screen name="CustomerOnboarding" component={CustomerOnboardingScreen} />
          <Stack.Screen name="CleanerOnboarding" component={CleanerOnboardingScreen} />
          <Stack.Screen name="OnboardingComplete" component={OnboardingCompleteScreen} />
          <Stack.Screen
            name="LocationLock"
            component={LocationLockScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen name="Waitlist" component={WaitlistScreen} />
          
          {/* Main App Flow - MainTabsScreen keys by user id to force remount when switching accounts */}
          <Stack.Screen name="MainTabs" component={MainTabsScreen} />
          
          {/* Booking Flow */}
          <Stack.Screen name="UnifiedBooking" component={UnifiedBookingScreen} />
          <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
          
          {/* Other Screens */}
          <Stack.Screen name="CleanerProfile" component={CleanerProfileScreen} />
          <Stack.Screen name="BookingConfirmed" component={BookingConfirmedScreen} />
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
          <Stack.Screen name="PayoutSetup" component={PayoutSetupScreen} />
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
          <Stack.Screen name="PostJob" component={PostJobScreen} />
          <Stack.Screen name="QuoteList" component={QuoteListScreen} />
          <Stack.Screen name="QuoteAccept" component={QuoteAcceptScreen} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboard} />

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

  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={stripePublishableKey}>
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
      </StripeProvider>
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