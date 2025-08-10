import { supabase } from './supabase';
import { ApiResponse } from '../types/api';
import * as Haptics from 'expo-haptics';

// Dummy Wallet Configuration
const DUMMY_WALLET_CONFIG = {
  initialBalance: 50000, // $500.00 in cents
  testCardNumber: '4242424242424242',
  testExpiry: '12/28',
  testCVV: '123',
  platformFee: 0.30, // 30% platform fee
  cleanerRetention: 0.70, // 70% goes to cleaner
};

export interface DummyWalletBalance {
  customer_balance: number;
  cleaner_balance: number;
  platform_balance: number;
  total_spent: number;
  total_earned: number;
}

export interface DummyTransaction {
  id: string;
  user_id: string;
  type: 'payment' | 'payout' | 'refund' | 'tip';
  amount: number;
  description: string;
  booking_id?: string;
  cleaner_id?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  metadata?: {
    platform_fee?: number;
    cleaner_amount?: number;
    tip_amount?: number;
  };
}

export interface PaymentBreakdown {
  subtotal: number;
  tip: number;
  platform_fee: number;
  cleaner_amount: number;
  total: number;
}

class DummyWalletService {
  
  // ============================================================================
  // WALLET BALANCE MANAGEMENT
  // ============================================================================
  
