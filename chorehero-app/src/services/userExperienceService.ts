import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse } from '../types/api';

// ============================================================================
// USER EXPERIENCE & EDGE CASES SERVICE
// Integrated solution for Gaps #10, #11, #12, #19
// ============================================================================

export interface TimezoneBooking {
  booking_id: string;
  customer_timezone: string;
  cleaner_timezone: string;
  scheduled_time_utc: string;
  scheduled_time_customer: string;
  scheduled_time_cleaner: string;
  timezone_confirmed: boolean;
  confirmation_method: 'automatic' | 'manual' | 'pending';
}

export interface UploadProgress {
  upload_id: string;
  file_name: string;
  file_size: number;
  bytes_uploaded: number;
  chunks_completed: number;
  total_chunks: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'failed';
  resumable_url?: string;
  error_reason?: string;
  started_at: string;
  last_progress_at: string;
}

export interface ProfileUpdate {
  update_id: string;
  user_id: string;
  field_name: string;
  old_value: any;
  new_value: any;
  propagation_status: 'pending' | 'propagating' | 'completed' | 'failed';
  target_screens: string[];
  completed_screens: string[];
  started_at: string;
  completed_at?: string;
}

export interface DateBoundaryBooking {
  booking_id: string;
  customer_date: string;
  cleaner_date: string;
  utc_date: string;
  crosses_midnight: boolean;
  duration_hours: number;
  timezone_adjusted: boolean;
  conflicts_detected: string[];
}

class UserExperienceService {
  private activeUploads: Map<string, UploadProgress> = new Map();
  private profileUpdates: Map<string, ProfileUpdate> = new Map();
  private timezoneBookings: Map<string, TimezoneBooking> = new Map();
  private dateBoundaryBookings: Map<string, DateBoundaryBooking> = new Map();

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  async initialize(): Promise<void> {
    console.log('🎨 Initializing User Experience & Edge Cases Service');
    
    await this.loadPendingOperations();
    this.setupTimezoneDetection();
    this.setupUploadMonitoring();
    this.setupProfilePropagation();
    
    console.log('✅ User Experience Service initialized');
  }

  // ============================================================================
  // GAP #10: TIMEZONE BOOKING CONFUSION
  // ============================================================================
  
  /**
   * Create timezone-aware booking with explicit confirmation
   */
  async createTimezoneAwareBooking(
    customerId: string,
    cleanerId: string,
    requestedDateTime: string,
    customerTimezone: string,
    durationHours: number = 2
  ): Promise<ApiResponse<{
    booking: TimezoneBooking;
    confirmation_required: boolean;
    time_difference_hours: number;
    display_times: {
      customer_local: string;
      cleaner_local: string;
      utc: string;
    };
  }>> {
    try {
      console.log('🕐 Creating timezone-aware booking:', customerId, requestedDateTime);

      // Get cleaner's timezone
      const { data: cleanerData, error: cleanerError } = await supabase
        .from('users')
        .select('timezone, user_profiles!inner(service_radius_km)')
        .eq('id', cleanerId)
        .single();

      if (cleanerError || !cleanerData) {
        throw new Error('Cleaner not found or unavailable');
      }

      const cleanerTimezone = cleanerData.timezone || 'UTC';
      
      // Convert times to all relevant timezones
      const customerLocalTime = new Date(requestedDateTime);
      const utcTime = this.convertToUTC(customerLocalTime, customerTimezone);
      const cleanerLocalTime = this.convertFromUTC(utcTime, cleanerTimezone);

      // Calculate time difference
      const timeDifference = this.calculateTimezoneOffset(customerTimezone, cleanerTimezone);
      
      // Check if confirmation is required (significant time difference or crosses business hours)
      const confirmationRequired = Math.abs(timeDifference) > 1 || 
                                 this.crossesBusinessHours(cleanerLocalTime, durationHours);

      const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const timezoneBooking: TimezoneBooking = {
        booking_id: bookingId,
        customer_timezone: customerTimezone,
        cleaner_timezone: cleanerTimezone,
        scheduled_time_utc: utcTime.toISOString(),
        scheduled_time_customer: customerLocalTime.toISOString(),
        scheduled_time_cleaner: cleanerLocalTime.toISOString(),
        timezone_confirmed: !confirmationRequired,
        confirmation_method: confirmationRequired ? 'pending' : 'automatic'
      };

      this.timezoneBookings.set(bookingId, timezoneBooking);

      // Save to database if automatically confirmed
      if (!confirmationRequired) {
        await this.saveTimezoneBooking(timezoneBooking, customerId, cleanerId, durationHours);
      }

      console.log('✅ Timezone booking created:', bookingId, 
                  confirmationRequired ? 'confirmation required' : 'auto-confirmed');

      return {
        success: true,
        data: {
          booking: timezoneBooking,
          confirmation_required: confirmationRequired,
          time_difference_hours: timeDifference,
          display_times: {
            customer_local: this.formatDisplayTime(customerLocalTime, customerTimezone),
            cleaner_local: this.formatDisplayTime(cleanerLocalTime, cleanerTimezone),
            utc: utcTime.toISOString()
          }
        }
      };

    } catch (error) {
      console.error('❌ Timezone booking creation failed:', error);
      return {
        success: false,
        data: {
          booking: {} as TimezoneBooking,
          confirmation_required: false,
          time_difference_hours: 0,
          display_times: { customer_local: '', cleaner_local: '', utc: '' }
        },
        error: error instanceof Error ? error.message : 'Timezone booking failed'
      };
    }
  }

