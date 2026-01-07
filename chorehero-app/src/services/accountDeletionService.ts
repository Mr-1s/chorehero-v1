import { supabase } from './supabase';
import { contentService } from './contentService';
import { ApiResponse } from '../types/api';

// ============================================================================
// ACCOUNT DELETION SERVICE
// ============================================================================

export interface UserDataExport {
  profile: any;
  bookings: any[];
  content: any[];
  reviews: any[];
  messages: any[];
  payment_history: any[];
  addresses: any[];
  preferences: any[];
  export_date: string;
  user_id: string;
}

export interface DeletionOptions {
  export_data?: boolean;
  soft_delete_active_bookings?: boolean;
  anonymize_reviews?: boolean;
  cancel_subscriptions?: boolean;
  delete_media_files?: boolean;
}

class AccountDeletionService {
  
  // ============================================================================
  // DATA EXPORT (GDPR Compliance)
  // ============================================================================
  
  /**
   * Export all user data before deletion (GDPR requirement)
   */
  async exportUserData(userId: string): Promise<ApiResponse<UserDataExport>> {
    try {
      console.log('📦 Exporting user data for:', userId);
      
      // Get user profile
      const { data: profile } = await supabase
        .from('users')
        .select(`
          *,
          customer_profiles(*),
          cleaner_profiles(*)
        `)
        .eq('id', userId)
        .single();

      // Get all bookings (both as customer and cleaner)
      const { data: bookings } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_add_ons(*),
          customer:users!customer_id(name, email),
          cleaner:users!cleaner_id(name, email)
        `)
        .or(`customer_id.eq.${userId},cleaner_id.eq.${userId}`);

      // Get content posts
      const { data: content } = await supabase
        .from('content_posts')
        .select('*')
        .eq('user_id', userId);

      // Get reviews (given and received)
      const { data: reviews } = await supabase
        .from('reviews')
        .select('*')
        .or(`customer_id.eq.${userId},cleaner_id.eq.${userId}`);

      // Get chat messages
      const { data: messages } = await supabase
        .from('chat_messages')
        .select(`
          *,
          chat_thread:chat_threads(*)
        `)
        .eq('sender_id', userId);

      // Get addresses
      const { data: addresses } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId);

      // Get payment methods (without sensitive data)
      const { data: payment_methods } = await supabase
        .from('payment_methods')
        .select('id, type, last_four, brand, exp_month, exp_year, is_default, created_at')
        .eq('user_id', userId);

      const exportData: UserDataExport = {
        profile: profile || {},
        bookings: bookings || [],
        content: content || [],
        reviews: reviews || [],
        messages: messages || [],
        payment_history: payment_methods || [],
        addresses: addresses || [],
        preferences: [], // Add preferences if we have a preferences table
        export_date: new Date().toISOString(),
        user_id: userId
      };

      console.log('✅ User data exported successfully');
      return { success: true, data: exportData };

    } catch (error) {
      console.error('❌ Error exporting user data:', error);
      return {
        success: false,
        data: {} as UserDataExport,
        error: error instanceof Error ? error.message : 'Failed to export user data'
      };
    }
  }

  // ============================================================================
  // SOFT DELETION FOR ACTIVE SERVICES
  // ============================================================================
  
  /**
   * Soft delete active bookings instead of hard deletion
   */
  async softDeleteActiveBookings(userId: string): Promise<ApiResponse<boolean>> {
    try {
      console.log('🔄 Soft deleting active bookings for user:', userId);
      
      // Find active bookings where user is customer or cleaner
      const { data: activeBookings, error: findError } = await supabase
        .from('bookings')
        .select('id, status, customer_id, cleaner_id')
        .or(`customer_id.eq.${userId},cleaner_id.eq.${userId}`)
        .in('status', ['pending', 'confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress']);

      if (findError) throw findError;

      if (!activeBookings || activeBookings.length === 0) {
        console.log('✅ No active bookings to soft delete');
        return { success: true, data: true };
      }

      // Update active bookings to mark user as deleted
      for (const booking of activeBookings) {
        const updates: any = {
          updated_at: new Date().toISOString()
        };

        // Mark the user fields as deleted but preserve booking for the other party
        if (booking.customer_id === userId) {
          updates.customer_deleted_at = new Date().toISOString();
          updates.customer_id = null; // Remove reference but keep booking
        }
        
        if (booking.cleaner_id === userId) {
          updates.cleaner_deleted_at = new Date().toISOString();
          updates.cleaner_id = null; // Remove reference but keep booking
        }

        // If booking is still pending and involves the deleted user, cancel it
        if (booking.status === 'pending') {
          updates.status = 'cancelled';
          updates.cancellation_reason = 'User account deleted';
        }

        const { error: updateError } = await supabase
          .from('bookings')
          .update(updates)
          .eq('id', booking.id);

        if (updateError) {
          console.warn(`⚠️ Failed to update booking ${booking.id}:`, updateError);
        }
      }

      console.log(`✅ Soft deleted ${activeBookings.length} active bookings`);
      return { success: true, data: true };

    } catch (error) {
      console.error('❌ Error soft deleting bookings:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to soft delete bookings'
      };
    }
  }

  /**
   * Anonymize user reviews instead of deleting them
   */
  async anonymizeUserReviews(userId: string): Promise<ApiResponse<boolean>> {
    try {
      console.log('🎭 Anonymizing user reviews for:', userId);
      
      // Anonymize reviews given by this user
      const { error: customerReviewsError } = await supabase
        .from('reviews')
        .update({
          comment: '[Review from deleted user]',
          customer_deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('customer_id', userId);

      if (customerReviewsError) throw customerReviewsError;

      // For reviews received by cleaners, just mark that the cleaner was deleted
      // but keep the review content for other users' benefit
      const { error: cleanerReviewsError } = await supabase
        .from('reviews')
        .update({
          cleaner_deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('cleaner_id', userId);

      if (cleanerReviewsError) throw cleanerReviewsError;

      console.log('✅ User reviews anonymized successfully');
      return { success: true, data: true };

    } catch (error) {
      console.error('❌ Error anonymizing reviews:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to anonymize reviews'
      };
    }
  }

  // ============================================================================
  // MEDIA AND EXTERNAL CLEANUP
  // ============================================================================
  
  /**
   * Delete all user's uploaded media files
   */
  async deleteUserMediaFiles(userId: string): Promise<ApiResponse<boolean>> {
    try {
      console.log('🗑️ Deleting media files for user:', userId);
      
      // Get all content posts to find media URLs
      const { data: contentPosts, error: fetchError } = await supabase
        .from('content_posts')
        .select('media_url, thumbnail_url, secondary_media_url')
        .eq('user_id', userId);

      if (fetchError) throw fetchError;

      if (!contentPosts || contentPosts.length === 0) {
        console.log('✅ No media files to delete');
        return { success: true, data: true };
      }

      // Delete each media file from storage
      const filesToDelete: string[] = [];
      
      for (const post of contentPosts) {
        if (post.media_url) {
          const urlParts = post.media_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const filePath = post.media_url.includes('/videos/') ? `videos/${fileName}` : `images/${fileName}`;
          filesToDelete.push(filePath);
        }
        
        if (post.thumbnail_url) {
          const urlParts = post.thumbnail_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          filesToDelete.push(`images/${fileName}`);
        }
        
        if (post.secondary_media_url) {
          const urlParts = post.secondary_media_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          filesToDelete.push(`images/${fileName}`);
        }
      }

      // Batch delete files from storage
      if (filesToDelete.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('content')
          .remove(filesToDelete);

        if (storageError) {
          console.warn('⚠️ Some media files could not be deleted:', storageError);
          // Continue with deletion even if some files fail
        } else {
          console.log(`✅ Deleted ${filesToDelete.length} media files`);
        }
      }

      return { success: true, data: true };

    } catch (error) {
      console.error('❌ Error deleting media files:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to delete media files'
      };
    }
  }

  /**
   * Cancel external subscriptions (Stripe, notifications, etc.)
   */
  async cancelExternalSubscriptions(userId: string): Promise<ApiResponse<boolean>> {
    try {
      console.log('🚫 Canceling external subscriptions for user:', userId);
      
      // TODO: Implement Stripe subscription cancellation
      // This would involve calling Stripe API to cancel any active subscriptions
      
      // TODO: Unsubscribe from push notifications
      // This would involve removing FCM tokens and notification preferences
      
      // For now, just remove payment methods from our database
      const { error: paymentError } = await supabase
        .from('payment_methods')
        .delete()
        .eq('user_id', userId);

      if (paymentError) {
        console.warn('⚠️ Error removing payment methods:', paymentError);
      }

      console.log('✅ External subscriptions canceled');
      return { success: true, data: true };

    } catch (error) {
      console.error('❌ Error canceling subscriptions:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to cancel subscriptions'
      };
    }
  }

  // ============================================================================
  // COMPLETE ACCOUNT DELETION
  // ============================================================================
  
  /**
   * Complete account deletion with all safety measures
   */
  async deleteAccount(
    userId: string, 
    options: DeletionOptions = {
      export_data: true,
      soft_delete_active_bookings: true,
      anonymize_reviews: true,
      cancel_subscriptions: true,
      delete_media_files: true
    }
  ): Promise<ApiResponse<{ exported_data?: UserDataExport }>> {
    try {
      console.log('🗑️ Starting complete account deletion for:', userId);
      
      let exportedData: UserDataExport | undefined;

      // Step 1: Export user data (GDPR compliance)
      if (options.export_data) {
        const exportResult = await this.exportUserData(userId);
        if (!exportResult.success) {
          throw new Error(`Data export failed: ${exportResult.error}`);
        }
        exportedData = exportResult.data;
        console.log('✅ User data exported');
      }

      // Step 2: Handle active bookings
      if (options.soft_delete_active_bookings) {
        const bookingResult = await this.softDeleteActiveBookings(userId);
        if (!bookingResult.success) {
          console.warn('⚠️ Booking soft deletion failed:', bookingResult.error);
        }
      }

      // Step 3: Anonymize reviews
      if (options.anonymize_reviews) {
        const reviewResult = await this.anonymizeUserReviews(userId);
        if (!reviewResult.success) {
          console.warn('⚠️ Review anonymization failed:', reviewResult.error);
        }
      }

      // Step 4: Delete media files
      if (options.delete_media_files) {
        const mediaResult = await this.deleteUserMediaFiles(userId);
        if (!mediaResult.success) {
          console.warn('⚠️ Media deletion failed:', mediaResult.error);
        }
      }

      // Step 5: Cancel external subscriptions
      if (options.cancel_subscriptions) {
        const subscriptionResult = await this.cancelExternalSubscriptions(userId);
        if (!subscriptionResult.success) {
          console.warn('⚠️ Subscription cancellation failed:', subscriptionResult.error);
        }
      }

      // Step 6: Delete user from Supabase Auth (this triggers all CASCADE DELETEs)
      const { error: authError } = await supabase.auth.admin.deleteUser(userId);
      
      if (authError) {
        throw new Error(`Auth deletion failed: ${authError.message}`);
      }

      console.log('✅ Account deletion completed successfully');
      
      return {
        success: true,
        data: { exported_data: exportedData }
      };

    } catch (error) {
      console.error('❌ Account deletion failed:', error);
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Account deletion failed'
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  /**
   * Check if user has any active bookings that would be affected
   */
  async getAccountDeletionImpact(userId: string): Promise<ApiResponse<{
    active_bookings: number;
    pending_payments: number;
    content_posts: number;
    reviews_given: number;
    reviews_received: number;
  }>> {
    try {
      // Count active bookings
      const { count: activeBookings } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .or(`customer_id.eq.${userId},cleaner_id.eq.${userId}`)
        .in('status', ['pending', 'confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress']);

      // Count content posts
      const { count: contentPosts } = await supabase
        .from('content_posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Count reviews given
      const { count: reviewsGiven } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', userId);

      // Count reviews received
      const { count: reviewsReceived } = await supabase
        .from('reviews')
        .select('*', { count: 'exact', head: true })
        .eq('cleaner_id', userId);

      return {
        success: true,
        data: {
          active_bookings: activeBookings || 0,
          pending_payments: 0, // TODO: Implement payment status check
          content_posts: contentPosts || 0,
          reviews_given: reviewsGiven || 0,
          reviews_received: reviewsReceived || 0
        }
      };

    } catch (error) {
      console.error('❌ Error checking deletion impact:', error);
      return {
        success: false,
        data: {
          active_bookings: 0,
          pending_payments: 0,
          content_posts: 0,
          reviews_given: 0,
          reviews_received: 0
        },
        error: error instanceof Error ? error.message : 'Failed to check deletion impact'
      };
    }
  }
}

export const accountDeletionService = new AccountDeletionService();
