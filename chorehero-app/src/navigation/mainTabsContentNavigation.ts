import { CommonActions } from '@react-navigation/native';

/**
 * Params for `MainTabs` > `Content` (VideoFeedScreen on the Chores tab).
 * Keep in sync with `VideoFeedScreen` route params.
 */
export type ChoresContentParams = {
  source?: 'main' | 'featured' | 'cleaner' | 'global' | 'saved' | 'liked';
  cleanerId?: string;
  initialVideoId?: string;
  videos?: any[];
  proId?: string;
  scrollToTop?: boolean;
};

/**
 * Navigate to the in-tab Chores feed so the **hoisted** bottom tab bar stays visible.
 * Do not call `navigate('VideoFeed')` from inside the app — that matches the **root**
 * `VideoFeed` screen and unmounts `MainTabs` (no tabs).
 */
export function navigateToChoresContent(navigation: { navigate: (name: string, p?: any) => void }, params?: ChoresContentParams) {
  navigation.navigate('MainTabs', {
    screen: 'Content',
    params: params ?? {},
  });
}

/**
 * Root reset that lands on `MainTabs` with `Content` active (e.g. post-auth).
 */
export function getResetToMainTabsChoresAction(params?: ChoresContentParams) {
  return CommonActions.reset({
    index: 0,
    routes: [
      {
        name: 'MainTabs' as const,
        state: {
          index: 0,
          routes: [{ name: 'Content', params: params ?? {} }],
        },
      },
    ],
  });
}
