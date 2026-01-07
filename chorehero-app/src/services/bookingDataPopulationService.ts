/**
 * Booking Data Population Service
 * Auto-populates booking forms with user profile data
 */

import { supabase } from './supabase';
import { useAuth } from '../hooks/useAuth';

export interface UserProfileData {
  // Basic info
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  avatar_url?: string;
  
  // Address data
  primaryAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    apartmentNumber?: string;
    accessInstructions?: string;
    parkingInfo?: string;
  };
  
  // Preferences from customer profile
  preferences?: {
    productPreference: 'standard' | 'eco-friendly' | 'bring-own';
    budgetRange: 'budget' | 'standard' | 'premium';
    cleaningFrequency: 'one-time' | 'weekly' | 'bi-weekly' | 'monthly';
    preferredTimes: string[];
    
    // Household info
    hasPets: boolean;
    petInfo?: string;
    hasAllergies: boolean;
    allergyInfo?: string;
    hasChildren: boolean;
    specialInstructions?: string;
  };
  
  // Emergency contact
  emergencyContact?: {
    name: string;
    phone: string;
  };
  
  // Payment info
  defaultPaymentMethod?: string;
}

export interface PopulatedBookingData {
  // Contact info (auto-filled)
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  
  // Address info (auto-filled)
  address: string;
  city: string;
  state: string;
  zipCode: string;
  apartmentNumber: string;
  accessInstructions: string;
  parkingInfo: string;
  
  // Preferences (pre-selected based on profile)
  productPreference: string;
  cleaningFrequency: string;
  petInfo: string;
  specialRequests: string;
  
  // Payment (if available)
  paymentMethod: string;
  
  // Metadata
  populatedFields: string[]; // Track which fields were auto-populated
  populationSource: 'profile' | 'previous_booking' | 'manual';
  lastBookingPreferences?: any; // Copy preferences from last booking
}

class BookingDataPopulationService {
  
  /**
   * Get comprehensive user profile data for booking auto-population
   */
  async getUserProfileData(userId: string): Promise<UserProfileData | null> {
    try {
      // Get basic user info
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (userError || !user) {
        console.error('Error fetching user data:', userError);
        return null;
      }
      
      // Get customer profile with preferences
      const { data: customerProfile } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      // Get primary address
      const { data: addresses } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();
      
      // Parse special preferences from customer profile
      const preferences = this.parseCustomerPreferences(customerProfile?.special_preferences);
      
      // Build comprehensive profile data
      const profileData: UserProfileData = {
        firstName: this.extractFirstName(user.name),
        lastName: this.extractLastName(user.name),
        fullName: user.name,
        email: user.email,
        phone: user.phone,
        avatar_url: user.avatar_url,
        
        primaryAddress: addresses ? {
          street: addresses.street,
          city: addresses.city,
          state: addresses.state,
          zipCode: addresses.zip_code,
          apartmentNumber: addresses.apartment_number || '',
          accessInstructions: addresses.access_instructions || '',
          parkingInfo: addresses.parking_info || ''
        } : undefined,
        
        preferences: {
          productPreference: preferences.productPreference || 'standard',
          budgetRange: preferences.budgetRange || 'standard',
          cleaningFrequency: preferences.cleaningFrequency || 'bi-weekly',
          preferredTimes: preferences.preferredTimes || [],
          hasPets: preferences.hasPets || false,
          petInfo: preferences.petInfo || '',
          hasAllergies: preferences.hasAllergies || false,
          allergyInfo: preferences.allergyInfo || '',
          hasChildren: preferences.hasChildren || false,
          specialInstructions: preferences.specialInstructions || ''
        },
        
        emergencyContact: preferences.emergencyContact,
        defaultPaymentMethod: customerProfile?.default_payment_method
      };
      
      return profileData;
      
    } catch (error) {
      console.error('Error getting user profile data:', error);
      return null;
    }
  }
  