  /**
   * Initialize dummy wallet for new user
   */
  async initializeDummyWallet(userId: string, role: 'customer' | 'cleaner'): Promise<ApiResponse<DummyWalletBalance>> {
    try {
      console.log('💰 Initializing dummy wallet for user:', userId, 'Role:', role);
      
      // Check if wallet already exists
      const { data: existingWallet } = await supabase
        .from('dummy_wallets')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (existingWallet) {
        return { success: true, data: existingWallet };
      }
      
      // Create new dummy wallet
      const initialBalance = role === 'customer' ? DUMMY_WALLET_CONFIG.initialBalance : 0;
      
      const { data: wallet, error } = await supabase
        .from('dummy_wallets')
        .insert({
          user_id: userId,
          customer_balance: initialBalance,
          cleaner_balance: 0,
          platform_balance: 0,
          total_spent: 0,
          total_earned: 0,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('✅ Dummy wallet created:', wallet);
      return { success: true, data: wallet };
      
    } catch (error) {
      console.error('❌ Error initializing dummy wallet:', error);
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to initialize wallet'
      };
    }
  }
  
  /**
   * Get current wallet balance
   */
  async getWalletBalance(userId: string): Promise<ApiResponse<DummyWalletBalance>> {
    try {
      const { data: wallet, error } = await supabase
        .from('dummy_wallets')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        // If wallet doesn't exist, create one
        if (error.code === 'PGRST116') {
          return this.initializeDummyWallet(userId, 'customer');
        }
        throw error;
      }
      
      return { success: true, data: wallet };
      
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to get wallet balance'
      };
    }
  }
  
  /**
   * Add funds to customer wallet (for testing)
   */
  async addFunds(userId: string, amount: number): Promise<ApiResponse<DummyWalletBalance>> {
    try {
      console.log('💵 Adding funds to wallet:', userId, 'Amount:', amount);
      
      const { data: wallet, error } = await supabase
        .from('dummy_wallets')
        .update({
          customer_balance: supabase.raw(`customer_balance + ${amount}`),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Record transaction
      await this.recordTransaction({
        user_id: userId,
        type: 'payment',
        amount: amount,
        description: 'Added test funds to wallet',
        status: 'completed',
      });
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return { success: true, data: wallet };
      
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to add funds'
      };
    }
  }
  
  // ============================================================================
  // PAYMENT PROCESSING
  // ============================================================================
  
  /**
   * Calculate payment breakdown with platform fee
   */
  calculatePaymentBreakdown(subtotal: number, tip: number = 0): PaymentBreakdown {
    const platformFee = Math.round(subtotal * DUMMY_WALLET_CONFIG.platformFee);
    const cleanerAmount = subtotal - platformFee + tip;
    const total = subtotal + tip;
    
    return {
      subtotal,
      tip,
      platform_fee: platformFee,
      cleaner_amount: cleanerAmount,
      total,
    };
  }
  
  /**
   * Process booking payment (dummy implementation)
   */
  async processBookingPayment(
    customerId: string,
    cleanerId: string,
    bookingId: string,
    amount: number,
    tip: number = 0
  ): Promise<ApiResponse<{
    transaction_id: string;
    breakdown: PaymentBreakdown;
  }>> {
    try {
      console.log('💳 Processing booking payment:', { customerId, cleanerId, bookingId, amount, tip });
      
      const breakdown = this.calculatePaymentBreakdown(amount, tip);
      
      // Check customer balance
      const { data: customerWallet } = await this.getWalletBalance(customerId);
      if (!customerWallet || customerWallet.customer_balance < breakdown.total) {
        throw new Error('Insufficient balance. Please add funds to your wallet.');
      }
      
      // Deduct from customer
      await supabase
        .from('dummy_wallets')
        .update({
          customer_balance: supabase.raw(`customer_balance - ${breakdown.total}`),
          total_spent: supabase.raw(`total_spent + ${breakdown.total}`),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', customerId);
      
      // Add to cleaner
      await supabase
        .from('dummy_wallets')
        .update({
          cleaner_balance: supabase.raw(`cleaner_balance + ${breakdown.cleaner_amount}`),
          total_earned: supabase.raw(`total_earned + ${breakdown.cleaner_amount}`),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', cleanerId);
      
      // Add to platform
      const platformUserId = '00000000-0000-0000-0000-000000000000';
      const { data: platformWallet } = await supabase
        .from('dummy_wallets')
        .select('*')
        .eq('user_id', platformUserId)
        .single();
      
      if (platformWallet) {
        await supabase
          .from('dummy_wallets')
          .update({
            platform_balance: supabase.raw(`platform_balance + ${breakdown.platform_fee}`),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', platformUserId);
      }
      
      // Record transaction
      const transactionId = await this.recordTransaction({
        user_id: customerId,
        type: 'payment',
        amount: breakdown.total,
        description: `Payment for booking #${bookingId}`,
        booking_id: bookingId,
        cleaner_id: cleanerId,
        status: 'completed',
        metadata: {
          platform_fee: breakdown.platform_fee,
          cleaner_amount: breakdown.cleaner_amount,
          tip_amount: tip,
        },
      });
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      console.log('✅ Payment processed successfully:', transactionId);
      return {
        success: true,
        data: {
          transaction_id: transactionId,
          breakdown,
        },
      };
      
    } catch (error) {
      console.error('❌ Payment processing failed:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Payment processing failed'
      };
    }
  }
  
  /**
   * Process cleaner payout (dummy implementation)
   */
  async processCleanerPayout(
    cleanerId: string,
    amount: number
  ): Promise<ApiResponse<{ payout_id: string }>> {
    try {
      console.log('💸 Processing cleaner payout:', cleanerId, 'Amount:', amount);
      
      // Check cleaner balance
      const { data: cleanerWallet } = await this.getWalletBalance(cleanerId);
      if (!cleanerWallet || cleanerWallet.cleaner_balance < amount) {
        throw new Error('Insufficient balance for payout');
      }
      
      // Deduct from cleaner balance
      await supabase
        .from('dummy_wallets')
        .update({
          cleaner_balance: supabase.raw(`cleaner_balance - ${amount}`),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', cleanerId);
      
      // Record payout transaction
      const payoutId = await this.recordTransaction({
        user_id: cleanerId,
        type: 'payout',
        amount: amount,
        description: `Payout to bank account`,
        status: 'completed',
      });
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      console.log('✅ Payout processed successfully:', payoutId);
      return {
        success: true,
        data: { payout_id: payoutId },
      };
      
    } catch (error) {
      console.error('❌ Payout processing failed:', error);
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Payout processing failed'
      };
    }
  }
  
  // ============================================================================
  // TRANSACTION MANAGEMENT
  // ============================================================================
  
  /**
   * Record transaction in database
   */
  private async recordTransaction(transaction: Omit<DummyTransaction, 'id' | 'created_at'>): Promise<string> {
    const { data, error } = await supabase
      .from('dummy_transactions')
      .insert({
        ...transaction,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    
    if (error) throw error;
    return data.id;
  }
  
  /**
   * Get transaction history
   */
  async getTransactionHistory(userId: string, limit: number = 20): Promise<ApiResponse<DummyTransaction[]>> {
    try {
      const { data: transactions, error } = await supabase
        .from('dummy_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return { success: true, data: transactions || [] };
      
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get transaction history'
      };
    }
  }
  
  // ============================================================================
  // TESTING UTILITIES
  // ============================================================================
  
  /**
   * Reset wallet for testing
   */
  async resetWallet(userId: string, role: 'customer' | 'cleaner'): Promise<ApiResponse<DummyWalletBalance>> {
    try {
      const initialBalance = role === 'customer' ? DUMMY_WALLET_CONFIG.initialBalance : 0;
      
      const { data: wallet, error } = await supabase
        .from('dummy_wallets')
        .update({
          customer_balance: role === 'customer' ? initialBalance : 0,
          cleaner_balance: 0,
          platform_balance: 0,
          total_spent: 0,
          total_earned: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Clear transaction history
      await supabase
        .from('dummy_transactions')
        .delete()
        .eq('user_id', userId);
      
      return { success: true, data: wallet };
      
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to reset wallet'
      };
    }
  }
  
  /**
   * Get platform analytics (for admin testing)
   */
  async getPlatformAnalytics(): Promise<ApiResponse<{
    total_revenue: number;
    total_payouts: number;
    active_users: number;
    transaction_volume: number;
  }>> {
    try {
      const { data: analytics, error } = await supabase
        .rpc('get_platform_analytics');
      
      if (error) throw error;
      
      return { success: true, data: analytics };
      
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to get platform analytics'
      };
    }
  }
}

export const dummyWalletService = new DummyWalletService();
export { DUMMY_WALLET_CONFIG };
