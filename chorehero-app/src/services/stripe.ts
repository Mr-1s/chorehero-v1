import { supabase } from './supabase';
import { ApiResponse } from '../types/api';

// Stripe configuration
const STRIPE_CONFIG = {
  // In production, these would come from environment variables
  publishableKey: 'pk_test_your_publishable_key_here',
  secretKey: 'sk_test_your_secret_key_here', // This should be server-side only
  webhookSecret: 'whsec_your_webhook_secret_here',
  
  // Platform fee configuration (30% platform, 70% cleaner)
  platformFeePercentage: 0.30,
  cleanerRetentionPercentage: 0.70,
  
  // Minimum amounts
  minimumAmount: 1000, // $10.00 in cents
  minimumTip: 100, // $1.00 in cents
};

export interface PaymentMethod {
  id: string;
  type: 'card';
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  is_default: boolean;
}

export interface ConnectAccount {
  id: string;
  user_id: string;
  stripe_account_id: string;
  details_submitted: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requirements: {
    currently_due: string[];
    eventually_due: string[];
    past_due: string[];
    pending_verification: string[];
  };
  onboarding_url?: string;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
  client_secret: string;
  application_fee_amount?: number;
  transfer_destination?: string;
}

export interface PaymentBreakdown {
  subtotal: number;
  platform_fee: number;
  tip: number;
  total: number;
  cleaner_amount: number;
}

class StripeService {
  // Calculate payment breakdown with platform fee
  calculatePaymentBreakdown(subtotal: number, tip: number = 0): PaymentBreakdown {
    const platformFee = Math.round(subtotal * STRIPE_CONFIG.platformFeePercentage);
    const cleanerAmount = subtotal - platformFee + tip;
    const total = subtotal + tip;

    return {
      subtotal,
      platform_fee: platformFee,
      tip,
      total,
      cleaner_amount: cleanerAmount,
    };
  }

  // Create Stripe Connect account for cleaner
  async createConnectAccount(userId: string): Promise<ApiResponse<{ account_id: string; onboarding_url: string }>> {
    try {
      // In a real app, this would call your backend API which would use Stripe's server-side SDK
      const response = await fetch('/api/stripe/create-connect-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create Connect account');
      }

      const data = await response.json();

      // Save Connect account to database
      const { error: dbError } = await supabase
        .from('stripe_connect_accounts')
        .insert({
          user_id: userId,
          stripe_account_id: data.account_id,
          details_submitted: false,
          charges_enabled: false,
          payouts_enabled: false,
          requirements: data.requirements || {},
          onboarding_url: data.onboarding_url,
          created_at: new Date().toISOString(),
        });

      if (dbError) {
        throw dbError;
      }

      return {
        success: true,
        data: {
          account_id: data.account_id,
          onboarding_url: data.onboarding_url,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to create Connect account',
      };
    }
  }

  // Get Connect account status
  async getConnectAccount(userId: string): Promise<ApiResponse<ConnectAccount | null>> {
    try {
      const { data, error } = await supabase
        .from('stripe_connect_accounts')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (!data) {
        return {
          success: true,
          data: null,
        };
      }

      return {
        success: true,
        data: data as ConnectAccount,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get Connect account',
      };
    }
  }