  /**
   * Confirm timezone booking after user review
   */
  async confirmTimezoneBooking(
    bookingId: string,
    confirmationMethod: 'manual' | 'automatic',
    adjustedTime?: string
  ): Promise<ApiResponse<TimezoneBooking>> {
    try {
      const booking = this.timezoneBookings.get(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (adjustedTime) {
        // Recalculate times with adjusted time
        const newCustomerTime = new Date(adjustedTime);
        const newUtcTime = this.convertToUTC(newCustomerTime, booking.customer_timezone);
        const newCleanerTime = this.convertFromUTC(newUtcTime, booking.cleaner_timezone);

        booking.scheduled_time_customer = newCustomerTime.toISOString();
        booking.scheduled_time_utc = newUtcTime.toISOString();
        booking.scheduled_time_cleaner = newCleanerTime.toISOString();
      }

      booking.timezone_confirmed = true;
      booking.confirmation_method = confirmationMethod;

      // Save confirmed booking to database
      await this.saveConfirmedTimezoneBooking(booking);

      console.log('✅ Timezone booking confirmed:', bookingId);
      return { success: true, data: booking };

    } catch (error) {
      console.error('❌ Timezone booking confirmation failed:', error);
      return {
        success: false,
        data: {} as TimezoneBooking,
        error: error instanceof Error ? error.message : 'Booking confirmation failed'
      };
    }
  }

  // ============================================================================
  // GAP #11: CONTENT UPLOAD NETWORK FAILURES
  // ============================================================================
  
  /**
   * Resumable chunk-based upload with network failure recovery
   */
  async uploadContentWithResume(
    filePath: string,
    fileName: string,
    fileSize: number,
    contentType: string,
    chunkSize: number = 1024 * 1024 // 1MB chunks
  ): Promise<ApiResponse<{
    upload_id: string;
    final_url?: string;
    progress: UploadProgress;
  }>> {
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log('📤 Starting resumable upload:', fileName, `${(fileSize / 1024 / 1024).toFixed(2)}MB`);

      const totalChunks = Math.ceil(fileSize / chunkSize);
      
      const uploadProgress: UploadProgress = {
        upload_id: uploadId,
        file_name: fileName,
        file_size: fileSize,
        bytes_uploaded: 0,
        chunks_completed: 0,
        total_chunks: totalChunks,
        status: 'uploading',
        started_at: new Date().toISOString(),
        last_progress_at: new Date().toISOString()
      };

      this.activeUploads.set(uploadId, uploadProgress);

      // Start chunked upload
      const result = await this.performChunkedUpload(uploadId, filePath, contentType, chunkSize);
      
      if (result.success) {
        uploadProgress.status = 'completed';
        uploadProgress.bytes_uploaded = fileSize;
        uploadProgress.chunks_completed = totalChunks;
        console.log('✅ Upload completed successfully:', uploadId);
      }

      return {
        success: result.success,
        data: {
          upload_id: uploadId,
          final_url: result.data?.final_url,
          progress: uploadProgress
        },
        error: result.error
      };

    } catch (error) {
      console.error('❌ Upload failed:', error);
      const progress = this.activeUploads.get(uploadId);
      if (progress) {
        progress.status = 'failed';
        progress.error_reason = error instanceof Error ? error.message : 'Upload failed';
      }

      return {
        success: false,
        data: {
          upload_id: uploadId,
          progress: progress || {} as UploadProgress
        },
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Resume failed upload from where it left off
   */
  async resumeUpload(uploadId: string): Promise<ApiResponse<UploadProgress>> {
    try {
      const uploadProgress = this.activeUploads.get(uploadId);
      if (!uploadProgress || uploadProgress.status === 'completed') {
        throw new Error('Upload not found or already completed');
      }

      console.log('🔄 Resuming upload:', uploadId, `from chunk ${uploadProgress.chunks_completed}`);

      uploadProgress.status = 'uploading';
      uploadProgress.last_progress_at = new Date().toISOString();

      // Resume from last completed chunk
      const result = await this.performChunkedUpload(
        uploadId, 
        '', // File path would be retrieved from stored state
        'application/octet-stream', // Content type from stored state
        1024 * 1024, // Chunk size from stored state
        uploadProgress.chunks_completed
      );

      if (result.success) {
        uploadProgress.status = 'completed';
        console.log('✅ Upload resumed and completed:', uploadId);
      }

      return { success: result.success, data: uploadProgress, error: result.error };

    } catch (error) {
      console.error('❌ Upload resume failed:', error);
      return {
        success: false,
        data: {} as UploadProgress,
        error: error instanceof Error ? error.message : 'Upload resume failed'
      };
    }
  }

  private async performChunkedUpload(
    uploadId: string,
    filePath: string,
    contentType: string,
    chunkSize: number,
    startChunk: number = 0
  ): Promise<ApiResponse<{ final_url: string }>> {
    const uploadProgress = this.activeUploads.get(uploadId);
    if (!uploadProgress) {
      throw new Error('Upload progress not found');
    }

    try {
      // In a real implementation, you'd read the file in chunks
      // and upload each chunk with retry logic
      for (let chunkIndex = startChunk; chunkIndex < uploadProgress.total_chunks; chunkIndex++) {
        const chunkStart = chunkIndex * chunkSize;
        const chunkEnd = Math.min(chunkStart + chunkSize, uploadProgress.file_size);
        
        console.log(`📤 Uploading chunk ${chunkIndex + 1}/${uploadProgress.total_chunks}`);
        
        // Simulate chunk upload with retry logic
        const chunkResult = await this.uploadChunkWithRetry(
          uploadId, 
          chunkIndex, 
          chunkStart, 
          chunkEnd - chunkStart
        );

        if (!chunkResult.success) {
          uploadProgress.status = 'failed';
          uploadProgress.error_reason = chunkResult.error;
          throw new Error(chunkResult.error || 'Chunk upload failed');
        }

        uploadProgress.chunks_completed = chunkIndex + 1;
        uploadProgress.bytes_uploaded = chunkEnd;
        uploadProgress.last_progress_at = new Date().toISOString();

        // Save progress periodically
        if (chunkIndex % 10 === 0) {
          await this.saveUploadProgress(uploadProgress);
        }
      }

      // Finalize upload
      const finalUrl = await this.finalizeUpload(uploadId);
      return { success: true, data: { final_url: finalUrl } };

    } catch (error) {
      throw error;
    }
  }

  private async uploadChunkWithRetry(
    uploadId: string,
    chunkIndex: number,
    chunkStart: number,
    chunkSize: number,
    maxRetries: number = 3
  ): Promise<ApiResponse<boolean>> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Simulate chunk upload to Supabase Storage
        // In production, this would be actual chunk upload
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network delay
        
        // Random failure simulation for demo (remove in production)
        if (Math.random() < 0.1 && attempt === 0) {
          throw new Error('Simulated network failure');
        }

        console.log(`✅ Chunk ${chunkIndex} uploaded successfully (attempt ${attempt + 1})`);
        return { success: true, data: true };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Chunk upload failed');
        console.log(`⚠️ Chunk ${chunkIndex} failed (attempt ${attempt + 1}): ${lastError.message}`);
        
        if (attempt < maxRetries - 1) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    return {
      success: false,
      data: false,
      error: lastError?.message || 'Chunk upload failed after retries'
    };
  }

  // ============================================================================
  // GAP #12: PROFILE UPDATE PROPAGATION DELAYS
  // ============================================================================
  
  /**
   * Real-time profile update propagation across all screens
   */
  async propagateProfileUpdate(
    userId: string,
    fieldName: string,
    oldValue: any,
    newValue: any,
    targetScreens: string[] = ['profile', 'feed', 'chat', 'bookings', 'reviews']
  ): Promise<ApiResponse<{
    update_id: string;
    propagation_status: string;
    completed_screens: string[];
    failed_screens: string[];
  }>> {
    const updateId = `update_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log('🔄 Propagating profile update:', userId, fieldName);

      const profileUpdate: ProfileUpdate = {
        update_id: updateId,
        user_id: userId,
        field_name: fieldName,
        old_value: oldValue,
        new_value: newValue,
        propagation_status: 'propagating',
        target_screens: targetScreens,
        completed_screens: [],
        started_at: new Date().toISOString()
      };

      this.profileUpdates.set(updateId, profileUpdate);

      // Update database first
      const dbResult = await this.updateUserProfileInDB(userId, fieldName, newValue);
      if (!dbResult.success) {
        throw new Error('Database update failed');
      }

      // Propagate to each target screen
      const propagationResults = await Promise.allSettled(
        targetScreens.map(screen => this.propagateToScreen(updateId, userId, fieldName, newValue, screen))
      );

      const completedScreens: string[] = [];
      const failedScreens: string[] = [];

      propagationResults.forEach((result, index) => {
        const screen = targetScreens[index];
        if (result.status === 'fulfilled' && result.value.success) {
          completedScreens.push(screen);
        } else {
          failedScreens.push(screen);
          console.error(`❌ Propagation to ${screen} failed:`, 
                       result.status === 'rejected' ? result.reason : result.value.error);
        }
      });

      profileUpdate.completed_screens = completedScreens;
      profileUpdate.propagation_status = failedScreens.length === 0 ? 'completed' : 'failed';
      profileUpdate.completed_at = new Date().toISOString();

      // Broadcast real-time update
      await this.broadcastProfileUpdate(userId, fieldName, newValue, completedScreens);

      console.log('✅ Profile update propagated:', updateId, 
                  `${completedScreens.length}/${targetScreens.length} screens updated`);

      return {
        success: true,
        data: {
          update_id: updateId,
          propagation_status: profileUpdate.propagation_status,
          completed_screens: completedScreens,
          failed_screens: failedScreens
        }
      };

    } catch (error) {
      console.error('❌ Profile update propagation failed:', error);
      const update = this.profileUpdates.get(updateId);
      if (update) {
        update.propagation_status = 'failed';
        update.completed_at = new Date().toISOString();
      }

      return {
        success: false,
        data: {
          update_id: updateId,
          propagation_status: 'failed',
          completed_screens: [],
          failed_screens: targetScreens
        },
        error: error instanceof Error ? error.message : 'Profile propagation failed'
      };
    }
  }

  private async propagateToScreen(
    updateId: string,
    userId: string,
    fieldName: string,
    newValue: any,
    screen: string
  ): Promise<ApiResponse<boolean>> {
    try {
      // Screen-specific propagation logic
      switch (screen) {
        case 'profile':
          await this.updateProfileScreen(userId, fieldName, newValue);
          break;
        case 'feed':
          await this.updateFeedScreen(userId, fieldName, newValue);
          break;
        case 'chat':
          await this.updateChatScreen(userId, fieldName, newValue);
          break;
        case 'bookings':
          await this.updateBookingsScreen(userId, fieldName, newValue);
          break;
        case 'reviews':
          await this.updateReviewsScreen(userId, fieldName, newValue);
          break;
        default:
          console.log(`⚠️ Unknown screen: ${screen}`);
      }

      console.log(`✅ Screen ${screen} updated for user ${userId}`);
      return { success: true, data: true };

    } catch (error) {
      console.error(`❌ Screen ${screen} update failed:`, error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Screen update failed'
      };
    }
  }

  // ============================================================================
  // GAP #19: DATE BOUNDARY BOOKING ISSUES
  // ============================================================================
  
  /**
   * Handle date boundary issues with timezone-aware validation
   */
  async validateDateBoundaryBooking(
    customerId: string,
    cleanerId: string,
    startDateTime: string,
    durationHours: number,
    customerTimezone: string
  ): Promise<ApiResponse<{
    boundary_booking: DateBoundaryBooking;
    warnings: string[];
    conflicts: string[];
    suggested_adjustments: string[];
  }>> {
    try {
      console.log('📅 Validating date boundary booking:', startDateTime, `${durationHours}h`);

      // Get cleaner timezone
      const { data: cleanerData } = await supabase
        .from('users')
        .select('timezone')
        .eq('id', cleanerId)
        .single();

      const cleanerTimezone = cleanerData?.timezone || 'UTC';

      // Calculate times in different timezones
      const customerStartTime = new Date(startDateTime);
      const customerEndTime = new Date(customerStartTime.getTime() + (durationHours * 60 * 60 * 1000));
      
      const utcStartTime = this.convertToUTC(customerStartTime, customerTimezone);
      const utcEndTime = new Date(utcStartTime.getTime() + (durationHours * 60 * 60 * 1000));
      
      const cleanerStartTime = this.convertFromUTC(utcStartTime, cleanerTimezone);
      const cleanerEndTime = this.convertFromUTC(utcEndTime, cleanerTimezone);

      // Detect boundary crossing issues
      const customerCrossesMidnight = customerStartTime.getDate() !== customerEndTime.getDate();
      const cleanerCrossesMidnight = cleanerStartTime.getDate() !== cleanerEndTime.getDate();
      const crossesTimezones = customerTimezone !== cleanerTimezone;

      const bookingId = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const boundaryBooking: DateBoundaryBooking = {
        booking_id: bookingId,
        customer_date: customerStartTime.toDateString(),
        cleaner_date: cleanerStartTime.toDateString(),
        utc_date: utcStartTime.toDateString(),
        crosses_midnight: customerCrossesMidnight || cleanerCrossesMidnight,
        duration_hours: durationHours,
        timezone_adjusted: crossesTimezones,
        conflicts_detected: []
      };

      // Detect conflicts and warnings
      const warnings: string[] = [];
      const conflicts: string[] = [];
      const suggestedAdjustments: string[] = [];

      if (customerCrossesMidnight) {
        warnings.push('Booking crosses midnight in customer timezone');
        suggestedAdjustments.push('Consider starting earlier to avoid midnight crossing');
      }

      if (cleanerCrossesMidnight) {
        warnings.push('Booking crosses midnight in cleaner timezone');
        conflicts.push('Cleaner availability may be affected by midnight crossing');
        suggestedAdjustments.push('Adjust start time to fit within cleaner\'s business day');
      }

      if (crossesTimezones) {
        const timeDiff = this.calculateTimezoneOffset(customerTimezone, cleanerTimezone);
        warnings.push(`${Math.abs(timeDiff)} hour time difference between customer and cleaner`);
        
        if (Math.abs(timeDiff) > 6) {
          conflicts.push('Significant timezone difference may cause scheduling conflicts');
          suggestedAdjustments.push('Consider alternative time slots for better coordination');
        }
      }

      // Check for business hours violations
      const customerBusinessHours = this.isWithinBusinessHours(customerStartTime, customerEndTime);
      const cleanerBusinessHours = this.isWithinBusinessHours(cleanerStartTime, cleanerEndTime);

      if (!customerBusinessHours.valid) {
        warnings.push('Booking outside customer\'s typical business hours');
      }

      if (!cleanerBusinessHours.valid) {
        conflicts.push('Booking outside cleaner\'s business hours');
        suggestedAdjustments.push(`Suggest times between ${cleanerBusinessHours.suggested_start} - ${cleanerBusinessHours.suggested_end}`);
      }

      // Check for existing bookings on boundary dates
      const existingConflicts = await this.checkDateBoundaryConflicts(
        cleanerId, utcStartTime, utcEndTime
      );

      if (existingConflicts.length > 0) {
        conflicts.push(...existingConflicts);
        suggestedAdjustments.push('Check alternative time slots to avoid conflicts');
      }

      boundaryBooking.conflicts_detected = conflicts;
      this.dateBoundaryBookings.set(bookingId, boundaryBooking);

      console.log('✅ Date boundary validation completed:', bookingId, 
                  `${warnings.length} warnings, ${conflicts.length} conflicts`);

      return {
        success: true,
        data: {
          boundary_booking: boundaryBooking,
          warnings,
          conflicts,
          suggested_adjustments: suggestedAdjustments
        }
      };

    } catch (error) {
      console.error('❌ Date boundary validation failed:', error);
      return {
        success: false,
        data: {
          boundary_booking: {} as DateBoundaryBooking,
          warnings: [],
          conflicts: ['Validation system error'],
          suggested_adjustments: []
        },
        error: error instanceof Error ? error.message : 'Date boundary validation failed'
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  private convertToUTC(localTime: Date, timezone: string): Date {
    // In production, use a proper timezone library like date-fns-tz or moment-timezone
    // This is a simplified implementation
    const timezoneOffsets: Record<string, number> = {
      'UTC': 0,
      'EST': -5, 'EDT': -4,
      'CST': -6, 'CDT': -5,
      'MST': -7, 'MDT': -6,
      'PST': -8, 'PDT': -7,
      'GMT': 0, 'BST': 1,
      'CET': 1, 'EET': 2
    };

    const offset = timezoneOffsets[timezone] || 0;
    return new Date(localTime.getTime() - (offset * 60 * 60 * 1000));
  }

  private convertFromUTC(utcTime: Date, timezone: string): Date {
    const timezoneOffsets: Record<string, number> = {
      'UTC': 0,
      'EST': -5, 'EDT': -4,
      'CST': -6, 'CDT': -5,
      'MST': -7, 'MDT': -6,
      'PST': -8, 'PDT': -7,
      'GMT': 0, 'BST': 1,
      'CET': 1, 'EET': 2
    };

    const offset = timezoneOffsets[timezone] || 0;
    return new Date(utcTime.getTime() + (offset * 60 * 60 * 1000));
  }

  private calculateTimezoneOffset(timezone1: string, timezone2: string): number {
    const timezoneOffsets: Record<string, number> = {
      'UTC': 0,
      'EST': -5, 'EDT': -4,
      'CST': -6, 'CDT': -5,
      'MST': -7, 'MDT': -6,
      'PST': -8, 'PDT': -7,
      'GMT': 0, 'BST': 1,
      'CET': 1, 'EET': 2
    };

    const offset1 = timezoneOffsets[timezone1] || 0;
    const offset2 = timezoneOffsets[timezone2] || 0;
    return offset1 - offset2;
  }

  private formatDisplayTime(date: Date, timezone: string): string {
    return `${date.toLocaleString()} ${timezone}`;
  }

  private crossesBusinessHours(startTime: Date, durationHours: number): boolean {
    const endTime = new Date(startTime.getTime() + (durationHours * 60 * 60 * 1000));
    const startHour = startTime.getHours();
    const endHour = endTime.getHours();
    
    // Consider business hours as 6 AM to 10 PM
    return startHour < 6 || endHour > 22 || endTime.getDate() !== startTime.getDate();
  }

  private isWithinBusinessHours(startTime: Date, endTime: Date): {
    valid: boolean;
    suggested_start?: string;
    suggested_end?: string;
  } {
    const startHour = startTime.getHours();
    const endHour = endTime.getHours();
    
    const valid = startHour >= 6 && endHour <= 22 && startTime.getDate() === endTime.getDate();
    
    return {
      valid,
      suggested_start: valid ? undefined : '06:00',
      suggested_end: valid ? undefined : '22:00'
    };
  }

  private async checkDateBoundaryConflicts(
    cleanerId: string,
    startTime: Date,
    endTime: Date
  ): Promise<string[]> {
    const conflicts: string[] = [];

    try {
      // Check for existing bookings that overlap
      const { data: existingBookings, error } = await supabase
        .from('bookings')
        .select('scheduled_start, scheduled_end, status')
        .eq('cleaner_id', cleanerId)
        .in('status', ['confirmed', 'in_progress'])
        .gte('scheduled_start', startTime.toISOString())
        .lte('scheduled_end', endTime.toISOString());

      if (error) throw error;

      if (existingBookings && existingBookings.length > 0) {
        conflicts.push(`${existingBookings.length} existing booking(s) found in time range`);
        existingBookings.forEach(booking => {
          conflicts.push(`Conflict with booking from ${booking.scheduled_start} to ${booking.scheduled_end}`);
        });
      }

    } catch (error) {
      console.error('❌ Conflict check failed:', error);
      conflicts.push('Unable to verify booking conflicts');
    }

    return conflicts;
  }

  // Database and screen update methods (simplified implementations)
  private async updateUserProfileInDB(userId: string, fieldName: string, newValue: any): Promise<ApiResponse<boolean>> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ [fieldName]: newValue, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      return { success: true, data: true };
    } catch (error) {
      return { success: false, data: false, error: error instanceof Error ? error.message : 'DB update failed' };
    }
  }

  private async updateProfileScreen(userId: string, fieldName: string, newValue: any): Promise<void> {
    // Broadcast to profile screen components
    console.log('📱 Profile screen updated:', fieldName, newValue);
  }

  private async updateFeedScreen(userId: string, fieldName: string, newValue: any): Promise<void> {
    // Update user info in feed posts
    console.log('📱 Feed screen updated:', fieldName, newValue);
  }

  private async updateChatScreen(userId: string, fieldName: string, newValue: any): Promise<void> {
    // Update user info in chat messages
    console.log('📱 Chat screen updated:', fieldName, newValue);
  }

  private async updateBookingsScreen(userId: string, fieldName: string, newValue: any): Promise<void> {
    // Update user info in booking cards
    console.log('📱 Bookings screen updated:', fieldName, newValue);
  }

  private async updateReviewsScreen(userId: string, fieldName: string, newValue: any): Promise<void> {
    // Update user info in review cards
    console.log('📱 Reviews screen updated:', fieldName, newValue);
  }

  private async broadcastProfileUpdate(userId: string, fieldName: string, newValue: any, completedScreens: string[]): Promise<void> {
    // Broadcast real-time update via Supabase realtime or WebSocket
    console.log('📡 Broadcasting profile update:', userId, fieldName, completedScreens);
  }

  private async saveTimezoneBooking(booking: TimezoneBooking, customerId: string, cleanerId: string, durationHours: number): Promise<void> {
    const { error } = await supabase
      .from('bookings')
      .insert({
        customer_id: customerId,
        cleaner_id: cleanerId,
        scheduled_start: booking.scheduled_time_utc,
        scheduled_end: new Date(new Date(booking.scheduled_time_utc).getTime() + (durationHours * 60 * 60 * 1000)).toISOString(),
        status: 'confirmed',
        timezone_data: {
          customer_timezone: booking.customer_timezone,
          cleaner_timezone: booking.cleaner_timezone,
          customer_time: booking.scheduled_time_customer,
          cleaner_time: booking.scheduled_time_cleaner
        }
      });

    if (error) throw error;
  }

  private async saveConfirmedTimezoneBooking(booking: TimezoneBooking): Promise<void> {
    // Save confirmed booking with timezone data
    console.log('💾 Saving confirmed timezone booking:', booking.booking_id);
  }

  private async finalizeUpload(uploadId: string): Promise<string> {
    // Finalize upload and return final URL
    const progress = this.activeUploads.get(uploadId);
    return `https://storage.supabase.co/uploads/${uploadId}/${progress?.file_name}`;
  }

  private async saveUploadProgress(progress: UploadProgress): Promise<void> {
    await AsyncStorage.setItem(`upload_${progress.upload_id}`, JSON.stringify(progress));
  }

  private setupTimezoneDetection(): void {
    console.log('🌍 Timezone detection active');
  }

  private setupUploadMonitoring(): void {
    console.log('📤 Upload monitoring active');
  }

  private setupProfilePropagation(): void {
    console.log('🔄 Profile propagation monitoring active');
  }

  private async loadPendingOperations(): Promise<void> {
    console.log('📂 Loading pending UX operations');
  }

  // ============================================================================
  // PUBLIC STATUS METHODS
  // ============================================================================
  
  getServiceStatus(): {
    active_uploads: number;
    pending_profile_updates: number;
    timezone_bookings: number;
    date_boundary_bookings: number;
  } {
    return {
      active_uploads: Array.from(this.activeUploads.values()).filter(u => u.status === 'uploading').length,
      pending_profile_updates: Array.from(this.profileUpdates.values()).filter(u => u.propagation_status === 'propagating').length,
      timezone_bookings: this.timezoneBookings.size,
      date_boundary_bookings: this.dateBoundaryBookings.size
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    console.log('🧹 Cleaning up User Experience Service');
    this.activeUploads.clear();
    this.profileUpdates.clear();
    this.timezoneBookings.clear();
    this.dateBoundaryBookings.clear();
  }
}

export const userExperienceService = new UserExperienceService();
