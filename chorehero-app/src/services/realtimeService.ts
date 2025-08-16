/**
 * Comprehensive Real-time Subscription Service
 * Handles all real-time data updates across the ChoreHero platform
 */

import { supabase } from './supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Types
export interface BookingUpdate {
  id: string;
  status: string;
  cleaner_id?: string;
  customer_id: string;
  scheduled_time: string;
  actual_start_time?: string;
  actual_end_time?: string;
}

export interface MessageUpdate {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  created_at: string;
}

export interface LocationUpdate {
  id: string;
  booking_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface EarningsUpdate {
  booking_id: string;
  cleaner_id: string;
  cleaner_earnings: number;
  payment_status: string;
}

export interface NotificationUpdate {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// Callback types
export type BookingUpdateCallback = (payload: RealtimePostgresChangesPayload<BookingUpdate>) => void;
export type MessageUpdateCallback = (payload: RealtimePostgresChangesPayload<MessageUpdate>) => void;
export type LocationUpdateCallback = (payload: RealtimePostgresChangesPayload<LocationUpdate>) => void;
export type EarningsUpdateCallback = (payload: RealtimePostgresChangesPayload<EarningsUpdate>) => void;
export type NotificationUpdateCallback = (payload: RealtimePostgresChangesPayload<NotificationUpdate>) => void;

class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscriptions: Map<string, () => void> = new Map();