  // Update Connect account status (called by webhook)
  async updateConnectAccountStatus(
    accountId: string,
    status: {
      details_submitted: boolean;
      charges_enabled: boolean;
      payouts_enabled: boolean;
      requirements: any;
    }
  ): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('stripe_connect_accounts')
        .update({
          details_submitted: status.details_submitted,
          charges_enabled: status.charges_enabled,
          payouts_enabled: status.payouts_enabled,
          requirements: status.requirements,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', accountId);

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to update Connect account',
      };
    }
  }

  // Add payment method for customer
  async addPaymentMethod(userId: string, paymentMethodId: string): Promise<ApiResponse<PaymentMethod>> {
    try {
      // In a real app, this would call your backend to attach the payment method
      const response = await fetch('/api/stripe/add-payment-method', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({
          user_id: userId,
          payment_method_id: paymentMethodId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add payment method');
      }

      const data = await response.json();

      // Save payment method to database
      const { error: dbError } = await supabase
        .from('payment_methods')
        .insert({
          user_id: userId,
          stripe_payment_method_id: paymentMethodId,
          type: data.type,
          card_brand: data.card?.brand,
          card_last4: data.card?.last4,
          card_exp_month: data.card?.exp_month,
          card_exp_year: data.card?.exp_year,
          is_default: data.is_default || false,
          created_at: new Date().toISOString(),
        });

      if (dbError) {
        throw dbError;
      }

      return {
        success: true,
        data: data as PaymentMethod,
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to add payment method',
      };
    }
  }

  // Get customer payment methods
  async getPaymentMethods(userId: string): Promise<ApiResponse<PaymentMethod[]>> {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const paymentMethods = data.map((pm: any) => ({
        id: pm.stripe_payment_method_id,
        type: pm.type,
        card: {
          brand: pm.card_brand,
          last4: pm.card_last4,
          exp_month: pm.card_exp_month,
          exp_year: pm.card_exp_year,
        },
        is_default: pm.is_default,
      }));

      return {
        success: true,
        data: paymentMethods,
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get payment methods',
      };
    }
  }

  // Enhanced payment processing with cleaner split payments
  async processBookingPayment(
    bookingId: string,
    amount: number,
    cleanerAccountId: string,
    paymentMethodId: string,
    tip: number = 0
  ): Promise<ApiResponse<{
    paymentIntent: PaymentIntent;
    cleanerTransfer: any;
    platformFee: number;
  }>> {
    try {
      const breakdown = this.calculatePaymentBreakdown(amount, tip);
      
      // Create payment intent with automatic transfer to cleaner
      const paymentIntent = await this.createPaymentIntent(
        bookingId,
        breakdown.total,
        cleanerAccountId,
        paymentMethodId,
        tip
      );
      
      if (!paymentIntent.success) {
        return paymentIntent as any;
      }
      
      // Create immediate transfer to cleaner (after platform fee)
      const cleanerTransfer = await this.createCleanerTransfer(
        cleanerAccountId,
        breakdown.cleaner_amount,
        bookingId
      );
      
      return {
        success: true,
        data: {
          paymentIntent: paymentIntent.data,
          cleanerTransfer: cleanerTransfer.data,
          platformFee: breakdown.platform_fee,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Payment processing failed',
      };
    }
  }

  // Create payment intent for booking
  async createPaymentIntent(
    bookingId: string,
    amount: number,
    cleanerAccountId: string,
    paymentMethodId: string,
    tip: number = 0
  ): Promise<ApiResponse<PaymentIntent>> {
    try {
      const breakdown = this.calculatePaymentBreakdown(amount, tip);

      if (breakdown.total < STRIPE_CONFIG.minimumAmount) {
        throw new Error(`Minimum payment amount is $${STRIPE_CONFIG.minimumAmount / 100}`);
      }

      // Create payment intent via backend
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({
          booking_id: bookingId,
          amount: breakdown.total,
          application_fee_amount: breakdown.platform_fee,
          transfer_destination: cleanerAccountId,
          payment_method_id: paymentMethodId,
          currency: 'usd',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const data = await response.json();

      // Save payment record to database
      const { error: dbError } = await supabase
        .from('payments')
        .insert({
          booking_id: bookingId,
          stripe_payment_intent_id: data.id,
          amount: breakdown.total,
          platform_fee: breakdown.platform_fee,
          tip: breakdown.tip,
          cleaner_amount: breakdown.cleaner_amount,
          status: 'pending',
          created_at: new Date().toISOString(),
        });

      if (dbError) {
        throw dbError;
      }

      return {
        success: true,
        data: data as PaymentIntent,
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to create payment intent',
      };
    }
  }

  // Confirm payment
  async confirmPayment(paymentIntentId: string): Promise<ApiResponse<{ status: string }>> {
    try {
      const response = await fetch('/api/stripe/confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({
          payment_intent_id: paymentIntentId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm payment');
      }

      const data = await response.json();

      // Update payment status in database
      const { error: dbError } = await supabase
        .from('payments')
        .update({
          status: data.status,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntentId);

      if (dbError) {
        throw dbError;
      }

      return {
        success: true,
        data: { status: data.status },
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to confirm payment',
      };
    }
  }

  // Process refund
  async processRefund(
    paymentIntentId: string,
    amount?: number,
    reason: 'duplicate' | 'fraudulent' | 'requested_by_customer' = 'requested_by_customer'
  ): Promise<ApiResponse<{ refund_id: string; amount: number }>> {
    try {
      const response = await fetch('/api/stripe/create-refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({
          payment_intent_id: paymentIntentId,
          amount,
          reason,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process refund');
      }

      const data = await response.json();

      // Update payment record with refund info
      const { error: dbError } = await supabase
        .from('payments')
        .update({
          refund_id: data.refund_id,
          refund_amount: data.amount,
          refund_status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntentId);

      if (dbError) {
        throw dbError;
      }

      return {
        success: true,
        data: {
          refund_id: data.refund_id,
          amount: data.amount,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to process refund',
      };
    }
  }

  // Adjust tip amount (before payment is captured)
  async adjustTip(
    paymentIntentId: string,
    newTipAmount: number
  ): Promise<ApiResponse<PaymentBreakdown>> {
    try {
      if (newTipAmount < 0) {
        throw new Error('Tip amount cannot be negative');
      }

      // Get current payment details
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select('*')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .single();

      if (paymentError || !payment) {
        throw new Error('Payment not found');
      }

      const originalAmount = payment.amount - payment.tip;
      const newBreakdown = this.calculatePaymentBreakdown(originalAmount, newTipAmount);

      // Update payment intent amount via backend
      const response = await fetch('/api/stripe/update-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`,
        },
        body: JSON.stringify({
          payment_intent_id: paymentIntentId,
          amount: newBreakdown.total,
          application_fee_amount: newBreakdown.platform_fee,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update payment intent');
      }

      // Update payment record
      const { error: dbError } = await supabase
        .from('payments')
        .update({
          amount: newBreakdown.total,
          tip: newBreakdown.tip,
          cleaner_amount: newBreakdown.cleaner_amount,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_payment_intent_id', paymentIntentId);

      if (dbError) {
        throw dbError;
      }

      return {
        success: true,
        data: newBreakdown,
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to adjust tip',
      };
    }
  }

  // Get cleaner earnings summary
  async getCleanerEarnings(userId: string, period: 'week' | 'month' | 'all' = 'month'): Promise<ApiResponse<{
    total_earnings: number;
    total_jobs: number;
    average_rating: number;
    pending_payouts: number;
    last_payout_date?: string;
  }>> {
    try {
      let dateFilter = '';
      const now = new Date();

      switch (period) {
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = `and created_at >= '${weekAgo.toISOString()}'`;
          break;
        case 'month':
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          dateFilter = `and created_at >= '${monthAgo.toISOString()}'`;
          break;
        default:
          dateFilter = '';
      }

      // Get earnings from completed bookings
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          cleaner_amount,
          bookings!inner (
            cleaner_id,
            status,
            rating
          )
        `)
        .eq('bookings.cleaner_id', userId)
        .eq('bookings.status', 'completed')
        .eq('status', 'succeeded');

      if (paymentsError) {
        throw paymentsError;
      }

      const totalEarnings = payments?.reduce((sum: number, payment: any) => sum + payment.cleaner_amount, 0) || 0;
      const totalJobs = payments?.length || 0;
      const averageRating = payments?.reduce((sum: number, payment: any) => {
        return sum + (payment.bookings?.[0]?.rating || 0);
      }, 0) / Math.max(totalJobs, 1);

      // Get pending payouts (payments that haven't been transferred yet)
      const { data: pendingPayments, error: pendingError } = await supabase
        .from('payments')
        .select(`
          cleaner_amount,
          bookings!inner (cleaner_id)
        `)
        .eq('bookings.cleaner_id', userId)
        .eq('status', 'succeeded')
        .is('payout_date', null);

      if (pendingError) {
        throw pendingError;
      }

      const pendingPayouts = pendingPayments?.reduce((sum: number, payment: any) => sum + payment.cleaner_amount, 0) || 0;

      return {
        success: true,
        data: {
          total_earnings: totalEarnings,
          total_jobs: totalJobs,
          average_rating: Math.round(averageRating * 10) / 10,
          pending_payouts: pendingPayouts,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to get cleaner earnings',
      };
    }
  }

  // Handle webhook events (called by backend webhook handler)
  async handleWebhookEvent(event: any): Promise<void> {
    try {
      switch (event.type) {
        case 'account.updated':
          // Update Connect account status
          const account = event.data.object;
          await this.updateConnectAccountStatus(account.id, {
            details_submitted: account.details_submitted,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            requirements: account.requirements,
          });
          break;

        case 'payment_intent.succeeded':
          // Update payment status
          const paymentIntent = event.data.object;
          await supabase
            .from('payments')
            .update({
              status: 'succeeded',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_payment_intent_id', paymentIntent.id);
          break;

        case 'transfer.created':
          // Record payout to cleaner
          const transfer = event.data.object;
          await supabase
            .from('payments')
            .update({
              payout_date: new Date().toISOString(),
              transfer_id: transfer.id,
            })
            .eq('stripe_payment_intent_id', transfer.source_transaction);
          break;

        default:
          console.log('Unhandled webhook event:', event.type);
      }
    } catch (error) {
      console.error('Error handling webhook event:', error);
      throw error;
    }
  }

  // Helper method to get auth token for API calls
  private async getAuthToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  }
}

export const stripeService = new StripeService();

// Utility functions for formatting
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100);
};

export const formatPaymentBreakdown = (breakdown: PaymentBreakdown) => {
  return {
    subtotal: formatCurrency(breakdown.subtotal),
    platform_fee: formatCurrency(breakdown.platform_fee),
    tip: formatCurrency(breakdown.tip),
    total: formatCurrency(breakdown.total),
    cleaner_amount: formatCurrency(breakdown.cleaner_amount),
  };
}; 