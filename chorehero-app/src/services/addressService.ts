/**
 * Comprehensive Address Management Service
 * Handles address CRUD operations, validation, and geocoding
 */

import { supabase } from './supabase';

// Types
export interface Address {
  id: string;
  user_id: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  latitude?: number;
  longitude?: number;
  is_primary: boolean;
  address_type: 'home' | 'work' | 'other';
  special_instructions?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAddressRequest {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
  address_type?: 'home' | 'work' | 'other';
  special_instructions?: string;
  is_primary?: boolean;
}

export interface UpdateAddressRequest {
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  address_type?: 'home' | 'work' | 'other';
  special_instructions?: string;
  is_primary?: boolean;
}

export interface AddressValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions?: Address[];
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

class AddressService {
  
  // ============================================================================
  // CORE ADDRESS OPERATIONS
  // ============================================================================
  
  /**
   * Create a new address for a user
   */
  async createAddress(userId: string, addressData: CreateAddressRequest): Promise<ApiResponse<Address>> {
    try {
      console.log('🏠 Creating address for user:', userId);

      // Validate address data
      const validation = this.validateAddressData(addressData);
      if (!validation.isValid) {
        throw new Error(`Invalid address data: ${validation.errors.join(', ')}`);
      }

      // If this is set as primary, unset other primary addresses
      if (addressData.is_primary) {
        await this.unsetPrimaryAddresses(userId);
      }

      // Geocode the address to get coordinates
      let coordinates: GeocodeResult | null = null;
      try {
        coordinates = await this.geocodeAddress(addressData);
      } catch (geocodeError) {
        console.warn('⚠️ Geocoding failed, proceeding without coordinates:', geocodeError);
      }

      // Create the address
      const { data: newAddress, error } = await supabase
        .from('addresses')
        .insert([{
          user_id: userId,
          address_line1: addressData.address_line1,
          address_line2: addressData.address_line2,
          city: addressData.city,
          state: addressData.state,
          zip_code: addressData.zip_code,
          country: addressData.country || 'United States',
          address_type: addressData.address_type || 'home',
          special_instructions: addressData.special_instructions,
          is_primary: addressData.is_primary || false,
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude
        }])
        .select('*')
        .single();

      if (error) throw error;

      console.log('✅ Address created successfully:', newAddress.id);
      return { success: true, data: newAddress as Address };

    } catch (error) {
      console.error('❌ Error creating address:', error);
      return {
        success: false,
        data: {} as Address,
        error: error instanceof Error ? error.message : 'Failed to create address'
      };
    }
  }

  /**
   * Get all addresses for a user
   */
  async getUserAddresses(userId: string): Promise<ApiResponse<Address[]>> {
    try {
      console.log('📋 Getting addresses for user:', userId);

      const { data: addresses, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log(`✅ Got ${addresses?.length || 0} addresses`);
      return { success: true, data: addresses as Address[] || [] };

    } catch (error) {
      console.error('❌ Error getting user addresses:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get addresses'
      };
    }
  }

  /**
   * Get a specific address by ID
   */
  async getAddressById(addressId: string, userId?: string): Promise<ApiResponse<Address>> {
    try {
      console.log('🔍 Getting address by ID:', addressId);

      let query = supabase
        .from('addresses')
        .select('*')
        .eq('id', addressId);

      // If userId provided, ensure user owns the address
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: address, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Address not found');
        }
        throw error;
      }

      console.log('✅ Got address:', address.id);
      return { success: true, data: address as Address };

    } catch (error) {
      console.error('❌ Error getting address:', error);
      return {
        success: false,
        data: {} as Address,
        error: error instanceof Error ? error.message : 'Failed to get address'
      };
    }
  }

