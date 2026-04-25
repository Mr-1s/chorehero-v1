import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../hooks/useAuth';

type GuestRole = 'customer' | 'cleaner';

type OnboardingUser = {
  role?: string | null;
  customer_onboarding_state?: unknown;
  customer_onboarding_step?: unknown;
  cleaner_onboarding_state?: unknown;
  cleaner_onboarding_step?: unknown;
} | null | undefined;

/**
 * Single source of truth for which main tabs stack (customer vs cleaner) to show.
 * - Prefer persisted `user.role` when set to customer/cleaner.
 * - Then `pending_auth_role` (AsyncStorage) until the profile row is written (don’t clear early).
 * - Then explicit onboarding: non-empty `*_onboarding_state` or step **> 0** (0 means “not started”, not pro).
 * - Default: **customer** (never default to pro).
 */
export function resolveMainAppRole(
  user: OnboardingUser,
  opts?: { pendingAuthRole?: string | null }
): GuestRole {
  const r = user?.role;
  if (r === 'cleaner' || r === 'customer') {
    return r;
  }
  const p = opts?.pendingAuthRole;
  if (p === 'customer' || p === 'cleaner') {
    return p;
  }

  const cState = user?.customer_onboarding_state;
  const cStep = user?.customer_onboarding_step;
  const kState = user?.cleaner_onboarding_state;
  const kStep = user?.cleaner_onboarding_step;

  const hasCustomerHint =
    (typeof cState === 'string' && cState.trim().length > 0) || (cStep != null && Number(cStep) > 0);
  const hasCleanerHint =
    (typeof kState === 'string' && kState.trim().length > 0) || (kStep != null && Number(kStep) > 0);

  if (hasCustomerHint && hasCleanerHint) {
    return 'customer';
  }
  if (hasCustomerHint) return 'customer';
  if (hasCleanerHint) return 'cleaner';
  return 'customer';
}

/**
 * @deprecated use {@link resolveMainAppRole} with the same `user` (no pending).
 */
export function inferAuthenticatedMainTabsRole(user: OnboardingUser): GuestRole {
  return resolveMainAppRole(user, { pendingAuthRole: null });
}

export type MainTabsInterfaceRole = {
  /** True when the cleaner stack is shown (must match `RoleBasedTabNavigator`). */
  interfaceIsCleaner: boolean;
  resolvedRole: GuestRole;
};

/**
 * Resolved UI role for main tabs chrome and visibility. Keeps `MainTabsChrome` aligned with
 * `RoleBasedTabNavigator` (avoids `useAuth().isCleaner` vs `user.role` mismatch).
 */
export function useMainTabsInterfaceRole(): MainTabsInterfaceRole {
  const { isAuthenticated, user } = useAuth();
  const [guestRole, setGuestRole] = useState<GuestRole | null>(null);
  const [authPendingRole, setAuthPendingRole] = useState<string | null>(null);

  useEffect(() => {
    const checkGuestRole = async () => {
      try {
        if (isAuthenticated) {
          await AsyncStorage.removeItem('interface_role_override');
          setGuestRole(null);
          const p = await AsyncStorage.getItem('pending_auth_role');
          setAuthPendingRole(p);
          return;
        }
        setAuthPendingRole(null);
        const storedGuestRole = await AsyncStorage.getItem('guest_user_role');
        if (storedGuestRole === 'customer' || storedGuestRole === 'cleaner') {
          setGuestRole(storedGuestRole);
        } else {
          setGuestRole('customer');
        }
      } catch {
        setGuestRole('customer');
        setAuthPendingRole(null);
      }
    };
    void checkGuestRole();
  }, [isAuthenticated, user?.id, user?.role]);

  const resolvedRole: GuestRole = isAuthenticated
    ? resolveMainAppRole(user, { pendingAuthRole: authPendingRole })
    : guestRole ?? 'customer';

  return {
    interfaceIsCleaner: resolvedRole === 'cleaner',
    resolvedRole,
  };
}
