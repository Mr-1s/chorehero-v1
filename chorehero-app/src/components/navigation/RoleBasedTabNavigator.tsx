import React, { useState, useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
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
import DummyWalletScreen from '../../screens/shared/DummyWalletScreen';

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
      <Stack.Screen name="DummyWallet" component={DummyWalletScreen} />
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
      <Stack.Screen name="DummyWallet" component={DummyWalletScreen} />
    </Stack.Navigator>
  );
};

const RoleBasedTabNavigator = () => {
  const { isCleaner, isCustomer, isAuthenticated, isDemoMode, setDemoUser, user } = useAuth();
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [showRoleSelection, setShowRoleSelection] = useState(false);

  // Check for demo role on mount (only for non-authenticated users)
  useEffect(() => {
    const checkDemoRole = async () => {
      try {
        console.log('🔍 checkDemoRole called - Current state:', {
          isAuthenticated,
          isDemoMode,
          isCleaner,
          isCustomer,
          userName: user?.name
        });
        
         if (isAuthenticated && !isDemoMode) {
          // For real authenticated users without demo mode, ignore demo role
          console.log('Real authenticated user detected, ignoring demo role');
          setIsLoadingRole(false);
          return;
        }
        
        if (isAuthenticated && isDemoMode) {
          // Real user with demo mode active - prefer demo mode
          console.log('Real user with demo mode active - using demo role');
        }

        // Show role selection if no demo mode, not authenticated, and no valid role
        if (!isAuthenticated && !isDemoMode && !isCleaner && !isCustomer) {
          console.log('No auth, no demo mode, no role - showing role selection');
          setShowRoleSelection(true);
          } else {
          console.log('Auth, demo mode, or role exists - hiding role selection');
          setShowRoleSelection(false);
        }
        
        setIsLoadingRole(false);
      } catch (error) {
        console.error('Error checking demo role:', error);
        if (!isAuthenticated) {
          setShowRoleSelection(true);
        }
        setIsLoadingRole(false);
      }
    };

    checkDemoRole();
  }, [isCleaner, isCustomer, isAuthenticated, isDemoMode, user]);

  const handleRoleSelected = async (role: 'customer' | 'cleaner') => {
    try {
      console.log('🎯 Setting demo user role:', role);
      // Use the new demo system to set a specific demo user
      const cleanerType = role === 'cleaner' ? 'sarah' : undefined; // Default to Sarah for demo
      await setDemoUser(role, cleanerType);
      setShowRoleSelection(false);
      console.log('✅ Demo role selected and set:', role);
      
      // Force a small delay and re-check to ensure state updates
      setTimeout(() => {
        console.log('🔄 Checking updated auth state after demo setup');
        setIsLoadingRole(false); // Force re-render
      }, 200);
    } catch (error) {
      console.error('❌ Error setting demo user:', error);
    }
  };

  // Determine which interface to show based on auth or demo mode
  // Priority: Real auth > Demo mode > Default customer
  const effectiveIsCleaner = isAuthenticated ? isCleaner : (isDemoMode ? isCleaner : false);
  const effectiveIsCustomer = isAuthenticated ? isCustomer : (isDemoMode ? isCustomer : false);
  
  // Debug logging
  console.log('🔍 Role Debug:', {
    isAuthenticated,
    isDemoMode,
    isCleaner,
    isCustomer,
    effectiveIsCleaner,
    effectiveIsCustomer,
    userRole: user?.role,
    userName: user?.name
  });

  // Show role selection modal if no role is determined (only for non-authenticated, non-demo users)
  if (!isAuthenticated && !isDemoMode && (isLoadingRole || (!effectiveIsCleaner && !effectiveIsCustomer))) {
    console.log('🚪 Showing role selection modal', {
      isLoadingRole,
      effectiveIsCleaner,
      effectiveIsCustomer,
      showRoleSelection
    });
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