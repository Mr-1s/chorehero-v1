/**
 * Cleaner Booking Service
 * 
 * Fetches real booking data from the database for cleaners:
 * - Available bookings (pending/offered jobs in cleaner's service area)
 * - Active bookings (accepted, on_the_way, in_progress)
 * - Past bookings (completed, cancelled)
 */

import { supabase } from './supabase';
import type { Booking } from '../types/cleaner';

interface RawBooking {
  id: string;
  customer_id: string;
  cleaner_id: string | null;
  service_type: string;
  status: string;
  scheduled_time: string;
  estimated_duration: number;
  special_instructions: string | null;
  total_amount: number;
  cleaner_earnings: number | null;
  created_at: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip_code: string;
  } | null;
  customer: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
}

class CleanerBookingService {
  /**
   * Transform raw database booking to app Booking type
   */
  private transformBooking(raw: RawBooking): Booking {
    const scheduledDate = new Date(raw.scheduled_time);
    
    return {
      id: raw.id,
      customerName: raw.customer?.name || 'Customer',
      customerAvatarUrl: raw.customer?.avatar_url || 'https://via.placeholder.com/48',
      customerRating: 4.8, // TODO: Fetch from ratings table
      customerTotalBookings: 0, // TODO: Count from bookings table
      serviceType: this.formatServiceType(raw.service_type),
      status: this.mapStatus(raw.status),
      scheduledAt: raw.scheduled_time,
      durationMinutes: raw.estimated_duration,
      distanceMiles: 2.5, // TODO: Calculate from cleaner location
      addressLine1: raw.address 
        ? `${raw.address.street}, ${raw.address.city}` 
        : 'Address not provided',
      hasSpecialRequests: !!raw.special_instructions,
      specialRequestText: raw.special_instructions || undefined,
      totalPrice: parseFloat(String(raw.total_amount)) || 0,
      payoutToCleaner: parseFloat(String(raw.cleaner_earnings)) || parseFloat(String(raw.total_amount)) * 0.7,
      isInstant: false, // TODO: Add instant booking flag
      createdAt: raw.created_at,
    };
  }

  /**
   * Format service type for display
   */
  private formatServiceType(serviceType: string): string {
    const typeMap: Record<string, string> = {
      'standard_clean': 'Standard Clean',
      'deep_clean': 'Deep Clean',
      'move_in_out': 'Move In/Out',
      'express_clean': 'Express Clean',
      'office_clean': 'Office Clean',
    };
    return typeMap[serviceType] || serviceType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Map database status to app status
   */
  private mapStatus(status: string): Booking['status'] {
    const statusMap: Record<string, Booking['status']> = {
      'pending': 'offered',
      'confirmed': 'accepted',
      'cleaner_en_route': 'on_the_way',
      'cleaner_arrived': 'on_the_way',
      'in_progress': 'in_progress',
      'completed': 'completed',
      'cancelled': 'cancelled',
    };
    return statusMap[status] || 'offered';
  }

  /**
   * Get available bookings for a cleaner (jobs they can accept)
   */
  async getAvailableBookings(cleanerId: string): Promise<Booking[]> {
    try {
      // Get cleaner's service radius
      const { data: cleanerProfile } = await supabase
        .from('cleaner_profiles')
        .select('service_radius_km')
        .eq('user_id', cleanerId)
        .single();

      // Fetch pending bookings that don't have a cleaner assigned yet
      // In production, filter by distance from cleaner's location
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          customer_id,
          cleaner_id,
          service_type,
          status,
          scheduled_time,
          estimated_duration,
          special_instructions,
          total_amount,
          cleaner_earnings,
          created_at,
          address:addresses!address_id(
            street,
            city,
            state,
            zip_code
          ),
          customer:users!customer_id(
            id,
            name,
            avatar_url
          )
        `)
        .is('cleaner_id', null)
        .eq('status', 'pending')
        .gte('scheduled_time', new Date().toISOString())
        .order('scheduled_time', { ascending: true })
        .limit(20);

      if (error) {
        console.error('❌ Error fetching available bookings:', error);
        return [];
      }

      return (data || []).map(b => this.transformBooking(b as unknown as RawBooking));
    } catch (err) {
      console.error('❌ Error in getAvailableBookings:', err);
      return [];
    }
  }

  /**
   * Get active bookings for a cleaner (jobs they've accepted)
   */
  async getActiveBookings(cleanerId: string): Promise<Booking[]> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          customer_id,
          cleaner_id,
          service_type,
          status,
          scheduled_time,
          estimated_duration,
          special_instructions,
          total_amount,
          cleaner_earnings,
          created_at,
          address:addresses!address_id(
            street,
            city,
            state,
            zip_code
          ),
          customer:users!customer_id(
            id,
            name,
            avatar_url
          )
        `)
        .eq('cleaner_id', cleanerId)
        .in('status', ['confirmed', 'cleaner_en_route', 'cleaner_arrived', 'in_progress'])
        .order('scheduled_time', { ascending: true });

      if (error) {
        console.error('❌ Error fetching active bookings:', error);
        return [];
      }

      return (data || []).map(b => this.transformBooking(b as unknown as RawBooking));
    } catch (err) {
      console.error('❌ Error in getActiveBookings:', err);
      return [];
    }
  }

