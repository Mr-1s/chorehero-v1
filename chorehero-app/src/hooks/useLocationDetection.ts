/**
 * useLocationDetection - Fallback chain: GPS -> IP geolocation -> default (NYC).
 * Provides location for feed population when user has not set address.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Location from 'expo-location';

export interface DetectedLocation {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  isDemo: boolean;
  method: 'gps' | 'ip' | 'default';
}

const NYC_COORDS = { latitude: 40.7128, longitude: -74.006 };

function trackEvent(event: string, props?: Record<string, unknown>) {
  try {
    if (typeof (global as any).__analytics?.track === 'function') {
      (global as any).__analytics.track(event, props);
    }
  } catch {
    // no-op
  }
}

async function tryIPGeolocation(): Promise<DetectedLocation | null> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data?.latitude != null && data?.longitude != null) {
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        city: data.city || undefined,
        state: data.region || undefined,
        isDemo: false,
        method: 'ip',
      };
    }
  } catch {
    // Network error or timeout
  }
  return null;
}

async function tryGPS(): Promise<DetectedLocation | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const coords = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const lat = coords.coords.latitude;
    const lng = coords.coords.longitude;

    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const place = results[0];

    return {
      latitude: lat,
      longitude: lng,
      city: place?.city || undefined,
      state: place?.region || undefined,
      isDemo: false,
      method: 'gps',
    };
  } catch {
    return null;
  }
}

function getDefaultLocation(): DetectedLocation {
  return {
    ...NYC_COORDS,
    city: 'NYC',
    isDemo: true,
    method: 'default',
  };
}

export function useLocationDetection() {
  const [location, setLocation] = useState<DetectedLocation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const detect = useCallback(async () => {
    setIsLoading(true);
    let detected: DetectedLocation | null = null;

    // 1. Try GPS
    detected = await tryGPS();
    if (detected) {
      setLocation(detected);
      trackEvent('location_detected', { method: 'gps', city: detected.city });
      setIsLoading(false);
      return;
    }

    // 2. Try IP geolocation
    detected = await tryIPGeolocation();
    if (detected) {
      setLocation(detected);
      trackEvent('location_detected', { method: 'ip', city: detected.city });
      setIsLoading(false);
      return;
    }

    // 3. Default to NYC
    const fallback = getDefaultLocation();
    setLocation(fallback);
    trackEvent('location_detected', { method: 'default', city: 'NYC' });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    detect();
  }, [detect]);

  const userLocation = useMemo(
    () =>
      location
        ? { latitude: location.latitude, longitude: location.longitude }
        : undefined,
    [location?.latitude, location?.longitude]
  );

  return {
    location,
    userLocation,
    userCity: location?.city ?? null,
    isDemo: location?.isDemo ?? true,
    isLoading,
    refresh: detect,
  };
}
