import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';

/**
 * Global ref to the root NavigationContainer. Used to reset the stack when a screen
 * was incorrectly restored as the only route (e.g. last_route = EditProfile).
 */
export const navigationRef = createNavigationContainerRef();

export function resetToMainTabs() {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' as never }] })
    );
  }
}

/** Navigate a screen on the **root** stack (e.g. `CleanerProfile`) from deeply nested app screens. */
export function navigateRoot(name: string, params?: Record<string, unknown>) {
  if (navigationRef.isReady()) {
    (navigationRef as any).navigate(name, params);
  }
}
