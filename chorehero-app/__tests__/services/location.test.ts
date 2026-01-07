import { locationService } from '../../src/services/location';
import * as Location from 'expo-location';
import { supabase } from '../../src/services/supabase';

// Mock expo-location
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  geocodeAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  Accuracy: {
    High: 'high',
    Balanced: 'balanced',
  },
}));

// Mock supabase
jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
    })),
  },
}));

describe('LocationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('requestPermissions', () => {
    it('should request and return permissions successfully', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await locationService.requestPermissions();

      expect(result.success).toBe(true);
      expect(result.data.foreground).toBe(true);
      expect(result.data.background).toBe(true);
    });

    it('should handle foreground permission denial', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await locationService.requestPermissions();

      expect(result.success).toBe(false);
      expect(result.data.foreground).toBe(false);
      expect(result.data.background).toBe(false);
      expect(result.error).toContain('Location permission denied');
    });

    it('should handle background permission denial gracefully', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await locationService.requestPermissions();

      expect(result.success).toBe(true);
      expect(result.data.foreground).toBe(true);
      expect(result.data.background).toBe(false);
    });

    it('should handle permission request errors', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockRejectedValue(
        new Error('Permission request failed')
      );

      const result = await locationService.requestPermissions();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission request failed');
    });
  });

  describe('getCurrentLocation', () => {
    it('should get current location successfully', async () => {
      const mockLocation = {
        coords: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          altitude: 20,
          heading: 180,
          speed: 5,
        },
        timestamp: Date.now(),
      };

      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue(mockLocation);

      const result = await locationService.getCurrentLocation();

      expect(result.success).toBe(true);
      expect(result.data.coords.latitude).toBe(37.7749);
      expect(result.data.coords.longitude).toBe(-122.4194);
    });

    it('should handle location permission failure', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await locationService.getCurrentLocation();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Location permission denied');
    });

    it('should handle location fetch failure', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getCurrentPositionAsync as jest.Mock).mockRejectedValue(
        new Error('Location unavailable')
      );

      const result = await locationService.getCurrentLocation();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Location unavailable');
    });
  });

  describe('startTracking', () => {
    it('should start location tracking successfully', async () => {
      const mockSubscription = {
        remove: jest.fn(),
      };

      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.watchPositionAsync as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await locationService.startTracking(
        'booking-123',
        'user-456'
      );

      expect(result.success).toBe(true);
      expect(Location.watchPositionAsync).toHaveBeenCalled();
    });

    it('should handle tracking start failure', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await locationService.startTracking(
        'booking-123',
        'user-456'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Location permissions required');
    });

    it('should stop existing tracking before starting new', async () => {
      const mockSubscription1 = { remove: jest.fn() };
      const mockSubscription2 = { remove: jest.fn() };

      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.watchPositionAsync as jest.Mock)
        .mockResolvedValueOnce(mockSubscription1)
        .mockResolvedValueOnce(mockSubscription2);

      // Start first tracking
      await locationService.startTracking('booking-123', 'user-456');

      // Start second tracking
      await locationService.startTracking('booking-456', 'user-789');

      expect(mockSubscription1.remove).toHaveBeenCalled();
    });
  });

  describe('stopTracking', () => {
    it('should stop tracking successfully', async () => {
      const mockSubscription = { remove: jest.fn() };

      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.watchPositionAsync as jest.Mock).mockResolvedValue(mockSubscription);

      // Start tracking first
      await locationService.startTracking('booking-123', 'user-456');

      // Stop tracking
      await locationService.stopTracking();

      expect(mockSubscription.remove).toHaveBeenCalled();
      expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(
        'background-location-task'
      );
    });

    it('should handle stop tracking when not tracking', async () => {
      // Should not throw when stopping without active tracking
      await expect(locationService.stopTracking()).resolves.toBeUndefined();
    });
  });

  describe('calculateDistance', () => {
    it('should calculate distance between coordinates correctly', () => {
      // Distance between San Francisco and Los Angeles (approximate)
      const distance = locationService.calculateDistance(
        37.7749, // SF lat
        -122.4194, // SF lng
        34.0522, // LA lat
        -118.2437 // LA lng
      );

      // Should be approximately 559 km
      expect(distance).toBeGreaterThan(550);
      expect(distance).toBeLessThan(570);
    });

    it('should return 0 for same coordinates', () => {
      const distance = locationService.calculateDistance(
        37.7749,
        -122.4194,
        37.7749,
        -122.4194
      );

      expect(distance).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const distance = locationService.calculateDistance(
        -33.8688, // Sydney lat
        151.2093, // Sydney lng
        -37.8136, // Melbourne lat
        144.9631 // Melbourne lng
      );

      expect(distance).toBeGreaterThan(700);
      expect(distance).toBeLessThan(800);
    });
  });

  describe('calculateETA', () => {
    it('should calculate ETA correctly for driving', async () => {
      const result = await locationService.calculateETA(
        37.7749, // Current lat
        -122.4194, // Current lng
        37.7849, // Dest lat (1km north)
        -122.4194, // Dest lng
        'driving'
      );

      expect(result.success).toBe(true);
      expect(result.data.distance).toBeGreaterThan(0);
      expect(result.data.duration).toBeGreaterThan(0);
      expect(result.data.eta).toBeDefined();
    });

    it('should adjust ETA for different travel modes', async () => {
      const drivingResult = await locationService.calculateETA(
        37.7749,
        -122.4194,
        37.7849,
        -122.4194,
        'driving'
      );

      const walkingResult = await locationService.calculateETA(
        37.7749,
        -122.4194,
        37.7849,
        -122.4194,
        'walking'
      );

      expect(walkingResult.data.duration).toBeGreaterThan(drivingResult.data.duration);
    });

    it('should handle ETA calculation errors', async () => {
      // Pass invalid coordinates
      const result = await locationService.calculateETA(
        NaN,
        NaN,
        37.7849,
        -122.4194
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('geocodeAddress', () => {
    it('should geocode address successfully', async () => {
      const mockGeocodedResult = [
        {
          latitude: 37.7749,
          longitude: -122.4194,
        },
      ];

      const mockReverseResult = [
        {
          street: '123',
          streetNumber: 'Main St',
          city: 'San Francisco',
          region: 'CA',
        },
      ];

      (Location.geocodeAsync as jest.Mock).mockResolvedValue(mockGeocodedResult);
      (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue(mockReverseResult);

      const result = await locationService.geocodeAddress('123 Main St, San Francisco, CA');

      expect(result.success).toBe(true);
      expect(result.data.latitude).toBe(37.7749);
      expect(result.data.longitude).toBe(-122.4194);
      expect(result.data.formattedAddress).toContain('Main St');
    });

    it('should handle address not found', async () => {
      (Location.geocodeAsync as jest.Mock).mockResolvedValue([]);

      const result = await locationService.geocodeAddress('Invalid Address');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Address not found');
    });

    it('should handle geocoding errors', async () => {
      (Location.geocodeAsync as jest.Mock).mockRejectedValue(
        new Error('Geocoding service unavailable')
      );

      const result = await locationService.geocodeAddress('123 Main St');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Geocoding service unavailable');
    });
  });

  describe('getLocationUpdates', () => {
    it('should retrieve location updates successfully', async () => {
      const mockUpdates = [
        {
          id: 'update-1',
          booking_id: 'booking-123',
          user_id: 'user-456',
          latitude: 37.7749,
          longitude: -122.4194,
          timestamp: new Date().toISOString(),
          accuracy: 10,
        },
        {
          id: 'update-2',
          booking_id: 'booking-123',
          user_id: 'user-456',
          latitude: 37.7750,
          longitude: -122.4195,
          timestamp: new Date().toISOString(),
          accuracy: 8,
        },
      ];

      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: mockUpdates,
          error: null,
        }),
      });

      const result = await locationService.getLocationUpdates('booking-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].latitude).toBe(37.7749);
    });

    it('should handle empty location updates', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const result = await locationService.getLocationUpdates('booking-123');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      });

      const result = await locationService.getLocationUpdates('booking-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('getTrackingStatus', () => {
    it('should return tracking status correctly', () => {
      const status = locationService.getTrackingStatus();

      expect(status.isTracking).toBe(false);
      expect(status.lastUpdate).toBeNull();
    });

    it('should update tracking status when tracking starts', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Location.watchPositionAsync as jest.Mock).mockResolvedValue({
        remove: jest.fn(),
      });

      await locationService.startTracking('booking-123', 'user-456');

      const status = locationService.getTrackingStatus();
      expect(status.isTracking).toBe(true);
    });
  });
});