  /**
   * Auto-populate booking form data from user profile
   */
  async populateBookingForm(userId: string, cleanerId?: string): Promise<PopulatedBookingData> {
    try {
      // Get user profile data
      const profileData = await this.getUserProfileData(userId);
      
      // Get last booking preferences if available
      const lastBookingData = await this.getLastBookingPreferences(userId, cleanerId);
      
      // Build populated booking data
      const populatedData: PopulatedBookingData = {
        // Contact info (always populated from profile)
        contactName: profileData?.fullName || '',
        contactPhone: profileData?.phone || '',
        contactEmail: profileData?.email || '',
        
        // Address info (from primary address)
        address: profileData?.primaryAddress?.street || '',
        city: profileData?.primaryAddress?.city || '',
        state: profileData?.primaryAddress?.state || '',
        zipCode: profileData?.primaryAddress?.zipCode || '',
        apartmentNumber: profileData?.primaryAddress?.apartmentNumber || '',
        accessInstructions: profileData?.primaryAddress?.accessInstructions || '',
        parkingInfo: profileData?.primaryAddress?.parkingInfo || '',
        
        // Preferences (from profile or last booking)
        productPreference: lastBookingData?.productPreference || profileData?.preferences?.productPreference || 'standard',
        cleaningFrequency: lastBookingData?.cleaningFrequency || profileData?.preferences?.cleaningFrequency || 'one-time',
        petInfo: profileData?.preferences?.petInfo || '',
        specialRequests: profileData?.preferences?.specialInstructions || '',
        
        // Payment
        paymentMethod: profileData?.defaultPaymentMethod || '',
        
        // Track what was populated
        populatedFields: [],
        populationSource: lastBookingData ? 'previous_booking' : 'profile',
        lastBookingPreferences: lastBookingData
      };
      
      // Track which fields were auto-populated
      populatedData.populatedFields = this.getPopulatedFields(populatedData, profileData);
      
      console.log('✅ Booking form auto-populated:', {
        fieldsPopulated: populatedData.populatedFields.length,
        source: populatedData.populationSource
      });
      
      return populatedData;
      
    } catch (error) {
      console.error('Error populating booking form:', error);
      return this.getEmptyBookingData();
    }
  }
  
  /**
   * Get preferences from user's last booking (especially with same cleaner)
   */
  private async getLastBookingPreferences(userId: string, cleanerId?: string): Promise<any> {
    try {
      let query = supabase
        .from('bookings')
        .select('*')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false });
      
      // Prioritize bookings with the same cleaner
      if (cleanerId) {
        const { data: sameCleanerBookings } = await query
          .eq('cleaner_id', cleanerId)
          .limit(1);
          
        if (sameCleanerBookings && sameCleanerBookings.length > 0) {
          return this.extractBookingPreferences(sameCleanerBookings[0]);
        }
      }
      
      // Fall back to any recent booking
      const { data: recentBookings } = await query.limit(1);
      
      if (recentBookings && recentBookings.length > 0) {
        return this.extractBookingPreferences(recentBookings[0]);
      }
      
