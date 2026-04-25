import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../hooks/useAuth';
import { useProNotifications } from '../../hooks/useProNotifications';

// Customer Screens
import CustomerDashboardScreen from '../../screens/customer/DashboardScreen';
import CustomerProfileScreen from '../../screens/customer/ProfileScreen';
import TrackingScreen from '../../screens/customer/TrackingScreen';

// Cleaner Screens (Refactored versions with Zustand store)
import CleanerDashboardScreen from '../../screens/cleaner/DashboardScreen';
import CleanerProfileScreen from '../../screens/cleaner/ProfileScreenNew';
import CleanerEarningsScreen from '../../screens/cleaner/EarningsScreen';
import CleanerJobsScreen from '../../screens/cleaner/JobsScreenNew';
import CleanerScheduleScreen from '../../screens/cleaner/ScheduleScreen';
import VideoUploadScreen from '../../screens/cleaner/VideoUploadScreen';
import TipsScreen from '../../screens/cleaner/TipsScreen';
import CleanerContentScreen from '../../screens/cleaner/ContentScreenNew';
import CleanerMessagesScreen from '../../screens/cleaner/MessagesScreenNew';
import EarningsBreakdownScreen from '../../screens/cleaner/EarningsBreakdownScreen';
import HeroStatsScreen from '../../screens/cleaner/HeroStatsScreen';
import CalendarSettingsScreen from '../../screens/cleaner/CalendarSettingsScreen';
import RateManagerScreen from '../../screens/cleaner/RateManagerScreen';
import ProServicesScreen from '../../screens/cleaner/ProServicesScreen';
import BookServiceScreen from '../../screens/customer/BookServiceScreen';
import CameraView from '../../screens/cleaner/CameraView';

// Shared Screens
import DiscoverScreen from '../../screens/shared/DiscoverScreen';
import MessagesScreen from '../../screens/shared/MessagesScreen';
import BookingScreen from '../../screens/shared/BookingScreen';
import NewBookingFlowScreen from '../../screens/booking/NewBookingFlowScreen';
import VideoFeedScreen from '../../screens/shared/VideoFeedScreen';
import ContentCreationScreen from '../../screens/shared/ContentCreationScreen';
import UserProfileScreen from '../../screens/shared/UserProfileScreen';
import PaymentScreen from '../../screens/shared/PaymentScreen';
import SettingsScreen from '../../screens/shared/SettingsScreen';
import EditProfileScreen from '../../screens/shared/EditProfileScreen';
import AddressManagementScreen from '../../screens/shared/AddressManagementScreen';
import SavedServicesScreen from '../../screens/shared/SavedServicesScreen';
import JobDetailsScreen from '../../screens/shared/JobDetailsScreen';
import CleanerProfileEditScreen from '../../screens/cleaner/ProfileEditScreen';
import BookingConfirmedScreen from '../../screens/customer/BookingConfirmedScreen';
import LiveTrackingScreen from '../../screens/shared/LiveTrackingScreen';

// Video Quote System
import PostJobScreen from '../../screens/customer/PostJobScreen';
import QuoteListScreen from '../../screens/customer/QuoteListScreen';
import QuoteAcceptScreen from '../../screens/customer/QuoteAcceptScreen';
import MyJobsScreen from '../../screens/customer/MyJobsScreen';
import JobDetailScreen from '../../screens/cleaner/JobDetailScreen';
import RecordQuoteScreen from '../../screens/cleaner/RecordQuoteScreen';
import QuoteSentScreen from '../../screens/cleaner/QuoteSentScreen';

import { COLORS } from '../../utils/constants';
import { getMainTabStackOptions } from '../../navigation/mainTabStackOptions';
import { useMainTabsInterfaceRole } from '../../navigation/mainTabsInterfaceRole';
// Responsive container wrapper removed per user request

const Stack = createStackNavigator<any>();

