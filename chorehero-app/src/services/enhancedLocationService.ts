import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';
import { ApiResponse } from '../types/api';

const LOCATION_TASK_NAME = 'background-location-task';

interface LocationUpdate {
  id: string;
  bookingId: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  address?: string;
  eta?: number;
}

interface TrackingSession {
  bookingId: string;
  userId: string;
  startTime: Date;
  isActive: boolean;
  lastUpdate?: LocationUpdate;
}

interface LocationServiceOptions {
  accuracy: Location.Accuracy;
  timeInterval: number;
  distanceInterval: number;
  enableBackground: boolean;
}

class EnhancedLocationService {
  private currentSession: TrackingSession | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private isTracking = false;
  private watchPositionId: number | null = null;

  private defaultOptions: LocationServiceOptions = {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000, // 5 seconds
    distanceInterval: 10, // 10 meters
    enableBackground: true,
  };

  async initialize(): Promise<void> {
    // Define background location task
    TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
      if (error) {
        console.error('Background location error:', error);
        return;
      }

      if (data) {
        const { locations } = data as any;
        this.handleBackgroundLocationUpdate(locations[0]);
      }
    });
  }

  async requestPermissions(): Promise<ApiResponse<{ foreground: boolean; background: boolean }>> {
    try {
      // Request foreground permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        return {
          success: false,
          data: { foreground: false, background: false },
          error: 'Location permission denied. Please enable location services.',
        };
      }

      // Request background permissions for job tracking
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
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

  async getCurrentLocation(): Promise<ApiResponse<{ latitude: number; longitude: number; address?: string }>> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        return {
          success: false,
          data: null as any,
          error: 'Location permission not granted',
        };
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      // Reverse geocode to get address
      const address = await this.reverseGeocode(
        location.coords.latitude,
        location.coords.longitude
      );

      return {
        success: true,
        data: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: address.data?.address,
        },
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Failed to get current location',
      };
    }
  }

  async startJobTracking(bookingId: string, userId: string): Promise<ApiResponse<boolean>> {
    try {
      if (this.isTracking) {
        await this.stopTracking();
      }

      const permissions = await this.requestPermissions();
      if (!permissions.success || !permissions.data.foreground) {
        return {
          success: false,
          data: false,
          error: 'Location permissions required for job tracking',
        };
      }

      // Create tracking session
      this.currentSession = {
        bookingId,
        userId,
        startTime: new Date(),
        isActive: true,
      };

      // Start foreground tracking
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: this.defaultOptions.accuracy,
          timeInterval: this.defaultOptions.timeInterval,
          distanceInterval: this.defaultOptions.distanceInterval,
        },
        (location) => {
          this.handleLocationUpdate(location);
        }
      );

      // Start background tracking if permitted
      if (permissions.data.background) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: this.defaultOptions.accuracy,
          timeInterval: this.defaultOptions.timeInterval,
          distanceInterval: this.defaultOptions.distanceInterval,
          foregroundService: {
            notificationTitle: 'ChoreHero - Job in Progress',
            notificationBody: 'Tracking location for customer safety',
          },
        });
      }

      this.isTracking = true;

      // Send initial status update
      await this.sendJobStatusUpdate(bookingId, 'tracking_started');

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to start job tracking',
      };
    }
  }

  async stopTracking(): Promise<void> {
    try {
      if (this.locationSubscription) {
        this.locationSubscription.remove();
        this.locationSubscription = null;
      }

      // Stop background tracking
      const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isRegistered) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      }

      if (this.currentSession) {
        await this.sendJobStatusUpdate(this.currentSession.bookingId, 'tracking_stopped');
        this.currentSession = null;
      }

      this.isTracking = false;
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }

  private async handleLocationUpdate(location: Location.LocationObject): Promise<void> {
    if (!this.currentSession) return;

    try {
      // Create location update record
      const locationUpdate: Omit<LocationUpdate, 'id'> = {
        bookingId: this.currentSession.bookingId,
        userId: this.currentSession.userId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        timestamp: new Date().toISOString(),
      };

      // Get address for significant location changes
      const address = await this.reverseGeocode(
        location.coords.latitude,
        location.coords.longitude
      );

      if (address.success) {
        locationUpdate.address = address.data?.address;
      }

      // Calculate ETA if destination is available
      const eta = await this.calculateETA(
        location.coords.latitude,
        location.coords.longitude,
        this.currentSession.bookingId
      );

      if (eta.success) {
        locationUpdate.eta = eta.data;
      }

      // Save to database
      const { error } = await supabase
        .from('location_updates')
        .insert(locationUpdate);

      if (error) throw error;

      // Update current session
      this.currentSession.lastUpdate = {
        ...locationUpdate,
        id: '', // Would be returned from database
      };

      // Broadcast location update to subscribers
      await this.broadcastLocationUpdate(locationUpdate);

    } catch (error) {
      console.error('Error handling location update:', error);
    }
  }

  private async handleBackgroundLocationUpdate(location: Location.LocationObject): Promise<void> {
    // Handle background location updates
    await this.handleLocationUpdate(location);
  }

  private async reverseGeocode(latitude: number, longitude: number): Promise<ApiResponse<{ address: string }>> {
    try {
      const result = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (result.length > 0) {
        const place = result[0];
        const address = [
          place.streetNumber,
          place.street,
          place.city,
          place.region,
          place.country,
        ].filter(Boolean).join(', ');

        return {
          success: true,
          data: { address },
        };
      }

      return {
        success: false,
        data: null as any,
        error: 'No address found for coordinates',
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : 'Geocoding failed',
      };
    }
  }

  private async calculateETA(
    currentLat: number,
    currentLng: number,
    bookingId: string
  ): Promise<ApiResponse<number>> {
    try {
      // Get booking destination
      const { data: booking, error } = await supabase
        .from('bookings')
        .select('address:address_id(latitude, longitude)')
        .eq('id', bookingId)
        .single();

      if (error || !booking?.address) {
        return {
          success: false,
          data: 0,
          error: 'Booking destination not found',
        };
      }

      const { latitude: destLat, longitude: destLng } = booking.address;

      // Calculate distance using Haversine formula
      const distance = this.calculateDistance(currentLat, currentLng, destLat, destLng);
      
      // Estimate travel time (assuming average speed of 40 km/h in city)
      const averageSpeed = 40; // km/h
      const etaMinutes = Math.round((distance / averageSpeed) * 60);

      return {
        success: true,
        data: etaMinutes,
      };
    } catch (error) {
      return {
        success: false,
        data: 0,
        error: error instanceof Error ? error.message : 'ETA calculation failed',
      };
    }
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private async broadcastLocationUpdate(locationUpdate: Omit<LocationUpdate, 'id'>): Promise<void> {
    try {
      // Broadcast via Supabase real-time
      await supabase
        .channel('location_updates')
        .send({
          type: 'broadcast',
          event: 'location_update',
          payload: locationUpdate,
        });
    } catch (error) {
      console.error('Error broadcasting location update:', error);
    }
  }

  private async sendJobStatusUpdate(bookingId: string, status: string): Promise<void> {
    try {
      await supabase
        .from('booking_status_updates')
        .insert({
          booking_id: bookingId,
          status,
          timestamp: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error sending job status update:', error);
    }
  }

  // Subscribe to location updates for a specific booking
  async subscribeToLocationUpdates(
    bookingId: string,
    callback: (update: LocationUpdate) => void
  ): Promise<() => void> {
    const channel = supabase
      .channel('location_updates')
      .on('broadcast', { event: 'location_update' }, (payload) => {
        if (payload.payload.bookingId === bookingId) {
          callback(payload.payload);
        }
      })
      .subscribe();

    // Return unsubscribe function
    return () => {
      channel.unsubscribe();
    };
  }

  // Get location history for a booking
  async getLocationHistory(bookingId: string): Promise<ApiResponse<LocationUpdate[]>> {
    try {
      const { data, error } = await supabase
        .from('location_updates')
        .select('*')
        .eq('booking_id', bookingId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      return {
        success: true,
        data: data || [],
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get location history',
      };
    }
  }

  // Share location with customer (one-time)
  async shareLocationWithCustomer(
    bookingId: string,
    customerId: string
  ): Promise<ApiResponse<boolean>> {
    try {
      const currentLocation = await this.getCurrentLocation();
      if (!currentLocation.success) {
        return currentLocation as any;
      }

      // Send location to customer via real-time channel
      await supabase
        .channel(`customer_${customerId}`)
        .send({
          type: 'broadcast',
          event: 'cleaner_location_shared',
          payload: {
            bookingId,
            location: currentLocation.data,
            timestamp: new Date().toISOString(),
          },
        });

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to share location',
      };
    }
  }

  // Get current tracking status
  getTrackingStatus(): {
    isTracking: boolean;
    currentSession: TrackingSession | null;
    lastUpdate: LocationUpdate | null;
  } {
    return {
      isTracking: this.isTracking,
      currentSession: this.currentSession,
      lastUpdate: this.currentSession?.lastUpdate || null,
    };
  }

  // Update tracking options
  updateTrackingOptions(options: Partial<LocationServiceOptions>): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }
}

export const enhancedLocationService = new EnhancedLocationService(); 