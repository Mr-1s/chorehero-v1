/**
 * Onboarding Service
 * Controls when to show the guide/tutorial for new users only
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const HAS_SEEN_GUIDE_KEY = 'chorehero_hasSeenGuide';
const GUIDE_HOURS_WINDOW = 24;

/**
 * Check if the guide should be shown.
 * Only for new sign-ups (created in last 24 hours) who haven't seen it.
 */
export const shouldShowGuide = async (): Promise<boolean> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const hasSeenGuide = await AsyncStorage.getItem(HAS_SEEN_GUIDE_KEY);
    if (hasSeenGuide === 'true') return false;

    const createdAt = new Date(user.created_at);
    const now = new Date();
    const hoursSinceSignup = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    return hoursSinceSignup < GUIDE_HOURS_WINDOW;
  } catch (error) {
    console.warn('onboardingService.shouldShowGuide error:', error);
    return false;
  }
};

/**
 * Mark the guide as seen so it won't show again.
 */
export const markGuideAsSeen = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(HAS_SEEN_GUIDE_KEY, 'true');
  } catch (error) {
    console.warn('onboardingService.markGuideAsSeen error:', error);
  }
};