// Customer Stack Navigation
const CustomerDiscoverStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="DiscoverFeed">
      <Stack.Screen name="DiscoverFeed" component={DiscoverScreen as any} />
      <Stack.Screen name="BookService" component={BookServiceScreen as any} />
      <Stack.Screen name="PostJob" component={PostJobScreen as any} />
      <Stack.Screen name="QuoteList" component={QuoteListScreen as any} />
      <Stack.Screen name="QuoteAccept" component={QuoteAcceptScreen as any} />
      <Stack.Screen name="MyJobs" component={MyJobsScreen as any} />
      <Stack.Screen name="Bookings" component={BookingScreen as any} />
      <Stack.Screen name="BookingFlow" component={NewBookingFlowScreen as any} />
      <Stack.Screen name="BookingConfirmed" component={BookingConfirmedScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen as any} />
  </Stack.Navigator>
);

// Cleaner Profile Stack (using new refactored ProfileScreen)
const CleanerProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CleanerProfile" component={CleanerProfileScreen} />
    <Stack.Screen name="VideoUpload" component={VideoUploadScreen} />
    <Stack.Screen name="CameraView" component={CameraView} />
    <Stack.Screen name="ContentCreation" component={ContentCreationScreen} />
    <Stack.Screen name="Content" component={CleanerContentScreen} />
    <Stack.Screen name="EarningsBreakdown" component={EarningsBreakdownScreen} />
    <Stack.Screen name="HeroStats" component={HeroStatsScreen} />
    <Stack.Screen name="CalendarSettings" component={CalendarSettingsScreen} />
    <Stack.Screen name="RateManager" component={RateManagerScreen} />
    <Stack.Screen name="ProServices" component={ProServicesScreen as any} />
  </Stack.Navigator>
);

const CustomerNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="Content"
      screenOptions={({ route }) => ({
        headerShown: false,
        ...getMainTabStackOptions(route.name),
      })}
    >
      <Stack.Screen name="Home" component={CustomerProfileScreen as any} />
      <Stack.Screen name="Content" component={VideoFeedScreen as any} />
      <Stack.Screen name="Discover" component={CustomerDiscoverStack as any} />
      <Stack.Screen name="Tracking" component={TrackingScreen as any} />
      <Stack.Screen name="LiveTracking" component={LiveTrackingScreen as any} />
      <Stack.Screen name="Messages" component={MessagesScreen as any} />
      <Stack.Screen name="Profile" component={CustomerProfileScreen as any} />
      <Stack.Screen name="Dashboard" component={CustomerDashboardScreen as any} />
      <Stack.Screen name="Bookings" component={BookingScreen as any} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen as any} />
      <Stack.Screen name="BookingFlow" component={NewBookingFlowScreen as any} />
      <Stack.Screen name="ContentCreation" component={ContentCreationScreen as any} />
      <Stack.Screen name="Tips" component={TipsScreen as any} />
      <Stack.Screen name="PaymentScreen" component={PaymentScreen as any} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen as any} />
      <Stack.Screen name="EditProfileScreen" component={EditProfileScreen as any} />
      <Stack.Screen name="AddressManagementScreen" component={AddressManagementScreen as any} />
      <Stack.Screen name="SavedServices" component={SavedServicesScreen as any} />
      <Stack.Screen name="JobDetails" component={JobDetailsScreen as any} />
      <Stack.Screen name="PostJob" component={PostJobScreen as any} />
      <Stack.Screen name="QuoteList" component={QuoteListScreen as any} />
      <Stack.Screen name="QuoteAccept" component={QuoteAcceptScreen as any} />
      <Stack.Screen name="MyJobs" component={MyJobsScreen as any} />
      <Stack.Screen name="BookingConfirmed" component={BookingConfirmedScreen} />

    </Stack.Navigator>
  );
};

const ProNotificationsSubscriber = () => {
  useProNotifications();
  return null;
};

