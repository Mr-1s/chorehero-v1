/**
 * Tracking Workflow Service
 * 
 * Orchestrates the cleaner tracking flow:
 * 1. Cleaner taps "Start Traveling" → Start GPS tracking
 * 2. Send push notification to customer → "Your ChoreHero is on the way!"
 * 3. Broadcast real-time location updates
 * 4. Customer sees live ETA and map updates
 */

import { enhancedLocationService } from './enhancedLocationService';
import { pushNotificationService } from './pushNotifications';
import { supabase } from './supabase';

interface CleanerTrackingState {
  isTracking: boolean;
  bookingId: string | null;
  customerId: string | null;
  cleanerId: string | null;
  startTime: Date | null;
}

class TrackingWorkflowService {
  private state: CleanerTrackingState = {
    isTracking: false,
    bookingId: null,
    customerId: null,
    cleanerId: null,
    startTime: null,
  };

  /**
   * Start cleaner tracking when they tap "Start Traveling"
   * 1. Update booking status to 'cleaner_en_route'
   * 2. Start GPS tracking
   * 3. Notify customer via push notification
   * 4. Create notification in database
   */
  async startCleanerTracking(
    bookingId: string,
    cleanerId: string,
    cleanerName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🚗 Starting cleaner tracking workflow...');

      // Skip database operations for mock bookings
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);

      let customerId: string | null = null;

      if (isValidUUID) {
        // 1. Get booking details to find customer
        const { data: booking, error: bookingError } = await supabase
          .from('bookings')
          .select('customer_id, scheduled_time, address:addresses!address_id(street, city)')
          .eq('id', bookingId)
          .single();

        if (bookingError || !booking) {
          console.error('❌ Failed to fetch booking:', bookingError);
          return { success: false, error: 'Booking not found' };
        }

        customerId = booking.customer_id;

        // 2. Update booking status
        const { error: updateError } = await supabase
          .from('bookings')
          .update({ 
            status: 'cleaner_en_route',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId);

        if (updateError) {
          console.error('❌ Failed to update booking status:', updateError);
          return { success: false, error: 'Failed to update booking status' };
        }

        // 3. Create notification in database for customer
        await supabase.from('notifications').insert({
          user_id: customerId,
          type: 'booking_update',
          title: '🚗 Your ChoreHero is on the way!',
          message: `${cleanerName} has started traveling to your location. You can track their progress in real-time.`,
          is_read: false,
        });

        // 4. Send push notification to customer
        try {
          const eta = await this.calculateInitialETA(cleanerId, bookingId);
          await pushNotificationService.sendCleanerEnRouteNotification(
            customerId,
            cleanerName,
            eta
          );
          console.log('📱 Push notification sent to customer');
        } catch (pushError) {
          console.warn('⚠️ Failed to send push notification:', pushError);
          // Don't fail the whole flow if push fails
        }
      }

      // 5. Start GPS tracking
      const trackingResult = await enhancedLocationService.startJobTracking(bookingId, cleanerId);
      
      if (!trackingResult.success) {
        console.warn('⚠️ GPS tracking failed to start:', trackingResult.error);
        // Continue anyway - push notification already sent
      } else {
        console.log('📍 GPS tracking started');
      }

      // Update internal state
      this.state = {
        isTracking: true,
        bookingId,
        customerId,
        cleanerId,
        startTime: new Date(),
      };

      console.log('✅ Cleaner tracking workflow started successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ Error starting tracking workflow:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start tracking' 
      };
    }
  }

  /**
   * Stop tracking when cleaner arrives
   */
  async stopCleanerTracking(bookingId: string): Promise<void> {
    try {
      console.log('🏁 Stopping cleaner tracking...');

      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);

      // Stop GPS tracking
      await enhancedLocationService.stopTracking();

      if (isValidUUID) {
        // Update booking status
        await supabase
          .from('bookings')
          .update({ 
            status: 'cleaner_arrived',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId);

        // Notify customer
        if (this.state.customerId) {
          await supabase.from('notifications').insert({
            user_id: this.state.customerId,
            type: 'booking_update',
            title: '🏠 Your ChoreHero has arrived!',
            message: 'Your cleaner has arrived at your location.',
            is_read: false,
          });
        }
      }

      // Reset state
      this.state = {
        isTracking: false,
        bookingId: null,
        customerId: null,
        cleanerId: null,
        startTime: null,
      };

      console.log('✅ Cleaner tracking stopped');
    } catch (error) {
      console.error('❌ Error stopping tracking:', error);
    }
  }

  /**
   * Calculate initial ETA based on cleaner's current location and booking address
   */
  private async calculateInitialETA(cleanerId: string, bookingId: string): Promise<string> {
    try {
      // Get cleaner's current location
      const locationResult = await enhancedLocationService.getCurrentLocation();
      
      if (!locationResult.success) {
        return '~15 min'; // Default fallback
      }

      // In a real app, you'd use Google Maps Directions API or similar
      // For now, return a reasonable estimate
      return '~15 min';
    } catch {
      return '~15 min';
    }
  }

  /**
   * Subscribe to location updates for a booking (customer side)
   */
  subscribeToCleanerLocation(
    bookingId: string,
    onLocationUpdate: (location: {
      latitude: number;
      longitude: number;
      eta?: number;
      timestamp: string;
    }) => void
  ): () => void {
    console.log('📡 Subscribing to cleaner location updates for booking:', bookingId);

    const channel = supabase
      .channel(`location-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_updates',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          const { latitude, longitude, eta, timestamp } = payload.new as any;
          onLocationUpdate({
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            eta: eta ? parseFloat(eta) : undefined,
            timestamp,
          });
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      console.log('📡 Unsubscribing from cleaner location updates');
      supabase.removeChannel(channel);
    };
  }

  /**
   * Get the latest location for a booking
   */
  async getLatestLocation(bookingId: string): Promise<{
    latitude: number;
    longitude: number;
    eta?: number;
    timestamp: string;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('location_updates')
        .select('latitude, longitude, eta, timestamp')
        .eq('booking_id', bookingId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      return {
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        eta: data.eta ? parseFloat(data.eta) : undefined,
        timestamp: data.timestamp,
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if cleaner is currently tracking
   */
  isCurrentlyTracking(): boolean {
    return this.state.isTracking;
  }

  /**
   * Get current tracking state
   */
  getTrackingState(): CleanerTrackingState {
    return { ...this.state };
  }
}

export const trackingWorkflowService = new TrackingWorkflowService();


