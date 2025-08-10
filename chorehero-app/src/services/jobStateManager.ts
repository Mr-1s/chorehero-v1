import { supabase } from './supabase';
import { ApiResponse } from '../types/api';
import { pushNotificationService } from './pushNotifications';
import { enhancedLocationService } from './enhancedLocationService';

export type JobStatus = 
  | 'pending'           // Booking created, waiting for cleaner acceptance
  | 'confirmed'         // Cleaner accepted, job scheduled
  | 'cleaner_assigned'  // Cleaner confirmed and assigned
  | 'cleaner_en_route' // Cleaner traveling to location
  | 'cleaner_arrived'  // Cleaner has arrived at location
  | 'in_progress'      // Job actively being performed
  | 'completed'        // Job finished, awaiting payment/review
  | 'paid'             // Payment processed
  | 'reviewed'         // Customer has left review
  | 'cancelled'        // Job cancelled by either party
  | 'no_show'          // Cleaner or customer no-show
  | 'disputed';        // Issue requiring resolution

interface JobStatusUpdate {
  id: string;
  bookingId: string;
  previousStatus: JobStatus;
  newStatus: JobStatus;
  updatedBy: string;
  timestamp: string;
  notes?: string;
  metadata?: Record<string, any>;
}

interface JobWorkflowRules {
  allowedTransitions: Record<JobStatus, JobStatus[]>;
  requiredActions: Record<JobStatus, string[]>;
  notifications: Record<JobStatus, string[]>;
  timeouts: Record<JobStatus, number>; // milliseconds
}

class JobStateManager {
  private workflowRules: JobWorkflowRules = {
    allowedTransitions: {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['cleaner_assigned', 'cancelled'],
      cleaner_assigned: ['cleaner_en_route', 'cancelled', 'no_show'],
      cleaner_en_route: ['cleaner_arrived', 'cancelled'],
      cleaner_arrived: ['in_progress', 'no_show'],
      in_progress: ['completed', 'cancelled'],
      completed: ['paid', 'disputed'],
      paid: ['reviewed'],
      reviewed: [], // Final state
      cancelled: [], // Final state
      no_show: ['cancelled'], // Can be escalated to cancelled
      disputed: ['completed', 'cancelled'], // Resolution paths
    },
    
    requiredActions: {
      pending: ['cleaner_acceptance'],
      confirmed: ['cleaner_assignment'],
      cleaner_assigned: ['start_tracking'],
      cleaner_en_route: ['location_tracking'],
      cleaner_arrived: ['start_job'],
      in_progress: ['job_completion'],
      completed: ['payment_processing'],
      paid: ['review_request'],
      reviewed: [],
      cancelled: ['refund_processing'],
      no_show: ['incident_report'],
      disputed: ['resolution_process'],
    },
    
    notifications: {
      pending: ['cleaner'],
      confirmed: ['customer'],
      cleaner_assigned: ['customer'],
      cleaner_en_route: ['customer'],
      cleaner_arrived: ['customer'],
      in_progress: ['customer'],
      completed: ['customer', 'cleaner'],
      paid: ['cleaner'],
      reviewed: ['cleaner'],
      cancelled: ['customer', 'cleaner'],
      no_show: ['customer', 'cleaner'],
      disputed: ['customer', 'cleaner', 'admin'],
    },
    
    timeouts: {
      pending: 30 * 60 * 1000, // 30 minutes to accept
      confirmed: 2 * 60 * 60 * 1000, // 2 hours before job start
      cleaner_assigned: 15 * 60 * 1000, // 15 minutes to start traveling
      cleaner_en_route: 60 * 60 * 1000, // 1 hour maximum travel time
      cleaner_arrived: 10 * 60 * 1000, // 10 minutes to start job
      in_progress: 8 * 60 * 60 * 1000, // 8 hours maximum job duration
      completed: 24 * 60 * 60 * 1000, // 24 hours to process payment
      paid: 7 * 24 * 60 * 60 * 1000, // 7 days to leave review
      reviewed: 0,
      cancelled: 0,
      no_show: 0,
      disputed: 7 * 24 * 60 * 60 * 1000, // 7 days to resolve
    },
  };

