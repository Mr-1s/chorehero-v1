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
  access_instructions: string | null;
  total_amount: number;
  cleaner_earnings: number | null;
  created_at: string;
  address: string | null; // Text field with full address
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  has_pets: boolean | null;
  pet_details: string | null;
  customer: {
    id: string;
    name: string;
    avatar_url: string | null;
  } | null;
}

class CleanerBookingService {
  private buildBookingSelect(includePets: boolean): string {
    const petFields = includePets ? 'has_pets,\n      pet_details,\n      ' : '';
    return `
      id,
      customer_id,
      cleaner_id,
      service_type,
      status,
      scheduled_time,
      estimated_duration,
      special_instructions,
      access_instructions,
      total_amount,
      cleaner_earnings,
      created_at,
      address,
      bedrooms,
      bathrooms,
      square_feet,
      ${petFields}
      customer:users!customer_id(
        id,
        name,
        avatar_url
      )
    `;
  }

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
      addressLine1: raw.address || 'Address not provided',
      hasSpecialRequests: !!raw.special_instructions,
      specialRequestText: raw.special_instructions || undefined,
      totalPrice: parseFloat(String(raw.total_amount)) || 0,
      payoutToCleaner: parseFloat(String(raw.cleaner_earnings)) || parseFloat(String(raw.total_amount)) * 0.7,
      isInstant: false, // TODO: Add instant booking flag
      createdAt: raw.created_at,
      bedrooms: raw.bedrooms || undefined,
      bathrooms: raw.bathrooms || undefined,
      squareFeet: raw.square_feet || undefined,
      hasPets: raw.has_pets ?? this.extractHasPets(raw.special_instructions),
      petDetails: raw.pet_details || null,
      accessInstructions: raw.access_instructions || null,
    };
  }

  private extractHasPets(note: string | null): boolean | null {
    if (!note) return null;
    const match = note.match(/Pets:\s*([A-Za-z0-9\s-]+)/i);
    if (!match) return null;
    const value = match[1].trim().toLowerCase();
    if (value.startsWith('no')) return false;
    if (value.startsWith('yes')) return true;
    return true;
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

      // Fetch pending bookings:
      // 1. Bookings directly assigned to this cleaner with 'pending' status
      // 2. OR open bookings with no cleaner assigned (marketplace mode)
      const runQuery = async (includePets: boolean) => (
        supabase
          .from('bookings')
          .select(this.buildBookingSelect(includePets))
          .or(`cleaner_id.eq.${cleanerId},cleaner_id.is.null`)
          .eq('status', 'pending')
          .gte('scheduled_time', new Date().toISOString())
          .order('scheduled_time', { ascending: true })
          .limit(20)
      );

      let { data, error } = await runQuery(true);
      if (error?.code === '42703') {
        ({ data, error } = await runQuery(false));
      }

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
   * Get active bookings for a cleaner (confirmed + in-progress jobs)
   * Note: 'pending' status bookings appear in Available Jobs, not here
   */
  async getActiveBookings(cleanerId: string): Promise<Booking[]> {
    try {
      const runQuery = async (includePets: boolean) => (
        supabase
          .from('bookings')
          .select(this.buildBookingSelect(includePets))
          .eq('cleaner_id', cleanerId)
          .in('status', ['confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress'])
          .order('scheduled_time', { ascending: true })
      );

      let { data, error } = await runQuery(true);
      if (error?.code === '42703') {
        ({ data, error } = await runQuery(false));
      }

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
      const runQuery = async (includePets: boolean) => (
        supabase
          .from('bookings')
          .select(this.buildBookingSelect(includePets))
          .eq('cleaner_id', cleanerId)
          .in('status', ['completed', 'cancelled'])
          .order('scheduled_time', { ascending: false })
          .limit(50)
      );

      let { data, error } = await runQuery(true);
      if (error?.code === '42703') {
        ({ data, error } = await runQuery(false));
      }

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


