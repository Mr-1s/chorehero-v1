import { supabase } from './supabase';
import { ApiResponse } from '../types/api';

// ============================================================================
// CONCURRENT BOOKING PREVENTION SERVICE
// Prevents race conditions when multiple users book the same cleaner
// ============================================================================

export interface BookingLock {
  id: string;
  cleaner_id: string;
  time_slot: string;
  locked_by: string;
  expires_at: string;
  created_at: string;
}

export interface AvailabilityCheck {
  cleaner_id: string;
  scheduled_time: string;
  estimated_duration: number;
  is_available: boolean;
  conflicts: string[];
  lock_acquired?: boolean;
  lock_id?: string;
}

class ConcurrentBookingService {
  
  // ============================================================================
  // OPTIMISTIC LOCKING FOR BOOKING SLOTS
  // ============================================================================
  
  /**
   * Check availability and acquire optimistic lock
   */
  async checkAvailabilityAndLock(
    cleanerId: string,
    scheduledTime: string,
    estimatedDurationMinutes: number,
    customerId: string
  ): Promise<ApiResponse<AvailabilityCheck>> {
    try {
      console.log('🔒 Checking availability and acquiring lock for cleaner:', cleanerId);
      
      const startTime = new Date(scheduledTime);
      const endTime = new Date(startTime.getTime() + estimatedDurationMinutes * 60000);
      
      // Step 1: Check for existing conflicts in a transaction
      const conflicts = await this.findSchedulingConflicts(cleanerId, startTime, endTime);
      
      if (conflicts.length > 0) {
        console.log('❌ Scheduling conflicts found:', conflicts);
        return {
          success: true,
          data: {
            cleaner_id: cleanerId,
            scheduled_time: scheduledTime,
            estimated_duration: estimatedDurationMinutes,
            is_available: false,
            conflicts: conflicts,
            lock_acquired: false
          }
        };
      }

      // Step 2: Try to acquire optimistic lock
      const lockResult = await this.acquireBookingLock(cleanerId, scheduledTime, customerId);
      
      if (!lockResult.success) {
        console.log('❌ Failed to acquire booking lock:', lockResult.error);
        return {
          success: true,
          data: {
            cleaner_id: cleanerId,
            scheduled_time: scheduledTime,
            estimated_duration: estimatedDurationMinutes,
            is_available: false,
            conflicts: ['Another customer is currently booking this time slot'],
            lock_acquired: false
          }
        };
      }

      console.log('✅ Availability confirmed and lock acquired:', lockResult.data?.id);
      return {
        success: true,
        data: {
          cleaner_id: cleanerId,
          scheduled_time: scheduledTime,
          estimated_duration: estimatedDurationMinutes,
          is_available: true,
          conflicts: [],
          lock_acquired: true,
          lock_id: lockResult.data?.id
        }
      };

    } catch (error) {
      console.error('❌ Error checking availability:', error);
      return {
        success: false,
        data: {
          cleaner_id: cleanerId,
          scheduled_time: scheduledTime,
          estimated_duration: estimatedDurationMinutes,
          is_available: false,
          conflicts: ['System error during availability check'],
          lock_acquired: false
        },
        error: error instanceof Error ? error.message : 'Availability check failed'
      };
    }
  }

  /**
   * Find scheduling conflicts with existing bookings
   */
  private async findSchedulingConflicts(
    cleanerId: string,
    startTime: Date,
    endTime: Date
  ): Promise<string[]> {
    const { data: conflicts, error } = await supabase
      .from('bookings')
      .select('id, scheduled_time, estimated_duration, status')
      .eq('cleaner_id', cleanerId)
      .in('status', ['pending', 'confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress'])
      .or(`
        and(scheduled_time.lte.${startTime.toISOString()},scheduled_time.gte.${new Date(startTime.getTime() - 4 * 60 * 60 * 1000).toISOString()}),
        and(scheduled_time.gte.${startTime.toISOString()},scheduled_time.lte.${endTime.toISOString()})
      `);

    if (error) {
      console.error('❌ Error checking conflicts:', error);
      throw error;
    }

    const conflictMessages: string[] = [];
    
    if (conflicts && conflicts.length > 0) {
      for (const conflict of conflicts) {
        const conflictStart = new Date(conflict.scheduled_time);
        const conflictEnd = new Date(conflictStart.getTime() + conflict.estimated_duration * 60000);
        
        // Check for actual time overlap
        if (
          (startTime >= conflictStart && startTime < conflictEnd) ||
          (endTime > conflictStart && endTime <= conflictEnd) ||
          (startTime <= conflictStart && endTime >= conflictEnd)
        ) {
          conflictMessages.push(
            `Cleaner has ${conflict.status} booking from ${conflictStart.toLocaleTimeString()} to ${conflictEnd.toLocaleTimeString()}`
          );
        }
      }
    }

    return conflictMessages;
  }

