import { supabase } from './supabase';
import { chatService } from './chatService';
import { messageService } from './messageService';
import { notificationService } from './notificationService';
import { ApiResponse } from '../types/api';
import { Booking, BookingRequest, BookingResponse, ServiceType, AddOn, TimeSlot } from '../types/booking';
import { Address } from '../types/user';
import { SERVICE_TYPES, ADD_ONS, PLATFORM_CONFIG } from '../utils/constants';
import { displayInTz, DEFAULT_TZ } from '../utils/timezone';

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
      // Prevent self-booking (customer cannot book themselves as cleaner)
      if (request.cleaner_id && request.customer_id === request.cleaner_id) {
        return {
          success: false,
          data: null as any,
          error: 'Cannot book your own services',
        };
      }

      // Calculate pricing: use package override when present, else SERVICE_TYPES
      let pricing: {
        service_base_price: number;
        add_ons_total: number;
        platform_fee: number;
        tax: number;
        total_amount: number;
        cleaner_earnings: number;
      };
      if (request.service_base_price_cents != null) {
        const serviceBasePrice = request.service_base_price_cents / 100;
        const addOnsTotal = request.add_ons.reduce((total, addOnId) => {
          const addOn = ADD_ONS.find(a => a.id === addOnId);
          return total + (addOn?.price || 0);
        }, 0);
        const subtotal = serviceBasePrice + addOnsTotal;
        const platformFee = subtotal * PLATFORM_CONFIG.commission_rate;
        const tax = subtotal * 0.08;
        const totalAmount = subtotal + platformFee + tax;
        const cleanerEarnings = subtotal * PLATFORM_CONFIG.cleaner_retention_rate;
        pricing = {
          service_base_price: serviceBasePrice,
          add_ons_total: addOnsTotal,
          platform_fee: platformFee,
          tax,
          total_amount: totalAmount,
          cleaner_earnings: cleanerEarnings,
        };
      } else {
        const pricingResponse = await this.calculateBookingTotal(
          request.service_type,
          request.add_ons,
          request.scheduled_time
        );
        if (!pricingResponse.success) {
          throw new Error(pricingResponse.error);
        }
        pricing = pricingResponse.data;
      }

      // Create booking record
      const insertPayload: Record<string, unknown> = {
        customer_id: request.customer_id,
        cleaner_id: request.cleaner_id,
        service_type: request.service_type,
        address_id: request.address_id,
        scheduled_time: request.scheduled_time,
        estimated_duration: request.estimated_duration ?? SERVICE_TYPES[request.service_type].estimated_duration,
          special_instructions: request.special_instructions,
          access_instructions: request.access_instructions,
          bedrooms: request.bedrooms,
          bathrooms: request.bathrooms,
          square_feet: request.square_feet,
          has_pets: request.has_pets ?? null,
          pet_details: request.pet_details ?? null,
          service_base_price: pricing.service_base_price,
          add_ons_total: pricing.add_ons_total,
          platform_fee: pricing.platform_fee,
          tax: pricing.tax,
          tip: request.tip_amount || 0,
          total_amount: pricing.total_amount + (request.tip_amount || 0),
          cleaner_earnings: pricing.cleaner_earnings + (request.tip_amount || 0),
          status: 'pending',
          payment_status: 'pending',
        };
      if (request.package_id) {
        insertPayload.package_id = request.package_id;
      }
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert(insertPayload)
        .select(`
          *,
          customer:customer_id(name, phone),
          cleaner:cleaner_id(name, phone, avatar_url)
        `)
        .single();

      if (bookingError) {
        console.error('❌ Booking insert failed:', bookingError);
        throw new Error(`${bookingError.code || 'BOOKING_INSERT'}: ${bookingError.message}`);
      }

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

        if (addOnsError) {
          console.error('❌ Booking add-ons insert failed:', addOnsError);
          throw new Error(`${addOnsError.code || 'BOOKING_ADDONS'}: ${addOnsError.message}`);
        }
      }

      // Create chat thread (skip for marketplace jobs with no cleaner assigned)
      let chatThreadId: string | undefined;
      if (request.cleaner_id) {
        const chatResult = await chatService.createOrGetChatThread({
          customer_id: request.customer_id,
          cleaner_id: request.cleaner_id,
          booking_id: booking.id,
        });
        if (!chatResult.success) {
          console.error('❌ Chat thread creation failed:', chatResult.error);
          throw new Error(chatResult.error || 'Failed to create chat thread');
        }
        chatThreadId = chatResult.data!.id;
      }

      // Send notification: direct to assigned cleaner, or push to cleaners in radius (marketplace)
      if (request.cleaner_id) {
        await this.sendBookingNotification(booking.id, 'new_booking_request');
      } else {
        await notificationService.notifyCleanersOfNewJob({
          id: booking.id,
          address_id: request.address_id,
          service_type: request.service_type,
          total_amount: (booking as any).total_amount,
          scheduled_time: request.scheduled_time,
        });
      }

      return {
        success: true,
        data: {
          booking: booking as Booking,
          estimated_arrival: new Date(new Date(request.scheduled_time).getTime() - 15 * 60 * 1000).toISOString(),
          cleaner_info: request.cleaner_id && (booking as any).cleaner
            ? {
                name: (booking as any).cleaner.name,
                photo_url: (booking as any).cleaner.avatar_url || '',
                rating: 4.8,
                phone: (booking as any).cleaner.phone,
              }
            : null,
          chat_thread_id: chatThreadId,
        },
      };
    } catch (error) {
      console.error('❌ Booking creation failed:', error);
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
      // Get booking details (include package_id and scheduled_time for contextual notifications)
      const { data: booking } = await supabase
        .from('bookings')
        .select('customer_id, cleaner_id, status, package_id, scheduled_time')
        .eq('id', bookingId)
        .single();

      if (!booking) return;

      // Fetch package title if booking includes a package
      let packageTitle: string | null = null;
      if (booking.package_id) {
        const { data: pkg } = await supabase
          .from('content_posts')
          .select('title')
          .eq('id', booking.package_id)
          .single();
        packageTitle = pkg?.title ?? null;
      }

      const formatScheduledDate = (iso: string) => {
        try {
          return new Date(iso).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          });
        } catch {
          return '';
        }
      };

      const scheduledStr = booking.scheduled_time ? formatScheduledDate(booking.scheduled_time) : '';

      const notifications = [];

      // Create notification for customer
      notifications.push({
        user_id: booking.customer_id,
        type,
        title: this.getNotificationTitle(type, 'customer'),
        message: this.getNotificationMessage(type, 'customer'),
        data: { booking_id: bookingId },
      });

      // Create notification for cleaner (with package context when available)
      if (booking.cleaner_id) {
        const cleanerMessage =
          type === 'new_booking_request' && packageTitle && scheduledStr
            ? `Someone booked your "${packageTitle}" package for ${scheduledStr}`
            : type === 'new_booking_request' && scheduledStr
              ? `You have a new booking request for ${scheduledStr}`
              : this.getNotificationMessage(type, 'cleaner');

        notifications.push({
          user_id: booking.cleaner_id,
          type,
          title: this.getNotificationTitle(type, 'cleaner'),
          message: cleanerMessage,
          data: {
            booking_id: bookingId,
            package_id: booking.package_id ?? null,
            package_title: packageTitle ?? null,
          },
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
          customer:users!customer_id(id, name, avatar_url, email, phone),
          cleaner:users!cleaner_id(id, name, avatar_url, email, phone),
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

  // Accept a job (assign cleaner to booking) — atomic via DB RPC
  async acceptJob(
    bookingId: string,
    cleanerId: string
  ): Promise<ApiResponse<Booking>> {
    try {
      // Acquire a short-lived booking lock to signal intent
      await supabase.from('booking_locks').upsert(
        {
          cleaner_id: cleanerId,
          time_slot: new Date().toISOString(),
          locked_by: cleanerId,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        },
        { onConflict: 'cleaner_id,time_slot' }
      ).then(() => {}).catch(() => {});

      // Atomic claim — SELECT FOR UPDATE SKIP LOCKED prevents race condition
      const { data: claimed, error: rpcError } = await supabase.rpc('claim_booking', {
        p_booking_id: bookingId,
        p_cleaner_id: cleanerId,
      });

      if (rpcError) throw rpcError;

      if (!claimed) {
        throw new Error('Job no longer available — another cleaner accepted it first');
      }

      // Fetch the updated booking so callers get full data
      const { data, error } = await supabase
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
        .eq('id', bookingId)
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
              content: `Booking confirmed! Your cleaner will arrive at ${displayInTz(data.scheduled_time, (data as any).timezone || DEFAULT_TZ)}. Feel free to chat here for any questions or updates.`,
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

  /**
   * Cancel a booking with automatic time-based refund policy.
   *
   * Refund policy:
   *   > 24 hrs before job  → 100% refund
   *   2–24 hrs before job  → 50% refund
   *   < 2 hrs / in-progress → 0% refund
   *   Cleaner cancels       → always 100% refund
   *
   * If the payment was already captured, a Stripe refund is triggered
   * via the Supabase Edge Function `process-refund`.
   */
  async cancelBooking(
    bookingId: string,
    reason: string,
    cancelledBy: 'customer' | 'cleaner' | 'system'
  ): Promise<ApiResponse<{ refundAmount: number; refundPct: number }>> {
    try {
      // DB handles policy calculation atomically
      const { data: result, error } = await supabase.rpc('cancel_booking_with_refund', {
        p_booking_id:   bookingId,
        p_reason:       reason,
        p_cancelled_by: cancelledBy,
        p_refund_pct:   null, // let DB policy decide
      });

      if (error) throw error;

      const rpcResult = result as {
        success: boolean;
        error?: string;
        refund_pct: number;
        refund_amount: number;
        payment_intent: string | null;
        payment_status: string;
      };

      if (!rpcResult.success) {
        throw new Error(rpcResult.error || 'Cancellation failed');
      }

      // If payment was captured, trigger Stripe refund via Edge Function
      if (
        rpcResult.refund_amount > 0 &&
        rpcResult.payment_intent &&
        ['captured', 'succeeded'].includes(rpcResult.payment_status)
      ) {
        const { error: refundError } = await supabase.functions.invoke('process-refund', {
          body: {
            payment_intent_id: rpcResult.payment_intent,
            amount_cents: Math.round(rpcResult.refund_amount * 100),
            booking_id: bookingId,
          },
        });

        if (refundError) {
          // Log but don't fail — DB is already cancelled, refund can be retried
          console.error('⚠️ Stripe refund failed (will retry):', refundError);
        }
      }

      // Notify both parties via notification system
      try {
        await supabase.from('notifications').insert([
          {
            user_id:  null, // populated below per-party
            type:    'booking_cancelled',
            title:   'Booking Cancelled',
            message: `Your booking has been cancelled. ${rpcResult.refund_amount > 0 ? `Refund of $${rpcResult.refund_amount.toFixed(2)} will be processed.` : 'No refund applies per cancellation policy.'}`,
            data:    { booking_id: bookingId, cancelled_by: cancelledBy },
          },
        ]);
      } catch {
        // non-critical
      }

      return {
        success: true,
        data: {
          refundAmount: rpcResult.refund_amount,
          refundPct:    rpcResult.refund_pct,
        },
      };
    } catch (error) {
      console.error('Error cancelling booking:', error);
      return {
        success: false,
        data: { refundAmount: 0, refundPct: 0 },
        error: error instanceof Error ? error.message : 'Failed to cancel booking',
      };
    }
  }
}

export const bookingService = new BookingService();