import { supabase } from './supabase';
import { ApiResponse } from '../types/api';

// ============================================================================
// PRICE LOCKING SERVICE
// Prevents pricing confusion during booking flows
// ============================================================================

export interface PriceLock {
  id: string;
  customer_id: string;
  cleaner_id: string;
  service_type: string;
  locked_price: number;
  original_price: number;
  currency: string;
  expires_at: string;
  created_at: string;
  add_ons?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

export interface PriceQuote {
  cleaner_id: string;
  service_type: string;
  base_price: number;
  add_ons_total: number;
  platform_fee: number;
  tax: number;
  total_price: number;
  currency: string;
  valid_until: string;
  quote_id: string;
  price_locked: boolean;
}

class PriceLockingService {
  
  // ============================================================================
  // PRICE QUOTE GENERATION
  // ============================================================================
  
  /**
   * Generate price quote with lock option
   */
  async generatePriceQuote(
    cleanerId: string,
    serviceType: string,
    addOns: Array<{ id: string; quantity: number }> = [],
    lockDurationMinutes: number = 30
  ): Promise<ApiResponse<PriceQuote>> {
    try {
      console.log('💰 Generating price quote for cleaner:', cleanerId);

      // Get current cleaner pricing
      const { data: cleanerData, error: cleanerError } = await supabase
        .from('users')
        .select(`
          id,
          cleaner_profiles!inner(hourly_rate, service_pricing)
        `)
        .eq('id', cleanerId)
        .eq('role', 'cleaner')
        .single();

      if (cleanerError || !cleanerData) {
        throw new Error('Cleaner not found or inactive');
      }

      // Get service base price
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('base_price, estimated_duration')
        .eq('type', serviceType)
        .single();

      if (serviceError || !serviceData) {
        throw new Error('Service type not found');
      }

      // Calculate add-ons total
      let addOnsTotal = 0;
      const selectedAddOns: Array<{ id: string; name: string; price: number }> = [];

      if (addOns.length > 0) {
        const { data: addOnData, error: addOnError } = await supabase
          .from('add_ons')
          .select('id, name, price')
          .in('id', addOns.map(ao => ao.id));

        if (addOnError) throw addOnError;

        for (const addOn of addOns) {
          const addOnInfo = addOnData?.find(ao => ao.id === addOn.id);
          if (addOnInfo) {
            const totalPrice = addOnInfo.price * addOn.quantity;
            addOnsTotal += totalPrice;
            selectedAddOns.push({
              id: addOnInfo.id,
              name: addOnInfo.name,
              price: totalPrice
            });
          }
        }
      }

      // Use cleaner's custom pricing if available, otherwise service base price
      const cleanerProfile = cleanerData.cleaner_profiles[0];
      const customPricing = cleanerProfile.service_pricing?.[serviceType];
      const basePrice = customPricing || serviceData.base_price;

      // Calculate fees and taxes
      const platformFeeRate = 0.15; // 15% platform fee
      const taxRate = 0.08; // 8% tax (varies by location)
      
      const subtotal = basePrice + addOnsTotal;
      const platformFee = Math.round(subtotal * platformFeeRate * 100) / 100;
      const tax = Math.round(subtotal * taxRate * 100) / 100;
      const totalPrice = subtotal + platformFee + tax;

      // Generate quote ID
      const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const validUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);

      const priceQuote: PriceQuote = {
        cleaner_id: cleanerId,
        service_type: serviceType,
        base_price: basePrice,
        add_ons_total: addOnsTotal,
        platform_fee: platformFee,
        tax: tax,
        total_price: totalPrice,
        currency: 'USD',
        valid_until: validUntil.toISOString(),
        quote_id: quoteId,
        price_locked: false
      };

      console.log('✅ Price quote generated:', quoteId, `$${totalPrice}`);
      return { success: true, data: priceQuote };

    } catch (error) {
      console.error('❌ Error generating price quote:', error);
      return {
        success: false,
        data: {} as PriceQuote,
        error: error instanceof Error ? error.message : 'Failed to generate price quote'
      };
    }
  }

  // ============================================================================
  // PRICE LOCKING MECHANISM
  // ============================================================================
  