  async updateJobStatus(
    bookingId: string,
    newStatus: JobStatus,
    updatedBy: string,
    notes?: string,
    metadata?: Record<string, any>
  ): Promise<ApiResponse<JobStatusUpdate>> {
    try {
      // Get current booking status
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('status, customer_id, cleaner_id')
        .eq('id', bookingId)
        .single();

      if (bookingError || !booking) {
        return {
          success: false,
          data: null as any,
          error: 'Booking not found',
        };
      }

      const currentStatus = booking.status as JobStatus;

      // Validate transition
      const validationResult = this.validateStatusTransition(currentStatus, newStatus);
      if (!validationResult.success) {
        return validationResult as any;
      }

      // Update booking status
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (updateError) throw updateError;

      // Create status update record
      const statusUpdate = {
        booking_id: bookingId,
        previous_status: currentStatus,
        new_status: newStatus,
        updated_by: updatedBy,
        timestamp: new Date().toISOString(),
        notes,
        metadata,
      };

      const { data: updateRecord, error: recordError } = await supabase
        .from('job_status_updates')
        .insert(statusUpdate)
        .select()
        .single();

      if (recordError) throw recordError;

      // Execute status-specific actions
      await this.executeStatusActions(
        bookingId,
        newStatus,
        booking.customer_id,
        booking.cleaner_id,
        metadata
      );

      // Send notifications
      await this.sendStatusNotifications(
        bookingId,
        newStatus,
        booking.customer_id,
        booking.cleaner_id
      );

      // Schedule timeout checks if needed
      await this.scheduleTimeoutCheck(bookingId, newStatus);

      return {
        success: true,
        data: {
          id: updateRecord.id,
          bookingId,
          previousStatus: currentStatus,
          newStatus,
          updatedBy,
          timestamp: statusUpdate.timestamp,
          notes,
          metadata,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to update job status',
      };
    }
  }

  private validateStatusTransition(
    currentStatus: JobStatus,
    newStatus: JobStatus
  ): ApiResponse<boolean> {
    const allowedTransitions = this.workflowRules.allowedTransitions[currentStatus];
    
    if (!allowedTransitions.includes(newStatus)) {
      return {
        success: false,
        data: false,
        error: `Invalid status transition from ${currentStatus} to ${newStatus}`,
      };
    }

    return {
      success: true,
      data: true,
    };
  }

  private async executeStatusActions(
    bookingId: string,
    status: JobStatus,
    customerId: string,
    cleanerId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      switch (status) {
        case 'confirmed':
          await this.handleBookingConfirmed(bookingId, customerId, cleanerId);
          break;
          
        case 'cleaner_en_route':
          await this.handleCleanerEnRoute(bookingId, cleanerId, customerId);
          break;
          
        case 'cleaner_arrived':
          await this.handleCleanerArrived(bookingId, customerId);
          break;
          
        case 'in_progress':
          await this.handleJobStarted(bookingId, cleanerId, customerId);
          break;
          
        case 'completed':
          await this.handleJobCompleted(bookingId, cleanerId, customerId);
          break;
          
        case 'paid':
          await this.handlePaymentCompleted(bookingId, cleanerId, customerId, metadata);
          break;
          
        case 'cancelled':
          await this.handleJobCancelled(bookingId, customerId, cleanerId, metadata);
          break;
          
        case 'no_show':
          await this.handleNoShow(bookingId, customerId, cleanerId, metadata);
          break;
          
        default:
          break;
      }
    } catch (error) {
      console.error(`Error executing actions for status ${status}:`, error);
    }
  }

  private async handleBookingConfirmed(
    bookingId: string,
    customerId: string,
    cleanerId: string
  ): Promise<void> {
    // Get booking details for notification
    const { data: booking } = await supabase
      .from('bookings')
      .select('scheduled_time, cleaner:cleaner_id(name)')
      .eq('id', bookingId)
      .single();

    if (booking) {
      await pushNotificationService.sendBookingConfirmationNotification(
        customerId,
        booking.cleaner.name,
        new Date(booking.scheduled_time).toLocaleString()
      );
    }
  }

  private async handleCleanerEnRoute(
    bookingId: string,
    cleanerId: string,
    customerId: string
  ): Promise<void> {
    // Start location tracking
    await enhancedLocationService.startJobTracking(bookingId, cleanerId);
    
    // Get cleaner details and notify customer
    const { data: cleaner } = await supabase
      .from('users')
      .select('name')
      .eq('id', cleanerId)
      .single();

    if (cleaner) {
      await pushNotificationService.sendCleanerEnRouteNotification(
        customerId,
        cleaner.name,
        'Calculating...'
      );
    }
  }

