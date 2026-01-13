import React, { useState, useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../hooks/useAuth';
import RoleSelectionModal from '../RoleSelectionModal';

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


import { COLORS } from '../../utils/constants';
// Responsive container wrapper removed per user request

const Stack = createStackNavigator<any>();

// Customer Stack Navigation
const CustomerDiscoverStack = () => (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Discover" component={DiscoverScreen as any} />
      <Stack.Screen name="BookingFlow" component={NewBookingFlowScreen as any} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen as any} />
  </Stack.Navigator>
);

// Cleaner Profile Stack (using new refactored ProfileScreen)
const CleanerProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CleanerProfile" component={CleanerProfileScreen} />
    <Stack.Screen name="VideoUpload" component={VideoUploadScreen} />
    <Stack.Screen name="ContentCreation" component={ContentCreationScreen} />
    <Stack.Screen name="Content" component={CleanerContentScreen} />
  </Stack.Navigator>
);

const CustomerNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Content">
      <Stack.Screen name="Home" component={CustomerProfileScreen as any} />
      <Stack.Screen name="Content" component={VideoFeedScreen as any} />
      <Stack.Screen name="Discover" component={CustomerDiscoverStack as any} />
      <Stack.Screen name="Tracking" component={TrackingScreen as any} />
      <Stack.Screen name="Messages" component={MessagesScreen as any} />
      <Stack.Screen name="Profile" component={CustomerProfileScreen as any} />
      <Stack.Screen name="Dashboard" component={CustomerDashboardScreen as any} />
      <Stack.Screen name="Bookings" component={BookingScreen as any} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen as any} />
      <Stack.Screen name="BookingFlow" component={NewBookingFlowScreen as any} />
      <Stack.Screen name="ContentCreation" component={ContentCreationScreen as any} />
      <Stack.Screen name="PaymentScreen" component={PaymentScreen as any} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen as any} />
      <Stack.Screen name="EditProfileScreen" component={EditProfileScreen as any} />
      <Stack.Screen name="AddressManagementScreen" component={AddressManagementScreen as any} />
      <Stack.Screen name="SavedServices" component={SavedServicesScreen as any} />
      <Stack.Screen name="JobDetails" component={JobDetailsScreen as any} />

    </Stack.Navigator>
  );
};

const CleanerNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
      }}
      initialRouteName="Heroes"
    >
      <Stack.Screen name="Home" component={CleanerProfileScreen as any} />
      <Stack.Screen name="Dashboard" component={CleanerDashboardScreen as any} />
      <Stack.Screen name="Jobs" component={CleanerJobsScreen as any} />
      <Stack.Screen name="Heroes" component={TipsScreen as any} />
      <Stack.Screen name="Content" component={CleanerContentScreen as any} />
      <Stack.Screen name="Schedule" component={CleanerScheduleScreen} />
      <Stack.Screen name="Earnings" component={CleanerEarningsScreen as any} />
      <Stack.Screen name="Messages" component={CleanerMessagesScreen as any} />
      <Stack.Screen name="Profile" component={CleanerProfileStack as any} />
      <Stack.Screen name="VideoUpload" component={VideoUploadScreen as any} />
      <Stack.Screen name="ContentCreation" component={ContentCreationScreen as any} />
      <Stack.Screen name="PaymentScreen" component={PaymentScreen as any} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen as any} />
      <Stack.Screen name="EditProfileScreen" component={EditProfileScreen as any} />
      <Stack.Screen name="AddressManagementScreen" component={AddressManagementScreen as any} />
      <Stack.Screen name="SavedServices" component={SavedServicesScreen as any} />
      <Stack.Screen name="JobDetails" component={JobDetailsScreen as any} />
      <Stack.Screen name="CleanerProfileEdit" component={CleanerProfileEditScreen as any} />

    </Stack.Navigator>
  );
};

const RoleBasedTabNavigator = () => {
  const { isCleaner, isCustomer, isAuthenticated, user } = useAuth();
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const [guestRole, setGuestRole] = useState<'customer' | 'cleaner' | null>(null);

  // Check for demo role on mount (only for non-authenticated users)
  useEffect(() => {
    const checkDemoRole = async () => {
      try {
        console.log('🔍 checkDemoRole called - Current state:', {
          isAuthenticated,
          isCleaner,
          isCustomer,
          userName: user?.name
        });
        
         if (isAuthenticated) {
          // For real authenticated users, ignore demo role
          console.log('Real authenticated user detected, ignoring demo role');
          setGuestRole(null);
          setShowRoleSelection(false);
          setIsLoadingRole(false);
          return;
        }
        
        // For guest users, check if they have a stored role preference
        const storedGuestRole = await AsyncStorage.getItem('guest_user_role');
        if (storedGuestRole === 'customer' || storedGuestRole === 'cleaner') {
          console.log('🎭 Found stored guest role:', storedGuestRole);
          setGuestRole(storedGuestRole);
          setShowRoleSelection(false);
        } else {
          // No stored role, show selection modal
          console.log('🎭 No stored guest role, showing selection modal');
          setGuestRole(null);
          setShowRoleSelection(true);
        }
        
        setIsLoadingRole(false);
      } catch (error) {
        console.error('Error in navigation setup:', error);
        setShowRoleSelection(true); // Show role selection for guests
        setIsLoadingRole(false);
      }
    };

    checkDemoRole();
  }, [isCleaner, isCustomer, isAuthenticated, user]);

  const handleRoleSelected = async (role: 'customer' | 'cleaner') => {
    try {
      console.log('🎯 Setting guest user role:', role);
      // Store the selected role in AsyncStorage for guest mode
      await AsyncStorage.setItem('guest_user_role', role);
      setGuestRole(role);
      setShowRoleSelection(false);
    } catch (error) {
      console.error('❌ Role selection error:', error);
      setShowRoleSelection(false);
    }
  };

  // Determine which interface to show
  // Priority: Real auth > Guest role selection > Default to customer
  const effectiveIsCleaner = isAuthenticated ? isCleaner : guestRole === 'cleaner';
  const effectiveIsCustomer = isAuthenticated ? isCustomer : guestRole === 'customer' || guestRole === null;
  
  // Debug logging
  console.log('🔍 Role Debug:', {
    isAuthenticated,
    isCleaner,
    isCustomer,
    guestRole,
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
    guestRole,
    userRole: user?.role,
    userName: user?.name,
    willLoadCleanerInterface: effectiveIsCleaner
  });
  
  if (effectiveIsCleaner) {
    console.log('🧹 Loading CLEANER interface for:', user?.name);
    return (
      <>
        <CleanerNavigator />
        <RoleSelectionModal
          visible={showRoleSelection}
          onRoleSelected={handleRoleSelected}
        />
      </>
    );
  } else {
    console.log('👤 Loading CUSTOMER interface (else branch) for:', user?.name);
    return (
      <>
        <CustomerNavigator />
        <RoleSelectionModal
          visible={showRoleSelection}
          onRoleSelected={handleRoleSelected}
        />
      </>
    );
  }
};

export default RoleBasedTabNavigator; 