  // ============================================================================
  // BOOKING REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  /**
   * Subscribe to booking status updates for a specific user
   */
  subscribeToUserBookings(
    userId: string,
    userRole: 'customer' | 'cleaner',
    callback: BookingUpdateCallback
  ): () => void {
    const channelName = `booking-updates-${userId}`;
    
    console.log('🔄 Subscribing to booking updates for:', { userId, userRole });

    // Remove existing subscription if any
    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: userRole === 'customer' ? `customer_id=eq.${userId}` : `cleaner_id=eq.${userId}`
        },
        (payload: any) => {
          console.log('📦 Booking update received:', payload);
          callback(payload as RealtimePostgresChangesPayload<BookingUpdate>);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Booking subscription status for ${userId}:`, status);
      });

    this.channels.set(channelName, channel);

    // Return unsubscribe function
    const unsubscribe = () => this.unsubscribe(channelName);
    this.subscriptions.set(channelName, unsubscribe);
    return unsubscribe;
  }

  /**
   * Subscribe to a specific booking's updates (for active job tracking)
   */
  subscribeToBooking(bookingId: string, callback: BookingUpdateCallback): () => void {
    const channelName = `booking-${bookingId}`;
    
    console.log('🔄 Subscribing to specific booking:', bookingId);

    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`
        },
        (payload) => {
          console.log('📦 Specific booking update:', payload);
          callback(payload as RealtimePostgresChangesPayload<BookingUpdate>);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Specific booking subscription status:`, status);
      });

    this.channels.set(channelName, channel);

    const unsubscribe = () => this.unsubscribe(channelName);
    this.subscriptions.set(channelName, unsubscribe);
    return unsubscribe;
  }

  // ============================================================================
  // CHAT REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  /**
   * Subscribe to new messages in a chat thread
   */
  subscribeToMessages(threadId: string, callback: MessageUpdateCallback): () => void {
    const channelName = `messages-${threadId}`;
    
    console.log('🔄 Subscribing to messages for thread:', threadId);

    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          console.log('💬 New message received:', payload);
          callback(payload as RealtimePostgresChangesPayload<MessageUpdate>);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Messages subscription status:`, status);
      });

    this.channels.set(channelName, channel);

    const unsubscribe = () => this.unsubscribe(channelName);
    this.subscriptions.set(channelName, unsubscribe);
    return unsubscribe;
  }

  /**
   * Subscribe to all chat threads for a user (for unread message counts)
   */
  subscribeToUserThreads(userId: string, callback: MessageUpdateCallback): () => void {
    const channelName = `user-threads-${userId}`;
    
    console.log('🔄 Subscribing to user threads:', userId);

    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages'
        },
        async (payload) => {
          // Check if this message is in a thread involving this user
          if (payload.new && 'thread_id' in payload.new) {
            const { data: thread } = await supabase
              .from('chat_threads')
              .select('customer_id, cleaner_id')
              .eq('id', (payload.new as any).thread_id)
              .single();

            if (thread && (thread.customer_id === userId || thread.cleaner_id === userId)) {
              console.log('💬 User thread message update:', payload);
              callback(payload as RealtimePostgresChangesPayload<MessageUpdate>);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 User threads subscription status:`, status);
      });

    this.channels.set(channelName, channel);

    const unsubscribe = () => this.unsubscribe(channelName);
    this.subscriptions.set(channelName, unsubscribe);
    return unsubscribe;
  }

  // ============================================================================
  // LOCATION REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  /**
   * Subscribe to location updates during active bookings
   */
  subscribeToLocationUpdates(bookingId: string, callback: LocationUpdateCallback): () => void {
    const channelName = `location-${bookingId}`;
    
    console.log('🔄 Subscribing to location updates for booking:', bookingId);

    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'location_updates',
          filter: `booking_id=eq.${bookingId}`
        },
        (payload) => {
          console.log('📍 Location update received:', payload);
          callback(payload as RealtimePostgresChangesPayload<LocationUpdate>);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Location subscription status:`, status);
      });

    this.channels.set(channelName, channel);

    const unsubscribe = () => this.unsubscribe(channelName);
    this.subscriptions.set(channelName, unsubscribe);
    return unsubscribe;
  }

  // ============================================================================
  // EARNINGS REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  /**
   * Subscribe to earnings updates for a cleaner
   */
  subscribeToEarningsUpdates(cleanerId: string, callback: EarningsUpdateCallback): () => void {
    const channelName = `earnings-${cleanerId}`;
    
    console.log('🔄 Subscribing to earnings updates for cleaner:', cleanerId);

    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `cleaner_id=eq.${cleanerId}`
        },
        (payload) => {
          // Only trigger for earnings-related updates
          const oldRecord = payload.old as any;
          const newRecord = payload.new as any;
          
          if (oldRecord?.payment_status !== newRecord?.payment_status || 
              oldRecord?.cleaner_earnings !== newRecord?.cleaner_earnings) {
            console.log('💰 Earnings update received:', payload);
            callback(payload as RealtimePostgresChangesPayload<EarningsUpdate>);
          }
        }
      )
      .subscribe((status) => {
        console.log(`📡 Earnings subscription status:`, status);
      });

    this.channels.set(channelName, channel);

    const unsubscribe = () => this.unsubscribe(channelName);
    this.subscriptions.set(channelName, unsubscribe);
    return unsubscribe;
  }

  // ============================================================================
  // NOTIFICATION REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  /**
   * Subscribe to notifications for a user
   */
  subscribeToNotifications(userId: string, callback: NotificationUpdateCallback): () => void {
    const channelName = `notifications-${userId}`;
    
    console.log('🔄 Subscribing to notifications for user:', userId);

    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔔 Notification update received:', payload);
          callback(payload as RealtimePostgresChangesPayload<NotificationUpdate>);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Notifications subscription status:`, status);
      });

    this.channels.set(channelName, channel);

    const unsubscribe = () => this.unsubscribe(channelName);
    this.subscriptions.set(channelName, unsubscribe);
    return unsubscribe;
  }

  // ============================================================================
  // CONTENT & SOCIAL REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  /**
   * Subscribe to content feed updates (new posts, likes, etc.)
   */
  subscribeToContentFeed(userId: string, callback: (payload: any) => void): () => void {
    const channelName = `content-feed-${userId}`;
    
    console.log('🔄 Subscribing to content feed updates for user:', userId);

    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_posts'
        },
        (payload) => {
          console.log('📱 Content feed update received:', payload);
          callback(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_interactions'
        },
        (payload) => {
          console.log('❤️ User interaction update received:', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Content feed subscription status:`, status);
      });

    this.channels.set(channelName, channel);

    const unsubscribe = () => this.unsubscribe(channelName);
    this.subscriptions.set(channelName, unsubscribe);
    return unsubscribe;
  }

  // ============================================================================
  // CLEANER AVAILABILITY REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  /**
   * Subscribe to cleaner availability changes
   */
  subscribeToAvailabilityUpdates(cleanerId: string, callback: (payload: any) => void): () => void {
    const channelName = `availability-${cleanerId}`;
    
    console.log('🔄 Subscribing to availability updates for cleaner:', cleanerId);

    this.unsubscribe(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cleaner_availability',
          filter: `cleaner_id=eq.${cleanerId}`
        },
        (payload) => {
          console.log('📅 Availability update received:', payload);
          callback(payload);
        }
      )
      .subscribe((status) => {
        console.log(`📡 Availability subscription status:`, status);
      });

    this.channels.set(channelName, channel);

    const unsubscribe = () => this.unsubscribe(channelName);
    this.subscriptions.set(channelName, unsubscribe);
    return unsubscribe;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Unsubscribe from a specific channel
   */
  private unsubscribe(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      console.log('🔇 Unsubscribing from channel:', channelName);
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
      this.subscriptions.delete(channelName);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    console.log('🔇 Unsubscribing from all channels');
    
    for (const [channelName] of this.channels) {
      this.unsubscribe(channelName);
    }
    
    this.channels.clear();
    this.subscriptions.clear();
  }

  /**
   * Get active subscription count
   */
  getActiveSubscriptionCount(): number {
    return this.channels.size;
  }

  /**
   * Get list of active channel names
   */
  getActiveChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Check if a specific channel is active
   */
  isChannelActive(channelName: string): boolean {
    return this.channels.has(channelName);
  }

  // ============================================================================
  // BATCH SUBSCRIPTION MANAGEMENT
  // ============================================================================

  /**
   * Set up all essential subscriptions for a user session
   */
  setupUserSession(
    userId: string,
    userRole: 'customer' | 'cleaner',
    callbacks: {
      onBookingUpdate?: BookingUpdateCallback;
      onMessageUpdate?: MessageUpdateCallback;
      onNotificationUpdate?: NotificationUpdateCallback;
      onEarningsUpdate?: EarningsUpdateCallback;
      onLocationUpdate?: LocationUpdateCallback;
    }
  ): () => void {
    console.log('🚀 Setting up user session subscriptions:', { userId, userRole });

    const unsubscribers: (() => void)[] = [];

    // Booking updates
    if (callbacks.onBookingUpdate) {
      unsubscribers.push(
        this.subscribeToUserBookings(userId, userRole, callbacks.onBookingUpdate)
      );
    }

    // Message updates
    if (callbacks.onMessageUpdate) {
      unsubscribers.push(
        this.subscribeToUserThreads(userId, callbacks.onMessageUpdate)
      );
    }

    // Notification updates
    if (callbacks.onNotificationUpdate) {
      unsubscribers.push(
        this.subscribeToNotifications(userId, callbacks.onNotificationUpdate)
      );
    }

    // Cleaner-specific subscriptions
    if (userRole === 'cleaner') {
      if (callbacks.onEarningsUpdate) {
        unsubscribers.push(
          this.subscribeToEarningsUpdates(userId, callbacks.onEarningsUpdate)
        );
      }
    }

    // Return function to unsubscribe from all session subscriptions
    return () => {
      console.log('🔇 Cleaning up user session subscriptions');
      unsubscribers.forEach(unsub => unsub());
    };
  }

  /**
   * Set up subscriptions for an active booking
   */
  setupActiveBookingSession(
    bookingId: string,
    userId: string,
    callbacks: {
      onBookingUpdate?: BookingUpdateCallback;
      onMessageUpdate?: MessageUpdateCallback;
      onLocationUpdate?: LocationUpdateCallback;
    }
  ): () => void {
    console.log('🚀 Setting up active booking session:', bookingId);

    const unsubscribers: (() => void)[] = [];

    // Specific booking updates
    if (callbacks.onBookingUpdate) {
      unsubscribers.push(
        this.subscribeToBooking(bookingId, callbacks.onBookingUpdate)
      );
    }

    // Location updates during active booking
    if (callbacks.onLocationUpdate) {
      unsubscribers.push(
        this.subscribeToLocationUpdates(bookingId, callbacks.onLocationUpdate)
      );
    }

    // Get the chat thread for this booking and subscribe to messages
    if (callbacks.onMessageUpdate) {
      supabase
        .from('chat_threads')
        .select('id')
        .eq('booking_id', bookingId)
        .single()
        .then(({ data: thread }) => {
          if (thread) {
            unsubscribers.push(
              this.subscribeToMessages(thread.id, callbacks.onMessageUpdate!)
            );
          }
        });
    }

    // Return cleanup function
    return () => {
      console.log('🔇 Cleaning up active booking session subscriptions');
      unsubscribers.forEach(unsub => unsub());
    };
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService();
export default realtimeService;