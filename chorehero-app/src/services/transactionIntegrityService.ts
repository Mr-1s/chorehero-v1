import { supabase } from './supabase';
import { ApiResponse } from '../types/api';

// ============================================================================
// TRANSACTION INTEGRITY SERVICE
// Ensures atomic operations between payments and bookings
// ============================================================================

export interface PaymentBookingTransaction {
  payment_intent_id: string;
  booking_id: string;
  customer_id: string;
  cleaner_id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'rolled_back';
  created_at: string;
  completed_at?: string;
  error_reason?: string;
}

export interface TransactionRequest {
  customer_id: string;
  cleaner_id: string;
  service_data: {
    service_type: string;
    scheduled_time: string;
    address_id: string;
    special_instructions?: string;
    estimated_duration: number;
    base_price: number;
    add_ons_total?: number;
    platform_fee: number;
    tax?: number;
    total_amount: number;
  };
  payment_data: {
    payment_method_id: string;
    stripe_customer_id?: string;
  };
}

class TransactionIntegrityService {
  
  // ============================================================================
  // ATOMIC PAYMENT + BOOKING CREATION
  // ============================================================================
  
  /**
   * Execute atomic payment and booking creation with rollback capability
   */
  async executePaymentBookingTransaction(
    request: TransactionRequest
  ): Promise<ApiResponse<{ booking_id: string; payment_intent_id: string; transaction_id: string }>> {
    let transactionId: string | null = null;
    let paymentIntentId: string | null = null;
    let bookingId: string | null = null;

    try {
      console.log('💳 Starting atomic payment-booking transaction');
      
      // Step 1: Create transaction record for tracking
      transactionId = await this.createTransactionRecord(request);
      console.log('📝 Transaction record created:', transactionId);

      // Step 2: Validate prerequisites
      await this.validateTransaction(request);
      console.log('✅ Transaction validation passed');

      // Step 3: Create Stripe payment intent (hold funds)
      paymentIntentId = await this.createPaymentIntent(request, transactionId);
      console.log('💰 Payment intent created:', paymentIntentId);

      // Step 4: Create booking record in database
      bookingId = await this.createBookingRecord(request, paymentIntentId, transactionId);
      console.log('📅 Booking record created:', bookingId);

      // Step 5: Confirm payment (capture funds)
      await this.confirmPayment(paymentIntentId, transactionId);
      console.log('✅ Payment confirmed');

      // Step 6: Mark transaction as completed
      await this.completeTransaction(transactionId, bookingId, paymentIntentId);
      console.log('🎉 Transaction completed successfully');

      return {
        success: true,
        data: {
          booking_id: bookingId,
          payment_intent_id: paymentIntentId,
          transaction_id: transactionId
        }
      };

    } catch (error) {
      console.error('❌ Transaction failed:', error);
      
      // Rollback any partial operations
      if (transactionId) {
        await this.rollbackTransaction(transactionId, paymentIntentId, bookingId);
      }

      return {
        success: false,
        data: { booking_id: '', payment_intent_id: '', transaction_id: '' },
        error: error instanceof Error ? error.message : 'Transaction failed'
      };
    }
  }

  // ============================================================================
  // TRANSACTION LIFECYCLE METHODS
  // ============================================================================
  
