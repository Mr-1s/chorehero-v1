import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';
import { TESTING } from '../utils/constants';

import type { StackNavigationProp } from '@react-navigation/stack';

interface RoleBasedUIProps {
  navigation?: StackNavigationProp<any>;
  children?: React.ReactNode;
  showUploadButton?: boolean;
  cleanerContent?: React.ReactNode;
  customerContent?: React.ReactNode;
}

const RoleBasedUI: React.FC<RoleBasedUIProps> = ({
  navigation,
  children,
  showUploadButton = false,
  cleanerContent,
  customerContent,
}) => {
  // Use actual auth context and role features
  const { user, isCustomer, isCleaner } = useAuth();
  const { userRole, isCleaner: effectiveIsCleaner, isCustomer: effectiveIsCustomer } = useRoleFeatures();

  return (
    <View style={styles.container}>
      {children}
      
      {/* Role-specific content */}
      {effectiveIsCleaner && cleanerContent}
      {effectiveIsCustomer && customerContent}
      
      {/* Cleaner Upload Button - Removed as requested */}
      

    </View>
  );
};

// Hook for role-based feature flags
export const useRoleFeatures = () => {
  // Use actual auth context
  const { user, isCustomer, isCleaner } = useAuth();
  const [demoRole, setDemoRole] = useState<string | null>(null);
  const userRole = user?.role || 'customer';
  
  // Check for guest role in AsyncStorage
  useEffect(() => {
    const checkDemoRole = async () => {
      try {
        const storedRole = await AsyncStorage.getItem('guest_user_role');
        setDemoRole(storedRole);
      } catch (error) {
        console.error('Error reading demo role:', error);
      }
    };
    checkDemoRole();
    
    // Set up a listener for demo role changes
    const interval = setInterval(checkDemoRole, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Testing override - force cleaner mode if enabled OR if demo role is cleaner
  const forceCleanerMode = TESTING.FORCE_CLEANER_MODE || demoRole === 'cleaner';
  const effectiveIsCleaner = forceCleanerMode || isCleaner;
  const effectiveIsCustomer = !forceCleanerMode && isCustomer;

  return {
    // Cleaner features
    canUploadVideos: effectiveIsCleaner,
    canManageBookings: effectiveIsCleaner,
    canSetPricing: effectiveIsCleaner,
    canViewEarnings: effectiveIsCleaner,
    
    // Customer features  
    canBookServices: effectiveIsCustomer,
    canRateCleaners: effectiveIsCustomer,
    canTrackBookings: effectiveIsCustomer,
    
    // Shared features
    canChat: true,
    canViewProfile: true,
    canManageSettings: true,
    
    // UI flags
    showUploadButton: effectiveIsCleaner,
    showBookingButton: effectiveIsCustomer,
    showEarningsTab: effectiveIsCleaner,
    showTrackingTab: effectiveIsCustomer,
    
    // Role info
    userRole: forceCleanerMode ? 'cleaner' : userRole,
    isCustomer: effectiveIsCustomer,
    isCleaner: effectiveIsCleaner,
  };
};



// Component for role-specific headers
export const RoleHeader: React.FC<{ title?: string }> = ({ title }) => {
  const { userRole, isCleaner } = useRoleFeatures();
  
  const getHeaderColor = () => {
    return isCleaner ? '#FF6B6B' : '#3ad3db';
  };
  
  const getHeaderTitle = () => {
    if (title) return title;
    return isCleaner ? 'Cleaner Dashboard' : 'Find Cleaners';
  };

  return (
    <View style={[styles.header, { backgroundColor: getHeaderColor() }]}>
      <Text style={styles.headerTitle}>{getHeaderTitle()}</Text>
      <Text style={styles.headerSubtitle}>
        {isCleaner ? 'Manage your cleaning business' : 'Book trusted cleaners'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  roleIndicator: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1000,
  },
  roleText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  roleSubtext: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '400',
    opacity: 0.8,
    marginTop: 2,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
});

export default RoleBasedUI; 