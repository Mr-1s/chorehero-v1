/**
 * AddressAutocomplete - Google Places Autocomplete + Place Details.
 * Suggestions render inline below the field (works inside ScrollView; Modal often fails there).
 * On selection, auto-populates street, city, state, zip, latitude, longitude.
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { wp } from '../utils/responsive';

const PLACES_TROUBLESHOOT_DEV = `Google Places: use iOS app restriction + bundle id from app.json, not HTTP referrers. Enable Places API (and Places API New) for the project. Set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in EAS for production.`;

/**
 * The verbose dev troubleshooting banner is loud and useful when developing,
 * but in TestFlight / production builds it leaks raw API errors to end users.
 * Gate it behind both `__DEV__` and an explicit opt-in flag in `expo-constants`
 * extra so it can be enabled in dev builds without leaking to release builds.
 */
const SHOW_PLACES_DIAGNOSTICS =
  __DEV__ ||
  Boolean((Constants?.expoConfig?.extra as Record<string, unknown> | undefined)?.showPlacesDiagnostics);

export interface AddressResult {
  street: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onPlaceSelected: (result: AddressResult) => void;
  placeholder?: string;
  style?: object;
}

const placesApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting?: { main_text: string; secondary_text?: string };
}

function useDebounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const debounced = useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => fnRef.current(...args), ms);
    }) as T,
    [ms]
  );
  React.useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);
  return debounced;
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChangeText,
  onPlaceSelected,
  placeholder = 'Search address',
  style,
}) => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPredictions = useCallback(async (input: string) => {
    if (!placesApiKey || input.length < 2) {
      setPredictions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        input
      )}&key=${placesApiKey}&types=address&components=country:us&language=en`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (data.predictions && data.predictions.length > 0) {
        setPredictions(data.predictions);
        setError(null);
      } else {
        setPredictions([]);
        if (data.error_message) {
          if (__DEV__) console.warn('[Places]', data.error_message);
          setError(data.error_message);
        }
      }
    } catch (e) {
      clearTimeout(timeoutId);
      setPredictions([]);
      const msg = e instanceof Error ? e.message : 'Request failed';
      const err = e instanceof Error && e.name === 'AbortError' ? 'Request timed out' : msg;
      if (__DEV__) console.warn('[Places]', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedFetch = useDebounce(fetchPredictions, 300);

  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText(text);
      if (text.length >= 2) {
        debouncedFetch(text);
      } else {
        setPredictions([]);
      }
    },
    [onChangeText, debouncedFetch]
  );

  const fetchPlaceDetails = useCallback(
    async (placeId: string): Promise<AddressResult | null> => {
      if (!placesApiKey) return null;
      try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${placesApiKey}&fields=address_components,geometry`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.result?.address_components) {
          const componentMap: Record<string, string> = {};
          data.result.address_components.forEach((c: any) => {
            const type = c.types?.[0];
            componentMap[type] = c.long_name;
          });
          const street =
            [componentMap.street_number, componentMap.route].filter(Boolean).join(' ') ||
            componentMap.premise ||
            '';
          const city = componentMap.locality || '';
          const state = componentMap.administrative_area_level_1 || '';
          const zip = componentMap.postal_code || '';
          const loc = data.result.geometry?.location;
          const lat = loc?.lat ?? 0;
          const lng = loc?.lng ?? 0;
          return { street, city, state, zip, latitude: lat, longitude: lng };
        }
      } catch {
        // ignore
      }
      return null;
    },
    []
  );

  const handleSelectPlace = useCallback(
    async (item: Prediction) => {
      setPredictions([]);
      onChangeText(item.description);

      const details = await fetchPlaceDetails(item.place_id);
      if (details) {
        const fullAddr = [details.street, details.city, details.state, details.zip]
          .filter(Boolean)
          .join(', ');
        onChangeText(fullAddr || item.description);
        onPlaceSelected(details);
      } else {
        // Fallback: use description as street, no coords
        onPlaceSelected({
          street: item.description,
          city: '',
          state: '',
          zip: '',
          latitude: 0,
          longitude: 0,
        });
      }
    },
    [onChangeText, onPlaceSelected, fetchPlaceDetails]
  );

  const handleFocus = useCallback(() => {
    if (value.length >= 2 && predictions.length === 0 && !loading) {
      debouncedFetch(value);
    }
  }, [value, predictions.length, loading, debouncedFetch]);

  if (!placesApiKey) {
    return (
      <View style={styles.wrapper}>
        <TextInput
          style={[styles.input, style]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType="default"
        />
        <Text style={styles.noKeyHint}>
          Address search is not configured in this build. Enter city, state, and ZIP below.
        </Text>
        {__DEV__ ? <Text style={styles.noKeyHintDev}>Dev: set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in env.</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, style]}
          value={value}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          keyboardType="default"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color="#26B7C9" />
          </View>
        )}
      </View>

      {predictions.length > 0 && (
        <View style={styles.suggestionsWrap}>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={styles.suggestionsScroll}
          >
            {predictions.map((item) => (
              <TouchableOpacity
                key={item.place_id}
                style={styles.listItem}
                onPress={() => handleSelectPlace(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="location-outline" size={20} color="#6B7280" />
                <Text style={styles.listItemText} numberOfLines={2}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {error && predictions.length === 0 && (
        SHOW_PLACES_DIAGNOSTICS ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTextMono}>{error}</Text>
            <Text style={styles.errorTextUser}>
              We could not look up your address. You can type city, state, and ZIP in the fields below.
            </Text>
            <Text style={styles.errorHintDev}>
              {/referr|RESTRIC/i.test(error) ? PLACES_TROUBLESHOOT_DEV : 'Check Places API is enabled; verify EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in EAS and rebuild.'}
            </Text>
          </View>
        ) : (
          <Text style={styles.productionHint}>
            Address search unavailable — type city, state, and ZIP below.
          </Text>
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    zIndex: 1000,
    overflow: 'visible',
  },
  noKeyHint: {
    marginTop: 8,
    fontSize: wp('2.8%'),
    color: '#94A3B8',
    lineHeight: 18,
  },
  noKeyHintDev: {
    marginTop: 4,
    fontSize: wp('2.4%'),
    color: '#94A3B8',
  },
  inputRow: {
    position: 'relative',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: wp('3%'),
    paddingHorizontal: wp('3%'),
    paddingVertical: Platform.OS === 'ios' ? wp('3%') : wp('2.5%'),
    fontSize: wp('3.5%'),
    color: '#0F172A',
    backgroundColor: '#ffffff',
    height: Platform.OS === 'ios' ? 44 : 48,
  },
  loader: {
    position: 'absolute',
    right: wp('3%'),
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  suggestionsWrap: {
    marginTop: 6,
    maxHeight: 220,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: wp('3%'),
    backgroundColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  suggestionsScroll: {
    maxHeight: 220,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: wp('3%'),
    paddingHorizontal: wp('4%'),
    gap: wp('3%'),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  listItemText: {
    flex: 1,
    fontSize: wp('3.5%'),
    color: '#1F2937',
  },
  errorContainer: {
    marginTop: 8,
    padding: wp('3%'),
    borderRadius: wp('2%'),
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  errorTextUser: {
    fontSize: wp('3%'),
    color: '#7F1D1D',
    lineHeight: 20,
  },
  errorTextMono: {
    fontSize: wp('2.4%'),
    color: '#9CA3AF',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorHintDev: {
    fontSize: wp('2.4%'),
    color: '#64748B',
    marginTop: 8,
    lineHeight: 18,
  },
  productionHint: {
    marginTop: 8,
    fontSize: wp('2.9%'),
    color: '#6B7280',
    lineHeight: 18,
  },
});
