/**
 * Tutorial Service
 * Interactive guided tours for new users
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetElement?: string; // Component to highlight
  /**
   * Optional screen to navigate to before painting this step. Lets the tour
   * cycle through the app instead of stacking modals on a single screen.
   * Must be a route registered on the root navigator (e.g. `MainTabs`,
   * `EditProfileScreen`, `PayoutSetup`).
   */
  targetScreen?: string;
  position: 'top' | 'bottom' | 'center';
  action?: 'tap' | 'swipe' | 'scroll' | 'wait';
  duration?: number; // Auto-advance after X seconds
  skippable: boolean;
  showOverlay: boolean;
  animation?: 'bounce' | 'pulse' | 'glow';
  /** Brand accent for this step. Defaults to the tutorial's userType. */
  tone?: 'customer' | 'cleaner';
  /** Optional Ionicon name to show in the tooltip header bubble. */
  icon?: string;
}

export interface Tutorial {
  id: string;
  name: string;
  userType: 'customer' | 'cleaner' | 'both';
  trigger: 'first_login' | 'feature_unlock' | 'manual';
  steps: TutorialStep[];
  isRequired: boolean;
  version: number; // For updating tutorials
}

class TutorialService {
  private readonly STORAGE_KEY = 'chorehero_tutorials_completed';
  
  /**
   * Core tutorials for different user journeys
   */
  private tutorials: Tutorial[] = [
    // Customer First-Time Tutorial — version 2 redesign with teal theme +
    // a quick cycle through Videos/Discover/Bookings/Profile.
    {
      id: 'customer_welcome',
      name: 'Welcome Tour for Customers',
      userType: 'customer',
      trigger: 'first_login',
      isRequired: false,
      version: 2,
      steps: [
        {
          id: 'welcome',
          title: 'Welcome to ChoreHero',
          description: "Quick tour: we'll show you the four tabs you'll use most — Videos, Discover, Bookings, and Profile.",
          position: 'center',
          skippable: true,
          showOverlay: false,
          tone: 'customer',
          icon: 'sparkles',
          targetScreen: 'MainTabs',
        },
        {
          id: 'feed_intro',
          title: 'Your video feed',
          description: 'See real work from local pros. Swipe up to browse, tap a video to view the pro and book.',
          position: 'center',
          skippable: true,
          showOverlay: false,
          tone: 'customer',
          icon: 'play-circle',
        },
        {
          id: 'discover_tab',
          title: 'Discover services',
          description: 'Browse popular services, trending pros near you, and packages you can book in one tap.',
          position: 'center',
          skippable: true,
          showOverlay: false,
          tone: 'customer',
          icon: 'compass',
        },
        {
          id: 'post_job',
          title: 'Or post a job',
          description: "Don't see what you need? Post a job and pros will send you 60-second video quotes.",
          position: 'center',
          skippable: true,
          showOverlay: false,
          tone: 'customer',
          icon: 'megaphone',
        },
        {
          id: 'profile_setup',
          title: "You're all set",
          description: 'Add your address and a payment method from the Profile tab so booking is one tap.',
          position: 'center',
          skippable: true,
          showOverlay: false,
          tone: 'customer',
          icon: 'person-circle',
        },
      ],
    },
    
    // Cleaner First-Time Tutorial — version 2 redesign with orange theme +
    // cycles the cleaner through the actual screens they'll work in.
    {
      id: 'cleaner_welcome',
      name: 'Hero Onboarding',
      userType: 'cleaner',
      trigger: 'first_login',
      isRequired: false,
      version: 2,
      steps: [
        {
          id: 'welcome',
          title: 'Welcome to ChoreHero',
          description: "You're a Pro now. We'll walk you through the four screens you'll live in: Dashboard, Jobs, Profile, and Earnings.",
          position: 'center',
          skippable: true,
          showOverlay: false,
          tone: 'cleaner',
          icon: 'sparkles',
          targetScreen: 'MainTabs',
        },
        {
          id: 'jobs_tab',
          title: 'Jobs come in here',
          description: 'New job requests appear under Requests. Quotes you\'ve sent live under Quotes. Booked work shows under Booked.',
          position: 'center',
          skippable: true,
          showOverlay: false,
          tone: 'cleaner',
          icon: 'briefcase',
        },
        {
          id: 'profile_setup',
          title: 'Finish your profile',
          description: 'Customers won\'t see you until your profile is complete and you\'re online. Edit your bio, area, and rate from the Profile tab.',
          position: 'center',
          skippable: true,
          showOverlay: false,
          tone: 'cleaner',
          icon: 'person-circle',
        },
        {
          id: 'payouts',
          title: 'Get paid',
          description: 'Set up Stripe payouts under Settings → Payouts. We deposit your earnings 1–2 business days after each completed job.',
          position: 'center',
          skippable: true,
          showOverlay: false,
          tone: 'cleaner',
          icon: 'cash',
        },
        {
          id: 'video_quote',
          title: 'Win with video',
          description: 'When a customer posts a job, send a 60-second video quote. Pros who introduce themselves on video get booked first.',
          position: 'center',
          skippable: true,
          showOverlay: false,
          tone: 'cleaner',
          icon: 'videocam',
        },
        {
          id: 'ready',
          title: "You're all set",
          description: 'Toggle yourself online from Profile, then watch the Jobs tab. Good luck out there!',
          position: 'center',
          skippable: true,
          showOverlay: false,
          tone: 'cleaner',
          icon: 'rocket',
        },
      ],
    },

    // Feature-Specific Tutorials
    {
      id: 'first_booking',
      name: 'Your First Booking',
      userType: 'customer',
      trigger: 'feature_unlock',
      isRequired: false,
      version: 1,
      steps: [
        {
          id: 'auto_fill_magic',
          title: '✨ Smart Form Filling',
          description: 'Notice how we pre-filled your information? We save time by using your profile data and previous bookings!',
          position: 'center',
          skippable: true,
          showOverlay: true,
          animation: 'bounce'
        },
        {
          id: 'cleaner_expertise',
          title: '🎯 Tailored Experience',
          description: 'This booking flow was customized by your chosen cleaner based on their specific expertise and services.',
          position: 'center',
          skippable: true,
          showOverlay: true
        }
      ]
    },

    {
      id: 'video_engagement',
      name: 'Engaging with Content',
      userType: 'both',
      trigger: 'feature_unlock',
      isRequired: false,
      version: 1,
      steps: [
        {
          id: 'like_and_comment',
          title: '❤️ Show Some Love',
          description: 'Like and comment on videos you enjoy! This helps us show you more relevant content.',
          targetElement: 'action_bubbles',
          position: 'top',
          action: 'tap',
          skippable: true,
          showOverlay: true,
          animation: 'pulse'
        },
        {
          id: 'cleaner_profile',
          title: '👨‍💼 Cleaner Profiles',
          description: 'Tap on any cleaner\'s name or avatar to see their full profile, reviews, and services.',
          targetElement: 'cleaner_avatar',
          position: 'bottom',
          action: 'tap',
          skippable: true,
          showOverlay: true
        }
      ]
    }
  ];

