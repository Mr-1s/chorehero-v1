import { supabase } from './supabase';
import { chatService } from './chatService';
import { messageService } from './messageService';
import { ApiResponse } from '../types/api';
import { Booking, BookingRequest, BookingResponse, ServiceType, AddOn, TimeSlot } from '../types/booking';
import { Address } from '../types/user';
import { SERVICE_TYPES, ADD_ONS, PLATFORM_CONFIG } from '../utils/constants';

class BookingService {
  // Get available time slots for a cleaner
  async getAvailableTimeSlots(
    cleanerId: string,
    date: string,
    serviceType: ServiceType
  ): Promise<ApiResponse<TimeSlot[]>> {
    try {
      const serviceDuration = SERVICE_TYPES[serviceType].estimated_duration;
      const dayOfWeek = new Date(date).getDay();

      // Get cleaner availability for the day
      const { data: availability, error: availabilityError } = await supabase
        .from('cleaner_availability')
        .select('start_time, end_time')
        .eq('cleaner_id', cleanerId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_available', true);

      if (availabilityError) throw availabilityError;

      if (!availability || availability.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // Get existing bookings for the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data: existingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('scheduled_time, estimated_duration')
        .eq('cleaner_id', cleanerId)
        .gte('scheduled_time', startOfDay.toISOString())
        .lte('scheduled_time', endOfDay.toISOString())
        .in('status', ['confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress']);

      if (bookingsError) throw bookingsError;

      // Generate available time slots
      const timeSlots: TimeSlot[] = [];
      const now = new Date();
      const selectedDate = new Date(date);

      for (const slot of availability) {
        const [startHour, startMinute] = slot.start_time.split(':').map(Number);
        const [endHour, endMinute] = slot.end_time.split(':').map(Number);

        let currentTime = new Date(selectedDate);
        currentTime.setHours(startHour, startMinute, 0, 0);

        const endTime = new Date(selectedDate);
        endTime.setHours(endHour, endMinute, 0, 0);

        // If it's today, don't show past time slots
        if (selectedDate.toDateString() === now.toDateString()) {
          const minTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
          if (currentTime < minTime) {
            currentTime = new Date(minTime);
            currentTime.setMinutes(Math.ceil(minTime.getMinutes() / 30) * 30, 0, 0); // Round to next 30-minute mark
          }
        }

        while (currentTime.getTime() + serviceDuration * 60 * 1000 <= endTime.getTime()) {
          const slotEndTime = new Date(currentTime.getTime() + serviceDuration * 60 * 1000);

          // Check if this slot conflicts with existing bookings
          const hasConflict = existingBookings?.some((booking: any) => {
            const bookingStart = new Date(booking.scheduled_time);
            const bookingEnd = new Date(bookingStart.getTime() + booking.estimated_duration * 60 * 1000);
            
            return (
              (currentTime >= bookingStart && currentTime < bookingEnd) ||
              (slotEndTime > bookingStart && slotEndTime <= bookingEnd) ||
              (currentTime <= bookingStart && slotEndTime >= bookingEnd)
            );
          });

          if (!hasConflict) {
            timeSlots.push({
              datetime: currentTime.toISOString(),
              is_available: true,
              price_modifier: this.getPriceModifier(currentTime),
            });
          }

          // Move to next 30-minute slot
          currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
        }
      }

      return {
        success: true,
        data: timeSlots,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get available time slots',
      };
    }
  }

  // Get price modifier based on time (peak hours, etc.)
  private getPriceModifier(datetime: Date): number {
    const hour = datetime.getHours();
    const dayOfWeek = datetime.getDay();

    // Weekend premium
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 1.15; // 15% premium for weekends
    }

    // Peak hours (after work)
    if (hour >= 17 && hour <= 20) {
      return 1.1; // 10% premium for peak hours
    }

    // Early morning premium
    if (hour < 8) {
      return 1.05; // 5% premium for early morning
    }

    return 1.0; // No modifier
  }

  // Calculate booking total
  async calculateBookingTotal(
    serviceType: ServiceType,
    selectedAddOns: string[],
    scheduledTime: string
  ): Promise<ApiResponse<{
    service_base_price: number;
    add_ons_total: number;
    platform_fee: number;
    tax: number;
    total_amount: number;
    cleaner_earnings: number;
    price_modifier: number;
  }>> {
    try {
      const serviceConfig = SERVICE_TYPES[serviceType];
      const datetime = new Date(scheduledTime);
      const priceModifier = this.getPriceModifier(datetime);

      const serviceBasePrice = serviceConfig.base_price * priceModifier;

      const addOnsTotal = selectedAddOns.reduce((total, addOnId) => {
        const addOn = ADD_ONS.find(a => a.id === addOnId);
        return total + (addOn?.price || 0);
      }, 0);

      const subtotal = serviceBasePrice + addOnsTotal;
      const platformFee = subtotal * PLATFORM_CONFIG.commission_rate;
      const tax = subtotal * 0.08; // 8% tax (simplified)
      const totalAmount = subtotal + platformFee + tax;
      const cleanerEarnings = subtotal * PLATFORM_CONFIG.cleaner_retention_rate;

      return {
        success: true,
        data: {
          service_base_price: serviceBasePrice,
          add_ons_total: addOnsTotal,
          platform_fee: platformFee,
          tax,
          total_amount: totalAmount,
          cleaner_earnings: cleanerEarnings,
          price_modifier: priceModifier,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to calculate booking total',
      };
    }
  }

  // Create a new booking
  async createBooking(request: BookingRequest): Promise<ApiResponse<BookingResponse>> {
    try {
      // Calculate pricing
      const pricingResponse = await this.calculateBookingTotal(
        request.service_type,
        request.add_ons,
        request.scheduled_time
      );

      if (!pricingResponse.success) {
        throw new Error(pricingResponse.error);
      }

      const pricing = pricingResponse.data;

      // Create booking record
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_id: request.customer_id,
          cleaner_id: request.cleaner_id,
          service_type: request.service_type,
          address_id: request.address_id,
          scheduled_time: request.scheduled_time,
          estimated_duration: SERVICE_TYPES[request.service_type].estimated_duration,
          special_instructions: request.special_instructions,
          service_base_price: pricing.service_base_price,
          add_ons_total: pricing.add_ons_total,
          platform_fee: pricing.platform_fee,
          tax: pricing.tax,
          tip: request.tip_amount || 0,
          total_amount: pricing.total_amount + (request.tip_amount || 0),
          cleaner_earnings: pricing.cleaner_earnings + (request.tip_amount || 0),
          status: 'pending',
          payment_status: 'pending',
        })
        .select(`
          *,
          customer:customer_id(name, phone),
          cleaner:cleaner_id(name, phone, avatar_url)
        `)
        .single();

      if (bookingError) throw bookingError;

      // Create booking add-ons
      if (request.add_ons.length > 0) {
        const bookingAddOns = request.add_ons.map(addOnId => ({
          booking_id: booking.id,
          add_on_id: addOnId,
          quantity: 1,
          price_per_unit: ADD_ONS.find(a => a.id === addOnId)?.price || 0,
        }));

        const { error: addOnsError } = await supabase
          .from('booking_add_ons')
          .insert(bookingAddOns);

        if (addOnsError) throw addOnsError;
      }

      // Create chat thread using chat service
      const chatResult = await chatService.createOrGetChatThread({
        customer_id: request.customer_id,
        cleaner_id: request.cleaner_id,
        booking_id: booking.id,
      });

      if (!chatResult.success) {
        throw new Error(chatResult.error || 'Failed to create chat thread');
      }

      // Send notification to cleaner
      await this.sendBookingNotification(booking.id, 'new_booking_request');

      return {
        success: true,
        data: {
          booking: booking as Booking,
          estimated_arrival: new Date(new Date(request.scheduled_time).getTime() - 15 * 60 * 1000).toISOString(),
          cleaner_info: {
            name: booking.cleaner.name,
            photo_url: booking.cleaner.avatar_url || '',
            rating: 4.8, // Would come from cleaner profile
            phone: booking.cleaner.phone,
          },
          chat_thread_id: chatResult.data!.id,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to create booking',
      };
    }
  }

  // Get customer's bookings
  async getCustomerBookings(
    customerId: string,
    status?: string[]
  ): Promise<ApiResponse<Booking[]>> {
    try {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          cleaner:cleaner_id(name, phone, avatar_url)
        `)
        .eq('customer_id', customerId)
        .order('scheduled_time', { ascending: false });

      if (status && status.length > 0) {
        query = query.in('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: data as Booking[],
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get bookings',
      };
    }
  }

  // Update booking status
  async updateBookingStatus(
    bookingId: string,
    status: string,
    userId: string
  ): Promise<ApiResponse<Booking>> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (error) throw error;

      // Send status update notification
      await this.sendBookingNotification(bookingId, 'status_update');

      return {
        success: true,
        data: data as Booking,
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to update booking status',
      };
    }
  }

  // Cancel booking
  async cancelBooking(
    bookingId: string,
    userId: string,
    reason?: string
  ): Promise<ApiResponse<Booking>> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          special_instructions: reason ? `Cancelled: ${reason}` : 'Cancelled by user',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (error) throw error;

      // Handle refund logic here if needed
      // Send cancellation notification
      await this.sendBookingNotification(bookingId, 'booking_cancelled');

      return {
        success: true,
        data: data as Booking,
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to cancel booking',
      };
    }
  }

  // Send booking notification
  private async sendBookingNotification(bookingId: string, type: string) {
    try {
      // Get booking details
      const { data: booking } = await supabase
        .from('bookings')
        .select('customer_id, cleaner_id, status')
        .eq('id', bookingId)
        .single();

      if (!booking) return;

      const notifications = [];

      // Create notification for customer
      notifications.push({
        user_id: booking.customer_id,
        type,
        title: this.getNotificationTitle(type, 'customer'),
        message: this.getNotificationMessage(type, 'customer'),
        data: { booking_id: bookingId },
      });

      // Create notification for cleaner
      if (booking.cleaner_id) {
        notifications.push({
          user_id: booking.cleaner_id,
          type,
          title: this.getNotificationTitle(type, 'cleaner'),
          message: this.getNotificationMessage(type, 'cleaner'),
          data: { booking_id: bookingId },
        });
      }

      await supabase.from('notifications').insert(notifications);
    } catch (error) {
      console.error('Failed to send booking notification:', error);
    }
  }

  // Get notification titles and messages
  private getNotificationTitle(type: string, userType: 'customer' | 'cleaner'): string {
    const titles = {
      new_booking_request: {
        customer: 'Booking Confirmed',
        cleaner: 'New Booking Request',
      },
      status_update: {
        customer: 'Booking Update',
        cleaner: 'Booking Update',
      },
      booking_cancelled: {
        customer: 'Booking Cancelled',
        cleaner: 'Booking Cancelled',
      },
    };

    return (titles as any)[type]?.[userType] || 'ChoreHero Update';
  }

  private getNotificationMessage(type: string, userType: 'customer' | 'cleaner'): string {
    const messages = {
      new_booking_request: {
        customer: 'Your booking has been confirmed. Your cleaner will be in touch soon!',
        cleaner: 'You have a new booking request. Please review and accept.',
      },
      status_update: {
        customer: 'Your booking status has been updated.',
        cleaner: 'Booking status has been updated.',
      },
      booking_cancelled: {
        customer: 'Your booking has been cancelled.',
        cleaner: 'A booking has been cancelled.',
      },
    };

    return (messages as any)[type]?.[userType] || 'Please check your ChoreHero app for updates.';
  }


  // Get booking by ID
  async getBookingById(bookingId: string): Promise<ApiResponse<Booking>> {
    try {
      const { data: booking, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:profiles!customer_id(*),
          cleaner:profiles!cleaner_id(*),
          address:addresses(*)
        `)
        .eq('id', bookingId)
        .single();

      if (error) throw error;

      return {
        success: true,
        data: booking as Booking,
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to get booking',
      };
    }
  }

