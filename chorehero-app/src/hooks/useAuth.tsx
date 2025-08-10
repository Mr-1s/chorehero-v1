import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, onAuthStateChange } from '../services/auth';
import { AuthUser, User } from '../types/user';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { demoAuth } from '../services/demoAuth';

interface AuthContextType {
  // Current auth state
  authUser: AuthUser | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Auth actions
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  
  // Helper methods
  isCustomer: boolean;
  isCleaner: boolean;
  isVerifiedCleaner: boolean;
  
  // Demo methods
  isDemoMode: boolean;
  setDemoUser: (role: 'customer' | 'cleaner', cleanerType?: 'sarah' | 'marcus' | 'emily') => Promise<void>;
  clearDemo: () => Promise<void>;
  forceResetAllSessions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    // Check for existing session on app start
    const checkSession = async () => {
      try {
        // First check for real Supabase session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('🚨 Session check error:', error);
          // Clear any invalid stored sessions
          await supabase.auth.signOut();
          await demoAuth.clearDemoUser(); // Clear all demo sessions
          setAuthUser(null);
          setIsDemoMode(false);
          setIsLoading(false);
          return;
        }
        
        if (session?.user) {
          // User is authenticated with Supabase, get their profile
          const response = await authService.getCurrentUser();
          if (response.success && response.data) {
            setAuthUser(response.data);
            // Ensure demo mode is disabled for real authenticated users
            setIsDemoMode(false);
          } else {
            // Failed to get user profile, clear session
            console.error('❌ Failed to get user profile, clearing session');
            await supabase.auth.signOut();
            setAuthUser(null);
          }
        } else {
          // No real auth session, check for demo mode
          const demoUserData = await demoAuth.getDemoUser();
          if (demoUserData && demoUserData.id && demoUserData.name && demoUserData.role) {
            // Create a demo auth user with valid demo account data
            const demoUser: AuthUser = {
              user: {
                id: demoUserData.id,
                email: demoUserData.email,
                role: demoUserData.role as 'customer' | 'cleaner',
                name: demoUserData.name,
                created_at: new Date().toISOString(),
                profile_completed: true,
                avatar_url: demoUserData.avatar_url
              }
            };
            setAuthUser(demoUser);
            setIsDemoMode(true);
            console.log('✅ Demo user loaded:', demoUserData.name, 'Role:', demoUserData.role);
          } else if (demoUserData) {
            // Corrupted demo data found, clear it
            console.warn('⚠️ Corrupted demo data found, clearing:', demoUserData);
            await demoAuth.clearDemoUser();
            setAuthUser(null);
            setIsDemoMode(false);
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    // Set up Supabase auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state change:', event, session ? 'session exists' : 'no session');
      
      if (event === 'SIGNED_IN' && session?.user) {
        // User signed in, get their profile
        try {
          const response = await authService.getCurrentUser();
          if (response.success && response.data) {
            setAuthUser(response.data);
            // Disable demo mode on real sign-in
            setIsDemoMode(false);
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
        // User signed out or token refresh failed, clear auth state
        console.log('🚪 Clearing auth state due to sign out or failed token refresh');
        setAuthUser(null);
        // Clear any stored demo role as well
        AsyncStorage.removeItem('demo_user_role').catch(console.error);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Token successfully refreshed, update user data
        try {
          const response = await authService.getCurrentUser();
          if (response.success && response.data) {
            setAuthUser(response.data);
          }
        } catch (error) {
          console.error('Error loading user profile after token refresh:', error);
          // If we can't get user profile after token refresh, sign out
          await signOut();
        }
      }
      setIsLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Computed values - recalculated when authUser changes
  const user = authUser?.user || null;
  const isAuthenticated = !!authUser;
  const isCustomer = user?.role === 'customer';
  const isCleaner = user?.role === 'cleaner';
  const isVerifiedCleaner = 
    isCleaner && 
    'verification_status' in user && 
    user.verification_status === 'verified';

  // Debug log computed values when they change
  useEffect(() => {
    console.log('🧮 Computed values updated:', {
      user: user?.name,
      role: user?.role,
      isAuthenticated,
      isCustomer,
      isCleaner,
      isDemoMode
    });
    
    // Detect and fix corrupted demo mode
    if (isDemoMode && !user?.name) {
      console.warn('⚠️ Corrupted demo mode detected (isDemoMode=true but no user data), clearing...');
      clearDemo().catch(console.error);
    }
  }, [user, isAuthenticated, isCustomer, isCleaner, isDemoMode]);

  // Sign out
  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Check if user is authenticated with Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Real user - sign out from Supabase
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('Supabase sign out error:', error);
          Alert.alert('Error', 'Sign out failed');
          return;
        }
      }
      
      // Clear demo role from AsyncStorage (for both real and demo users)
      await AsyncStorage.removeItem('demo_user_role');
      console.log('Demo role cleared from AsyncStorage');
      
      // Clear auth state
      setAuthUser(null);
      
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Sign out failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh session
  const refreshSession = async () => {
    try {
      const response = await authService.refreshSession();
      if (response.success && response.data) {
        setAuthUser(response.data);
      } else if (response.error) {
        console.warn('Session refresh failed:', response.error);
        // Handle different types of session errors
        if (response.error.includes('Invalid Refresh Token') || 
            response.error.includes('Refresh Token Not Found') ||
            response.error.includes('Auth session missing')) {
          console.log('🧹 Invalid/missing session, clearing auth state');
          await demoAuth.clearDemoUser(); // Clear any demo sessions too
          setAuthUser(null);
          setIsDemoMode(false);
        }
      }
    } catch (error) {
      console.warn('Session refresh error:', error);
      // Clear auth state instead of calling signOut to avoid loops
      console.log('🧹 Clearing auth state due to refresh error');
      await demoAuth.clearDemoUser();
      setAuthUser(null);
      setIsDemoMode(false);
    }
  };

  // Update profile
  const updateProfile = async (updates: Partial<User>) => {
    if (!user) {
      throw new Error('No authenticated user');
    }

    try {
      setIsLoading(true);
      const response = await authService.updateProfile(user.id, updates);
      
      if (response.success) {
        // Update the auth user with new profile data
        setAuthUser(prev => prev ? {
          ...prev,
          user: response.data,
        } : null);
      } else {
        throw new Error(response.error || 'Profile update failed');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    if (!authUser) return;
    
    try {
      setIsLoading(true);
      const response = await authService.getCurrentUser();
      
      if (response.success) {
        setAuthUser(response.data);
      }
    } catch (error) {
      console.error('Refresh user error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Demo authentication methods
  const setDemoUser = async (role: 'customer' | 'cleaner', cleanerType?: 'sarah' | 'marcus' | 'emily') => {
    try {
      console.log('🚀 setDemoUser called with role:', role, 'cleanerType:', cleanerType);
      
      // Set the demo user data first
      await demoAuth.setDemoUser(role, cleanerType);
      console.log('✅ Demo user data stored successfully');
      
      // Get the demo user data and set it in state
      const demoUserData = await demoAuth.getDemoUser();
      console.log('📖 Retrieved demo user data:', demoUserData);
      
      if (demoUserData) {
        const demoUser: AuthUser = {
          user: {
            id: demoUserData.id,
            email: demoUserData.email,
            role: demoUserData.role as 'customer' | 'cleaner',
            name: demoUserData.name,
            created_at: new Date().toISOString(),
            profile_completed: true,
            avatar_url: demoUserData.avatar_url
          }
        };
        
        console.log('🎯 Setting authUser in state:', demoUser.user);
        setAuthUser(demoUser);
        setIsDemoMode(true);
        console.log('✅ Demo user set in auth context:', demoUser.user.name, 'Role:', demoUser.user.role);
      } else {
        console.error('❌ No demo user data retrieved after setting');
      }
    } catch (error) {
      console.error('❌ Error setting demo user:', error);
    }
  };

  const clearDemo = async () => {
    try {
      await demoAuth.clearDemoUser();
      setAuthUser(null);
      setIsDemoMode(false);
      console.log('✅ Demo cleared from auth context');
    } catch (error) {
      console.error('❌ Error clearing demo:', error);
    }
  };

  const forceResetAllSessions = async () => {
    try {
      // Clear Supabase session
      await supabase.auth.signOut();
      
      // Force clear all AsyncStorage
      await demoAuth.forceResetAllSessions();
      
      // Reset auth state
      setAuthUser(null);
      setIsDemoMode(false);
      
      console.log('🧹 Force reset complete - all sessions cleared');
    } catch (error) {
      console.error('❌ Error force resetting sessions:', error);
    }
  };

  const contextValue: AuthContextType = {
    // State
    authUser,
    user,
    isLoading,
    isAuthenticated,
    
    // Actions
    signOut,
    refreshSession,
    refreshUser,
    updateProfile,
    
    // Computed values
    isCustomer,
    isCleaner,
    isVerifiedCleaner,
    
    // Demo methods
    isDemoMode,
    setDemoUser,
    clearDemo,
    forceResetAllSessions,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// HOC for screens that require authentication
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    requireRole?: 'customer' | 'cleaner';
    requireVerification?: boolean;
  }
) => {
  return (props: P) => {
    const { isAuthenticated, user, isLoading } = useAuth();

    if (isLoading) {
      return null; // Or loading spinner
    }

    if (!isAuthenticated || !user) {
      return null; // Will be handled by app navigation
    }

    // Check role requirement
    if (options?.requireRole && user.role !== options.requireRole) {
      Alert.alert(
        'Access Denied',
        `This feature is only available for ${options.requireRole}s.`
      );
      return null;
    }

    // Check verification requirement for cleaners
    if (
      options?.requireVerification && 
      user.role === 'cleaner' &&
      'verification_status' in user &&
      user.verification_status !== 'verified'
    ) {
      Alert.alert(
        'Verification Required',
        'Your cleaner profile must be verified to access this feature.'
      );
      return null;
    }

    return <Component {...props} />;
  };
};

// Utility hook for role-based navigation
export const useRoleBasedNavigation = () => {
  const { user, isCustomer, isCleaner, isVerifiedCleaner } = useAuth();

  const getHomeScreen = () => {
    if (isCustomer) {
      return 'CustomerHome';
    } else if (isCleaner) {
      if (isVerifiedCleaner) {
        return 'CleanerHome';
      } else {
        return 'CleanerOnboarding';
      }
    }
    return 'Auth';
  };

  const canAccess = (screen: string): boolean => {
    // Define screen access rules
    const customerScreens = ['CustomerHome', 'DiscoverCleaners', 'BookingFlow', 'TrackingScreen'];
    const cleanerScreens = ['CleanerHome', 'JobsScreen', 'EarningsScreen', 'ScheduleScreen'];
    const verifiedCleanerScreens = ['AcceptJob', 'ActiveJob'];

    if (customerScreens.includes(screen)) {
      return isCustomer;
    }

    if (cleanerScreens.includes(screen)) {
      return isCleaner;
    }

    if (verifiedCleanerScreens.includes(screen)) {
      return isVerifiedCleaner;
    }

    // Shared screens
    const sharedScreens = ['Chat', 'Profile', 'Ratings', 'Settings'];
    if (sharedScreens.includes(screen)) {
      return !!user;
    }

    return false;
  };

  return {
    getHomeScreen,
    canAccess,
    user,
    isCustomer,
    isCleaner,
    isVerifiedCleaner,
  };
};