import type { NavigationState, PartialState } from '@react-navigation/native';
import { CLEANER_MAIN_TAB_NAMES, CUSTOMER_MAIN_TAB_NAMES } from './mainTabStackOptions';

type NavState = NavigationState | PartialState<NavigationState> | undefined;

/** Any tab that exists in either role stack — must not resolve to root stack screens with the same name. */
const NESTED_MAIN_TAB_NAMES = new Set<string>([
  ...CLEANER_MAIN_TAB_NAMES,
  ...CUSTOMER_MAIN_TAB_NAMES,
]);

/**
 * Current route name in the role stack (Customer or Cleaner) under the root `MainTabs` route.
 * Does not walk into nested stacks (e.g. Discover → DiscoverFeed): returns "Discover" not "DiscoverFeed".
 * When `MainTabs` is focused but nested state is not mounted yet, pass `interfaceIsCleaner` for a safe default
 * (avoids top === "MainTabs" which is not a tab name — bar would stay hidden).
 */
export function getRoleStackTopRouteName(
  state: NavState,
  interfaceIsCleaner?: boolean
): string | undefined {
  if (!state?.routes || state.index == null) return undefined;
  const root = state.routes[state.index];
  if (root.name === 'MainTabs') {
    if (root.state && typeof (root.state as any).index === 'number') {
      const role = root.state as NavigationState;
      return role.routes[role.index]?.name;
    }
    if (interfaceIsCleaner === true) return 'Dashboard';
    if (interfaceIsCleaner === false) return 'Content';
    return undefined;
  }
  return root?.name;
}

/**
 * `true` when the focused root screen is the main app shell (not e.g. root-level VideoUpload).
 */
export function isRootRouteMainTabs(state: NavState): boolean {
  if (!state?.routes || state.index == null) return false;
  return state.routes[state.index]?.name === 'MainTabs';
}

/**
 * `MainTabsChrome` is a **sibling** of the role `Stack` (not nested under it), so
 * `useNavigationState` there often sees the **nested** stack state only, not a root
 * route named `MainTabs`. A strict `isRootRouteMainTabs` check would then hide the
 * bar everywhere (e.g. Chores/feed) even when the app shell is correct. Show the bar
 * when the current route name in that state (or under `MainTabs` when full root state
 * is present) is a main-tab screen.
 */
export function isFloatingTabBarVisible(state: NavState, isCleaner: boolean): boolean {
  const top = getRoleStackTopRouteName(state, isCleaner);
  if (!top) return false;
  return (isCleaner ? CLEANER_MAIN_TAB_NAMES : CUSTOMER_MAIN_TAB_NAMES).has(top);
}

/**
 * The `MainTabs` screen receives the **root** stack's `navigation`. Tab presses call
 * `navigate('Profile')` etc., but those routes live on the **nested** role stack under
 * `MainTabs`, so we re-dispatch as `navigate('MainTabs', { screen, params })`.
 */
export function wrapNavigationForNestedMainTabs(outer: any): any {
  if (!outer?.navigate || typeof outer.getState !== 'function') return outer;

  return {
    ...outer,
    navigate(routeName: string, params?: any) {
      // Tab routes (Messages, PaymentScreen, …) are registered on BOTH the root stack
      // and the role stack. Prefer the in-tab target so `MainTabs` + `MainTabsChrome` stay active.
      if (NESTED_MAIN_TAB_NAMES.has(routeName)) {
        return params !== undefined && params !== null
          ? outer.navigate('MainTabs', { screen: routeName, params })
          : outer.navigate('MainTabs', { screen: routeName });
      }
      const names = outer.getState()?.routeNames as string[] | undefined;
      if (Array.isArray(names) && names.includes(routeName)) {
        return outer.navigate(routeName, params);
      }
      return params !== undefined && params !== null
        ? outer.navigate('MainTabs', { screen: routeName, params })
        : outer.navigate('MainTabs', { screen: routeName });
    },
  };
}
