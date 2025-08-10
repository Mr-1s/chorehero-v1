import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Demo account credentials - these should match the demo ecosystem data
export const DEMO_ACCOUNTS = {
  customer: {
    id: 'a0b1c2d3-4e5f-6789-abcd-1234567890ab',
    email: 'demo.customer@chorehero.com',
    name: 'Demo Customer',
    role: 'customer',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop'
  },
  cleaner: {
    // We'll rotate between demo cleaners for variety
    sarah: {
      id: 'b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c',
      email: 'sarah.johnson@email.com',
      name: 'Sarah Johnson',
      role: 'cleaner',
      avatar_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b5bc?w=150&h=150&fit=crop'
    },
    marcus: {
      id: 'c1d8f7b3-9e2a-5f6c-ad4b-2e3f4a5b6c7d',
      email: 'marcus.rodriguez@email.com',
      name: 'Marcus Rodriguez',
      role: 'cleaner',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop'
    },
    emily: {
      id: 'd2e9a8c4-af3b-6e7d-be5c-3f4a5b6c7d8e',
      email: 'emily.chen@email.com',
      name: 'Emily Chen',
      role: 'cleaner',
      avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop'
    }
  }
};

/**
 * Demo Authentication Service
 * Simulates real authentication by storing demo user data locally
 * and providing it to the auth context
 */
class DemoAuthService {
  
  /**
   * Set demo user as "authenticated" locally
   */
  async setDemoUser(role: 'customer' | 'cleaner', cleanerType?: 'sarah' | 'marcus' | 'emily'): Promise<void> {
    try {
      let demoUser;
      
      if (role === 'customer') {
        demoUser = DEMO_ACCOUNTS.customer;
      } else {
        // Default to Sarah for cleaner, or use specified type
        const cleanerKey = cleanerType || 'sarah';
        demoUser = DEMO_ACCOUNTS.cleaner[cleanerKey];
      }
      
      // Store demo user data locally
      await AsyncStorage.setItem('demo_user_data', JSON.stringify(demoUser));
      await AsyncStorage.setItem('demo_user_role', role);
      
      console.log(`✅ Demo ${role} user set:`, demoUser.name, 'ID:', demoUser.id, 'Role:', demoUser.role);
    } catch (error) {
      console.error('❌ Error setting demo user:', error);
      throw error;
    }
  }
  
  /**
   * Get current demo user data
   */
  async getDemoUser(): Promise<any | null> {
    try {
      const demoUserData = await AsyncStorage.getItem('demo_user_data');
      const result = demoUserData ? JSON.parse(demoUserData) : null;
      console.log('📖 Getting demo user from storage:', result ? result.name : 'null');
      return result;
    } catch (error) {
      console.error('❌ Error getting demo user:', error);
      return null;
    }
  }
  
  /**
   * Clear demo authentication and all legacy demo sessions
   */
  async clearDemoUser(): Promise<void> {
    try {
      // Clear new demo system
      await AsyncStorage.removeItem('demo_user_data');
      await AsyncStorage.removeItem('demo_user_role');
      
      // Clear any legacy demo keys that might exist
      await AsyncStorage.removeItem('demo_customer');
      await AsyncStorage.removeItem('demo_cleaner');
      await AsyncStorage.removeItem('currentDemoUser');
      await AsyncStorage.removeItem('userRole');
      
      console.log('✅ All demo user sessions cleared');
    } catch (error) {
      console.error('❌ Error clearing demo user:', error);
    }
  }
  
  /**
   * Force clear ALL AsyncStorage for complete reset (debugging)
   */
  async forceResetAllSessions(): Promise<void> {
    try {
      // Get all keys and clear everything demo-related
      const allKeys = await AsyncStorage.getAllKeys();
      const demoKeys = allKeys.filter(key => 
        key.includes('demo') || 
        key.includes('user') || 
        key.includes('role') ||
        key.includes('auth')
      );
      
      if (demoKeys.length > 0) {
        await AsyncStorage.multiRemove(demoKeys);
        console.log('🧹 Force cleared all demo/user related keys:', demoKeys);
      }
    } catch (error) {
      console.error('❌ Error force clearing sessions:', error);
    }
  }
  
  /**
   * Check if user is currently using demo mode
   */
  async isDemoMode(): Promise<boolean> {
    try {
      const demoRole = await AsyncStorage.getItem('demo_user_role');
      return !!demoRole;
    } catch (error) {
      console.error('❌ Error checking demo mode:', error);
      return false;
    }
  }
  
  /**
   * Get demo user role
   */
  async getDemoRole(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('demo_user_role');
    } catch (error) {
      console.error('❌ Error getting demo role:', error);
      return null;
    }
  }
  
  /**
   * Create a demo booking from customer to cleaner
   * This connects demo accounts through the real booking system
   */
  async createDemoBooking(
    cleanerId: string,
    serviceId: number,
    scheduledDate: string,
    scheduledTime: string,
    instructions?: string
  ): Promise<{ success: boolean; bookingId?: string; error?: string }> {
    try {
      const demoUser = await this.getDemoUser();
      if (!demoUser || demoUser.role !== 'customer') {
        throw new Error('Must be demo customer to create bookings');
      }
      
      // Get demo customer address
      const { data: address, error: addressError } = await supabase
        .from('addresses')
        .select('id')
        .eq('user_id', demoUser.id)
        .single();
        
      if (addressError || !address) {
        throw new Error('Demo customer address not found');
      }
      
      // Create real booking in the system
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert([{
          customer_id: demoUser.id,
          cleaner_id: cleanerId,
          service_id: serviceId,
          address_id: address.id,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          estimated_duration_minutes: 120,
          total_price: 85.00,
          status: 'pending',
          special_instructions: instructions || 'Demo booking created from Heroes feed'
        }])
        .select()
        .single();
        
      if (bookingError) {
        throw bookingError;
      }
      
      console.log('✅ Demo booking created:', booking.id);
      return { success: true, bookingId: booking.id };
      
    } catch (error) {
      console.error('❌ Error creating demo booking:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create demo booking' 
      };
    }
  }
}

export const demoAuth = new DemoAuthService();
export default demoAuth;