  /**
   * Get past bookings for a cleaner (completed jobs)
   */
  async getPastBookings(cleanerId: string): Promise<Booking[]> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          customer_id,
          cleaner_id,
          service_type,
          status,
          scheduled_time,
          estimated_duration,
          special_instructions,
          total_amount,
          cleaner_earnings,
          created_at,
          address:addresses!address_id(
            street,
            city,
            state,
            zip_code
          ),
          customer:users!customer_id(
            id,
            name,
            avatar_url
          )
        `)
        .eq('cleaner_id', cleanerId)
        .in('status', ['completed', 'cancelled'])
        .order('scheduled_time', { ascending: false })
        .limit(50);

      if (error) {
        console.error('❌ Error fetching past bookings:', error);
        return [];
      }

      return (data || []).map(b => this.transformBooking(b as unknown as RawBooking));
    } catch (err) {
      console.error('❌ Error in getPastBookings:', err);
      return [];
    }
  }

  /**
   * Accept a booking
   */
  async acceptBooking(bookingId: string, cleanerId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          cleaner_id: cleanerId,
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .is('cleaner_id', null); // Ensure no one else grabbed it

      if (error) {
        console.error('❌ Error accepting booking:', error);
        return false;
      }

      console.log(`✅ Accepted booking ${bookingId}`);
      return true;
    } catch (err) {
      console.error('❌ Error in acceptBooking:', err);
      return false;
    }
  }

  /**
   * Decline a booking (just removes it from cleaner's view, doesn't cancel)
   */
  async declineBooking(bookingId: string, cleanerId: string): Promise<boolean> {
    // In a real app, you might track declined bookings per cleaner
    // For now, we just log it
    console.log(`Cleaner ${cleanerId} declined booking ${bookingId}`);
    return true;
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(bookingId: string, status: string): Promise<boolean> {
    try {
      const updates: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      };

      // Set actual times based on status
      if (status === 'in_progress') {
        updates.actual_start_time = new Date().toISOString();
      } else if (status === 'completed') {
        updates.actual_end_time = new Date().toISOString();
      }

      const { error } = await supabase
        .from('bookings')
        .update(updates)
        .eq('id', bookingId);

      if (error) {
        console.error('❌ Error updating booking status:', error);
        return false;
      }

      console.log(`✅ Updated booking ${bookingId} to ${status}`);
      return true;
    } catch (err) {
      console.error('❌ Error in updateBookingStatus:', err);
      return false;
    }
  }

  /**
   * Subscribe to new available bookings in real-time
   */
  subscribeToNewBookings(
    cleanerId: string,
    onNewBooking: (booking: Booking) => void
  ) {
    const channel = supabase
      .channel('new-bookings')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: 'status=eq.pending',
        },
        async (payload) => {
          console.log('🔔 New booking available:', payload.new);
          // Fetch full booking details
          const bookings = await this.getAvailableBookings(cleanerId);
          const newBooking = bookings.find(b => b.id === payload.new.id);
          if (newBooking) {
            onNewBooking(newBooking);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const cleanerBookingService = new CleanerBookingService();


