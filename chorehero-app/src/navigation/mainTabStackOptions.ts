import { CardStyleInterpolators } from '@react-navigation/stack';
import type { StackNavigationOptions } from '@react-navigation/stack';

/**
 * Pro / cleaner tab bar targets (same root stack, no slide — tab should feel like a switch).
 */
export const CLEANER_MAIN_TAB_NAMES = new Set([
  'Dashboard',
  'Content',
  'Jobs',
  'Messages',
  'Profile',
  'PaymentScreen',
]);

/**
 * Customer tab bar targets (Chores, Discover, Bookings, Messages, Profile).
 */
export const CUSTOMER_MAIN_TAB_NAMES = new Set([
  'Content',
  'Discover',
  'Bookings',
  'Messages',
  'Profile',
  'PaymentScreen',
]);

const zeroDuration = {
  open: { animation: 'timing' as const, config: { duration: 0 } },
  close: { animation: 'timing' as const, config: { duration: 0 } },
};

/**
 * No card slide/fade: keeps the custom floating tab bar from riding the stack transition.
 * Detail / modal routes keep the default stack animation from navigator defaults.
 */
export function getMainTabStackOptions(routeName: string): StackNavigationOptions {
  if (CLEANER_MAIN_TAB_NAMES.has(routeName) || CUSTOMER_MAIN_TAB_NAMES.has(routeName)) {
    return {
      transitionSpec: zeroDuration,
      cardStyleInterpolator: CardStyleInterpolators.forNoAnimation,
    };
  }
  return {};
}