const CleanerNavigator = () => {
  const [initialRoute, setInitialRoute] = React.useState<string>('Dashboard');

  React.useEffect(() => {
    const checkJustOnboarded = async () => {
      try {
        const justOnboarded = await AsyncStorage.getItem('cleaner_just_onboarded');
        if (justOnboarded === 'true') {
          await AsyncStorage.removeItem('cleaner_just_onboarded');
          setInitialRoute('Jobs');
        }
      } catch {
        // keep Dashboard
      }
    };
    void checkJustOnboarded();
  }, []);

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={({ route }) => ({
        headerShown: false,
        gestureEnabled: true,
        ...getMainTabStackOptions(route.name),
      })}
    >
      <Stack.Screen name="Home" component={CleanerProfileScreen as any} />
      <Stack.Screen name="Dashboard" component={CleanerDashboardScreen as any} />
      <Stack.Screen name="Jobs" component={CleanerJobsScreen as any} />
      <Stack.Screen name="Content" component={CleanerContentScreen as any} />
      <Stack.Screen name="Schedule" component={CleanerScheduleScreen} />
      <Stack.Screen name="Earnings" component={CleanerEarningsScreen as any} />
      <Stack.Screen name="EarningsBreakdown" component={EarningsBreakdownScreen} />
      <Stack.Screen name="HeroStats" component={HeroStatsScreen} />
      <Stack.Screen name="CalendarSettings" component={CalendarSettingsScreen} />
      <Stack.Screen name="RateManager" component={RateManagerScreen} />
      <Stack.Screen name="ProServices" component={ProServicesScreen as any} />
      <Stack.Screen name="Messages" component={CleanerMessagesScreen as any} />
      <Stack.Screen name="Profile" component={CleanerProfileStack as any} />
      <Stack.Screen name="VideoUpload" component={VideoUploadScreen as any} />
      <Stack.Screen name="CameraView" component={CameraView as any} />
      <Stack.Screen name="ContentCreation" component={ContentCreationScreen as any} />
      <Stack.Screen name="Tips" component={TipsScreen as any} />
      <Stack.Screen name="PaymentScreen" component={PaymentScreen as any} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen as any} />
      <Stack.Screen name="EditProfileScreen" component={EditProfileScreen as any} />
      <Stack.Screen name="AddressManagementScreen" component={AddressManagementScreen as any} />
      <Stack.Screen name="SavedServices" component={SavedServicesScreen as any} />
      <Stack.Screen name="JobDetails" component={JobDetailsScreen as any} />
      <Stack.Screen name="CleanerProfileEdit" component={CleanerProfileEditScreen as any} />
      <Stack.Screen name="QuoteJobDetail" component={JobDetailScreen as any} />
      <Stack.Screen name="RecordQuote" component={RecordQuoteScreen as any} />
      <Stack.Screen name="QuoteSent" component={QuoteSentScreen as any} />
      <Stack.Screen name="LiveTracking" component={LiveTrackingScreen as any} />

    </Stack.Navigator>
  );
};

const RoleBasedTabNavigator = () => {
  const { isCleaner, isCustomer, isAuthenticated, user } = useAuth();
  const { interfaceIsCleaner: effectiveIsCleaner, resolvedRole } = useMainTabsInterfaceRole();
  const effectiveIsCustomer = resolvedRole === 'customer' || !resolvedRole;
  
  // Debug logging
  console.log('🔍 Role Debug:', {
    isAuthenticated,
    isCleaner,
    isCustomer,
    resolvedRole,
    effectiveIsCleaner,
    effectiveIsCustomer,
    userRole: user?.role,
    userName: user?.name
  });

  // Show role selection modal for guest users who haven't chosen a role
  // Remove welcome/role selection screen for guest flow: proceed directly
  // Guests choose role at the moment they tap Continue as Guest in Auth

  // Show appropriate interface based on role
  console.log('🚦 Interface selection decision:', {
    effectiveIsCleaner,
    effectiveIsCustomer,
    resolvedRole,
    userRole: user?.role,
    userName: user?.name,
    willLoadCleanerInterface: effectiveIsCleaner
  });
  
  if (effectiveIsCleaner) {
    return (
      <>
        <ProNotificationsSubscriber />
        <CleanerNavigator />
      </>
    );
  }
  return <CustomerNavigator />;
};

export default RoleBasedTabNavigator; 