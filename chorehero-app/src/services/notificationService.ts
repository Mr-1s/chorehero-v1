import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'booking' | 'message' | 'system';
  title: string;
  message: string;
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar?: string;
  toUserId: string;
  relatedId?: string; // videoId, bookingId, etc.
  timestamp: Date;
  read: boolean;
}

class NotificationService {
  private notifications: Notification[] = [];

  // Send a notification
  async sendNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false,
    };

    this.notifications.push(newNotification);
    
    // Store in AsyncStorage for persistence
    try {
      await AsyncStorage.setItem('notifications', JSON.stringify(this.notifications));
      console.log('Notification sent:', newNotification);
    } catch (error) {
      console.error('Error storing notification:', error);
    }

    return newNotification;
  }

  // Send like notification
  async sendLikeNotification(
    videoId: string,
    cleanerId: string,
    likerUserId: string,
    likerName: string,
    likerAvatar?: string
  ) {
    return this.sendNotification({
      type: 'like',
      title: 'New Like! ❤️',
      message: `${likerName} liked your cleaning video`,
      fromUserId: likerUserId,
      fromUserName: likerName,
      fromUserAvatar: likerAvatar,
      toUserId: cleanerId,
      relatedId: videoId,
    });
  }

  // Send comment notification
  async sendCommentNotification(
    videoId: string,
    cleanerId: string,
    commenterUserId: string,
    commenterName: string,
    commentText: string,
    commenterAvatar?: string
  ) {
    return this.sendNotification({
      type: 'comment',
      title: 'New Comment! 💬',
      message: `${commenterName}: ${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}`,
      fromUserId: commenterUserId,
      fromUserName: commenterName,
      fromUserAvatar: commenterAvatar,
      toUserId: cleanerId,
      relatedId: videoId,
    });
  }

  // Send follow notification
  async sendFollowNotification(
    cleanerId: string,
    followerUserId: string,
    followerName: string,
    followerAvatar?: string
  ) {
    return this.sendNotification({
      type: 'system',
      title: 'New Follower! 👋',
      message: `${followerName} started following you`,
      fromUserId: followerUserId,
      fromUserName: followerName,
      fromUserAvatar: followerAvatar,
      toUserId: cleanerId,
    });
  }

  // Send booking notification
  async sendBookingNotification(
    bookingId: string,
    cleanerId: string,
    customerUserId: string,
    customerName: string,
    serviceType: string,
    customerAvatar?: string
  ) {
    return this.sendNotification({
      type: 'booking',
      title: 'New Booking! 🎉',
      message: `${customerName} booked your ${serviceType} service`,
      fromUserId: customerUserId,
      fromUserName: customerName,
      fromUserAvatar: customerAvatar,
      toUserId: cleanerId,
      relatedId: bookingId,
    });
  }

  /**
   * Notify cleaners of a new marketplace job (pending, no cleaner assigned).
   * Trigger inserts into notifications; this invokes send-push for each matched cleaner.
   */
  async notifyCleanersOfNewJob(booking: {
    id: string;
    address_id?: string;
    service_type?: string;
    total_amount?: number;
    scheduled_time?: string;
  }): Promise<void> {
    try {
      if (!booking.address_id) return;

      const { data: addr } = await supabase
        .from('addresses')
        .select('latitude, longitude')
        .eq('id', booking.address_id)
        .single();

      const lat = addr?.latitude != null ? Number(addr.latitude) : null;
      const lng = addr?.longitude != null ? Number(addr.longitude) : null;
      if (lat == null || lng == null) return;

      const { data: cleaners, error } = await supabase.rpc('find_cleaners_for_job', {
        p_lat: lat,
        p_lng: lng,
        p_service_type: booking.service_type || null,
        p_radius_km: 50,
      });

      if (error || !cleaners?.length) return;

      const serviceType = booking.service_type || 'Cleaning';
      const total = booking.total_amount ?? 0;
      const scheduled = booking.scheduled_time
        ? new Date(booking.scheduled_time).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : '';

      const title = 'New cleaning job available!';
      const body = `$${total.toFixed(2)} - ${serviceType} on ${scheduled}`;

      for (const row of cleaners as { user_id: string }[]) {
        try {
          await supabase.functions.invoke('send-push', {
            body: {
              userId: row.user_id,
              title,
              body,
              data: { type: 'new_booking', bookingId: booking.id },
            },
          });
        } catch (e) {
          console.warn('Push send failed for cleaner:', row.user_id, e);
        }
      }
    } catch (err) {
      console.warn('notifyCleanersOfNewJob failed:', err);
    }
  }

  // Send cancellation notification to cleaner
  async sendCancellationNotification(
    bookingId: string,
    cleanerId: string,
    customerUserId: string,
    customerName: string,
    serviceType: string,
    scheduledDate: string,
    customerAvatar?: string
  ) {
    return this.sendNotification({
      type: 'booking',
      title: 'Booking Cancelled ❌',
      message: `${customerName} cancelled their ${serviceType} booking for ${scheduledDate}`,
      fromUserId: customerUserId,
      fromUserName: customerName,
      fromUserAvatar: customerAvatar,
      toUserId: cleanerId,
      relatedId: bookingId,
    });
  }

  // Get notifications for a user
  async getNotificationsForUser(userId: string): Promise<Notification[]> {
    try {
      const stored = await AsyncStorage.getItem('notifications');
      if (stored) {
        this.notifications = JSON.parse(stored);
      }
      return this.notifications.filter(n => n.toUserId === userId);
    } catch (error) {
      console.error('Error loading notifications:', error);
      return [];
    }
  }

  // Get unread count for a user
  async getUnreadCount(userId: string): Promise<number> {
    const userNotifications = await this.getNotificationsForUser(userId);
    return userNotifications.filter(n => !n.read).length;
  }

  // Mark notification as read
  async markAsRead(notificationId: string) {
    this.notifications = this.notifications.map(n => 
      n.id === notificationId ? { ...n, read: true } : n
    );
    
    try {
      await AsyncStorage.setItem('notifications', JSON.stringify(this.notifications));
    } catch (error) {
      console.error('Error updating notification:', error);
    }
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string) {
    this.notifications = this.notifications.map(n => 
      n.toUserId === userId ? { ...n, read: true } : n
    );
    
    try {
      await AsyncStorage.setItem('notifications', JSON.stringify(this.notifications));
    } catch (error) {
      console.error('Error updating notifications:', error);
    }
  }

  // Clear all notifications for a user (for logout)
  async clearNotificationsForUser(userId: string) {
    this.notifications = this.notifications.filter(n => n.toUserId !== userId);
    
    try {
      await AsyncStorage.setItem('notifications', JSON.stringify(this.notifications));
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }
}

export const notificationService = new NotificationService(); 

export const send_notification = async (
  notification: Omit<Notification, 'id' | 'timestamp' | 'read'>
) => notificationService.sendNotification(notification);