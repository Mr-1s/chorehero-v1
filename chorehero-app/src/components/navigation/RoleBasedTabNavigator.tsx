import React, { useState, useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../hooks/useAuth';
import RoleSelectionModal from '../RoleSelectionModal';
import RoleIndicator from '../RoleIndicator';

// Customer Screens
import CustomerDashboardScreen from '../../screens/customer/DashboardScreen';
import CustomerProfileScreen from '../../screens/customer/ProfileScreen';
import TrackingScreen from '../../screens/customer/TrackingScreen';

// Cleaner Screens  
import CleanerDashboardScreen from '../../screens/cleaner/DashboardScreen';
import CleanerProfileScreen from '../../screens/cleaner/ProfileScreen';
import CleanerEarningsScreen from '../../screens/cleaner/EarningsScreen';
import CleanerJobsScreen from '../../screens/cleaner/JobsScreen';
import CleanerScheduleScreen from '../../screens/cleaner/ScheduleScreen';
import VideoUploadScreen from '../../screens/cleaner/VideoUploadScreen';
// CleanerContentScreen removed - Content button now goes directly to ContentCreation

// Shared Screens
import DiscoverScreen from '../../screens/shared/DiscoverScreen';
import MessagesScreen from '../../screens/shared/MessagesScreen';
import BookingScreen from '../../screens/shared/BookingScreen';
import BookingFlowScreen from '../../screens/shared/BookingFlowScreen';
import DynamicBookingScreen from '../../screens/booking/DynamicBookingScreen';
import ContentFeedScreen from '../../screens/shared/ContentFeedScreen';
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

const Stack = createStackNavigator();

// Content Stack for both users
const ContentStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ContentFeed" component={ContentFeedScreen} />
    <Stack.Screen name="ContentCreation" component={ContentCreationScreen} />
    <Stack.Screen name="UserProfile" component={UserProfileScreen} />
  </Stack.Navigator>
);

// Customer Stack Navigation
const CustomerDiscoverStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Discover" component={DiscoverScreen} />
    <Stack.Screen name="BookingFlow" component={BookingFlowScreen} />
    <Stack.Screen name="DynamicBooking" component={DynamicBookingScreen} />
    <Stack.Screen name="UserProfile" component={UserProfileScreen} />
  </Stack.Navigator>
);

// Cleaner Profile Stack
const CleanerProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CleanerProfile" component={CleanerProfileScreen} />
    <Stack.Screen name="VideoUpload" component={VideoUploadScreen} />
    <Stack.Screen name="ContentCreation" component={ContentCreationScreen} />
  </Stack.Navigator>
);

const CustomerNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={CustomerProfileScreen} />
      <Stack.Screen name="Content" component={VideoFeedScreen} />
      <Stack.Screen name="ContentFeed" component={ContentFeedScreen} />
      <Stack.Screen name="Discover" component={CustomerDiscoverStack} />
      <Stack.Screen name="Tracking" component={TrackingScreen} />
      <Stack.Screen name="Messages" component={MessagesScreen} />
      <Stack.Screen name="Profile" component={CustomerProfileScreen} />
      <Stack.Screen name="Dashboard" component={CustomerDashboardScreen} />
      <Stack.Screen name="Bookings" component={BookingScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="BookingFlow" component={BookingFlowScreen} />
      <Stack.Screen name="DynamicBooking" component={DynamicBookingScreen} />
      <Stack.Screen name="ContentCreation" component={ContentCreationScreen} />
      <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="EditProfileScreen" component={EditProfileScreen} />
      <Stack.Screen name="AddressManagementScreen" component={AddressManagementScreen} />
      <Stack.Screen name="SavedServices" component={SavedServicesScreen} />
      <Stack.Screen name="JobDetails" component={JobDetailsScreen} />

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
    >
      <Stack.Screen name="Home" component={CleanerProfileScreen} />
      <Stack.Screen name="Dashboard" component={CleanerDashboardScreen} />
      <Stack.Screen name="Jobs" component={CleanerJobsScreen} />
      <Stack.Screen name="Heroes" component={VideoFeedScreen} />
                  {/* Content screen removed - Content button now goes directly to ContentCreation */}
      <Stack.Screen name="Schedule" component={CleanerScheduleScreen} />
      <Stack.Screen name="Earnings" component={CleanerEarningsScreen} />
      <Stack.Screen name="Messages" component={MessagesScreen} />
      <Stack.Screen name="Profile" component={CleanerProfileStack} />
      <Stack.Screen name="VideoUpload" component={VideoUploadScreen} />
      <Stack.Screen name="ContentCreation" component={ContentCreationScreen} />
      <Stack.Screen name="ContentFeed" component={ContentFeedScreen} />
      <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="EditProfileScreen" component={EditProfileScreen} />
      <Stack.Screen name="AddressManagementScreen" component={AddressManagementScreen} />
      <Stack.Screen name="SavedServices" component={SavedServicesScreen} />
      <Stack.Screen name="JobDetails" component={JobDetailsScreen} />
      <Stack.Screen name="CleanerProfileEdit" component={CleanerProfileEditScreen} />

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
  if (!isAuthenticated && showRoleSelection) {
    console.log('🚪 Showing role selection modal for guest user');
    return (
      <>
        <CustomerNavigator />
        <RoleIndicator />
        <RoleSelectionModal
          visible={showRoleSelection}
          onRoleSelected={handleRoleSelected}
        />
      </>
    );
  }

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
        <RoleIndicator />
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
        <RoleIndicator />
        <RoleSelectionModal
          visible={showRoleSelection}
          onRoleSelected={handleRoleSelected}
        />
      </>
    );
  }
};

export default RoleBasedTabNavigator; 