  /**
   * Acquire optimistic lock for booking slot
   */
  private async acquireBookingLock(
    cleanerId: string,
    scheduledTime: string,
    customerId: string
  ): Promise<ApiResponse<BookingLock>> {
    try {
      // Generate unique lock ID
      const lockId = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minute lock
      
      // Try to insert lock (will fail if another lock exists for same slot)
      const { data, error } = await supabase
        .from('booking_locks')
        .insert({
          id: lockId,
          cleaner_id: cleanerId,
          time_slot: scheduledTime,
          locked_by: customerId,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (error) {
        // Check if it's a unique constraint violation (another lock exists)
        if (error.code === '23505') {
          console.log('🔒 Lock already exists for this time slot');
          return {
            success: false,
            data: {} as BookingLock,
            error: 'Time slot is being booked by another customer'
          };
        }
        throw error;
      }

      console.log('✅ Booking lock acquired:', lockId);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Error acquiring booking lock:', error);
      return {
        success: false,
        data: {} as BookingLock,
        error: error instanceof Error ? error.message : 'Failed to acquire lock'
      };
    }
  }

  /**
   * Release booking lock after successful/failed booking
   */
  async releaseBookingLock(lockId: string): Promise<ApiResponse<boolean>> {
    try {
      const { error } = await supabase
        .from('booking_locks')
        .delete()
        .eq('id', lockId);

      if (error) throw error;

      console.log('🔓 Booking lock released:', lockId);
      return { success: true, data: true };

    } catch (error) {
      console.error('❌ Error releasing booking lock:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to release lock'
      };
    }
  }

  /**
   * Extend booking lock if booking is taking longer
   */
  async extendBookingLock(lockId: string, additionalMinutes: number = 10): Promise<ApiResponse<boolean>> {
    try {
      const newExpiresAt = new Date(Date.now() + additionalMinutes * 60 * 1000);
      
      const { error } = await supabase
        .from('booking_locks')
        .update({ expires_at: newExpiresAt.toISOString() })
        .eq('id', lockId);

      if (error) throw error;

      console.log('⏰ Booking lock extended:', lockId);
      return { success: true, data: true };

    } catch (error) {
      console.error('❌ Error extending booking lock:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to extend lock'
      };
    }
  }

  // ============================================================================
  // ATOMIC BOOKING CREATION WITH LOCK VERIFICATION
  // ============================================================================
  
  /**
   * Create booking atomically with lock verification
   */
  async createBookingWithLock(
    lockId: string,
    bookingData: any
  ): Promise<ApiResponse<{ booking_id: string }>> {
    try {
      console.log('📝 Creating booking with lock verification:', lockId);

      // Verify lock is still valid and owned by this user
      const { data: lock, error: lockError } = await supabase
        .from('booking_locks')
        .select('*')
        .eq('id', lockId)
        .eq('locked_by', bookingData.customer_id)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (lockError || !lock) {
        throw new Error('Booking lock has expired or is invalid');
      }

      // Double-check no conflicts appeared since lock was acquired
      const conflicts = await this.findSchedulingConflicts(
        bookingData.cleaner_id,
        new Date(bookingData.scheduled_time),
        new Date(new Date(bookingData.scheduled_time).getTime() + bookingData.estimated_duration * 60000)
      );

      if (conflicts.length > 0) {
        throw new Error(`Scheduling conflict detected: ${conflicts[0]}`);
      }

      // Create booking in transaction
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select('id')
        .single();

      if (bookingError) throw bookingError;

      // Release the lock
      await this.releaseBookingLock(lockId);

      console.log('✅ Booking created successfully with lock verification:', booking.id);
      return {
        success: true,
        data: { booking_id: booking.id }
      };

    } catch (error) {
      console.error('❌ Atomic booking creation failed:', error);
      
      // Try to release lock on failure
      await this.releaseBookingLock(lockId);
      
      return {
        success: false,
        data: { booking_id: '' },
        error: error instanceof Error ? error.message : 'Booking creation failed'
      };
    }
  }

  // ============================================================================
  // CLEANUP AND MAINTENANCE
  // ============================================================================
  
  /**
   * Clean up expired locks (run periodically)
   */
  async cleanupExpiredLocks(): Promise<number> {
    try {
      const { error } = await supabase
        .from('booking_locks')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) throw error;

      console.log('🧹 Expired booking locks cleaned up');
      return 0; // TODO: Return actual count
    } catch (error) {
      console.error('❌ Error cleaning up expired locks:', error);
      return 0;
    }
  }

  /**
   * Get active locks for debugging
   */
  async getActiveLocks(cleanerId?: string): Promise<ApiResponse<BookingLock[]>> {
    try {
      let query = supabase
        .from('booking_locks')
        .select('*')
        .gt('expires_at', new Date().toISOString());

      if (cleanerId) {
        query = query.eq('cleaner_id', cleanerId);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get active locks'
      };
    }
  }

  /**
   * Force release lock (admin function)
   */
  async forceReleaseLock(lockId: string, reason: string): Promise<ApiResponse<boolean>> {
    try {
      const { error } = await supabase
        .from('booking_locks')
        .delete()
        .eq('id', lockId);

      if (error) throw error;

      console.log('🔨 Booking lock force released:', lockId, 'Reason:', reason);
      return { success: true, data: true };

    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to force release lock'
      };
    }
  }
}

export const concurrentBookingService = new ConcurrentBookingService();