  private async handleCleanerArrived(bookingId: string, customerId: string): Promise<void> {
    // Stop location tracking
    await enhancedLocationService.stopTracking();
    
    // Notify customer
    await pushNotificationService.sendLocalNotification({
      type: 'booking_update',
      title: 'Cleaner Has Arrived',
      body: 'Your cleaner has arrived and is ready to start!',
      bookingId,
    });
  }

  private async handleJobStarted(
    bookingId: string,
    cleanerId: string,
    customerId: string
  ): Promise<void> {
    // Record job start time
    await supabase
      .from('bookings')
      .update({ 
        actual_start_time: new Date().toISOString(),
      })
      .eq('id', bookingId);

    // Notify both parties
    await pushNotificationService.sendLocalNotification({
      type: 'job_reminder',
      title: 'Service Started',
      body: 'Your cleaning service is now in progress',
      bookingId,
    });
  }

  private async handleJobCompleted(
    bookingId: string,
    cleanerId: string,
    customerId: string
  ): Promise<void> {
    // Record completion time
    await supabase
      .from('bookings')
      .update({ 
        actual_end_time: new Date().toISOString(),
      })
      .eq('id', bookingId);

    // Get cleaner name for notification
    const { data: cleaner } = await supabase
      .from('users')
      .select('name')
      .eq('id', cleanerId)
      .single();

    if (cleaner) {
      await pushNotificationService.sendJobCompletionNotification(
        customerId,
        cleaner.name
      );
    }

    // Auto-trigger payment processing
    setTimeout(() => {
      this.processJobPayment(bookingId);
    }, 5000); // 5 second delay
  }

  private async handlePaymentCompleted(
    bookingId: string,
    cleanerId: string,
    customerId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const amount = metadata?.amount || 0;
    
    // Notify cleaner of payment
    await pushNotificationService.sendPaymentNotification(cleanerId, amount);
    
    // Update cleaner earnings
    await this.updateCleanerEarnings(cleanerId, amount);
  }

  private async handleJobCancelled(
    bookingId: string,
    customerId: string,
    cleanerId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Stop any active tracking
    await enhancedLocationService.stopTracking();
    
    // Process refund if applicable
    const reason = metadata?.reason || 'Cancelled';
    
    // Record cancellation
    await supabase
      .from('job_cancellations')
      .insert({
        booking_id: bookingId,
        cancelled_by: metadata?.cancelledBy || 'system',
        reason,
        timestamp: new Date().toISOString(),
      });
  }

  private async handleNoShow(
    bookingId: string,
    customerId: string,
    cleanerId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    // Record no-show incident
    await supabase
      .from('no_show_incidents')
      .insert({
        booking_id: bookingId,
        no_show_party: metadata?.noShowParty || 'unknown',
        reported_by: metadata?.reportedBy || 'system',
        timestamp: new Date().toISOString(),
      });
  }

  private async sendStatusNotifications(
    bookingId: string,
    status: JobStatus,
    customerId: string,
    cleanerId: string
  ): Promise<void> {
    const recipients = this.workflowRules.notifications[status];
    
    for (const recipient of recipients) {
      const targetUserId = recipient === 'customer' ? customerId : cleanerId;
      const title = `Job ${status.replace('_', ' ')}`;
      const body = this.getStatusNotificationMessage(status);
      
      await pushNotificationService.sendPushNotification(targetUserId, {
        type: 'booking_update',
        title,
        body,
        bookingId,
      });
    }
  }

  private getStatusNotificationMessage(status: JobStatus): string {
    const messages: Record<JobStatus, string> = {
      pending: 'Waiting for cleaner to accept your booking',
      confirmed: 'Your booking has been confirmed!',
      cleaner_assigned: 'Cleaner has been assigned to your job',
      cleaner_en_route: 'Your cleaner is on the way',
      cleaner_arrived: 'Your cleaner has arrived',
      in_progress: 'Your cleaning service is in progress',
      completed: 'Service completed! Please rate your experience',
      paid: 'Payment processed successfully',
      reviewed: 'Thank you for your review!',
      cancelled: 'Your booking has been cancelled',
      no_show: 'No-show reported for this booking',
      disputed: 'This booking requires resolution',
    };
    
    return messages[status] || 'Booking status updated';
  }

