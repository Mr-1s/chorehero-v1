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
import LiveTrackingScreen from './screens/shared/LiveTrackingScreen';
import IndividualChatScreen from './screens/shared/IndividualChatScreen';
import RatingReviewScreen from './screens/shared/RatingReviewScreen';
import TipAndReviewScreen from './screens/shared/TipAndReviewScreen';
import HelpScreen from './screens/shared/HelpScreen';
import PrivacyScreen from './screens/shared/PrivacyScreen';
import NotificationsScreen from './screens/shared/NotificationsScreen';
import TermsScreen from './screens/shared/TermsScreen';
import AboutScreen from './screens/shared/AboutScreen';
import AuthScreen from './screens/shared/AuthScreen';
import AccountTypeSelectionScreen from './screens/onboarding/AccountTypeSelectionScreen';
import CustomerOnboardingScreen from './screens/onboarding/CustomerOnboardingScreen';
import CleanerOnboardingScreen from './screens/onboarding/CleanerOnboardingScreen';
import SimpleBookingFlowScreen from './screens/booking/SimpleBookingFlowScreen';
import ServiceDetailScreen from './screens/shared/ServiceDetailScreen';
import EarningsScreen from './screens/cleaner/EarningsScreen';
import ScheduleScreen from './screens/cleaner/ScheduleScreen';
import VideoUploadScreen from './screens/cleaner/VideoUploadScreen';
// Removed unused/legacy screens not present in current StackParamList
import { ToastProvider } from './components/Toast';
import { ThemeProvider, useTheme, HERO_THEME, CUSTOMER_THEME } from './context/ThemeContext';
import { useRoleFeatures } from './components/RoleBasedUI';


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
  SimpleBookingFlow: {
    cleanerId?: string;
    serviceType?: string;
  };
  ServiceDetail: {
    serviceId: string;
    serviceName: string;
    category: string;
  };
  MainTabs: undefined;
  CleanerProfile: { cleanerId: string };
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
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createStackNavigator<StackParamList>();

// Role-based tab navigator - replaces the static TabNavigator
const TabNavigator = RoleBasedTabNavigator;

const AppNavigator = () => {
  const { isAuthenticated, user } = useAuth();
  const navigationRef = useRef<any>(null);

  // Determine the correct initial route based on auth state and onboarding completion
  const getInitialRoute = (): keyof StackParamList => {
    if (!isAuthenticated) {
      return "AuthScreen";
    }
    // User is authenticated but hasn't completed onboarding (no role set)
    if (!user?.role) {
      console.log('📋 User authenticated but no role - routing to AccountTypeSelection');
      return "AccountTypeSelection";
    }
    // User is fully onboarded
    return "MainTabs";
  };

  // Handle logout navigation
  useEffect(() => {
    if (!isAuthenticated && navigationRef.current) {
      // Navigate to AuthScreen when user logs out
      navigationRef.current.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'AuthScreen' }],
        })
      );
    }
  }, [isAuthenticated]);

  // Handle navigation when user completes onboarding (role gets set)
  useEffect(() => {
    if (isAuthenticated && user?.role && navigationRef.current) {
      // User just completed onboarding, navigate to MainTabs
      console.log('✅ User has role, navigating to MainTabs');
      navigationRef.current.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        })
      );
    }
  }, [isAuthenticated, user?.role]);

  // Initialize services when user is authenticated
  React.useEffect(() => {
    if (isAuthenticated && user?.id) {
      initializeServices(user.id);
    }
    return () => {
      presenceService.cleanup();
    };
  }, [isAuthenticated, user?.id]);

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

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator 
        screenOptions={{ headerShown: false }}
        initialRouteName={getInitialRoute()}
      >
          {/* Authentication Flow */}
          <Stack.Screen name="AuthScreen" component={AuthScreen} />
          <Stack.Screen name="AccountTypeSelection" component={AccountTypeSelectionScreen} />
          <Stack.Screen name="CustomerOnboarding" component={CustomerOnboardingScreen} />
          <Stack.Screen name="CleanerOnboarding" component={CleanerOnboardingScreen} />
          
          {/* Main App Flow */}
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          
          {/* Booking Flow */}
          <Stack.Screen name="SimpleBookingFlow" component={SimpleBookingFlowScreen} />
          <Stack.Screen name="ServiceDetail" component={ServiceDetailScreen} />
          
          {/* Other Screens */}
          <Stack.Screen name="CleanerProfile" component={CleanerProfileScreen} />
          <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
          <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
          <Stack.Screen name="IndividualChat" component={IndividualChatScreen} />
          <Stack.Screen name="RatingReview" component={RatingReviewScreen} />
          <Stack.Screen name="TipAndReview" component={TipAndReviewScreen} />
          <Stack.Screen name="HelpScreen" component={HelpScreen} />
          <Stack.Screen name="PrivacyScreen" component={PrivacyScreen} />
          <Stack.Screen name="NotificationsScreen" component={NotificationsScreen} />
          <Stack.Screen name="TermsScreen" component={TermsScreen} />
          <Stack.Screen name="AboutScreen" component={AboutScreen} />
          <Stack.Screen name="EarningsScreen" component={EarningsScreen} />
          <Stack.Screen name="ScheduleScreen" component={ScheduleScreen} />
          <Stack.Screen name="VideoUpload" component={VideoUploadScreen} />
          

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