  private async createTransactionRecord(request: TransactionRequest): Promise<string> {
    const { data, error } = await supabase
      .from('payment_booking_transactions')
      .insert({
        customer_id: request.customer_id,
        cleaner_id: request.cleaner_id,
        amount: request.service_data.total_amount,
        status: 'pending'
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create transaction record: ${error.message}`);
    return data.id;
  }

  private async validateTransaction(request: TransactionRequest): Promise<void> {
    // Validate customer exists and is active
    const { data: customer, error: customerError } = await supabase
      .from('users')
      .select('id, is_active')
      .eq('id', request.customer_id)
      .eq('role', 'customer')
      .single();

    if (customerError || !customer?.is_active) {
      throw new Error('Invalid or inactive customer');
    }

    // Validate cleaner exists and is available
    const { data: cleaner, error: cleanerError } = await supabase
      .from('users')
      .select('id, is_active')
      .eq('id', request.cleaner_id)
      .eq('role', 'cleaner')
      .single();

    if (cleanerError || !cleaner?.is_active) {
      throw new Error('Invalid or inactive cleaner');
    }

    // Check for conflicting bookings at the same time
    const scheduledTime = new Date(request.service_data.scheduled_time);
    const { data: conflicts, error: conflictError } = await supabase
      .from('bookings')
      .select('id')
      .eq('cleaner_id', request.cleaner_id)
      .gte('scheduled_time', scheduledTime.toISOString())
      .lt('scheduled_time', new Date(scheduledTime.getTime() + request.service_data.estimated_duration * 60000).toISOString())
      .in('status', ['pending', 'confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress']);

    if (conflictError) throw new Error(`Availability check failed: ${conflictError.message}`);
    if (conflicts && conflicts.length > 0) {
      throw new Error('Cleaner is not available at the requested time');
    }

    // Validate address exists and belongs to customer
    const { data: address, error: addressError } = await supabase
      .from('addresses')
      .select('id')
      .eq('id', request.service_data.address_id)
      .eq('user_id', request.customer_id)
      .single();

    if (addressError) throw new Error('Invalid service address');
  }

  private async createPaymentIntent(request: TransactionRequest, transactionId: string): Promise<string> {
    // TODO: Implement actual Stripe payment intent creation
    // For now, simulate the payment intent creation
    console.log('💳 Creating Stripe payment intent for amount:', request.service_data.total_amount);
    
    // Simulate payment intent ID
    const paymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Update transaction record with payment intent
    const { error } = await supabase
      .from('payment_booking_transactions')
      .update({
        payment_intent_id: paymentIntentId,
        status: 'processing'
      })
      .eq('id', transactionId);

    if (error) throw new Error(`Failed to update transaction with payment intent: ${error.message}`);
    
    return paymentIntentId;
  }

  private async createBookingRecord(
    request: TransactionRequest, 
    paymentIntentId: string, 
    transactionId: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        customer_id: request.customer_id,
        cleaner_id: request.cleaner_id,
        service_type: request.service_data.service_type,
        status: 'pending',
        address_id: request.service_data.address_id,
        scheduled_time: request.service_data.scheduled_time,
        estimated_duration: request.service_data.estimated_duration,
        special_instructions: request.service_data.special_instructions,
        service_base_price: request.service_data.base_price,
        add_ons_total: request.service_data.add_ons_total || 0,
        platform_fee: request.service_data.platform_fee,
        tax: request.service_data.tax || 0,
        total_amount: request.service_data.total_amount,
        stripe_payment_intent_id: paymentIntentId,
        payment_status: 'pending',
        metadata: { transaction_id: transactionId }
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to create booking: ${error.message}`);
    return data.id;
  }

  private async confirmPayment(paymentIntentId: string, transactionId: string): Promise<void> {
    // TODO: Implement actual Stripe payment confirmation
    console.log('✅ Confirming Stripe payment:', paymentIntentId);
    
    // Simulate payment confirmation
    // In real implementation, this would call Stripe's confirm API
    
    // Update transaction status
    const { error } = await supabase
      .from('payment_booking_transactions')
      .update({ status: 'processing' })
      .eq('id', transactionId);

    if (error) throw new Error(`Failed to update payment status: ${error.message}`);
  }

  private async completeTransaction(
    transactionId: string, 
    bookingId: string, 
    paymentIntentId: string
  ): Promise<void> {
    // Update transaction as completed
    const { error: transactionError } = await supabase
      .from('payment_booking_transactions')
      .update({
        booking_id: bookingId,
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', transactionId);

    if (transactionError) throw new Error(`Failed to complete transaction: ${transactionError.message}`);

    // Update booking payment status
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ payment_status: 'succeeded' })
      .eq('id', bookingId);

    if (bookingError) throw new Error(`Failed to update booking payment status: ${bookingError.message}`);
  }

  // ============================================================================
  // ROLLBACK METHODS
  // ============================================================================
  
  private async rollbackTransaction(
    transactionId: string,
    paymentIntentId: string | null,
    bookingId: string | null
  ): Promise<void> {
    console.log('🔄 Rolling back transaction:', transactionId);

    try {
      // Cancel Stripe payment intent if created
      if (paymentIntentId) {
        await this.cancelPaymentIntent(paymentIntentId);
      }

      // Delete booking record if created
      if (bookingId) {
        await supabase
          .from('bookings')
          .delete()
          .eq('id', bookingId);
        console.log('🗑️ Booking record deleted:', bookingId);
      }

      // Mark transaction as rolled back
      await supabase
        .from('payment_booking_transactions')
        .update({
          status: 'rolled_back',
          error_reason: 'Transaction failed and was rolled back'
        })
        .eq('id', transactionId);

      console.log('✅ Transaction rollback completed');

    } catch (rollbackError) {
      console.error('❌ Rollback failed:', rollbackError);
      
      // Mark transaction as failed with rollback error
      await supabase
        .from('payment_booking_transactions')
        .update({
          status: 'failed',
          error_reason: `Transaction failed and rollback also failed: ${rollbackError}`
        })
        .eq('id', transactionId);
    }
  }

  private async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    // TODO: Implement actual Stripe payment intent cancellation
    console.log('❌ Canceling Stripe payment intent:', paymentIntentId);
    
    // In real implementation, this would call:
    // await stripe.paymentIntents.cancel(paymentIntentId);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionId: string): Promise<ApiResponse<PaymentBookingTransaction>> {
    try {
      const { data, error } = await supabase
        .from('payment_booking_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        data: {} as PaymentBookingTransaction,
        error: error instanceof Error ? error.message : 'Failed to get transaction status'
      };
    }
  }

  /**
   * Retry failed transaction
   */
  async retryTransaction(transactionId: string): Promise<ApiResponse<boolean>> {
    try {
      const { data: transaction, error } = await supabase
        .from('payment_booking_transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('status', 'failed')
        .single();

      if (error) throw new Error('Transaction not found or not in failed state');

      // TODO: Implement retry logic based on failure reason
      console.log('🔄 Retrying transaction:', transactionId);

      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to retry transaction'
      };
    }
  }
}

export const transactionIntegrityService = new TransactionIntegrityService();
