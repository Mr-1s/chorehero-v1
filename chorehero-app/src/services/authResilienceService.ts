import { supabase } from './supabase';
import { authService } from './auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiResponse } from '../types/api';

// ============================================================================
// AUTH RESILIENCE SERVICE
// Handles authentication failures during critical user flows
// ============================================================================

export interface CriticalFlowState {
  id: string;
  user_id: string;
  flow_type: 'booking' | 'payment' | 'service_completion' | 'message_send';
  flow_data: any;
  step: string;
  created_at: string;
  expires_at: string;
}

export interface AuthRecoveryResult {
  success: boolean;
  recovered_state?: CriticalFlowState;
  new_auth_token?: string;
  error?: string;
}

class AuthResilienceService {
  
  // ============================================================================
  // CRITICAL FLOW STATE PRESERVATION
  // ============================================================================
  
  /**
   * Save critical flow state before risky auth operations
   */
  async preserveCriticalFlow(
    flowType: CriticalFlowState['flow_type'],
    step: string,
    flowData: any,
    expiresInMinutes: number = 30
  ): Promise<ApiResponse<string>> {
    try {
      const user = await this.getCurrentUserSafely();
      if (!user) {
        throw new Error('No authenticated user to preserve state for');
      }

      const stateId = `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

      // Store in both local storage (immediate access) and database (persistence)
      const flowState: CriticalFlowState = {
        id: stateId,
        user_id: user.id,
        flow_type: flowType,
        flow_data: flowData,
        step: step,
        created_at: new Date().toISOString(),
        expires_at: expiresAt
      };

      // Store locally for immediate recovery
      await AsyncStorage.setItem(`critical_flow_${stateId}`, JSON.stringify(flowState));
      
      // Store in database for cross-device recovery
      const { error } = await supabase
        .from('critical_flow_states')
        .insert(flowState);

      if (error) {
        console.warn('⚠️ Failed to store flow state in database, continuing with local storage');
      }

      console.log('💾 Critical flow state preserved:', stateId, flowType, step);
      return { success: true, data: stateId };

    } catch (error) {
      console.error('❌ Failed to preserve critical flow state:', error);
      return {
        success: false,
        data: '',
        error: error instanceof Error ? error.message : 'Failed to preserve flow state'
      };
    }
  }

  /**
   * Recover critical flow state after auth recovery
   */
  async recoverCriticalFlow(stateId: string): Promise<ApiResponse<CriticalFlowState>> {
    try {
      // Try local storage first (faster)
      const localState = await AsyncStorage.getItem(`critical_flow_${stateId}`);
      if (localState) {
        const flowState: CriticalFlowState = JSON.parse(localState);
        
        // Check if not expired
        if (new Date(flowState.expires_at) > new Date()) {
          console.log('🔄 Recovered flow state from local storage:', stateId);
          return { success: true, data: flowState };
        } else {
          // Clean up expired state
          await AsyncStorage.removeItem(`critical_flow_${stateId}`);
        }
      }

      // Try database recovery
      const { data, error } = await supabase
        .from('critical_flow_states')
        .select('*')
        .eq('id', stateId)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error) throw error;

      console.log('🔄 Recovered flow state from database:', stateId);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Failed to recover critical flow state:', error);
      return {
        success: false,
        data: {} as CriticalFlowState,
        error: error instanceof Error ? error.message : 'Failed to recover flow state'
      };
    }
  }

  /**
   * Clean up completed or expired flow state
   */
  async cleanupFlowState(stateId: string): Promise<void> {
    try {
      // Remove from local storage
      await AsyncStorage.removeItem(`critical_flow_${stateId}`);
      
      // Remove from database
      await supabase
        .from('critical_flow_states')
        .delete()
        .eq('id', stateId);

      console.log('🧹 Cleaned up flow state:', stateId);
    } catch (error) {
      console.warn('⚠️ Failed to cleanup flow state:', error);
    }
  }

  // ============================================================================
  // AUTH RECOVERY WITH STATE RESTORATION
  // ============================================================================
  
  /**
   * Attempt to recover authentication and restore flow state
   */
  async recoverAuthWithFlow(stateId?: string): Promise<AuthRecoveryResult> {
    try {
      console.log('🔄 Attempting auth recovery with flow restoration');

      // Try to refresh the current session
      const refreshResult = await authService.refreshSession();
      
      if (refreshResult.success && refreshResult.data) {
        console.log('✅ Auth session refreshed successfully');
        
        // If we have a state ID, try to recover the flow
        if (stateId) {
          const flowResult = await this.recoverCriticalFlow(stateId);
          if (flowResult.success) {
            return {
              success: true,
              recovered_state: flowResult.data,
              new_auth_token: refreshResult.data.session.access_token
            };
          }
        }

        return {
          success: true,
          new_auth_token: refreshResult.data.session.access_token
        };
      }

      // Session refresh failed, user needs to re-authenticate
      console.log('❌ Session refresh failed, user needs to re-authenticate');
      return {
        success: false,
        error: 'Authentication session expired, please sign in again'
      };

    } catch (error) {
      console.error('❌ Auth recovery failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication recovery failed'
      };
    }
  }

  // ============================================================================
  // CRITICAL OPERATION WRAPPERS
  // ============================================================================
  
  /**
   * Execute critical operation with auth failure protection
   */
  async executeWithAuthProtection<T>(
    flowType: CriticalFlowState['flow_type'],
    step: string,
    flowData: any,
    operation: () => Promise<T>,
    maxRetries: number = 1
  ): Promise<T> {
    let attempt = 0;
    let lastError: Error | null = null;
    let stateId: string | null = null;

    while (attempt <= maxRetries) {
      try {
        // Preserve state before critical operation
        if (attempt === 0) {
          const preserveResult = await this.preserveCriticalFlow(flowType, step, flowData);
          if (preserveResult.success) {
            stateId = preserveResult.data;
          }
        }

        // Execute the operation
        const result = await operation();
        
        // Clean up state on success
        if (stateId) {
          await this.cleanupFlowState(stateId);
        }

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ Operation failed (attempt ${attempt + 1}):`, lastError.message);

        // Check if this is an auth error
        if (this.isAuthError(error) && attempt < maxRetries) {
          console.log('🔄 Auth error detected, attempting recovery');
          
          const recoveryResult = await this.recoverAuthWithFlow(stateId || undefined);
          if (recoveryResult.success) {
            console.log('✅ Auth recovered, retrying operation');
            attempt++;
            continue;
          } else {
            throw new Error(`Authentication failed: ${recoveryResult.error}`);
          }
        }

        // Not an auth error or max retries reached
        if (stateId) {
          console.log('📝 Operation failed, flow state preserved for manual recovery:', stateId);
        }
        throw lastError;
      }
    }

    throw lastError || new Error('Operation failed after all retries');
  }

  // ============================================================================
  // BOOKING FLOW SPECIFIC HELPERS
  // ============================================================================
  
  /**
   * Protected booking creation with state preservation
   */
  async createBookingWithProtection(bookingData: any): Promise<any> {
    return this.executeWithAuthProtection(
      'booking',
      'create_booking',
      bookingData,
      async () => {
        // Your actual booking creation logic here
        console.log('📅 Creating booking with auth protection');
        // TODO: Replace with actual booking service call
        return { success: true, booking_id: 'protected_booking_123' };
      }
    );
  }

  /**
   * Protected payment processing with state preservation
   */
  async processPaymentWithProtection(paymentData: any): Promise<any> {
    return this.executeWithAuthProtection(
      'payment',
      'process_payment',
      paymentData,
      async () => {
        // Your actual payment processing logic here
        console.log('💳 Processing payment with auth protection');
        // TODO: Replace with actual payment service call
        return { success: true, payment_intent_id: 'protected_payment_123' };
      }
    );
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  private async getCurrentUserSafely(): Promise<any> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user || null;
    } catch (error) {
      console.warn('⚠️ Failed to get current user:', error);
      return null;
    }
  }

  private isAuthError(error: any): boolean {
    if (!error) return false;
    
    const errorString = error.toString().toLowerCase();
    const authIndicators = [
      'auth',
      'unauthorized',
      'forbidden',
      'invalid_token',
      'expired_token',
      'access_denied',
      'jwt expired',
      'refresh_token'
    ];

    return authIndicators.some(indicator => errorString.includes(indicator));
  }

  /**
   * Get all preserved flow states for current user (for recovery UI)
   */
  async getUserFlowStates(): Promise<ApiResponse<CriticalFlowState[]>> {
    try {
      const user = await this.getCurrentUserSafely();
      if (!user) return { success: true, data: [] };

      const { data, error } = await supabase
        .from('critical_flow_states')
        .select('*')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get flow states'
      };
    }
  }

  /**
   * Cleanup expired flow states (cleanup job)
   */
  async cleanupExpiredStates(): Promise<number> {
    try {
      const { error } = await supabase
        .from('critical_flow_states')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) throw error;

      // Also cleanup local storage
      const keys = await AsyncStorage.getAllKeys();
      const flowKeys = keys.filter(key => key.startsWith('critical_flow_'));
      
      for (const key of flowKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const flowState = JSON.parse(data);
            if (new Date(flowState.expires_at) <= new Date()) {
              await AsyncStorage.removeItem(key);
            }
          }
        } catch (e) {
          // Clean up corrupted entries
          await AsyncStorage.removeItem(key);
        }
      }

      console.log('🧹 Cleaned up expired flow states');
      return flowKeys.length;
    } catch (error) {
      console.error('❌ Failed to cleanup expired states:', error);
      return 0;
    }
  }
}

export const authResilienceService = new AuthResilienceService();
