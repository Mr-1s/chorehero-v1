import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService, onAuthStateChange, hasEmbeddedResource } from '../services/auth';
import { AuthUser, User } from '../types/user';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import {
  getOrCreateGuestId,
  migrateGuestInteractions,
  migrateGuestToUser,
  createGuestSession,
  setGuestMode,
  isGuestMode as getIsGuestMode,
} from '../utils/guestSession';
import { applyPendingActionToInteractions, consumePendingAuthAction } from '../utils/authPendingAction';
import { useCleanerStore } from '../store/cleanerStore';
import { useCustomerStore } from '../store/customerStore';

/** Transient failures — do not sign user out or clear session */
function isLikelyNetworkError(error: unknown): boolean {
  const msg =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : String(error);
  return (
    msg.includes('Network request failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('timeout') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ENOTFOUND')
  );
}

interface AuthContextType {
  authUser: AuthUser | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuestMode: boolean;

  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** Re-fetches the session user without toggling global isLoading (use after save actions). */
  refreshUserSilent: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  enterGuestMode: () => Promise<void>;
  exitGuestMode: () => Promise<void>;

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
  const [isGuestMode, setIsGuestMode] = useState(false);

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

  /** Only clear after `users.role` is persisted — don’t drop customer/cleaner intent on half-loaded rows. */
  const clearPendingRoleIfResolved = async (userRow: { role?: string | null } | null | undefined) => {
    const role = userRow?.role;
    if (role === 'customer' || role === 'cleaner') {
      await clearPendingRole();
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      try {
        const guestMode = await getIsGuestMode();
        setIsGuestMode(guestMode);
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
            await clearPendingRoleIfResolved(response.data.user);
            // Sync name, email, phone, username from auth + profile so the app stays in sync
            const meta = session.user.user_metadata || {};
            const givenName = meta.given_name;
            const familyName = meta.family_name;
            const fullName = meta.full_name;
            const metaUsername = meta.username;
            const email = session.user.email;
            const phone = session.user.phone;
            const nameCandidate = fullName || [givenName, familyName].filter(Boolean).join(' ');
            const profile = response.data.user as Record<string, unknown>;
            const profileUsername = profile?.username as string | undefined;
            const username = metaUsername || profileUsername;
            if (response.data.user) {
              const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
              if (nameCandidate) payload.name = nameCandidate;
              if (email != null) payload.email = email;
              if (phone != null) payload.phone = phone;
              if (username != null && String(username).trim() !== '') payload.username = String(username).trim();
              if (Object.keys(payload).length > 1) {
                supabase
                  .from('users')
                  .update(payload)
                  .eq('id', session.user.id)
                  .then(() => {})
                  .catch(() => {});
              }
            }
          } else if (!response.success && response.error && isLikelyNetworkError(response.error)) {
            console.warn('📶 Could not load profile (network). Staying signed in with session metadata.');
            const pendingRole = await getPendingRole();
            const noProfileMeta = session.user.user_metadata || {};
            setAuthUser({
              user: {
                id: session.user.id,
                email: session.user.email || '',
                name: noProfileMeta.full_name || noProfileMeta.given_name || '',
                phone: session.user.phone || '',
                username: noProfileMeta.username || undefined,
                created_at: session.user.created_at || new Date().toISOString(),
                role: pendingRole || undefined,
                is_active: true,
              },
              session: session,
            });
          } else {
            // Profile doesn't exist yet - this is normal for new signups
            // Do NOT create a users row here - it would have no role and cause returning users
            // to see role selection every time. ProfileType creates the row with role.
            console.log('ℹ️ No user profile yet - likely a new signup, allowing onboarding to proceed');
            const pendingRole = await getPendingRole();
            const noProfileMeta = session.user.user_metadata || {};
            setAuthUser({
              user: {
                id: session.user.id,
                email: session.user.email || '',
                name: noProfileMeta.full_name || noProfileMeta.given_name || '',
                phone: session.user.phone || '',
                username: noProfileMeta.username || undefined,
                created_at: session.user.created_at || new Date().toISOString(),
                role: pendingRole || undefined,
                is_active: true,
              },
              session: session,
            });
          }
          const guestId = await getOrCreateGuestId();
          await migrateGuestToUser(guestId, session.user.id);
          await setGuestMode(false);
          setIsGuestMode(false);
          const pending = await consumePendingAuthAction();
          if (pending) {
            await applyPendingActionToInteractions(session.user.id, pending);
          }
        } else {
          setAuthUser(null);
        }
      } catch (error) {
        if (isLikelyNetworkError(error)) {
          console.warn('📶 Session check: network unavailable — keeping local session if any');
        } else {
          console.error('Session check error:', error);
          setAuthUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    // Set up Supabase auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state change:', event, session ? 'session exists' : 'no session');
      
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const guestId = await getOrCreateGuestId();
          await migrateGuestToUser(guestId, session.user.id);
          await setGuestMode(false);
          setIsGuestMode(false);
        } catch (e) {
          console.warn('Guest migration:', e);
        }
        try {
          const response = await authService.getCurrentUser();
          if (response.success && response.data) {
            setAuthUser(response.data);
            await clearPendingRoleIfResolved(response.data.user);
          } else {
            console.log('ℹ️ SIGNED_IN: No profile yet, setting minimal auth user for onboarding');
            const pendingRole = await getPendingRole();
            const signedInMeta = session.user.user_metadata || {};
            setAuthUser({
              user: {
                id: session.user.id,
                email: session.user.email || '',
                name: signedInMeta.full_name || signedInMeta.given_name || '',
                phone: session.user.phone || '',
                username: signedInMeta.username || undefined,
                created_at: session.user.created_at || new Date().toISOString(),
                role: pendingRole || undefined,
                is_active: true,
              },
              session: session,
            });
          }
        } catch (error) {
          if (isLikelyNetworkError(error)) {
            console.warn('📶 Profile load failed (network). Session kept.');
          } else {
            console.error('Error loading user profile:', error);
          }
        }
      } else if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        console.log('🚪 Clearing auth state due to sign out or failed token refresh');
        setAuthUser(null);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // Token successfully refreshed, update user data
        try {
          const response = await authService.getCurrentUser();
          if (response.success && response.data) {
            setAuthUser(response.data);
            await clearPendingRoleIfResolved(response.data.user);
          }
        } catch (error) {
          if (isLikelyNetworkError(error)) {
            console.warn('📶 Profile fetch after token refresh failed (network). Keeping session.');
          } else {
            console.error('Error loading user profile after token refresh:', error);
            await signOut();
          }
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
  // Role + embedded 1:1 profile rows: PostgREST returns objects, not only arrays, so we must not rely on role string alone
  const u = user as Record<string, unknown> | null | undefined;
  const hasCleanerEmb = hasEmbeddedResource(u?.cleaner_profiles);
  const hasCustomerEmb = hasEmbeddedResource(u?.customer_profiles);
  const r = u?.role as string | undefined;
  // Any linked cleaner_profiles row means pro — do not let users.role === 'customer' alone block pro features
  // (sync bugs / legacy rows can leave role wrong while the pro profile exists).
  const isCleaner = r === 'cleaner' || hasCleanerEmb;
  const isCustomer =
    (r === 'customer' && !hasCleanerEmb) ||
    (r == null && hasCustomerEmb && !hasCleanerEmb);
  const isVerifiedCleaner = 
    isCleaner && 
    'verification_status' in user && 
    user.verification_status === 'verified';

  useEffect(() => {
    if (__DEV__) {
      console.log('🧮 Computed values updated:', {
        user: user?.name,
        role: user?.role,
        isAuthenticated,
        isCustomer,
        isCleaner,
      });
    }
  }, [user, isAuthenticated, isCustomer, isCleaner]);

  // Sign out
  const signOut = async () => {
    let remoteSignOutPromise: Promise<unknown> | null = null;
    try {
      const dismissUid = authUser?.user?.id;
      if (dismissUid) {
        try {
          await AsyncStorage.removeItem(
            `ch_cleaner_profile_completion_dismissed:${dismissUid}`
          );
        } catch {
          // no-op
        }
      }

      // Clear local auth state first so UI can return to Welcome immediately.
      setAuthUser(null);
      await exitGuestMode();
      // Reset both role stores so switching accounts gets a clean slate.
      try {
        useCleanerStore.getState().resetStore();
      } catch {
        // no-op
      }
      try {
        useCustomerStore.getState().resetStore();
      } catch {
        // no-op
      }
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

      // Remote sign-out should not block UI transition.
      remoteSignOutPromise = supabase.auth
        .signOut()
        .then(({ error }) => {
          if (error) {
            console.warn('Supabase remote sign out warning:', error);
          }
        })
        .catch((error) => {
          console.warn('Supabase remote sign out failed:', error);
        });
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Sign out failed');
    } finally {
      setIsLoading(false);
      if (remoteSignOutPromise) {
        void remoteSignOutPromise;
      }
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

  const enterGuestMode = async () => {
    await setGuestMode(true);
    setIsGuestMode(true);
    await createGuestSession();
    await AsyncStorage.setItem('guest_user_role', 'customer');
  };

  const exitGuestMode = async () => {
    await setGuestMode(false);
    setIsGuestMode(false);
  };

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

  const refreshUserSilent = async () => {
    if (!authUser) return;
    try {
      const response = await authService.getCurrentUser();
      if (response.success && response.data) {
        setAuthUser(response.data);
      }
    } catch (error) {
      console.error('Silent refresh user error:', error);
    }
  };



  const contextValue: AuthContextType = {
    authUser,
    user,
    isLoading,
    isAuthenticated,
    isGuestMode,
    signOut,
    refreshSession,
    refreshUser,
    refreshUserSilent,
    updateProfile,
    enterGuestMode,
    exitGuestMode,
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