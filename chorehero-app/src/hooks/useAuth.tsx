import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, onAuthStateChange } from '../services/auth';
import { AuthUser, User } from '../types/user';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { getOrCreateGuestId, migrateGuestInteractions } from '../utils/guestSession';
import { applyPendingActionToInteractions, consumePendingAuthAction } from '../utils/authPendingAction';


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
  

}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getPendingRole = async (): Promise<'customer' | 'cleaner' | null> => {
    try {
      const pendingRole = await AsyncStorage.getItem('pending_auth_role');
      if (pendingRole === 'customer' || pendingRole === 'cleaner') {
        return pendingRole;
      }
    } catch (error) {
      console.warn('Failed to load pending role:', error);
    }
    return null;
  };

  const clearPendingRole = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem('pending_auth_role');
    } catch (error) {
      console.warn('Failed to clear pending role:', error);
    }
  };

  useEffect(() => {
    // Check for existing session on app start
    const checkSession = async () => {
      try {
        await getOrCreateGuestId();
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('🚨 Session check error:', error);
          // Handle refresh token errors gracefully
          if (error.message?.includes('refresh') || error.message?.includes('token')) {
            console.log('🔄 Refresh token error - clearing session silently');
            await supabase.auth.signOut({ scope: 'local' }); // Only clear local session
          } else {
            await supabase.auth.signOut();
          }
          setAuthUser(null);
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          // User is authenticated, get their profile
          const response = await authService.getCurrentUser();
          if (response.success && response.data) {
            setAuthUser(response.data);
            await clearPendingRole();
          } else {
            // Profile doesn't exist yet - this is normal for new signups
            // Don't sign out, just set a minimal auth user so onboarding can proceed
            console.log('ℹ️ No user profile yet - likely a new signup, allowing onboarding to proceed');
            const pendingRole = await getPendingRole();
            setAuthUser({
              user: {
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.full_name || '',
                phone: session.user.phone || '',
                created_at: session.user.created_at || new Date().toISOString(),
                role: pendingRole || undefined,
                is_active: true,
              },
              session: session,
            });
          }
          const givenName = session.user.user_metadata?.given_name;
          const familyName = session.user.user_metadata?.family_name;
          const fullName = session.user.user_metadata?.full_name;
          const email = session.user.email;
          const nameCandidate = fullName || [givenName, familyName].filter(Boolean).join(' ');
          if (nameCandidate || email) {
            const payload: any = { id: session.user.id };
            if (nameCandidate) payload.name = nameCandidate;
            if (email) payload.email = email;
            supabase
              .from('users')
              .upsert(payload, { onConflict: 'id' })
              .then(() => {})
              .catch(() => {});
          }
          const guestId = await getOrCreateGuestId();
          await migrateGuestInteractions(guestId, session.user.id);
          const pending = await consumePendingAuthAction();
          if (pending) {
            await applyPendingActionToInteractions(session.user.id, pending);
          }
        } else {
          setAuthUser(null);
        }
      } catch (error) {
        console.error('Session check error:', error);
        setAuthUser(null);
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
            await clearPendingRole();
          } else {
            // Profile doesn't exist yet - normal for new signups
            console.log('ℹ️ SIGNED_IN: No profile yet, setting minimal auth user for onboarding');
            const pendingRole = await getPendingRole();
            setAuthUser({
              user: {
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.full_name || '',
                phone: session.user.phone || '',
                created_at: session.user.created_at || new Date().toISOString(),
                role: pendingRole || undefined,
                is_active: true,
              },
              session: session,
            });
          }
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      } else if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        // User signed out or token refresh failed, clear auth state
        console.log('🚪 Clearing auth state due to sign out or failed token refresh');
        setAuthUser(null);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Token successfully refreshed, update user data
        try {
          const response = await authService.getCurrentUser();
          if (response.success && response.data) {
            setAuthUser(response.data);
            await clearPendingRole();
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
      isCleaner
    });
  }, [user, isAuthenticated, isCustomer, isCleaner]);

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

      // Clear auth state
      setAuthUser(null);
      try {
        await AsyncStorage.multiRemove([
          'interface_role_override',
          'guest_user_role',
          'pending_auth_role',
          'cleaner_onboarding_complete',
          'last_route',
        ]);
      } catch {
        // no-op
      }
      
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
          setAuthUser(null);
        }
      }
    } catch (error) {
      console.warn('Session refresh error:', error);
      // Clear auth state instead of calling signOut to avoid loops
      console.log('🧹 Clearing auth state due to refresh error');
      setAuthUser(null);
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