  /**
   * Update an existing address
   */
  async updateAddress(
    addressId: string, 
    userId: string, 
    updates: UpdateAddressRequest
  ): Promise<ApiResponse<Address>> {
    try {
      console.log('✏️ Updating address:', addressId);

      // Validate updates if provided
      if (Object.keys(updates).some(key => ['address_line1', 'city', 'state', 'zip_code'].includes(key))) {
        const validation = this.validateAddressData(updates as CreateAddressRequest);
        if (!validation.isValid) {
          throw new Error(`Invalid address data: ${validation.errors.join(', ')}`);
        }
      }

      // If setting as primary, unset other primary addresses
      if (updates.is_primary) {
        await this.unsetPrimaryAddresses(userId);
      }

      // If address components changed, re-geocode
      let coordinates: GeocodeResult | null = null;
      if (updates.address_line1 || updates.city || updates.state || updates.zip_code) {
        try {
          // Get current address to merge with updates
          const { data: currentAddress } = await this.getAddressById(addressId, userId);
          if (currentAddress) {
            const fullAddress = { ...currentAddress, ...updates };
            coordinates = await this.geocodeAddress(fullAddress);
          }
        } catch (geocodeError) {
          console.warn('⚠️ Geocoding failed during update:', geocodeError);
        }
      }

      // Update the address
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      if (coordinates) {
        updateData.latitude = coordinates.latitude;
        updateData.longitude = coordinates.longitude;
      }

      const { data: updatedAddress, error } = await supabase
        .from('addresses')
        .update(updateData)
        .eq('id', addressId)
        .eq('user_id', userId) // Ensure user owns the address
        .select('*')
        .single();

      if (error) throw error;

      console.log('✅ Address updated successfully');
      return { success: true, data: updatedAddress as Address };

    } catch (error) {
      console.error('❌ Error updating address:', error);
      return {
        success: false,
        data: {} as Address,
        error: error instanceof Error ? error.message : 'Failed to update address'
      };
    }
  }

