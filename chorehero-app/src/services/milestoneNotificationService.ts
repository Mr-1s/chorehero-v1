/**
 * Milestone Notification Service
 * 
 * Sends automated ChoreHero Support messages when users hit milestones:
 * - Email verification
 * - Profile completion
 * - First booking (customer)
 * - First job accepted (cleaner)
 * - First job completed (cleaner)
 * - 5-star rating received
 * - Account anniversary
 */

import { supabase } from './supabase';

// ChoreHero Support is a system user with a fixed ID
const CHOREHERO_SUPPORT_ID = 'chorehero-support-system';
const CHOREHERO_SUPPORT_NAME = 'ChoreHero Support';

export type MilestoneType = 
  | 'email_verified'
  | 'profile_completed'
  | 'first_booking_created'
  | 'first_job_accepted'
  | 'first_job_completed'
  | 'first_5_star_rating'
  | 'first_tip_received'
  | 'week_streak'
  | 'month_anniversary'
  | 'year_anniversary'
  | 'welcome';

interface MilestoneMessage {
  title: string;
  body: string;
  emoji: string;
}

const MILESTONE_MESSAGES: Record<MilestoneType, MilestoneMessage> = {
  welcome: {
    title: 'Welcome to ChoreHero! 🎉',
    body: "We're so excited to have you! If you have any questions, feel free to reach out. We're here to help!",
    emoji: '🎉',
  },
  email_verified: {
    title: 'Email Verified! ✅',
    body: "Your email has been verified. Your account is now secure and you have full access to all features!",
    emoji: '✅',
  },
  profile_completed: {
    title: 'Profile Complete! 🌟',
    body: "Great job completing your profile! This helps build trust and makes it easier to connect with others.",
    emoji: '🌟',
  },
  first_booking_created: {
    title: 'First Booking! 🧹',
    body: "Congratulations on your first booking! Your ChoreHero is on the way. You can track them in real-time!",
    emoji: '🧹',
  },
  first_job_accepted: {
    title: 'First Job Accepted! 💪',
    body: "You've accepted your first job! Make a great impression and you'll build up those 5-star reviews in no time!",
    emoji: '💪',
  },
  first_job_completed: {
    title: 'First Job Complete! 🏆',
    body: "Amazing work on your first job! Your customer has been notified to leave a review. Keep up the great work!",
    emoji: '🏆',
  },
  first_5_star_rating: {
    title: 'First 5-Star Rating! ⭐',
    body: "You earned your first 5-star rating! This will help you get more bookings. Customers love high-rated ChoreHeroes!",
    emoji: '⭐',
  },
  first_tip_received: {
    title: 'First Tip Received! 💰',
    body: "Your customer appreciated your work so much they left a tip! Keep delivering excellent service!",
    emoji: '💰',
  },
  week_streak: {
    title: 'One Week Strong! 🔥',
    body: "You've been active for a whole week! Consistency is key to building a successful ChoreHero career.",
    emoji: '🔥',
  },
  month_anniversary: {
    title: 'One Month Anniversary! 📅',
    body: "It's been a month since you joined ChoreHero! Thank you for being part of our community.",
    emoji: '📅',
  },
  year_anniversary: {
    title: 'One Year Anniversary! 🎂',
    body: "Happy ChoreHero anniversary! Thank you for being with us for a whole year. Here's to many more!",
    emoji: '🎂',
  },
};

class MilestoneNotificationService {
  /**
   * Ensure the ChoreHero Support system user exists
   * Note: We use 'cleaner' role since 'system' isn't in the enum
   * The app UI handles displaying this as "ChoreHero Support" based on the ID
   */
  private async ensureSystemUserExists(): Promise<boolean> {
    try {
      // Check if system user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', CHOREHERO_SUPPORT_ID)
        .single();

      if (existingUser) {
        return true;
      }

      // Create system user if it doesn't exist
      // Using 'cleaner' role since 'system' isn't in the user_role enum
      const { error } = await supabase
        .from('users')
        .insert({
          id: CHOREHERO_SUPPORT_ID,
          name: CHOREHERO_SUPPORT_NAME,
          email: 'support@chorehero.app',
          role: 'cleaner', // Using cleaner role, UI will display as support based on ID
          avatar_url: null, // Will use default avatar
          is_verified: true,
        });

      if (error) {
        // If it fails (e.g., foreign key issues), we'll handle the message differently
        console.warn('⚠️ Could not create system user, will send notification only:', error);
        return false;
      }

      console.log('✅ Created ChoreHero Support system user');
      return true;
    } catch (err) {
      console.error('❌ Error ensuring system user exists:', err);
      return false;
    }
  }

