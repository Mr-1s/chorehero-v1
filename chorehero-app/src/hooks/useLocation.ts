import { useState, useEffect, useCallback, useRef } from 'react';
import { locationService } from '../services/location';
import { subscribeToLocationUpdates } from '../services/supabase';
import { LocationUpdate } from '../types/booking';
import { ApiResponse } from '../types/api';
import * as Location from 'expo-location';

interface LocationState {
  currentLocation: Location.LocationObject | null;
  locationUpdates: LocationUpdate[];
  isTracking: boolean;
  hasPermissions: boolean;
  isLoading: boolean;
  error: string | null;
  eta: {
    distance: number;
    duration: number;
    arrivalTime: string;
  } | null;
}

interface UseLocationOptions {
  trackingEnabled?: boolean;
  backgroundTracking?: boolean;
  updateInterval?: number;
  distanceThreshold?: number;
}

export const useLocation = (
  bookingId?: string,
  userId?: string,
  options: UseLocationOptions = {}
) => {
  // State
  const [state, setState] = useState<LocationState>({
    currentLocation: null,
    locationUpdates: [],
    isTracking: false,
    hasPermissions: false,
    isLoading: false,
    error: null,
    eta: null,
  });

  // Refs
  const realtimeSubscription = useRef<any>(null);
  const locationUpdateTimer = useRef<any>(null);
  const etaUpdateTimer = useRef<any>(null);

  // Options with defaults
  const {
    trackingEnabled = false,
    backgroundTracking = false,
    updateInterval = 10000, // 10 seconds
    distanceThreshold = 50, // 50 meters
  } = options;

  // Request location permissions
  const requestPermissions = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await locationService.requestPermissions();
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          hasPermissions: response.data.foreground,
          isLoading: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to get location permissions',
          isLoading: false,
        }));
      }

      return response;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Permission request failed',
        isLoading: false,
      }));
      
      return {
        success: false,
        data: { foreground: false, background: false },
        error: 'Permission request failed',
      };
    }
  }, []);

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await locationService.getCurrentLocation();
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          currentLocation: response.data,
          isLoading: false,
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to get current location',
          isLoading: false,
        }));
      }

      return response;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Location fetch failed',
        isLoading: false,
      }));
      
      return {
        success: false,
        data: null,
        error: 'Location fetch failed',
      };
    }
  }, []);

  // Start location tracking
  const startTracking = useCallback(async () => {
    if (!bookingId || !userId) {
      setState(prev => ({
        ...prev,
        error: 'Booking ID and User ID required for tracking',
      }));
      return;
    }

    try {
      const response = await locationService.startTracking(bookingId, userId, {
        accuracy: Location.Accuracy.High,
        timeInterval: updateInterval,
        distanceInterval: distanceThreshold,
        enableBackground: backgroundTracking,
      });

      if (response.success) {
        setState(prev => ({
          ...prev,
          isTracking: true,
          error: null,
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: response.error || 'Failed to start tracking',
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Tracking start failed',
      }));
    }
  }, [bookingId, userId, updateInterval, distanceThreshold, backgroundTracking]);

  // Stop location tracking
  const stopTracking = useCallback(async () => {
    try {
      await locationService.stopTracking();
      
      setState(prev => ({
        ...prev,
        isTracking: false,
      }));
    } catch (error) {
      console.error('Failed to stop tracking:', error);
    }
  }, []);

  // Load location updates for the booking
  const loadLocationUpdates = useCallback(async () => {
    if (!bookingId) return;

    try {
      const response = await locationService.getLocationUpdates(bookingId);
      
      if (response.success) {
        setState(prev => ({
          ...prev,
          locationUpdates: response.data,
        }));
      }
    } catch (error) {
      console.error('Failed to load location updates:', error);
    }
  }, [bookingId]);

  // Calculate ETA to destination
  const calculateETA = useCallback(async (
    destinationLat: number,
    destinationLon: number,
    travelMode: 'walking' | 'driving' | 'transit' = 'driving'
  ) => {
    if (!state.currentLocation) {
      await getCurrentLocation();
      return;
    }

    try {
      const response = await locationService.calculateETA(
        state.currentLocation.coords.latitude,
        state.currentLocation.coords.longitude,
        destinationLat,
        destinationLon,
        travelMode
      );

      if (response.success) {
        setState(prev => ({
          ...prev,
          eta: {
            distance: response.data.distance,
            duration: response.data.duration,
            arrivalTime: response.data.eta,
          },
        }));
      }
    } catch (error) {
      console.error('Failed to calculate ETA:', error);
    }
  }, [state.currentLocation, getCurrentLocation]);

  // Subscribe to real-time location updates
  useEffect(() => {
    if (!bookingId) return;

    // Subscribe to location updates
    realtimeSubscription.current = subscribeToLocationUpdates(
      bookingId,
      (payload) => {
        const newUpdate = payload.new as LocationUpdate;
        
        setState(prev => ({
          ...prev,
          locationUpdates: [...prev.locationUpdates, newUpdate].slice(-100), // Keep last 100 updates
        }));
      }
    );

    return () => {
      if (realtimeSubscription.current) {
        realtimeSubscription.current.unsubscribe();
      }
    };
  }, [bookingId]);

  // Auto-update current location when tracking is enabled
  useEffect(() => {
    if (trackingEnabled && state.hasPermissions) {
      getCurrentLocation();
      
      // Set up periodic location updates
      locationUpdateTimer.current = setInterval(() => {
        getCurrentLocation();
      }, updateInterval);

      return () => {
        if (locationUpdateTimer.current) {
          clearInterval(locationUpdateTimer.current);
        }
      };
    }
  }, [trackingEnabled, state.hasPermissions, getCurrentLocation, updateInterval]);

  // Auto-start tracking when enabled
  useEffect(() => {
    if (trackingEnabled && bookingId && userId && state.hasPermissions && !state.isTracking) {
      startTracking();
    }
  }, [trackingEnabled, bookingId, userId, state.hasPermissions, state.isTracking, startTracking]);

  // Auto-update ETA periodically
  useEffect(() => {
    if (state.eta && state.currentLocation) {
      etaUpdateTimer.current = setInterval(() => {
        // Re-calculate ETA every minute
        // This would need destination coordinates passed in
      }, 60000); // 1 minute

      return () => {
        if (etaUpdateTimer.current) {
          clearInterval(etaUpdateTimer.current);
        }
      };
    }
  }, [state.eta, state.currentLocation]);

  // Load initial location updates
  useEffect(() => {
    loadLocationUpdates();
  }, [loadLocationUpdates]);

  // Request permissions on mount
  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (state.isTracking) {
        stopTracking();
      }
      
      if (locationUpdateTimer.current) {
        clearInterval(locationUpdateTimer.current);
      }
      
      if (etaUpdateTimer.current) {
        clearInterval(etaUpdateTimer.current);
      }
      
      if (realtimeSubscription.current) {
        realtimeSubscription.current.unsubscribe();
      }
    };
  }, [state.isTracking, stopTracking]);

  // Get latest location update for a specific user
  const getLatestUserLocation = useCallback((targetUserId: string) => {
    const userUpdates = state.locationUpdates.filter(
      update => update.user_id === targetUserId
    );
    
    return userUpdates.length > 0 
      ? userUpdates[userUpdates.length - 1]
      : null;
  }, [state.locationUpdates]);

  // Calculate distance to another location
  const getDistanceToLocation = useCallback((
    lat: number,
    lon: number
  ): number | null => {
    if (!state.currentLocation) return null;
    
    return locationService.calculateDistance(
      state.currentLocation.coords.latitude,
      state.currentLocation.coords.longitude,
      lat,
      lon
    );
  }, [state.currentLocation]);

  // Get formatted location display
  const getLocationDisplay = useCallback((location: LocationUpdate | Location.LocationObject | null) => {
    if (!location) return 'Unknown location';
    
    const coords = 'coords' in location ? location.coords : location;
    return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  }, []);

  // Check if location is stale (older than threshold)
  const isLocationStale = useCallback((
    location: LocationUpdate,
    thresholdMinutes: number = 5
  ): boolean => {
    const locationTime = new Date(location.timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - locationTime.getTime()) / (1000 * 60);
    
    return diffMinutes > thresholdMinutes;
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    requestPermissions,
    getCurrentLocation,
    startTracking,
    stopTracking,
    loadLocationUpdates,
    calculateETA,
    
    // Computed values
    hasRecentLocation: !!state.currentLocation,
    trackingStatus: locationService.getTrackingStatus(),
    
    // Utilities
    getLatestUserLocation,
    getDistanceToLocation,
    getLocationDisplay,
    isLocationStale,
    
    // Quick access to commonly needed values
    currentCoords: state.currentLocation?.coords || null,
    lastUpdate: state.locationUpdates[state.locationUpdates.length - 1] || null,
    isLocationAvailable: state.hasPermissions && !!state.currentLocation,
  };
};