import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface NotificationData {
  type: 'booking_request' | 'booking_update' | 'message' | 'job_reminder' | 'payment' | 'rating_request';
  bookingId?: string;
  messageId?: string;
  userId?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

class PushNotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;

  async initialize(userId: string): Promise<void> {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    // Get push token
    this.expoPushToken = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo Push Token:', this.expoPushToken);

    // Save token to database
    await this.savePushToken(userId, this.expoPushToken);

    // Configure Android channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B6B',
      });

      // Create specific channels for different notification types
      await this.createNotificationChannels();
    }

    // Set up listeners
    this.setupNotificationListeners();
  }

  private async createNotificationChannels(): Promise<void> {
    const channels = [
      {
        id: 'booking_updates',
        name: 'Booking Updates',
        importance: Notifications.AndroidImportance.HIGH,
        description: 'Notifications about booking status changes',
      },
      {
        id: 'messages',
        name: 'Messages',
        importance: Notifications.AndroidImportance.DEFAULT,
        description: 'New message notifications',
      },
      {
        id: 'job_alerts',
        name: 'Job Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        description: 'Important job-related notifications',
      },
      {
        id: 'payments',
        name: 'Payments',
        importance: Notifications.AndroidImportance.HIGH,
        description: 'Payment and earnings notifications',
      },
    ];

    for (const channel of channels) {
      await Notifications.setNotificationChannelAsync(channel.id, channel);
    }
  }

  private setupNotificationListeners(): void {
    // Listen for notifications while app is running
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      this.handleNotificationReceived(notification);
    });

    // Listen for user interactions with notifications
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      this.handleNotificationResponse(response);
    });
  }

  private handleNotificationReceived(notification: Notifications.Notification): void {
    // Handle notification when app is in foreground
    const { type } = notification.request.content.data || {};
    
    // Update badge count
    this.updateBadgeCount();
    
    // Handle specific notification types
    switch (type) {
      case 'message':
        // Update message context
        break;
      case 'booking_update':
        // Refresh booking data
        break;
      default:
        break;
    }
  }

  private handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const { type, bookingId, messageId } = response.notification.request.content.data || {};
    
    // Navigate based on notification type
    switch (type) {
      case 'booking_request':
      case 'booking_update':
        if (bookingId) {
          // Navigate to booking details
          console.log('Navigate to booking:', bookingId);
        }
        break;
      case 'message':
        if (messageId) {
          // Navigate to chat
          console.log('Navigate to chat:', messageId);
        }
        break;
      case 'job_reminder':
        // Navigate to jobs screen
        console.log('Navigate to jobs');
        break;
      default:
        break;
    }
  }

  private async savePushToken(userId: string, token: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_push_tokens')
        .upsert({
          user_id: userId,
          push_token: token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  private async updateBadgeCount(): Promise<void> {
    try {
      // Get current unread counts from database
      const { data, error } = await supabase
        .from('user_notifications')
        .select('id')
        .eq('read', false);

      if (error) throw error;

      const badgeCount = data?.length || 0;
      await Notifications.setBadgeCountAsync(badgeCount);
    } catch (error) {
      console.error('Error updating badge count:', error);
    }
  }

  // Send local notification (for testing or immediate feedback)
  async sendLocalNotification(notificationData: NotificationData): Promise<void> {
    const channelId = this.getChannelForType(notificationData.type);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notificationData.title,
        body: notificationData.body,
        data: notificationData.data || {},
        sound: true,
      },
      trigger: null, // Send immediately
      ...(Platform.OS === 'android' && { channelId }),
    });
  }

  // Send push notification through backend
  async sendPushNotification(
    targetUserId: string,
    notificationData: NotificationData
  ): Promise<void> {
    try {
      // Send through backend API
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({
          target_user_id: targetUserId,
          notification: notificationData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send push notification');
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  private getChannelForType(type: string): string {
    switch (type) {
      case 'booking_request':
      case 'booking_update':
        return 'booking_updates';
      case 'message':
        return 'messages';
      case 'job_reminder':
        return 'job_alerts';
      case 'payment':
        return 'payments';
      default:
        return 'default';
    }
  }

  private async getAuthToken(): Promise<string> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  // Predefined notification templates
  async sendBookingRequestNotification(cleanerId: string, customerName: string, serviceType: string): Promise<void> {
    await this.sendPushNotification(cleanerId, {
      type: 'booking_request',
      title: 'New Booking Request',
      body: `${customerName} requested a ${serviceType} service`,
      data: { customerName, serviceType },
    });
  }

  async sendBookingConfirmationNotification(customerId: string, cleanerName: string, scheduledTime: string): Promise<void> {
    await this.sendPushNotification(customerId, {
      type: 'booking_update',
      title: 'Booking Confirmed',
      body: `${cleanerName} confirmed your booking for ${scheduledTime}`,
      data: { cleanerName, scheduledTime },
    });
  }

  async sendCleanerEnRouteNotification(customerId: string, cleanerName: string, eta: string): Promise<void> {
    await this.sendPushNotification(customerId, {
      type: 'booking_update',
      title: 'Cleaner En Route',
      body: `${cleanerName} is on the way! ETA: ${eta}`,
      data: { cleanerName, eta },
    });
  }

  async sendJobCompletionNotification(customerId: string, cleanerName: string): Promise<void> {
    await this.sendPushNotification(customerId, {
      type: 'rating_request',
      title: 'Service Completed',
      body: `${cleanerName} has completed your cleaning. Please rate your experience!`,
      data: { cleanerName },
    });
  }

  async sendPaymentNotification(cleanerId: string, amount: number): Promise<void> {
    await this.sendPushNotification(cleanerId, {
      type: 'payment',
      title: 'Payment Received',
      body: `You've received $${amount.toFixed(2)} for your completed service`,
      data: { amount },
    });
  }

  async sendNewMessageNotification(recipientId: string, senderName: string, messagePreview: string): Promise<void> {
    await this.sendPushNotification(recipientId, {
      type: 'message',
      title: `Message from ${senderName}`,
      body: messagePreview,
      data: { senderName },
    });
  }

  async sendJobReminderNotification(cleanerId: string, customerName: string, timeUntilJob: string): Promise<void> {
    await this.sendPushNotification(cleanerId, {
      type: 'job_reminder',
      title: 'Upcoming Job Reminder',
      body: `You have a job with ${customerName} in ${timeUntilJob}`,
      data: { customerName, timeUntilJob },
    });
  }

  // Clean up listeners
  dispose(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  // Schedule periodic notifications
  async scheduleJobReminders(): Promise<void> {
    // This would typically be handled by a backend cron job
    // But can also schedule local reminders for immediate jobs
    
    try {
      const { data: upcomingJobs, error } = await supabase
        .from('bookings')
        .select('id, scheduled_time, customer:customer_id(name)')
        .eq('cleaner_id', 'current_user_id') // Would be actual user ID
        .eq('status', 'confirmed')
        .gte('scheduled_time', new Date().toISOString())
        .lte('scheduled_time', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      for (const job of upcomingJobs || []) {
        const jobTime = new Date(job.scheduled_time);
        const reminderTime = new Date(jobTime.getTime() - 30 * 60 * 1000); // 30 minutes before

        if (reminderTime > new Date()) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Upcoming Job Reminder',
              body: `You have a job with ${job.customer.name} in 30 minutes`,
              data: { bookingId: job.id },
            },
            trigger: { date: reminderTime },
          });
        }
      }
    } catch (error) {
      console.error('Error scheduling job reminders:', error);
    }
  }
}

export const pushNotificationService = new PushNotificationService(); 