  /**
   * Check if user should see a tutorial
   */
  async shouldShowTutorial(tutorialId: string, userId: string, userType: 'customer' | 'cleaner'): Promise<boolean> {
    try {
      const tutorial = this.tutorials.find(t => t.id === tutorialId);
      if (!tutorial) return false;
      
      // Check user type compatibility
      if (tutorial.userType !== 'both' && tutorial.userType !== userType) {
        return false;
      }
      
      // Check if already completed
      const completed = await this.getTutorialProgress(userId);
      const tutorialProgress = completed[tutorialId];
      
      // If never seen or version is newer
      if (!tutorialProgress || tutorialProgress.version < tutorial.version) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking tutorial status:', error);
      return false;
    }
  }

  /**
   * Get tutorials that should trigger for user's current context
   */
  async getTriggeredTutorials(
    trigger: 'first_login' | 'feature_unlock' | 'manual',
    userId: string,
    userType: 'customer' | 'cleaner'
  ): Promise<Tutorial[]> {
    const triggeredTutorials: Tutorial[] = [];
    
    for (const tutorial of this.tutorials) {
      if (tutorial.trigger === trigger) {
        const shouldShow = await this.shouldShowTutorial(tutorial.id, userId, userType);
        if (shouldShow) {
          triggeredTutorials.push(tutorial);
        }
      }
    }
    
    return triggeredTutorials;
  }

