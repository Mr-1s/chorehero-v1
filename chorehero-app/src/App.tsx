import React, { useState, useRef, useEffect } from 'react';
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
import AnimatedSplash from './components/AnimatedSplash';
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
import BookingTemplateScreen from './screens/cleaner/BookingTemplateScreen';
import ContentUploadWithPricingScreen from './screens/cleaner/ContentUploadWithPricingScreen';
import { TutorialDemoScreen } from './screens/tutorial/TutorialDemoScreen';
import { ToastProvider } from './components/Toast';


// Import services for initialization
import { pushNotificationService } from './services/pushNotifications';
import { enhancedLocationService } from './services/enhancedLocationService';
import { jobStateManager } from './services/jobStateManager';


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

  // Initialize services when user is authenticated
  React.useEffect(() => {
    if (isAuthenticated && user?.id) {
      initializeServices(user.id);
    }
  }, [isAuthenticated, user?.id]);

  const initializeServices = async (userId: string) => {
    try {
      // Initialize push notifications
      await pushNotificationService.initialize(userId);
      
      // Initialize location service
      await enhancedLocationService.initialize();

      console.log('Services initialized successfully');
    } catch (error) {
      console.error('Error initializing services:', error);
    }
  };

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator 
        screenOptions={{ headerShown: false }}
        initialRouteName={isAuthenticated ? "MainTabs" : "AuthScreen"}
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
          <Stack.Screen name="BookingTemplate" component={BookingTemplateScreen} />
          <Stack.Screen name="ContentUploadWithPricing" component={ContentUploadWithPricingScreen} />
          <Stack.Screen name="TutorialDemo" component={TutorialDemoScreen} />
          

        </Stack.Navigator>
      </NavigationContainer>
    );
};

export default function App() {
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  const handleSplashFinish = () => {
    setIsSplashVisible(false);
  };

  if (isSplashVisible) {
    return <AnimatedSplash onFinish={handleSplashFinish} />;
  }

  return (
    <AuthProvider>
      <LocationProvider>
        <MessageProvider>
          <EnhancedMessageWrapper>
            <ToastProvider>
              <AppNavigator />
            </ToastProvider>
          </EnhancedMessageWrapper>
        </MessageProvider>
      </LocationProvider>
    </AuthProvider>
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