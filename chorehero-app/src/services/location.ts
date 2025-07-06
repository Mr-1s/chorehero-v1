import * as Location from 'expo-location';
import { supabase } from './supabase';
import { ApiResponse } from '../types/api';
import { LocationUpdate } from '../types/booking';

interface LocationPermissions {
  foreground: boolean;
  background: boolean;
}

interface LocationTrackingOptions {
  accuracy: Location.Accuracy;
  timeInterval: number;
  distanceInterval: number;
  enableBackground?: boolean;
}

class LocationService {
  private currentLocationSubscription: Location.LocationSubscription | null = null;
  private isTracking = false;
  private lastLocationUpdate: Date | null = null;
  private trackingOptions: LocationTrackingOptions = {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000, // 5 seconds
    distanceInterval: 10, // 10 meters
    enableBackground: false,
  };

  // Check and request location permissions
  async requestPermissions(): Promise<ApiResponse<LocationPermissions>> {
    try {
      // Request foreground permissions first
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        return {
          success: false,
          data: { foreground: false, background: false },
          error: 'Location permission denied. Please enable location services to track your service.',
        };
      }

      // Check if background permissions are available and needed
      let backgroundStatus = 'granted';
      
      // Only request background permissions if device supports it
      const backgroundPermissions = await Location.getBackgroundPermissionsAsync();
      if (backgroundPermissions.status !== 'granted') {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        backgroundStatus = status;
      }

      return {
        success: true,
        data: {
          foreground: foregroundStatus === 'granted',
          background: backgroundStatus === 'granted',
        },
      };
    } catch (error) {
      return {
        success: false,
        data: { foreground: false, background: false },
        error: error instanceof Error ? error.message : 'Failed to request location permissions',
      };
    }
  }

  // Get current location
  async getCurrentLocation(): Promise<ApiResponse<Location.LocationObject>> {
    try {
      const permissionsResponse = await this.requestPermissions();
      
      if (!permissionsResponse.success || !permissionsResponse.data.foreground) {
        throw new Error(permissionsResponse.error || 'Location permissions required');
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        success: true,
        data: location,
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to get current location',
      };
    }
  }

  // Start location tracking for a booking
  async startTracking(
    bookingId: string,
    userId: string,
    options?: Partial<LocationTrackingOptions>
  ): Promise<ApiResponse<void>> {
    try {
      if (this.isTracking) {
        await this.stopTracking();
      }

      const permissionsResponse = await this.requestPermissions();
      
      if (!permissionsResponse.success || !permissionsResponse.data.foreground) {
        throw new Error(permissionsResponse.error || 'Location permissions required');
      }

      // Update tracking options
      this.trackingOptions = { ...this.trackingOptions, ...options };

      // Start location tracking
      this.currentLocationSubscription = await Location.watchPositionAsync(
        {
          accuracy: this.trackingOptions.accuracy,
          timeInterval: this.trackingOptions.timeInterval,
          distanceInterval: this.trackingOptions.distanceInterval,
        },
        async (location) => {
          await this.handleLocationUpdate(bookingId, userId, location);
        }
      );

      this.isTracking = true;
      
      // If background tracking is enabled and permitted, start background task
      if (this.trackingOptions.enableBackground && permissionsResponse.data.background) {
        await this.startBackgroundTracking(bookingId, userId);
      }

      return {
        success: true,
        data: undefined,
      };
    } catch (error) {
      return {
        success: false,
        data: undefined,
        error: error instanceof Error ? error.message : 'Failed to start location tracking',
      };
    }
  }

  // Stop location tracking
  async stopTracking(): Promise<void> {
    if (this.currentLocationSubscription) {
      this.currentLocationSubscription.remove();
      this.currentLocationSubscription = null;
    }

    this.isTracking = false;
    
    // Stop background task if running
    await Location.stopLocationUpdatesAsync('background-location-task');
  }

  // Handle location update
  private async handleLocationUpdate(
    bookingId: string,
    userId: string,
    location: Location.LocationObject
  ): Promise<void> {
    try {
      // Throttle updates to avoid too frequent database writes
      const now = new Date();
      if (this.lastLocationUpdate && 
          now.getTime() - this.lastLocationUpdate.getTime() < 3000) { // 3 seconds
        return;
      }

      const locationUpdate: Omit<LocationUpdate, 'id'> = {
        booking_id: bookingId,
        user_id: userId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        heading: location.coords.heading || undefined,
        speed: location.coords.speed || undefined,
        timestamp: now.toISOString(),
      };

      // Save to database
      const { error } = await supabase
        .from('location_updates')
        .insert(locationUpdate);

      if (error) {
        console.error('Failed to save location update:', error);
      } else {
        this.lastLocationUpdate = now;
      }
    } catch (error) {
      console.error('Error handling location update:', error);
    }
  }

  // Start background location tracking
  private async startBackgroundTracking(bookingId: string, userId: string): Promise<void> {
    try {
      await Location.startLocationUpdatesAsync('background-location-task', {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 15000, // 15 seconds for background
        distanceInterval: 50, // 50 meters for background
        foregroundService: {
          notificationTitle: 'ChoreHero Tracking',
          notificationBody: 'Tracking your location for service safety',
        },
      });
    } catch (error) {
      console.error('Failed to start background location tracking:', error);
    }
  }

  // Get location updates for a booking
  async getLocationUpdates(
    bookingId: string,
    startTime?: string,
    limit: number = 100
  ): Promise<ApiResponse<LocationUpdate[]>> {
    try {
      let query = supabase
        .from('location_updates')
        .select('*')
        .eq('booking_id', bookingId)
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (startTime) {
        query = query.gte('timestamp', startTime);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return {
        success: true,
        data: data as LocationUpdate[],
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get location updates',
      };
    }
  }

  // Calculate distance between two coordinates
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  }

  // Calculate ETA based on current location and destination
  async calculateETA(
    currentLat: number,
    currentLon: number,
    destLat: number,
    destLon: number,
    travelMode: 'walking' | 'driving' | 'transit' = 'driving'
  ): Promise<ApiResponse<{
    distance: number;
    duration: number;
    eta: string;
  }>> {
    try {
      // Calculate straight-line distance
      const straightLineDistance = this.calculateDistance(
        currentLat,
        currentLon,
        destLat,
        destLon
      );

      // Estimate travel time based on mode
      const speeds = {
        walking: 5, // km/h
        driving: 40, // km/h (city driving)
        transit: 25, // km/h (average with stops)
      };

      const estimatedHours = straightLineDistance / speeds[travelMode];
      const estimatedMinutes = Math.ceil(estimatedHours * 60);
      
      // Add buffer for real-world conditions
      const bufferedMinutes = Math.ceil(estimatedMinutes * 1.3);

      const eta = new Date(Date.now() + bufferedMinutes * 60 * 1000);

      return {
        success: true,
        data: {
          distance: straightLineDistance,
          duration: bufferedMinutes,
          eta: eta.toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to calculate ETA',
      };
    }
  }

  // Geocode address to coordinates
  async geocodeAddress(address: string): Promise<ApiResponse<{
    latitude: number;
    longitude: number;
    formattedAddress: string;
  }>> {
    try {
      const geocoded = await Location.geocodeAsync(address);
      
      if (geocoded.length === 0) {
        throw new Error('Address not found');
      }

      const result = geocoded[0];
      
      // Reverse geocode to get formatted address
      const reverseGeocoded = await Location.reverseGeocodeAsync({
        latitude: result.latitude,
        longitude: result.longitude,
      });

      const formattedAddress = reverseGeocoded.length > 0
        ? `${reverseGeocoded[0].street} ${reverseGeocoded[0].streetNumber}, ${reverseGeocoded[0].city}, ${reverseGeocoded[0].region}`
        : address;

      return {
        success: true,
        data: {
          latitude: result.latitude,
          longitude: result.longitude,
          formattedAddress,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to geocode address',
      };
    }
  }

  // Check if tracking is active
  getTrackingStatus(): {
    isTracking: boolean;
    lastUpdate: Date | null;
  } {
    return {
      isTracking: this.isTracking,
      lastUpdate: this.lastLocationUpdate,
    };
  }

  // Update tracking options
  updateTrackingOptions(options: Partial<LocationTrackingOptions>): void {
    this.trackingOptions = { ...this.trackingOptions, ...options };
  }
}

export const locationService = new LocationService();

// Background location task definition (for expo-location)
// Note: defineTask is not available in current expo-location version
// Background location handling would need to be implemented through TaskManager
// Location.defineTask('background-location-task', ({ data, error }: any) => {
//   if (error) {
//     console.error('Background location error:', error);
//     return;
//   }
//
//   if (data) {
//     const { locations } = data;
//     console.log('Background location update:', locations);
//   }
// });