  /**
   * Mark tutorial as completed
   */
  async completeTutorial(tutorialId: string, userId: string): Promise<void> {
    try {
      const tutorial = this.tutorials.find(t => t.id === tutorialId);
      if (!tutorial) return;
      
      const completed = await this.getTutorialProgress(userId);
      completed[tutorialId] = {
        completedAt: new Date().toISOString(),
        version: tutorial.version,
        skipped: false
      };
      
      await this.saveTutorialProgress(userId, completed);
      
      // Also save to database for analytics
      await supabase
        .from('user_tutorial_progress')
        .upsert({
          user_id: userId,
          tutorial_id: tutorialId,
          completed_at: new Date().toISOString(),
          version: tutorial.version,
          skipped: false
        });
        
    } catch (error) {
      console.error('Error completing tutorial:', error);
    }
  }

  /**
   * Mark tutorial as skipped
   */
  async skipTutorial(tutorialId: string, userId: string): Promise<void> {
    try {
      const tutorial = this.tutorials.find(t => t.id === tutorialId);
      if (!tutorial) return;
      
      const completed = await this.getTutorialProgress(userId);
      completed[tutorialId] = {
        completedAt: new Date().toISOString(),
        version: tutorial.version,
        skipped: true
      };
      
      await this.saveTutorialProgress(userId, completed);
      
      // Also save to database
      await supabase
        .from('user_tutorial_progress')
        .upsert({
          user_id: userId,
          tutorial_id: tutorialId,
          completed_at: new Date().toISOString(),
          version: tutorial.version,
          skipped: true
        });
        
    } catch (error) {
      console.error('Error skipping tutorial:', error);
    }
  }

  /**
   * Get tutorial by ID
   */
  getTutorial(tutorialId: string): Tutorial | null {
    return this.tutorials.find(t => t.id === tutorialId) || null;
  }

  /**
   * Get user's tutorial progress from local storage
   */
  private async getTutorialProgress(userId: string): Promise<Record<string, any>> {
    try {
      const key = `${this.STORAGE_KEY}_${userId}`;
      const progress = await AsyncStorage.getItem(key);
      return progress ? JSON.parse(progress) : {};
    } catch (error) {
      console.error('Error getting tutorial progress:', error);
      return {};
    }
  }

  /**
   * Save tutorial progress to local storage
   */
  private async saveTutorialProgress(userId: string, progress: Record<string, any>): Promise<void> {
    try {
      const key = `${this.STORAGE_KEY}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(progress));
    } catch (error) {
      console.error('Error saving tutorial progress:', error);
    }
  }

  /**
   * Reset tutorial progress (for testing)
   */
  async resetTutorialProgress(userId: string): Promise<void> {
    try {
      const key = `${this.STORAGE_KEY}_${userId}`;
      await AsyncStorage.removeItem(key);
      
      // Also clear from database
      await supabase
        .from('user_tutorial_progress')
        .delete()
        .eq('user_id', userId);
        
    } catch (error) {
      console.error('Error resetting tutorial progress:', error);
    }
  }

  /**
   * Get tutorial analytics for admin dashboard
   */
  async getTutorialAnalytics(): Promise<{
    tutorialId: string;
    completionRate: number;
    skipRate: number;
    avgTimeToComplete: number;
  }[]> {
    try {
      const { data, error } = await supabase
        .from('user_tutorial_progress')
        .select('*');
        
      if (error) throw error;
      
      // Process analytics data
      const analytics = this.tutorials.map(tutorial => {
        const tutorialData = data.filter(d => d.tutorial_id === tutorial.id);
        const total = tutorialData.length;
        const completed = tutorialData.filter(d => !d.skipped).length;
        const skipped = tutorialData.filter(d => d.skipped).length;
        
        return {
          tutorialId: tutorial.id,
          completionRate: total > 0 ? (completed / total) * 100 : 0,
          skipRate: total > 0 ? (skipped / total) * 100 : 0,
          avgTimeToComplete: 0 // Would need start_time field to calculate
        };
      });
      
      return analytics;
    } catch (error) {
      console.error('Error getting tutorial analytics:', error);
      return [];
    }
  }
}

export const tutorialService = new TutorialService();
