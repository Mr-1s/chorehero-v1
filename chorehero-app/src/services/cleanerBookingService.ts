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

interface RawAddress {
  street: string;
  city: string;
  state: string;
  zip_code: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

interface RawJob {
  headline?: string;
}

interface RawBooking {
  id: string;
  job_id: string | null;
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
  messaging_enabled?: boolean;
  address: RawAddress | null; // Joined from addresses via address_id
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  has_pets: boolean | null;
  pet_details: string | null;
  customer: {
    id: string;
    name: string;
    avatar_url: string | null;
    customer_profile?: {
      average_rating?: number | null;
      total_bookings?: number | null;
    } | Array<{
      average_rating?: number | null;
      total_bookings?: number | null;
    }> | null;
  } | null;
  job?: RawJob | null; // Joined when booking has job_id (quote flow)
}

class CleanerBookingService {
  /**
   * In-flight mutating actions per (cleaner, booking). Prevents double-tap
   * accepts and double "mark complete" submissions.
   */
  private inFlightActions = new Set<string>();

  private actionKey(cleanerId: string, bookingId: string, action: string): string {
    return `${cleanerId}:${bookingId}:${action}`;
  }

  private buildBookingSelect(includePets: boolean): string {
    const petFields = includePets ? 'has_pets,\n      pet_details,\n      ' : '';
    return `
      id,
      job_id,
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
      messaging_enabled,
      address:addresses!address_id(street, city, state, zip_code, latitude, longitude),
      bedrooms,
      bathrooms,
      square_feet,
      ${petFields}
      job:jobs(headline),
      customer:users!customer_id(
        id,
        name,
        avatar_url,
        customer_profile:customer_profiles(average_rating, total_bookings)
      )
    `;
  }

  private parseQuoteJobIdFromSpecial(special: string | null | undefined): string | null {
    if (!special) return null;
    const m = special.match(
      /Job from quote - ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    );
    return m ? m[1] : null;
  }

  /**
   * Transform raw database booking to app Booking type
   */
  private transformBooking(raw: RawBooking): Booking {
    const scheduledDate = new Date(raw.scheduled_time);
    
    const serviceTypeDisplay = raw.job?.headline || this.formatServiceType(raw.service_type);
    const quoteJobId = raw.job_id || this.parseQuoteJobIdFromSpecial(raw.special_instructions);
    const customerProfile = Array.isArray(raw.customer?.customer_profile)
      ? raw.customer?.customer_profile[0]
      : raw.customer?.customer_profile;
    return {
      id: raw.id,
      customerId: raw.customer_id || raw.customer?.id,
      customerName: raw.customer?.name || 'Customer',
      customerAvatarUrl: raw.customer?.avatar_url || '',
      customerRating: Number(customerProfile?.average_rating ?? 0),
      customerTotalBookings: Number(customerProfile?.total_bookings ?? 0),
      serviceType: serviceTypeDisplay,
      status: this.mapStatus(raw.status),
      scheduledAt: raw.scheduled_time,
      durationMinutes: raw.estimated_duration,
      distanceMiles: 2.5, // TODO: Calculate from cleaner location
      addressLine1: raw.address
        ? [raw.address.street, raw.address.city, raw.address.state, raw.address.zip_code].filter(Boolean).join(', ')
        : 'Address not provided',
      jobLatitude:
        raw.address?.latitude != null && raw.address.latitude !== ''
          ? Number(raw.address.latitude)
          : null,
      jobLongitude:
        raw.address?.longitude != null && raw.address.longitude !== ''
          ? Number(raw.address.longitude)
          : null,
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
      messagingEnabled: !!raw.messaging_enabled,
      quoteJobId: quoteJobId || null,
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
      'cleaner_arrived': 'arrived',
      'in_progress': 'in_progress',
      'completed': 'completed',
      'cancelled': 'cancelled',
    };
    return statusMap[status] || 'offered';
  }

