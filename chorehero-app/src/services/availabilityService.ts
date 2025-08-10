/**
 * Comprehensive Cleaner Availability Service
 * Handles availability management, scheduling, and conflict detection
 */

import { supabase } from './supabase';

// Types
export interface CleanerAvailability {
  id: string;
  cleaner_id: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday, etc.
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
  booking_id?: string;
}

export interface AvailabilitySchedule {
  [dayOfWeek: number]: CleanerAvailability[];
}

export interface CreateAvailabilityRequest {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available?: boolean;
}

export interface UpdateAvailabilityRequest {
  start_time?: string;
  end_time?: string;
  is_available?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

class AvailabilityService {
  
  // ============================================================================
  // CORE AVAILABILITY MANAGEMENT
  // ============================================================================
  
  /**
   * Set cleaner's weekly availability schedule
   */
  async setCleanerAvailability(
    cleanerId: string, 
    availabilitySlots: CreateAvailabilityRequest[]
  ): Promise<ApiResponse<CleanerAvailability[]>> {
    try {
      console.log('📅 Setting availability for cleaner:', cleanerId);

      // Validate time slots
      for (const slot of availabilitySlots) {
        if (!this.isValidTimeSlot(slot.start_time, slot.end_time)) {
          throw new Error(`Invalid time slot: ${slot.start_time} - ${slot.end_time}`);
        }
        if (slot.day_of_week < 0 || slot.day_of_week > 6) {
          throw new Error(`Invalid day of week: ${slot.day_of_week}`);
        }
      }

      // Clear existing availability for the cleaner
      const { error: deleteError } = await supabase
        .from('cleaner_availability')
        .delete()
        .eq('cleaner_id', cleanerId);

      if (deleteError) throw deleteError;

      // Insert new availability slots
      const availabilityData = availabilitySlots.map(slot => ({
        cleaner_id: cleanerId,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        is_available: slot.is_available ?? true
      }));

      const { data: newAvailability, error: insertError } = await supabase
        .from('cleaner_availability')
        .insert(availabilityData)
        .select('*');

      if (insertError) throw insertError;

      console.log(`✅ Set ${newAvailability?.length || 0} availability slots`);
      return { success: true, data: newAvailability as CleanerAvailability[] || [] };

    } catch (error) {
      console.error('❌ Error setting cleaner availability:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to set availability'
      };
    }
  }

  /**
   * Get cleaner's availability schedule
   */
  async getCleanerAvailability(cleanerId: string): Promise<ApiResponse<AvailabilitySchedule>> {
    try {
      console.log('📋 Getting availability for cleaner:', cleanerId);

      const { data: availability, error } = await supabase
        .from('cleaner_availability')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;

      // Group by day of week
      const schedule: AvailabilitySchedule = {};
      (availability || []).forEach(slot => {
        if (!schedule[slot.day_of_week]) {
          schedule[slot.day_of_week] = [];
        }
        schedule[slot.day_of_week].push(slot);
      });

      console.log(`✅ Got availability schedule with ${availability?.length || 0} slots`);
      return { success: true, data: schedule };

    } catch (error) {
      console.error('❌ Error getting cleaner availability:', error);
      return {
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Failed to get availability'
      };
    }
  }

  /**
   * Update specific availability slot
   */
  async updateAvailabilitySlot(
    slotId: string, 
    cleanerId: string, 
    updates: UpdateAvailabilityRequest
  ): Promise<ApiResponse<CleanerAvailability>> {
    try {
      console.log('✏️ Updating availability slot:', slotId);

      // Validate time if provided
      if (updates.start_time && updates.end_time) {
        if (!this.isValidTimeSlot(updates.start_time, updates.end_time)) {
          throw new Error(`Invalid time slot: ${updates.start_time} - ${updates.end_time}`);
        }
      }

      // Update the slot
      const { data: updatedSlot, error } = await supabase
        .from('cleaner_availability')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', slotId)
        .eq('cleaner_id', cleanerId) // Ensure cleaner owns this slot
        .select('*')
        .single();

      if (error) throw error;

      console.log('✅ Availability slot updated successfully');
      return { success: true, data: updatedSlot as CleanerAvailability };

    } catch (error) {
      console.error('❌ Error updating availability slot:', error);
      return {
        success: false,
        data: {} as CleanerAvailability,
        error: error instanceof Error ? error.message : 'Failed to update availability slot'
      };
    }
  }

