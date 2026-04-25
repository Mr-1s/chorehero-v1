import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  Animated,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { zipLookupService } from '../../services/zipLookupService';
import { useAuth } from '../../hooks/useAuth';
import { wp, hp } from '../../utils/responsive';
import { updateGuestSession } from '../../utils/guestSession';

interface LocationLockProps {
  navigation: any;
}

const isValidZip = (zip: string) => /^\d{5}$/.test(zip);

const LocationLockScreen: React.FC<LocationLockProps> = ({ navigation }) => {
  const { user, enterGuestMode } = useAuth();
  const [zip, setZip] = useState('');
  const [cityState, setCityState] = useState<{ city: string; state: string } | null>(null);
  const [manualCity, setManualCity] = useState('');
  const [manualState, setManualState] = useState('');
  const [showManualCityState, setShowManualCityState] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const zipInputRef = useRef<TextInput>(null);
  const shimmerTranslate = useRef(new Animated.Value(-140)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      zipInputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (
      user?.role === 'customer' &&
      ['LOCATION_SET', 'ACTIVE_CUSTOMER', 'TRANSACTION_READY'].includes(
        user.customer_onboarding_state || ''
      )
    ) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
  }, [user?.role, user?.customer_onboarding_state, navigation]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerTranslate, {
        toValue: 140,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      // @ts-ignore
      loop.stop && loop.stop();
    };
  }, [shimmerTranslate]);

  useEffect(() => {
    const resolveZip = async () => {
      if (!isValidZip(zip)) {
        setCityState(null);
        setShowManualCityState(false);
        return;
      }
      setIsResolving(true);
      const result = await zipLookupService.lookup(zip);
      setCityState(result);
      setShowManualCityState(isValidZip(zip) && !result);
      setIsResolving(false);
    };
    resolveZip();
  }, [zip]);

  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Access', 'Please enable location permissions.');
        return;
      }
      const coords = await Location.getCurrentPositionAsync({});
      const results = await Location.reverseGeocodeAsync({
        latitude: coords.coords.latitude,
        longitude: coords.coords.longitude,
      });
      const place = results[0];
      if (!place?.postalCode) {
        Alert.alert('Location', 'Unable to resolve your ZIP code.');
        return;
      }
      setZip(place.postalCode);
    } catch (error) {
      Alert.alert('Location', 'Unable to use current location.');
    }
  };

  const navigateToFeed = async () => {
    const city = cityState?.city || manualCity.trim() || 'Your City';
    const state = cityState?.state || manualState.trim() || '';
    await enterGuestMode();
    await AsyncStorage.multiSet([
      ['guest_zip', zip],
      ['guest_city', city],
      ['guest_state', state],
    ]);
    await updateGuestSession({ location: { zip, city, state } });
    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'MainTabs',
          params: { screen: 'Content', params: { source: 'main' } },
        },
      ],
    });
  };

  const handleContinue = async () => {
    if (!isValidZip(zip)) {
      Alert.alert('Zip Code Required', 'Enter a valid 5-digit ZIP.');
      return;
    }

    setIsChecking(true);
    try {
      const checkWithTimeout = Promise.race([
        supabase
          .from('active_locations')
          .select('zip_code, city, state, is_active')
          .eq('zip_code', zip)
          .single(),
        new Promise<{ data: null; error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 5000)
        ),
      ]) as Promise<{ data: any; error: any }>;

      const { data, error } = await checkWithTimeout;

      const resolvedCity = data?.city || cityState?.city || manualCity.trim();
      const resolvedState = data?.state || cityState?.state || manualState.trim();

      if (error || !data || !data.is_active) {
        if (!resolvedCity || !resolvedState) {
          setShowManualCityState(true);
          Alert.alert('City/State Needed', 'Enter your city and state to continue.');
          return;
        }
        navigation.navigate('Waitlist', {
          zip,
          city: resolvedCity,
          state: resolvedState,
        });
        return;
      }

      const city = data.city || resolvedCity || 'Your City';
      const state = data.state || resolvedState || '';

      await AsyncStorage.multiSet([
        ['guest_zip', zip],
        ['guest_city', city],
        ['guest_state', state],
        ['guest_user_role', 'customer'],
      ]);
      await updateGuestSession({ location: { zip, city, state } });

      if (user?.id) {
        const payload = {
          id: user.id,
          role: user.role || 'customer',
          name: user.name || user.email || 'Customer',
          email: user.email || null,
          phone: user.phone || null,
          customer_onboarding_state: 'LOCATION_SET',
          customer_onboarding_step: 2,
          is_active: true,
        };
        supabase
          .from('users')
          .upsert(payload, { onConflict: 'id' })
          .then(({ error }) => {
            if (error) console.warn('Failed to persist onboarding state:', error);
          });
      }

      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'CustomerOnboarding',
            params: { zip, city, state },
          },
        ],
      });
    } catch (err) {
      const resolvedCity = cityState?.city || manualCity.trim();
      const resolvedState = cityState?.state || manualState.trim();
      if (resolvedCity && resolvedState) {
        navigation.navigate('Waitlist', { zip, city: resolvedCity, state: resolvedState });
      } else {
        setShowManualCityState(true);
        Alert.alert('Location', 'Unable to check availability. Enter your city and state, or browse the feed.');
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#26B7C9" />
      <LinearGradient colors={['#26B7C9', '#047B9B']} style={styles.gradient}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View>
                <View style={styles.header}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      if (navigation?.canGoBack?.()) {
                        navigation.goBack();
                        return;
                      }
                      navigation.navigate('ProfileType');
                    }}
                  >
                    <Ionicons name="arrow-back" size={22} color="#047B9B" />
                  </TouchableOpacity>
                </View>
                <View style={styles.card}>
                  <Text style={styles.title}>Find a ChoreHero</Text>
                  <Text style={styles.subtitle}>Enter your ZIP code to see availability.</Text>

                  <View style={styles.inputRow}>
                    <Ionicons name="location-outline" size={18} color="#6B7280" />
                    <TextInput
                      style={styles.input}
                      placeholder="Zip Code"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      maxLength={5}
                      value={zip}
                      onChangeText={(text) => {
                        const digits = text.replace(/\D/g, '').slice(0, 5);
                        setZip(digits);
                      }}
                      autoFocus
                      ref={zipInputRef}
                    />
                  </View>

                  {isResolving && <Text style={styles.helper}>Checking location…</Text>}
                  {cityState && (
                    <Text style={styles.helper}>
                      {cityState.city}, {cityState.state}
                    </Text>
                  )}

                  {showManualCityState && (
                    <View style={styles.manualRow}>
                      <TextInput
                        style={[styles.manualInput, styles.manualInputLeft]}
                        placeholder="City"
                        placeholderTextColor="#9CA3AF"
                        value={manualCity}
                        onChangeText={setManualCity}
                      />
                      <TextInput
                        style={[styles.manualInput, styles.manualInputRight]}
                        placeholder="State"
                        placeholderTextColor="#9CA3AF"
                        value={manualState}
                        onChangeText={setManualState}
                        maxLength={2}
                        autoCapitalize="characters"
                      />
                    </View>
                  )}

                  <TouchableOpacity style={styles.secondaryButton} onPress={handleUseCurrentLocation}>
                    <Ionicons name="navigate" size={16} color="#047B9B" />
                    <Text style={styles.secondaryButtonText}>Use Current Location</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.primaryButton, (!isValidZip(zip) || isChecking) && styles.primaryButtonDisabled]}
                    onPress={handleContinue}
                    disabled={!isValidZip(zip) || isChecking}
                  >
                    {isChecking ? (
                      <View style={styles.shimmerContainer}>
                        <Text style={styles.primaryButtonText}>Checking…</Text>
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            styles.shimmerOverlay,
                            { transform: [{ translateX: shimmerTranslate }] },
                          ]}
                        >
                          <LinearGradient
                            colors={['transparent', 'rgba(255,255,255,0.5)', 'transparent']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.shimmerGradient}
                          />
                        </Animated.View>
                      </View>
                    ) : (
                      <Text style={styles.primaryButtonText}>Continue</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.browseFeedLink}
                    onPress={() => isValidZip(zip) && navigateToFeed()}
                    disabled={!isValidZip(zip)}
                  >
                    <Ionicons name="play-circle-outline" size={16} color="#047B9B" />
                    <Text style={styles.browseFeedText}>Browse feed</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, padding: wp('5%') },
  keyboardAvoid: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: hp('38%'),
    justifyContent: 'center',
  },
  header: {
    paddingTop: hp('0.7%'),
    paddingBottom: hp('1.5%'),
  },
  backButton: {
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('5%'),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: wp('5%'),
    padding: wp('6%'),
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  title: { fontSize: wp('6%'), fontWeight: '800', color: '#1F2937', marginBottom: hp('1%') },
  subtitle: { fontSize: wp('3.5%'), color: '#6B7280', marginBottom: hp('2.5%') },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: wp('3%'),
    paddingHorizontal: wp('3%'),
    gap: wp('2%'),
  },
  input: { flex: 1, fontSize: wp('4%'), paddingVertical: hp('1.5%'), color: '#111827' },
  helper: { marginTop: hp('1%'), color: '#047B9B', fontWeight: '600' },
  manualRow: {
    marginTop: hp('1.5%'),
    flexDirection: 'row',
    gap: wp('2.5%'),
  },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: wp('3%'),
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('3%'),
    color: '#111827',
  },
  manualInputLeft: {},
  manualInputRight: { maxWidth: 90, textAlign: 'center' },
  secondaryButton: {
    marginTop: hp('2%'),
    borderWidth: 1,
    borderColor: '#047B9B',
    borderRadius: wp('3%'),
    paddingVertical: hp('1.5%'),
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: wp('2%'),
  },
  secondaryButtonText: { color: '#047B9B', fontWeight: '700' },
  primaryButton: {
    marginTop: hp('2%'),
    backgroundColor: '#26B7C9',
    paddingVertical: hp('1.7%'),
    borderRadius: wp('3%'),
    alignItems: 'center',
    overflow: 'hidden',
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: '#fff', fontSize: wp('4%'), fontWeight: '700' },
  browseFeedLink: {
    marginTop: hp('1.5%'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('1.5%'),
  },
  browseFeedText: { color: '#047B9B', fontWeight: '600', fontSize: wp('3.5%') },
  shimmerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shimmerOverlay: {
    position: 'absolute',
    width: 120,
    height: '100%',
  },
  shimmerGradient: {
    flex: 1,
  },
});

export default LocationLockScreen;