  // Subscribe to booking updates
  subscribeToBookingUpdates(
    bookingId: string,
    callback: (booking: Booking) => void
  ): () => void {
    const subscription = supabase
      .channel(`booking_${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`,
        },
        (payload: any) => {
          callback(payload.new as Booking);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  // Get bookings for cleaner (available jobs and assigned jobs)
  async getCleanerJobs(
    cleanerId: string,
    status?: string[]
  ): Promise<ApiResponse<Booking[]>> {
    try {
      let query = supabase
        .from('bookings')
        .select(`
          *,
          customer:customer_id (
            id,
            name,
            avatar_url,
            email,
            phone
          )
        `)
        .order('scheduled_time', { ascending: true });

      // If cleanerId is provided, filter by cleaner or available jobs
      if (cleanerId) {
        query = query.or(`cleaner_id.eq.${cleanerId},cleaner_id.is.null`);
      }

      // Filter by status if provided
      if (status && status.length > 0) {
        query = query.in('status', status);
      } else {
        // Default: show available jobs, assigned jobs, and active jobs
        query = query.in('status', [
          'pending',      // Available to accept
          'confirmed',    // Assigned but not started
          'cleaner_assigned',
          'cleaner_en_route',
          'cleaner_arrived',
          'in_progress'
        ]);
      }

      const { data: bookings, error } = await query;

      if (error) throw error;

      return {
        success: true,
        data: bookings || [],
      };
    } catch (error) {
      console.error('Error fetching cleaner jobs:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to fetch jobs',
      };
    }
  }

  // Accept a job (assign cleaner to booking)
  async acceptJob(
    bookingId: string,
    cleanerId: string
  ): Promise<ApiResponse<Booking>> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          cleaner_id: cleanerId,
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .eq('status', 'pending') // Only accept if still pending
        .select(`
          *,
          customer:customer_id (
            id,
            name,
            avatar_url,
            email,
            phone
          )
        `)
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error('Job no longer available');
      }

      // Send notification to customer
      await this.sendBookingNotification(bookingId, 'cleaner_assigned');

      // Create chat room for customer and cleaner
      try {
        console.log('🏠 Creating chat room for booking:', bookingId);
        const chatRoomResult = await messageService.createOrGetChatRoom({
          customer_id: data.customer_id,
          cleaner_id: cleanerId,
          booking_id: bookingId
        });

        if (chatRoomResult.success) {
          console.log('✅ Chat room created successfully:', chatRoomResult.data?.id);
          
          // Send welcome message to chat room
          if (chatRoomResult.data) {
            await messageService.sendMessage({
              roomId: chatRoomResult.data.id,
              senderId: 'system',
              content: `Booking confirmed! Your cleaner will arrive at ${new Date(data.scheduled_time).toLocaleString()}. Feel free to chat here for any questions or updates.`,
              messageType: 'booking_update'
            });
          }
        } else {
          console.warn('⚠️ Failed to create chat room:', chatRoomResult.error);
        }
      } catch (chatError) {
        console.warn('⚠️ Chat room creation failed:', chatError);
        // Don't fail the entire booking if chat creation fails
      }

      return {
        success: true,
        data: data as Booking,
      };
    } catch (error) {
      console.error('Error accepting job:', error);
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to accept job',
      };
    }
  }
}

export const bookingService = new BookingService();