  /**
   * Lock price for customer during booking flow
   */
  async lockPrice(
    customerId: string,
    quoteId: string,
    lockDurationMinutes: number = 30
  ): Promise<ApiResponse<PriceLock>> {
    try {
      console.log('🔒 Locking price for customer:', customerId, 'Quote:', quoteId);

      // For demo purposes, we'll store the lock in a simple format
      // In production, this would reference the actual quote data
      const lockId = `lock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + lockDurationMinutes * 60 * 1000);

      // Store price lock (for now we'll use local storage pattern)
      // In production, this would be a proper database table
      const priceLock: PriceLock = {
        id: lockId,
        customer_id: customerId,
        cleaner_id: 'temp_cleaner_id', // Would come from quote
        service_type: 'temp_service', // Would come from quote
        locked_price: 75.00, // Would come from quote
        original_price: 75.00, // Would come from quote
        currency: 'USD',
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      };

      // TODO: Store in database table 'price_locks'
      console.log('✅ Price locked:', lockId, `$${priceLock.locked_price}`);
      return { success: true, data: priceLock };

    } catch (error) {
      console.error('❌ Error locking price:', error);
      return {
        success: false,
        data: {} as PriceLock,
        error: error instanceof Error ? error.message : 'Failed to lock price'
      };
    }
  }

  /**
   * Validate price lock is still valid
   */
  async validatePriceLock(lockId: string): Promise<ApiResponse<PriceLock>> {
    try {
      // TODO: Query from database
      // For now, return mock validation
      console.log('🔍 Validating price lock:', lockId);

      // Mock validation - in production would check database
      const mockLock: PriceLock = {
        id: lockId,
        customer_id: 'mock_customer',
        cleaner_id: 'mock_cleaner',
        service_type: 'standard',
        locked_price: 75.00,
        original_price: 75.00,
        currency: 'USD',
        expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(), // 20 min from now
        created_at: new Date().toISOString()
      };

      return { success: true, data: mockLock };

    } catch (error) {
      return {
        success: false,
        data: {} as PriceLock,
        error: error instanceof Error ? error.message : 'Failed to validate price lock'
      };
    }
  }

  /**
   * Handle price change during active lock
   */
  async handlePriceChangeConflict(
    lockId: string,
    newPrice: number,
    reason: string
  ): Promise<ApiResponse<{
    action_required: boolean;
    locked_price: number;
    new_price: number;
    price_difference: number;
    options: Array<{
      action: 'accept_new_price' | 'keep_locked_price' | 'cancel_booking';
      description: string;
    }>;
  }>> {
    try {
      console.log('⚠️ Price change conflict detected for lock:', lockId);

      const lockResult = await this.validatePriceLock(lockId);
      if (!lockResult.success || !lockResult.data) {
        throw new Error('Invalid price lock');
      }

      const lockedPrice = lockResult.data.locked_price;
      const priceDifference = newPrice - lockedPrice;

      const response = {
        action_required: true,
        locked_price: lockedPrice,
        new_price: newPrice,
        price_difference: priceDifference,
        options: [
          {
            action: 'keep_locked_price' as const,
            description: `Continue with locked price of $${lockedPrice.toFixed(2)}`
          },
          {
            action: 'accept_new_price' as const,
            description: `Accept new price of $${newPrice.toFixed(2)} (${priceDifference >= 0 ? '+' : ''}$${priceDifference.toFixed(2)})`
          },
          {
            action: 'cancel_booking' as const,
            description: 'Cancel booking due to price change'
          }
        ]
      };

      return { success: true, data: response };

    } catch (error) {
      return {
        success: false,
        data: {
          action_required: false,
          locked_price: 0,
          new_price: 0,
          price_difference: 0,
          options: []
        },
        error: error instanceof Error ? error.message : 'Failed to handle price change'
      };
    }
  }

  // ============================================================================
  // PRICE MONITORING & NOTIFICATIONS
  // ============================================================================
  
  /**
   * Monitor cleaner pricing changes
   */
  async monitorPricingChanges(cleanerId: string): Promise<ApiResponse<boolean>> {
    try {
      // Set up real-time subscription for cleaner profile changes
      const channel = supabase
        .channel(`pricing_changes_${cleanerId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'cleaner_profiles',
            filter: `user_id=eq.${cleanerId}`
          },
          (payload) => {
            console.log('💰 Pricing change detected for cleaner:', cleanerId);
            this.handleRealTimePriceChange(cleanerId, payload);
          }
        )
        .subscribe();

      console.log('👀 Monitoring pricing changes for cleaner:', cleanerId);
      return { success: true, data: true };

    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to monitor pricing changes'
      };
    }
  }

  private async handleRealTimePriceChange(cleanerId: string, payload: any): Promise<void> {
    try {
      console.log('🔄 Processing real-time price change:', payload);

      // Check for active price locks for this cleaner
      // TODO: Query price_locks table for active locks
      
      // Notify affected customers
      // TODO: Send push notifications about price changes
      
      // Log price change for audit trail
      console.log('📊 Price change logged for cleaner:', cleanerId);

    } catch (error) {
      console.error('❌ Error handling real-time price change:', error);
    }
  }

  /**
   * Get pricing history for transparency
   */
  async getPricingHistory(
    cleanerId: string,
    serviceType: string,
    daysBack: number = 30
  ): Promise<ApiResponse<Array<{
    date: string;
    price: number;
    change_reason?: string;
  }>>> {
    try {
      // TODO: Query pricing history table
      // For now, return mock data
      const mockHistory = [
        {
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          price: 70.00,
          change_reason: 'Market adjustment'
        },
        {
          date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          price: 65.00,
          change_reason: 'Initial pricing'
        }
      ];

      return { success: true, data: mockHistory };

    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get pricing history'
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  /**
   * Release price lock
   */
  async releasePriceLock(lockId: string): Promise<ApiResponse<boolean>> {
    try {
      // TODO: Delete from price_locks table
      console.log('🔓 Price lock released:', lockId);
      return { success: true, data: true };

    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to release price lock'
      };
    }
  }

  /**
   * Extend price lock duration
   */
  async extendPriceLock(lockId: string, additionalMinutes: number): Promise<ApiResponse<boolean>> {
    try {
      // TODO: Update expires_at in price_locks table
      console.log('⏰ Price lock extended:', lockId, `+${additionalMinutes} minutes`);
      return { success: true, data: true };

    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to extend price lock'
      };
    }
  }

  /**
   * Clean up expired price locks
   */
  async cleanupExpiredLocks(): Promise<number> {
    try {
      // TODO: Delete expired locks from database
      console.log('🧹 Cleaned up expired price locks');
      return 0; // Return actual count
    } catch (error) {
      console.error('❌ Error cleaning up expired price locks:', error);
      return 0;
    }
  }
}

export const priceLockingService = new PriceLockingService();