  private async scheduleTimeoutCheck(bookingId: string, status: JobStatus): Promise<void> {
    const timeout = this.workflowRules.timeouts[status];
    
    if (timeout > 0) {
      // In a production app, this would be handled by a backend scheduler
      // For now, we'll just log the timeout requirement
      console.log(`Timeout scheduled for booking ${bookingId} in ${timeout}ms`);
      
      // You could implement client-side timeout checking here if needed
      setTimeout(async () => {
        await this.checkBookingTimeout(bookingId, status);
      }, timeout);
    }
  }

  private async checkBookingTimeout(bookingId: string, expectedStatus: JobStatus): Promise<void> {
    try {
      const { data: booking } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .single();

      if (booking && booking.status === expectedStatus) {
        // Handle timeout based on status
        switch (expectedStatus) {
          case 'pending':
            await this.updateJobStatus(bookingId, 'cancelled', 'system', 'Timeout: No cleaner acceptance');
            break;
          case 'cleaner_assigned':
            await this.updateJobStatus(bookingId, 'no_show', 'system', 'Timeout: Cleaner did not start traveling');
            break;
          default:
            console.log(`Timeout reached for booking ${bookingId} in status ${expectedStatus}`);
            break;
        }
      }
    } catch (error) {
      console.error('Error checking booking timeout:', error);
    }
  }

  private async processJobPayment(bookingId: string): Promise<void> {
    try {
      // Get booking payment details
      const { data: booking } = await supabase
        .from('bookings')
        .select('total_amount, cleaner_earnings, customer_id, cleaner_id')
        .eq('id', bookingId)
        .single();

      if (booking) {
        // Process payment (would integrate with Stripe)
        // For now, just update status
        await this.updateJobStatus(
          bookingId, 
          'paid', 
          'system', 
          'Payment processed automatically',
          { amount: booking.cleaner_earnings }
        );
      }
    } catch (error) {
      console.error('Error processing job payment:', error);
    }
  }

  private async updateCleanerEarnings(cleanerId: string, amount: number): Promise<void> {
    try {
      await supabase.rpc('update_cleaner_earnings', {
        cleaner_id: cleanerId,
        amount,
      });
    } catch (error) {
      console.error('Error updating cleaner earnings:', error);
    }
  }

  // Public methods for common status transitions
  async acceptBooking(bookingId: string, cleanerId: string): Promise<ApiResponse<JobStatusUpdate>> {
    return this.updateJobStatus(bookingId, 'confirmed', cleanerId, 'Booking accepted by cleaner');
  }

  async startTraveling(bookingId: string, cleanerId: string): Promise<ApiResponse<JobStatusUpdate>> {
    return this.updateJobStatus(bookingId, 'cleaner_en_route', cleanerId, 'Cleaner started traveling');
  }

  async arriveAtLocation(bookingId: string, cleanerId: string): Promise<ApiResponse<JobStatusUpdate>> {
    return this.updateJobStatus(bookingId, 'cleaner_arrived', cleanerId, 'Cleaner arrived at location');
  }

  async startJob(bookingId: string, cleanerId: string): Promise<ApiResponse<JobStatusUpdate>> {
    return this.updateJobStatus(bookingId, 'in_progress', cleanerId, 'Job started');
  }

  async completeJob(bookingId: string, cleanerId: string): Promise<ApiResponse<JobStatusUpdate>> {
    return this.updateJobStatus(bookingId, 'completed', cleanerId, 'Job completed');
  }

  async cancelBooking(
    bookingId: string, 
    userId: string, 
    reason: string
  ): Promise<ApiResponse<JobStatusUpdate>> {
    return this.updateJobStatus(
      bookingId, 
      'cancelled', 
      userId, 
      `Cancelled: ${reason}`,
      { reason, cancelledBy: userId }
    );
  }

  // Get booking status history
  async getStatusHistory(bookingId: string): Promise<ApiResponse<JobStatusUpdate[]>> {
    try {
      const { data, error } = await supabase
        .from('job_status_updates')
        .select('*')
        .eq('booking_id', bookingId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get status history',
      };
    }
  }
}

export const jobStateManager = new JobStateManager(); 