      return null;
      
    } catch (error) {
      console.error('Error getting last booking preferences:', error);
      return null;
    }
  }
  
  /**
   * Extract booking preferences from a booking record
   */
  private extractBookingPreferences(booking: any): any {
    return {
      serviceType: booking.service_type,
      cleaningType: booking.cleaning_type,
      productPreference: booking.product_preference,
      cleaningFrequency: booking.frequency,
      estimatedDuration: booking.estimated_duration,
      rooms: booking.rooms ? JSON.parse(booking.rooms) : [],
      specialRequests: booking.special_requests,
      cleanerGender: booking.cleaner_gender_preference,
      isRecurring: booking.is_recurring,
      recurringFrequency: booking.recurring_frequency
    };
  }
  
  /**
   * Parse customer preferences from special_preferences text field
   */
  private parseCustomerPreferences(specialPreferences?: string): any {
    if (!specialPreferences) return {};
    
    const preferences: any = {};
    
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(specialPreferences);
      return parsed;
    } catch {
      // Fall back to text parsing
      const lines = specialPreferences.split('\n');
      
      lines.forEach(line => {
        if (line.includes('Pets:')) {
          preferences.hasPets = line.includes('Yes');
          if (preferences.hasPets) {
            const petMatch = line.match(/Yes - (.+)/);
            preferences.petInfo = petMatch ? petMatch[1] : '';
          }
        }
        
        if (line.includes('Allergies:')) {
          preferences.hasAllergies = line.includes('Yes');
          if (preferences.hasAllergies) {
            const allergyMatch = line.match(/Yes - (.+)/);
            preferences.allergyInfo = allergyMatch ? allergyMatch[1] : '';
          }
        }
        
        if (line.includes('Children:')) {
          preferences.hasChildren = line.includes('Yes');
        }
        
        if (line.includes('Cleaning Frequency:')) {
          const freqMatch = line.match(/Cleaning Frequency: (.+)/);
          preferences.cleaningFrequency = freqMatch ? freqMatch[1].toLowerCase().replace('-', '_') : 'bi-weekly';
        }
        
        if (line.includes('Preferred Products:')) {
          const productMatch = line.match(/Preferred Products: (.+)/);
          preferences.productPreference = productMatch ? productMatch[1].toLowerCase().replace(' ', '_').replace('-', '_') : 'standard';
        }
        
        if (line.includes('Budget:')) {
          const budgetMatch = line.match(/Budget: (.+)/);
          preferences.budgetRange = budgetMatch ? budgetMatch[1].toLowerCase() : 'standard';
        }
      });
      
      return preferences;
    }
  }
  
  /**
   * Extract first name from full name
   */
  private extractFirstName(fullName: string): string {
    if (!fullName) return '';
    return fullName.split(' ')[0];
  }
  
  /**
   * Extract last name from full name
   */
  private extractLastName(fullName: string): string {
    if (!fullName) return '';
    const parts = fullName.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : '';
  }
  
  /**
   * Get list of fields that were auto-populated
   */
  private getPopulatedFields(populatedData: PopulatedBookingData, profileData: UserProfileData | null): string[] {
    const fields: string[] = [];
    
    if (populatedData.contactName) fields.push('contactName');
    if (populatedData.contactPhone) fields.push('contactPhone');
    if (populatedData.contactEmail) fields.push('contactEmail');
    if (populatedData.address) fields.push('address');
    if (populatedData.city) fields.push('city');
    if (populatedData.state) fields.push('state');
    if (populatedData.zipCode) fields.push('zipCode');
    if (populatedData.apartmentNumber) fields.push('apartmentNumber');
    if (populatedData.accessInstructions) fields.push('accessInstructions');
    if (populatedData.parkingInfo) fields.push('parkingInfo');
    if (populatedData.productPreference !== 'standard') fields.push('productPreference');
    if (populatedData.petInfo) fields.push('petInfo');
    if (populatedData.specialRequests) fields.push('specialRequests');
    if (populatedData.paymentMethod) fields.push('paymentMethod');
    
    return fields;
  }
  
  /**
   * Get empty booking data structure
   */
  private getEmptyBookingData(): PopulatedBookingData {
    return {
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      apartmentNumber: '',
      accessInstructions: '',
      parkingInfo: '',
      productPreference: 'standard',
      cleaningFrequency: 'one-time',
      petInfo: '',
      specialRequests: '',
      paymentMethod: '',
      populatedFields: [],
      populationSource: 'manual'
    };
  }
  
  /**
   * Update user preferences based on booking choices
   */
  async updateUserPreferencesFromBooking(userId: string, bookingData: any): Promise<void> {
    try {
      // Extract preferences that should be saved for future bookings
      const updatedPreferences = {
        productPreference: bookingData.productPreference,
        cleaningFrequency: bookingData.cleaningFrequency,
        petInfo: bookingData.petInfo,
        specialInstructions: bookingData.specialRequests
      };
      
      // Update customer profile with new preferences
      const { error } = await supabase
        .from('customer_profiles')
        .update({
          special_preferences: JSON.stringify(updatedPreferences),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error updating user preferences:', error);
      } else {
        console.log('✅ User preferences updated from booking');
      }
      
    } catch (error) {
      console.error('Error updating user preferences from booking:', error);
    }
  }
}

export const bookingDataPopulationService = new BookingDataPopulationService();