  private isValidUUID(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  /**
   * Get available bookings for a cleaner (jobs they can accept)
   */
  async getAvailableBookings(cleanerId: string): Promise<Booking[]> {
    if (!this.isValidUUID(cleanerId)) return [];
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
   * 7-day window: only shows jobs scheduled within the next 7 days
   * Note: 'pending' status bookings appear in Available Jobs, not here
   */
  async getActiveBookings(cleanerId: string): Promise<Booking[]> {
    if (!this.isValidUUID(cleanerId)) return [];
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const runQuery = async (includePets: boolean) => (
        supabase
          .from('bookings')
          .select(this.buildBookingSelect(includePets))
          .eq('cleaner_id', cleanerId)
          .in('status', ['confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress'])
          .gte('scheduled_time', oneDayAgo.toISOString())
          .lte('scheduled_time', sevenDaysFromNow.toISOString())
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
    if (!this.isValidUUID(cleanerId)) return [];
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
   * Blocks if Stripe onboarding not complete (prevents accepted jobs that can't pay out)
   */
  async acceptBooking(bookingId: string, cleanerId: string): Promise<boolean> {
    const key = this.actionKey(cleanerId, bookingId, 'accept');
    if (this.inFlightActions.has(key)) {
      console.warn('acceptBooking: duplicate request ignored for', key);
      return false;
    }
    this.inFlightActions.add(key);
    try {
      // Enforce Stripe onboarding and background check before accepting jobs
      const { data: profile, error: profileError } = await supabase
        .from('cleaner_profiles')
        .select('stripe_onboarding_complete, stripe_account_id, background_check_status')
        .eq('user_id', cleanerId)
        .single();

      if (profileError || !profile) {
        console.error('❌ Could not fetch cleaner profile:', profileError);
        return false;
      }

      if (!profile.stripe_onboarding_complete || !profile.stripe_account_id) {
        console.warn('⚠️ Cleaner must complete Stripe onboarding before accepting jobs');
        throw new Error('Complete Stripe onboarding before accepting jobs. Go to Profile → Earnings to set up payouts.');
      }

      // Background check required before first booking (deferred from onboarding)
      const bgStatus = profile.background_check_status as string | null | undefined;
      if (bgStatus !== 'cleared') {
        console.warn('⚠️ Background check required before accepting jobs');
        throw new Error('To complete this booking, we need to verify your background. This takes 2-3 minutes. Go to Profile to start verification.');
      }

      // Use atomic RPC to prevent two cleaners claiming simultaneously
      const { data: claimed, error } = await supabase.rpc('claim_booking', {
        p_booking_id: bookingId,
        p_cleaner_id: cleanerId,
      });

      if (error) {
        console.error('❌ Error accepting booking:', error);
        return false;
      }

      if (!claimed) {
        console.warn('⚠️ Booking already claimed by another cleaner');
        return false;
      }

      console.log(`✅ Accepted booking ${bookingId}`);
      return true;
    } catch (err) {
      console.error('❌ Error in acceptBooking:', err);
      return false;
    } finally {
      this.inFlightActions.delete(key);
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
   * Mark job complete (triggers escrow release via enqueue_cleaner_payout).
   * Verifies cleaner owns booking and status is in_progress.
   */
  async markJobComplete(bookingId: string, cleanerId: string): Promise<{ success: boolean; error?: string }> {
    const key = this.actionKey(cleanerId, bookingId, 'complete');
    if (this.inFlightActions.has(key)) {
      return { success: false, error: 'Completion is already being processed.' };
    }
    this.inFlightActions.add(key);
    try {
      const { data: result, error } = await supabase.rpc('complete_booking', {
        p_booking_id: bookingId,
        p_cleaner_id: cleanerId,
        p_completed_at: new Date().toISOString(),
      });

      if (error) throw error;

      const rpcResult = result as { success: boolean; error?: string };
      if (!rpcResult.success) {
        return { success: false, error: rpcResult.error || 'Failed to complete booking' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('❌ Error in markJobComplete:', err);
      const msg = err?.message || err?.error_description || String(err);
      if (msg.includes('42703') || msg.includes('completed_at')) {
        return { success: false, error: 'Database needs update. Run migration 063 (add completed_at to bookings).' };
      }
      if (msg.includes('Invalid status') || msg.includes('in_progress')) {
        return { success: false, error: 'Tap "Start Job" first, then "Mark Complete".' };
      }
      return { success: false, error: msg || 'Failed to complete booking' };
    } finally {
      this.inFlightActions.delete(key);
    }
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
        const now = new Date().toISOString();
        updates.actual_start_time = now;
        updates.started_at = now; // Migration 066
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
   * Cancel a job (cleaner-initiated). Uses RPC for refunds and payout cancellation.
   */
  async cancelJob(bookingId: string, reason: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data: result, error } = await supabase.rpc('cancel_booking_with_refund', {
        p_booking_id: bookingId,
        p_reason: reason,
        p_cancelled_by: 'cleaner',
        p_refund_pct: null,
      });

      if (error) {
        console.error('❌ Error cancelling job:', error);
        return { success: false, error: error.message };
      }

      const rpcResult = result as { success: boolean; error?: string };
      if (!rpcResult.success) {
        return { success: false, error: rpcResult.error || 'Cancellation failed' };
      }

      return { success: true };
    } catch (err) {
      console.error('❌ Error in cancelJob:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to cancel job',
      };
    }
  }

  /**
   * Subscribe to new available bookings in real-time (marketplace: status=pending)
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

  /**
   * Subscribe to new bookings assigned to this cleaner (quote-accepted flow).
   * When a customer pays for a quote, the booking is created with cleaner_id set.
   */
  subscribeToNewAssignedBookings(
    cleanerId: string,
    onNewAssigned: () => void
  ) {
    const channel = supabase
      .channel('new-assigned-bookings')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `cleaner_id=eq.${cleanerId}`,
        },
        (payload) => {
          console.log('🔔 New booking assigned to you (quote accepted):', payload.new?.id);
          onNewAssigned();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const cleanerBookingService = new CleanerBookingService();