  /**
   * Send a milestone notification message to a user
   * Creates a notification in the notifications table
   * If system user exists, also creates a chat message
   */
  async sendMilestoneNotification(
    userId: string, 
    milestone: MilestoneType
  ): Promise<boolean> {
    try {
      const message = MILESTONE_MESSAGES[milestone];
      if (!message) {
        console.warn(`⚠️ Unknown milestone type: ${milestone}`);
        return false;
      }

      // Always create a notification in the notifications table
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: userId,
        type: 'milestone',
        title: `${message.emoji} ${message.title}`,
        message: message.body,
        is_read: false,
      });

      if (notifError) {
        console.error('❌ Failed to create notification:', notifError);
        // Continue trying to create chat message
      }

      // Try to create system user and chat message (optional, don't fail if this doesn't work)
      const systemUserExists = await this.ensureSystemUserExists();
      
      if (systemUserExists) {
        try {
          // Create or get chat thread with ChoreHero Support
          let threadId: string | null = null;

          // Check if thread already exists
          const { data: existingThread } = await supabase
            .from('chat_threads')
            .select('id')
            .eq('customer_id', userId)
            .eq('cleaner_id', CHOREHERO_SUPPORT_ID)
            .single();

          if (existingThread) {
            threadId = existingThread.id;
          } else {
            // Create new thread
            const { data: newThread, error: threadError } = await supabase
              .from('chat_threads')
              .insert({
                customer_id: userId,
                cleaner_id: CHOREHERO_SUPPORT_ID,
                last_message_at: new Date().toISOString(),
              })
              .select('id')
              .single();

            if (!threadError && newThread) {
              threadId = newThread.id;
            }
          }

          if (threadId) {
            // Send the message
            await supabase
              .from('chat_messages')
              .insert({
                thread_id: threadId,
                sender_id: CHOREHERO_SUPPORT_ID,
                content: `${message.emoji} ${message.title}\n\n${message.body}`,
                is_read: false,
                message_type: 'system',
              });

            // Update thread's last_message_at
            await supabase
              .from('chat_threads')
              .update({ last_message_at: new Date().toISOString() })
              .eq('id', threadId);
              
            console.log(`✅ Created chat message for milestone: ${milestone}`);
          }
        } catch (chatErr) {
          // Chat message creation is optional, notification was already created
          console.warn('⚠️ Could not create chat message (notification still sent):', chatErr);
        }
      }

      console.log(`✅ Sent milestone notification: ${milestone} to user ${userId}`);
      return true;
    } catch (err) {
      console.error('❌ Error sending milestone notification:', err);
      return false;
    }
  }

  /**
   * Check and trigger milestone for a user
   * Call this after relevant actions to auto-detect milestones
   */
  async checkMilestones(userId: string, userRole: 'customer' | 'cleaner'): Promise<void> {
    try {
      // Get user's milestone history from a tracking table
      // For now, we'll check basic conditions

      if (userRole === 'cleaner') {
        // Check cleaner-specific milestones
        const { data: jobs } = await supabase
          .from('bookings')
          .select('id, status')
          .eq('cleaner_id', userId);

        const completedJobs = jobs?.filter(j => j.status === 'completed').length || 0;
        const acceptedJobs = jobs?.length || 0;

        if (acceptedJobs === 1) {
          await this.sendMilestoneNotification(userId, 'first_job_accepted');
        }

        if (completedJobs === 1) {
          await this.sendMilestoneNotification(userId, 'first_job_completed');
        }

        // Check for 5-star rating
        const { data: ratings } = await supabase
          .from('ratings')
          .select('rating')
          .eq('cleaner_id', userId)
          .eq('rating', 5);

        if (ratings?.length === 1) {
          await this.sendMilestoneNotification(userId, 'first_5_star_rating');
        }
      } else {
        // Check customer-specific milestones
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id')
          .eq('customer_id', userId);

        if (bookings?.length === 1) {
          await this.sendMilestoneNotification(userId, 'first_booking_created');
        }
      }
    } catch (err) {
      console.error('❌ Error checking milestones:', err);
    }
  }

  /**
   * Send welcome message to new user
   */
  async sendWelcomeMessage(userId: string): Promise<boolean> {
    return this.sendMilestoneNotification(userId, 'welcome');
  }

  /**
   * Send email verification message
   */
  async sendEmailVerifiedMessage(userId: string): Promise<boolean> {
    return this.sendMilestoneNotification(userId, 'email_verified');
  }

  /**
   * Send profile completed message
   */
  async sendProfileCompletedMessage(userId: string): Promise<boolean> {
    return this.sendMilestoneNotification(userId, 'profile_completed');
  }
}

export const milestoneNotificationService = new MilestoneNotificationService();