  /**
   * Delete availability slot
   */
  async deleteAvailabilitySlot(slotId: string, cleanerId: string): Promise<ApiResponse<boolean>> {
    try {
      console.log('🗑️ Deleting availability slot:', slotId);

      const { error } = await supabase
        .from('cleaner_availability')
        .delete()
        .eq('id', slotId)
        .eq('cleaner_id', cleanerId);

      if (error) throw error;

      console.log('✅ Availability slot deleted successfully');
      return { success: true, data: true };

    } catch (error) {
      console.error('❌ Error deleting availability slot:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to delete availability slot'
      };
    }
  }

  // ============================================================================
  // BOOKING AVAILABILITY CHECKS
  // ============================================================================

  /**
   * Get available time slots for a specific date
   */
  async getAvailableTimeSlots(
    cleanerId: string, 
    date: string, // YYYY-MM-DD format
    serviceDuration: number = 120 // minutes
  ): Promise<ApiResponse<TimeSlot[]>> {
    try {
      console.log('🕐 Getting available time slots for:', { cleanerId, date, serviceDuration });

      const requestDate = new Date(date);
      const dayOfWeek = requestDate.getDay();

      // Get cleaner's availability for this day
      const { data: availabilitySlots, error: availabilityError } = await supabase
        .from('cleaner_availability')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_available', true)
        .order('start_time');

      if (availabilityError) throw availabilityError;

      if (!availabilitySlots || availabilitySlots.length === 0) {
        return { success: true, data: [] };
      }

      // Get existing bookings for this date
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;

      const { data: existingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, scheduled_time, estimated_duration')
        .eq('cleaner_id', cleanerId)
        .gte('scheduled_time', startOfDay)
        .lte('scheduled_time', endOfDay)
        .in('status', ['confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress']);

      if (bookingsError) throw bookingsError;

      // Generate available time slots
      const timeSlots: TimeSlot[] = [];

      for (const availabilitySlot of availabilitySlots) {
        const slots = this.generateTimeSlotsFromAvailability(
          availabilitySlot,
          date,
          serviceDuration,
          existingBookings || []
        );
        timeSlots.push(...slots);
      }

      // Sort by start time
      timeSlots.sort((a, b) => a.start_time.localeCompare(b.start_time));

      console.log(`✅ Generated ${timeSlots.length} available time slots`);
      return { success: true, data: timeSlots };

    } catch (error) {
      console.error('❌ Error getting available time slots:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get available time slots'
      };
    }
  }

  /**
   * Check if a specific time slot is available
   */
  async isTimeSlotAvailable(
    cleanerId: string,
    startTime: string, // ISO string
    duration: number // minutes
  ): Promise<ApiResponse<{ available: boolean; reason?: string }>> {
    try {
      console.log('🔍 Checking time slot availability:', { cleanerId, startTime, duration });

      const requestDate = new Date(startTime);
      const endTime = new Date(requestDate.getTime() + duration * 60000);
      const dayOfWeek = requestDate.getDay();
      
      const requestStartTime = requestDate.toTimeString().slice(0, 5); // HH:MM
      const requestEndTime = endTime.toTimeString().slice(0, 5); // HH:MM

      // Check cleaner's general availability for this day/time
      const { data: availability, error: availabilityError } = await supabase
        .from('cleaner_availability')
        .select('*')
        .eq('cleaner_id', cleanerId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_available', true)
        .lte('start_time', requestStartTime)
        .gte('end_time', requestEndTime);

      if (availabilityError) throw availabilityError;

      if (!availability || availability.length === 0) {
        return { 
          success: true, 
          data: { 
            available: false, 
            reason: 'Cleaner is not available during this time' 
          } 
        };
      }

      // Check for conflicting bookings
      const { data: conflictingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, scheduled_time, estimated_duration')
        .eq('cleaner_id', cleanerId)
        .in('status', ['confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress']);

      if (bookingsError) throw bookingsError;

      // Check for time conflicts
      const hasConflict = (conflictingBookings || []).some(booking => {
        const bookingStart = new Date(booking.scheduled_time);
        const bookingEnd = new Date(bookingStart.getTime() + booking.estimated_duration * 60000);
        
        return (
          (requestDate >= bookingStart && requestDate < bookingEnd) ||
          (endTime > bookingStart && endTime <= bookingEnd) ||
          (requestDate <= bookingStart && endTime >= bookingEnd)
        );
      });

      if (hasConflict) {
        return { 
          success: true, 
          data: { 
            available: false, 
            reason: 'Time slot conflicts with existing booking' 
          } 
        };
      }

      console.log('✅ Time slot is available');
      return { success: true, data: { available: true } };

    } catch (error) {
      console.error('❌ Error checking time slot availability:', error);
      return {
        success: false,
        data: { available: false },
        error: error instanceof Error ? error.message : 'Failed to check availability'
      };
    }
  }

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  /**
   * Set temporary unavailability (e.g., vacation, sick days)
   */
  async setTemporaryUnavailability(
    cleanerId: string,
    startDate: string,
    endDate: string,
    reason?: string
  ): Promise<ApiResponse<boolean>> {
    try {
      console.log('🚫 Setting temporary unavailability:', { cleanerId, startDate, endDate });

      // In a full implementation, you might create a separate table for temporary unavailability
      // For now, we'll mark the cleaner as temporarily unavailable in their profile
      
      const { error } = await supabase
        .from('cleaner_profiles')
        .update({
          is_temporarily_unavailable: true,
          unavailable_until: endDate,
          unavailability_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', cleanerId);

      if (error) throw error;

      console.log('✅ Temporary unavailability set');
      return { success: true, data: true };

    } catch (error) {
      console.error('❌ Error setting temporary unavailability:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to set unavailability'
      };
    }
  }

  /**
   * Clear temporary unavailability
   */
  async clearTemporaryUnavailability(cleanerId: string): Promise<ApiResponse<boolean>> {
    try {
      console.log('✅ Clearing temporary unavailability for:', cleanerId);

      const { error } = await supabase
        .from('cleaner_profiles')
        .update({
          is_temporarily_unavailable: false,
          unavailable_until: null,
          unavailability_reason: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', cleanerId);

      if (error) throw error;

      console.log('✅ Temporary unavailability cleared');
      return { success: true, data: true };

    } catch (error) {
      console.error('❌ Error clearing temporary unavailability:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to clear unavailability'
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Validate time slot format and logic
   */
  private isValidTimeSlot(startTime: string, endTime: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return false;
    }

    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    
    return end > start;
  }

  /**
   * Convert time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes since midnight to time string
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Generate time slots from availability window
   */
  private generateTimeSlotsFromAvailability(
    availability: CleanerAvailability,
    date: string,
    serviceDuration: number,
    existingBookings: any[]
  ): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const slotInterval = 30; // 30-minute intervals

    const startMinutes = this.timeToMinutes(availability.start_time);
    const endMinutes = this.timeToMinutes(availability.end_time);

    for (let currentMinutes = startMinutes; currentMinutes + serviceDuration <= endMinutes; currentMinutes += slotInterval) {
      const slotStartTime = this.minutesToTime(currentMinutes);
      const slotEndTime = this.minutesToTime(currentMinutes + serviceDuration);
      
      // Create full datetime strings
      const slotStartDateTime = `${date}T${slotStartTime}:00.000Z`;
      const slotEndDateTime = `${date}T${slotEndTime}:00.000Z`;

      // Check if this slot conflicts with existing bookings
      const hasConflict = existingBookings.some(booking => {
        const bookingStart = new Date(booking.scheduled_time);
        const bookingEnd = new Date(bookingStart.getTime() + booking.estimated_duration * 60000);
        const slotStart = new Date(slotStartDateTime);
        const slotEnd = new Date(slotEndDateTime);

        return (
          (slotStart >= bookingStart && slotStart < bookingEnd) ||
          (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
          (slotStart <= bookingStart && slotEnd >= bookingEnd)
        );
      });

      slots.push({
        start_time: slotStartDateTime,
        end_time: slotEndDateTime,
        is_available: !hasConflict,
        booking_id: hasConflict ? existingBookings.find(b => {
          const bookingStart = new Date(b.scheduled_time);
          const bookingEnd = new Date(bookingStart.getTime() + b.estimated_duration * 60000);
          const slotStart = new Date(slotStartDateTime);
          return slotStart >= bookingStart && slotStart < bookingEnd;
        })?.id : undefined
      });
    }

    return slots;
  }

  /**
   * Get cleaners available for a specific time slot
   */
  async getAvailableCleaners(
    startTime: string, // ISO string
    duration: number, // minutes
    serviceType?: string,
    location?: { latitude: number; longitude: number }
  ): Promise<ApiResponse<Array<{
    cleaner_id: string;
    name: string;
    avatar_url?: string;
    average_rating: number;
    distance?: number;
  }>>> {
    try {
      console.log('👥 Finding available cleaners for:', { startTime, duration, serviceType });

      const requestDate = new Date(startTime);
      const dayOfWeek = requestDate.getDay();
      const requestTime = requestDate.toTimeString().slice(0, 5);
      const endTime = new Date(requestDate.getTime() + duration * 60000).toTimeString().slice(0, 5);

      // Get cleaners with availability for this time
      const { data: availableCleaners, error } = await supabase
        .from('cleaner_availability')
        .select(`
          cleaner_id,
          users!inner(
            id,
            name,
            avatar_url,
            cleaner_profiles!inner(
              average_rating,
              specialties,
              is_verified,
              is_temporarily_unavailable
            )
          )
        `)
        .eq('day_of_week', dayOfWeek)
        .eq('is_available', true)
        .lte('start_time', requestTime)
        .gte('end_time', endTime)
        .eq('users.is_active', true)
        .eq('users.cleaner_profiles.is_verified', true)
        .eq('users.cleaner_profiles.is_temporarily_unavailable', false);

      if (error) throw error;

      // Filter by service type if specified
      let filteredCleaners = availableCleaners || [];
      if (serviceType) {
        filteredCleaners = filteredCleaners.filter(cleaner => 
          cleaner.users.cleaner_profiles.specialties?.includes(serviceType)
        );
      }

      // Check for booking conflicts
      const cleanerIds = filteredCleaners.map(c => c.cleaner_id);
      if (cleanerIds.length === 0) {
        return { success: true, data: [] };
      }

      const { data: conflictingBookings } = await supabase
        .from('bookings')
        .select('cleaner_id, scheduled_time, estimated_duration')
        .in('cleaner_id', cleanerIds)
        .in('status', ['confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress']);

      // Remove cleaners with conflicts
      const requestStart = new Date(startTime);
      const requestEnd = new Date(requestStart.getTime() + duration * 60000);

      const availableWithoutConflicts = filteredCleaners.filter(cleaner => {
        const hasConflict = (conflictingBookings || []).some(booking => {
          if (booking.cleaner_id !== cleaner.cleaner_id) return false;
          
          const bookingStart = new Date(booking.scheduled_time);
          const bookingEnd = new Date(bookingStart.getTime() + booking.estimated_duration * 60000);
          
          return (
            (requestStart >= bookingStart && requestStart < bookingEnd) ||
            (requestEnd > bookingStart && requestEnd <= bookingEnd) ||
            (requestStart <= bookingStart && requestEnd >= bookingEnd)
          );
        });
        
        return !hasConflict;
      });

      // Format response
      const result = availableWithoutConflicts.map(cleaner => ({
        cleaner_id: cleaner.cleaner_id,
        name: cleaner.users.name,
        avatar_url: cleaner.users.avatar_url,
        average_rating: cleaner.users.cleaner_profiles.average_rating || 0,
        // TODO: Calculate distance if location provided
        distance: location ? undefined : undefined
      }));

      console.log(`✅ Found ${result.length} available cleaners`);
      return { success: true, data: result };

    } catch (error) {
      console.error('❌ Error finding available cleaners:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to find available cleaners'
      };
    }
  }
}

export const availabilityService = new AvailabilityService();
export default availabilityService;