  /**
   * Delete an address
   */
  async deleteAddress(addressId: string, userId: string): Promise<ApiResponse<boolean>> {
    try {
      console.log('🗑️ Deleting address:', addressId);

      // Check if this is the user's only address
      const { data: userAddresses } = await this.getUserAddresses(userId);
      if (userAddresses && userAddresses.length === 1 && userAddresses[0].id === addressId) {
        throw new Error('Cannot delete your only address');
      }

      // Check if this address is used in any active bookings
      const { data: activeBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('id')
        .eq('address_id', addressId)
        .in('status', ['pending', 'confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress']);

      if (bookingsError) throw bookingsError;

      if (activeBookings && activeBookings.length > 0) {
        throw new Error('Cannot delete address with active bookings');
      }

      // Delete the address
      const { error } = await supabase
        .from('addresses')
        .delete()
        .eq('id', addressId)
        .eq('user_id', userId);

      if (error) throw error;

      // If this was the primary address, set another address as primary
      const { data: remainingAddresses } = await this.getUserAddresses(userId);
      if (remainingAddresses && remainingAddresses.length > 0 && !remainingAddresses.some(addr => addr.is_primary)) {
        await this.setPrimaryAddress(remainingAddresses[0].id, userId);
      }

      console.log('✅ Address deleted successfully');
      return { success: true, data: true };

    } catch (error) {
      console.error('❌ Error deleting address:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to delete address'
      };
    }
  }

  /**
   * Set an address as primary
   */
  async setPrimaryAddress(addressId: string, userId: string): Promise<ApiResponse<boolean>> {
    try {
      console.log('⭐ Setting primary address:', addressId);

      // Unset all primary addresses for user
      await this.unsetPrimaryAddresses(userId);

      // Set the specified address as primary
      const { error } = await supabase
        .from('addresses')
        .update({ 
          is_primary: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', addressId)
        .eq('user_id', userId);

      if (error) throw error;

      console.log('✅ Primary address set successfully');
      return { success: true, data: true };

    } catch (error) {
      console.error('❌ Error setting primary address:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to set primary address'
      };
    }
  }

  /**
   * Get user's primary address
   */
  async getPrimaryAddress(userId: string): Promise<ApiResponse<Address | null>> {
    try {
      console.log('🏡 Getting primary address for user:', userId);

      const { data: address, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      console.log('✅ Got primary address:', address?.id || 'none');
      return { success: true, data: address as Address || null };

    } catch (error) {
      console.error('❌ Error getting primary address:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get primary address'
      };
    }
  }

  // ============================================================================
  // ADDRESS VALIDATION & GEOCODING
  // ============================================================================

  /**
   * Validate address data
   */
  private validateAddressData(addressData: Partial<CreateAddressRequest>): AddressValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!addressData.address_line1?.trim()) {
      errors.push('Address line 1 is required');
    }
    if (!addressData.city?.trim()) {
      errors.push('City is required');
    }
    if (!addressData.state?.trim()) {
      errors.push('State is required');
    }
    if (!addressData.zip_code?.trim()) {
      errors.push('ZIP code is required');
    }

    // Format validation
    if (addressData.zip_code && !/^\d{5}(-\d{4})?$/.test(addressData.zip_code)) {
      errors.push('Invalid ZIP code format');
    }

    // Length validation
    if (addressData.address_line1 && addressData.address_line1.length > 255) {
      errors.push('Address line 1 too long');
    }
    if (addressData.address_line2 && addressData.address_line2.length > 255) {
      errors.push('Address line 2 too long');
    }
    if (addressData.city && addressData.city.length > 100) {
      errors.push('City name too long');
    }
    if (addressData.special_instructions && addressData.special_instructions.length > 500) {
      errors.push('Special instructions too long');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Geocode an address to get coordinates
   */
  private async geocodeAddress(addressData: Partial<Address>): Promise<GeocodeResult> {
    // In production, you would use a geocoding service like Google Maps API
    // For now, return mock coordinates based on city/state
    
    const fullAddress = `${addressData.address_line1}, ${addressData.city}, ${addressData.state} ${addressData.zip_code}`;
    
    // Mock geocoding - in production, use actual geocoding service
    const mockCoordinates = this.getMockCoordinates(addressData.city || '', addressData.state || '');
    
    return {
      latitude: mockCoordinates.lat,
      longitude: mockCoordinates.lng,
      formatted_address: fullAddress
    };
  }

  /**
   * Get mock coordinates for testing (replace with real geocoding)
   */
  private getMockCoordinates(city: string, state: string): { lat: number; lng: number } {
    // Mock coordinates for major cities
    const cityCoordinates: { [key: string]: { lat: number; lng: number } } = {
      'new york': { lat: 40.7128, lng: -74.0060 },
      'los angeles': { lat: 34.0522, lng: -118.2437 },
      'chicago': { lat: 41.8781, lng: -87.6298 },
      'houston': { lat: 29.7604, lng: -95.3698 },
      'phoenix': { lat: 33.4484, lng: -112.0740 },
      'philadelphia': { lat: 39.9526, lng: -75.1652 },
      'san antonio': { lat: 29.4241, lng: -98.4936 },
      'san diego': { lat: 32.7157, lng: -117.1611 },
      'dallas': { lat: 32.7767, lng: -96.7970 },
      'san jose': { lat: 37.3382, lng: -121.8863 }
    };

    const cityKey = city.toLowerCase();
    if (cityCoordinates[cityKey]) {
      return cityCoordinates[cityKey];
    }

    // Default to center of US with some randomization
    return {
      lat: 39.8283 + (Math.random() - 0.5) * 10,
      lng: -98.5795 + (Math.random() - 0.5) * 20
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Unset all primary addresses for a user
   */
  private async unsetPrimaryAddresses(userId: string): Promise<void> {
    await supabase
      .from('addresses')
      .update({ is_primary: false })
      .eq('user_id', userId)
      .eq('is_primary', true);
  }

  /**
   * Format address for display
   */
  formatAddress(address: Address, includeSpecialInstructions: boolean = false): string {
    let formatted = address.address_line1;
    
    if (address.address_line2) {
      formatted += `, ${address.address_line2}`;
    }
    
    formatted += `, ${address.city}, ${address.state} ${address.zip_code}`;
    
    if (includeSpecialInstructions && address.special_instructions) {
      formatted += `\n${address.special_instructions}`;
    }
    
    return formatted;
  }

  /**
   * Calculate distance between two addresses
   */
  calculateDistance(address1: Address, address2: Address): number | null {
    if (!address1.latitude || !address1.longitude || !address2.latitude || !address2.longitude) {
      return null;
    }

    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(address2.latitude - address1.latitude);
    const dLon = this.toRadians(address2.longitude - address1.longitude);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(address1.latitude)) * Math.cos(this.toRadians(address2.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in miles
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Search addresses by query
   */
  async searchAddresses(userId: string, query: string): Promise<ApiResponse<Address[]>> {
    try {
      console.log('🔍 Searching addresses for user:', userId, 'Query:', query);

      const { data: addresses, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .or(`address_line1.ilike.%${query}%,address_line2.ilike.%${query}%,city.ilike.%${query}%`)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log(`✅ Found ${addresses?.length || 0} matching addresses`);
      return { success: true, data: addresses as Address[] || [] };

    } catch (error) {
      console.error('❌ Error searching addresses:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to search addresses'
      };
    }
  }
}

export const addressService = new AddressService();
export default addressService;