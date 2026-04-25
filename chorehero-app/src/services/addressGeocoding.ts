import * as Location from 'expo-location';

export type GeocodedCoords = { latitude: number; longitude: number };

const isValidCoord = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  Math.abs(latitude) <= 90 &&
  Math.abs(longitude) <= 180;

/**
 * Geocode a structured mailing address (Expo / platform geocoder).
 * Fails soft: returns null so callers can still save the address text.
 */
export async function geocodeMailingAddress(params: {
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
}): Promise<GeocodedCoords | null> {
  const { street, city, state, zip_code, country = 'US' } = params;
  const parts = [street, city, state, zip_code, country]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter((p) => p.length > 0);
  if (parts.length < 2) return null;

  const query = parts.join(', ');
  try {
    const results = await Location.geocodeAsync(query);
    if (results?.length) {
      const { latitude, longitude } = results[0];
      if (isValidCoord(latitude, longitude)) {
        return { latitude, longitude };
      }
    }
  } catch (e) {
    if (__DEV__) console.warn('[geocodeMailingAddress]', e);
  }
  return null;
}

/**
 * Geocode a single-line address (e.g. from booking flow).
 */
export async function geocodeFreeformAddress(addressLine: string): Promise<GeocodedCoords | null> {
  const q = addressLine?.trim();
  if (!q || q.length < 4) return null;
  if (q === 'Address on file') return null;

  try {
    const results = await Location.geocodeAsync(q);
    if (results?.length) {
      const { latitude, longitude } = results[0];
      if (isValidCoord(latitude, longitude)) {
        return { latitude, longitude };
      }
    }
  } catch (e) {
    if (__DEV__) console.warn('[geocodeFreeformAddress]', e);
  }
  return null;
}
