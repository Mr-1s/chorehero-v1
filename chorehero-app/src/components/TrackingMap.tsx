import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import MapView, { 
  Marker, 
  Polyline, 
  PROVIDER_GOOGLE,
  Region,
  MapPressEvent,
  MarkerPressEvent,
} from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LocationUpdate } from '../types/booking';
import { Address } from '../types/user';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../utils/constants';
import * as Location from 'expo-location';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TrackingMapProps {
  // Location data
  customerLocation?: LocationUpdate | null;
  cleanerLocation?: LocationUpdate | null;
  destinationAddress: Address;
  locationHistory?: LocationUpdate[];
  
  // Map configuration
  showTrail?: boolean;
  showETA?: boolean;
  followUser?: boolean;
  zoomLevel?: number;
  
  // Callbacks
  onLocationPress?: (coordinate: { latitude: number; longitude: number }) => void;
  onMarkerPress?: (type: 'customer' | 'cleaner' | 'destination', data: any) => void;
  onRegionChange?: (region: Region) => void;
  
  // UI customization
  style?: any;
  showControls?: boolean;
}

export const TrackingMap: React.FC<TrackingMapProps> = ({
  customerLocation,
  cleanerLocation,
  destinationAddress,
  locationHistory = [],
  showTrail = true,
  showETA = true,
  followUser = true,
  zoomLevel = 15,
  onLocationPress,
  onMarkerPress,
  onRegionChange,
  style,
  showControls = true,
}) => {
  // Refs
  const mapRef = useRef<MapView>(null);
  
  // State
  const [mapReady, setMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [mapType, setMapType] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const [showUserLocation, setShowUserLocation] = useState(true);

  // Get current user location
  const getCurrentLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setUserLocation(location);
    } catch (error) {
      console.error('Error getting current location:', error);
    }
  }, []);

  // Calculate map region to fit all markers
  const calculateRegion = useCallback((): Region => {
    const locations = [
      destinationAddress.latitude && destinationAddress.longitude 
        ? { latitude: destinationAddress.latitude, longitude: destinationAddress.longitude }
        : null,
      customerLocation 
        ? { latitude: customerLocation.latitude, longitude: customerLocation.longitude }
        : null,
      cleanerLocation 
        ? { latitude: cleanerLocation.latitude, longitude: cleanerLocation.longitude }
        : null,
      userLocation 
        ? { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude }
        : null,
    ].filter(Boolean) as { latitude: number; longitude: number }[];

    if (locations.length === 0) {
      // Default to San Francisco if no locations available
      return {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    if (locations.length === 1) {
      return {
        latitude: locations[0].latitude,
        longitude: locations[0].longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    // Calculate bounds
    const minLat = Math.min(...locations.map(l => l.latitude));
    const maxLat = Math.max(...locations.map(l => l.latitude));
    const minLon = Math.min(...locations.map(l => l.longitude));
    const maxLon = Math.max(...locations.map(l => l.longitude));

    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    const deltaLat = (maxLat - minLat) * 1.3; // Add 30% padding
    const deltaLon = (maxLon - minLon) * 1.3; // Add 30% padding

    return {
      latitude: centerLat,
      longitude: centerLon,
      latitudeDelta: Math.max(deltaLat, 0.01),
      longitudeDelta: Math.max(deltaLon, 0.01),
    };
  }, [destinationAddress, customerLocation, cleanerLocation, userLocation]);

  // Fit map to show all markers
  const fitToMarkers = useCallback(() => {
    if (!mapRef.current || !mapReady) return;

    const region = calculateRegion();
    mapRef.current.animateToRegion(region, 1000);
  }, [calculateRegion, mapReady]);

  // Center map on specific location
  const centerOnLocation = useCallback((
    latitude: number,
    longitude: number,
    animated: boolean = true
  ) => {
    if (!mapRef.current || !mapReady) return;

    const region: Region = {
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    if (animated) {
      mapRef.current.animateToRegion(region, 1000);
    } else {
      mapRef.current.animateToRegion(region, 0);
    }
  }, [mapReady]);

  // Toggle map type
  const toggleMapType = useCallback(() => {
    const types: ('standard' | 'satellite' | 'hybrid')[] = ['standard', 'satellite', 'hybrid'];
    const currentIndex = types.indexOf(mapType);
    const nextIndex = (currentIndex + 1) % types.length;
    setMapType(types[nextIndex]);
  }, [mapType]);

  // Handle map ready
  const handleMapReady = useCallback(() => {
    setMapReady(true);
    
    // Auto-fit to markers after a short delay
    setTimeout(() => {
      fitToMarkers();
    }, 500);
  }, [fitToMarkers]);

  // Handle marker press
  const handleMarkerPress = useCallback((
    type: 'customer' | 'cleaner' | 'destination',
    data: any
  ) => {
    onMarkerPress?.(type, data);
  }, [onMarkerPress]);

  // Get trail coordinates for polyline
  const getTrailCoordinates = useCallback(() => {
    if (!showTrail || locationHistory.length < 2) return [];
    
    return locationHistory
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(update => ({
        latitude: update.latitude,
        longitude: update.longitude,
      }));
  }, [showTrail, locationHistory]);

  // Calculate distance between two points
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Get distance between cleaner and destination
  const getDistanceToDestination = useCallback((): string => {
    if (!cleanerLocation || !destinationAddress.latitude || !destinationAddress.longitude) {
      return 'N/A';
    }

    const distance = calculateDistance(
      cleanerLocation.latitude,
      cleanerLocation.longitude,
      destinationAddress.latitude,
      destinationAddress.longitude
    );

    if (distance < 1) {
      return `${Math.round(distance * 1000)}m away`;
    }
    return `${distance.toFixed(1)}km away`;
  }, [cleanerLocation, destinationAddress]);

  // Initialize user location
  useEffect(() => {
    getCurrentLocation();
  }, [getCurrentLocation]);

  // Auto-center on cleaner when followUser is enabled
  useEffect(() => {
    if (followUser && cleanerLocation && mapReady) {
      centerOnLocation(cleanerLocation.latitude, cleanerLocation.longitude);
    }
  }, [followUser, cleanerLocation, mapReady, centerOnLocation]);

  const trailCoordinates = getTrailCoordinates();

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        onMapReady={handleMapReady}
        onPress={onLocationPress ? (event) => onLocationPress(event.nativeEvent.coordinate) : undefined}
        onRegionChangeComplete={onRegionChange}
        initialRegion={calculateRegion()}
      >
        {/* Destination Marker */}
        {destinationAddress.latitude && destinationAddress.longitude && (
          <Marker
            coordinate={{
              latitude: destinationAddress.latitude,
              longitude: destinationAddress.longitude,
            }}
            title="Destination"
            description={`${destinationAddress.street}, ${destinationAddress.city}`}
            onPress={() => handleMarkerPress('destination', destinationAddress)}
          >
            <View style={styles.destinationMarker}>
              <Ionicons name="home" size={24} color={COLORS.text.inverse} />
            </View>
          </Marker>
        )}

        {/* Customer Marker */}
        {customerLocation && (
          <Marker
            coordinate={{
              latitude: customerLocation.latitude,
              longitude: customerLocation.longitude,
            }}
            title="Customer"
            description="Customer location"
            onPress={() => handleMarkerPress('customer', customerLocation)}
          >
            <View style={styles.customerMarker}>
              <Ionicons name="person" size={20} color={COLORS.text.inverse} />
            </View>
          </Marker>
        )}

        {/* Cleaner Marker */}
        {cleanerLocation && (
          <Marker
            coordinate={{
              latitude: cleanerLocation.latitude,
              longitude: cleanerLocation.longitude,
            }}
            title="Cleaner"
            description={`Last updated: ${new Date(cleanerLocation.timestamp).toLocaleTimeString()}`}
            onPress={() => handleMarkerPress('cleaner', cleanerLocation)}
            rotation={cleanerLocation.heading || 0}
          >
            <View style={styles.cleanerMarker}>
              <Ionicons name="car" size={20} color={COLORS.text.inverse} />
            </View>
          </Marker>
        )}

        {/* Location Trail */}
        {trailCoordinates.length > 1 && (
          <Polyline
            coordinates={trailCoordinates}
            strokeColor={COLORS.primary}
            strokeWidth={3}
          />
        )}
      </MapView>

      {/* Map Controls */}
      {showControls && (
        <View style={styles.controls}>
          {/* Fit to Markers Button */}
          <TouchableOpacity style={styles.controlButton} onPress={fitToMarkers}>
            <Ionicons name="scan" size={20} color={COLORS.text.primary} />
          </TouchableOpacity>

          {/* Current Location Button */}
          <TouchableOpacity 
            style={styles.controlButton} 
            onPress={() => {
              if (userLocation) {
                centerOnLocation(
                  userLocation.coords.latitude,
                  userLocation.coords.longitude
                );
              } else {
                getCurrentLocation();
              }
            }}
          >
            <Ionicons name="locate" size={20} color={COLORS.text.primary} />
          </TouchableOpacity>

          {/* Map Type Toggle */}
          <TouchableOpacity style={styles.controlButton} onPress={toggleMapType}>
            <Ionicons name="layers" size={20} color={COLORS.text.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Distance Indicator */}
      {showETA && cleanerLocation && (
        <View style={styles.distanceIndicator}>
          <Text style={styles.distanceText}>
            {getDistanceToDestination()}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  
  // Marker Styles
  destinationMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.text.inverse,
    shadowColor: COLORS.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  customerMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.text.inverse,
    shadowColor: COLORS.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  cleanerMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.text.inverse,
    shadowColor: COLORS.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  
  // Controls
  controls: {
    position: 'absolute',
    top: 50,
    right: SPACING.lg,
    gap: SPACING.sm,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Distance Indicator
  distanceIndicator: {
    position: 'absolute',
    top: 50,
    left: SPACING.lg,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: COLORS.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  distanceText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
  },
});