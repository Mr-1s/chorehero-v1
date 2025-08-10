import { supabase } from './supabase';
import { bookingService } from './booking';
import { messageService } from './messageService';
import { ApiResponse } from '../types/api';

/**
 * Demo Booking Service
 * 
 * Bridges the demo UI with real database operations.
 * Allows demo customers to create real bookings that demo cleaners can see and accept.
 * This creates a functional end-to-end flow using demo data.
 */
class DemoBookingService {
  /**
   * Create a real booking from demo customer to demo cleaner
   */
  async createDemoBooking(params: {
    demoCustomerId: string;
    demoCleanerId: string;
    serviceType: string;
    scheduledTime: string;
    specialInstructions?: string;
  }): Promise<ApiResponse<any>> {
    try {
      console.log('🎭 Creating demo booking from demo customer to demo cleaner');
      
      const { demoCustomerId, demoCleanerId, serviceType, scheduledTime, specialInstructions } = params;
      
      // Get demo customer address
      const { data: customerAddress } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', demoCustomerId)
        .limit(1)
        .single();

      if (!customerAddress) {
        throw new Error('Demo customer address not found');
      }

      // Create the booking using real booking service
      const bookingRequest = {
        customer_id: demoCustomerId,
        cleaner_id: demoCleanerId,
        service_type: serviceType as any,
        address_id: customerAddress.id,
        scheduled_time: scheduledTime,
        add_ons: [],
        special_instructions: specialInstructions,
        payment_method_id: 'demo_payment_method', // Demo payment method
        tip_amount: 0,
      };

      // Calculate pricing (simplified for demo)
      const pricing = await this.calculateDemoBookingPricing(serviceType);
      
      // Create booking record directly in database
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_id: demoCustomerId,
          cleaner_id: null, // Available for any cleaner to accept
          service_type: serviceType,
          address_id: customerAddress.id,
          scheduled_time: scheduledTime,
          estimated_duration: pricing.estimated_duration,
          special_instructions: specialInstructions,
          service_base_price: pricing.service_base_price,
          add_ons_total: 0,
          platform_fee: pricing.platform_fee,
          tax: pricing.tax,
          tip: 0,
          total_amount: pricing.total_amount,
          cleaner_earnings: pricing.cleaner_earnings,
          status: 'pending',
          payment_status: 'paid', // Demo payments are auto-paid
        })
        .select(`
          *,
          customer:customer_id(name, phone, avatar_url),
          address:address_id(*)
        `)
        .single();

      if (bookingError) throw bookingError;

      console.log('✅ Demo booking created successfully:', booking.id);

      // Send notification to all demo cleaners
      await this.notifyDemoCleaners(booking.id);

      return {
        success: true,
        data: booking,
      };
    } catch (error) {
      console.error('❌ Demo booking creation failed:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to create demo booking',
      };
    }
  }

  /**
   * Calculate pricing for demo bookings
   */
  private async calculateDemoBookingPricing(serviceType: string) {
    const basePrices = {
      'kitchen': 89.00,
      'bathroom': 65.00,
      'living_room': 55.00,
      'bedroom': 45.00,
      'deep': 150.00,
      'standard': 75.00,
      'express': 45.00,
    };

    const basePrice = basePrices[serviceType as keyof typeof basePrices] || 75.00;
    const platformFee = basePrice * 0.1; // 10% platform fee
    const tax = basePrice * 0.08; // 8% tax
    const totalAmount = basePrice + platformFee + tax;
    const cleanerEarnings = basePrice * 0.8; // 80% to cleaner

    return {
      service_base_price: basePrice,
      platform_fee: platformFee,
      tax: tax,
      total_amount: totalAmount,
      cleaner_earnings: cleanerEarnings,
      estimated_duration: 120, // 2 hours default
    };
  }

  /**
   * Notify all demo cleaners about new booking opportunity
   */
  private async notifyDemoCleaners(bookingId: string) {
    try {
      // Get all demo cleaners (using seed data cleaners)
      const { data: cleaners } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'cleaner')
        .in('email', [
          'sarah.johnson@email.com',
          'marcus.rodriguez@email.com',
          'emily.chen@email.com',
          'michael.williams@email.com',
          'lisa.thompson@email.com'
        ]);

      if (cleaners) {
        const notifications = cleaners.map(cleaner => ({
          user_id: cleaner.id,
          type: 'new_booking_request',
          title: 'New Booking Request',
          message: 'A new cleaning service has been requested in your area. Check it out!',
          data: { booking_id: bookingId },
          created_at: new Date().toISOString(),
        }));

        await supabase.from('notifications').insert(notifications);
        console.log(`✅ Notified ${cleaners.length} demo cleaners about new booking`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to notify demo cleaners:', error);
    }
  }

  /**
   * Get available demo cleaners for booking
   */
  async getAvailableDemoCleaners(): Promise<ApiResponse<any[]>> {
    try {
      const { data: cleaners, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          avatar_url,
          cleaner_profiles (
            hourly_rate,
            specialties,
            years_experience,
            rating_average
          )
        `)
        .eq('role', 'cleaner')
        .eq('is_active', true)
        .in('email', [
          'sarah.johnson@email.com',
          'marcus.rodriguez@email.com', 
          'emily.chen@email.com',
          'michael.williams@email.com',
          'lisa.thompson@email.com'
        ]);

      if (error) throw error;

      return {
        success: true,
        data: cleaners || [],
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get demo cleaners',
      };
    }
  }

  /**
   * Create demo booking from Heroes feed (when customer taps book from video)
   */
  async bookFromHeroesFeed(params: {
    customerUserId: string;
    cleanerUserId: string;
    serviceType?: string;
  }): Promise<ApiResponse<any>> {
    try {
      console.log('🎬 Creating booking from Heroes feed');

      // Default to next day at 2 PM for demo
      const scheduledTime = new Date();
      scheduledTime.setDate(scheduledTime.getDate() + 1);
      scheduledTime.setHours(14, 0, 0, 0);

      const result = await this.createDemoBooking({
        demoCustomerId: params.customerUserId,
        demoCleanerId: params.cleanerUserId,
        serviceType: params.serviceType || 'standard',
        scheduledTime: scheduledTime.toISOString(),
        specialInstructions: 'Booked from Heroes feed - looking forward to the same great service shown in the video!',
      });

      if (result.success) {
        console.log('✅ Heroes feed booking created successfully');
      }

      return result;
    } catch (error) {
      console.error('❌ Heroes feed booking failed:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to book from Heroes feed',
      };
    }
  }
}

export const demoBookingService = new DemoBookingService();