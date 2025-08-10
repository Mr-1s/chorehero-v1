import AsyncStorage from '@react-native-async-storage/async-storage';

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