import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { bookingService } from '../../services/booking';
import { PLATFORM_CONFIG } from '../../utils/constants';
import AuthModal from '../../components/AuthModal';
import type { Address, PaymentMethod } from '../../types/user';
import { notificationService } from '../../services/notificationService';

type StackParamList = {
  BookingSummary: {
    cleanerId: string;
    cleanerName?: string;
    hourlyRate?: number;
    selectedService?: string;
    selectedTime?: string;
  };
  BookingConfirmation: {
    bookingId: string;
    service: { title: string; duration: string; price: number };
    cleaner: { id: string; name: string; avatar: string; rating: number; eta: string };
    address: string;
    scheduledTime: string;
  };
  PaymentScreen: {
    bookingTotal?: number;
    cleanerId?: string;
    fromBooking?: boolean;
    paymentIntent?: string;
  };
  AuthScreen: undefined;
};

type BookingSummaryNavigationProp = StackNavigationProp<StackParamList, 'BookingSummary'>;

interface BookingSummaryProps {
  navigation: BookingSummaryNavigationProp;
  route: { params: StackParamList['BookingSummary'] };
}

const DEFAULT_HOURS = 2;
const MIN_HOURS = 2;
const HOUR_STEP = 0.5;
const BEDROOM_OPTIONS = [1, 2, 3, 4, 5];
const BATHROOM_OPTIONS = [1, 1.5, 2, 2.5, 3];

const BookingSummaryScreen: React.FC<BookingSummaryProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const { cleanerId, cleanerName, hourlyRate = 0, selectedService, selectedTime } = route.params || {};
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [hideInputs, setHideInputs] = useState(false);
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [stateValue, setStateValue] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [propertyType, setPropertyType] = useState<'Apartment' | 'House' | 'Condo'>('Apartment');
  const [squareFeet, setSquareFeet] = useState('');
  const [hasPets, setHasPets] = useState(false);
  const [entryInstructions, setEntryInstructions] = useState('');
  const [bedrooms, setBedrooms] = useState(1);
  const [bathrooms, setBathrooms] = useState(1);
  const [serviceDuration, setServiceDuration] = useState(DEFAULT_HOURS);
  const [useSavedAddress, setUseSavedAddress] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const successScale = useRef(new Animated.Value(0.6)).current;

  const subtotal = useMemo(() => hourlyRate * serviceDuration, [hourlyRate, serviceDuration]);
  const serviceFee = useMemo(
    () => subtotal * PLATFORM_CONFIG.commission_rate,
    [subtotal]
  );
  const estimatedTotal = useMemo(
    () => subtotal + serviceFee,
    [subtotal, serviceFee]
  );
  const hasPaymentMethod = Boolean(selectedPaymentMethodId);

  useEffect(() => {
    if (!user?.id) return;
    const loadProfile = async () => {
      try {
        setProfileLoading(true);
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('address_line1, city, state, zip_code, property_type, square_feet, has_pets')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          if (profile.address_line1) setAddressLine1(profile.address_line1);
          if (profile.city) setCity(profile.city);
          if (profile.state) setStateValue(profile.state);
          if (profile.zip_code) setZipCode(profile.zip_code);
          if (profile.property_type) setPropertyType(profile.property_type);
          if (profile.square_feet) setSquareFeet(String(profile.square_feet));
          if (profile.has_pets !== null && profile.has_pets !== undefined) setHasPets(Boolean(profile.has_pets));

          const hasAll =
            !!profile.address_line1 &&
            !!profile.property_type &&
            !!profile.square_feet &&
            profile.has_pets !== null &&
            profile.has_pets !== undefined;
          setHideInputs(hasAll);
        }

        const { data: addresses } = await supabase
          .from('addresses')
          .select('id, street, city, state, zip_code, is_default, nickname, access_instructions')
          .eq('user_id', user.id)
          .order('is_default', { ascending: false });
        if (addresses) {
          setSavedAddresses(addresses as Address[]);
          const defaultAddress = addresses.find(addr => addr.is_default) || addresses[0];
          if (defaultAddress) {
            setSelectedAddressId(defaultAddress.id);
          }
        }

        setPaymentLoading(true);
        const { data: methods } = await supabase
          .from('payment_methods')
          .select('id, type, last_four, brand, is_default, stripe_payment_method_id')
          .eq('user_id', user.id)
          .eq('is_active', true);
        if (methods) {
          const sorted = (methods as PaymentMethod[]).sort((a, b) => Number(b.is_default) - Number(a.is_default));
          setPaymentMethods(sorted);
          if (sorted[0]) {
            setSelectedPaymentMethodId(sorted[0].id);
          }
        }
      } catch (error) {
        console.warn('⚠️ Failed to prefill user profile:', error);
      } finally {
        setProfileLoading(false);
        setPaymentLoading(false);
      }
    };
    loadProfile();
  }, [user?.id]);

  useEffect(() => {
    if (!useSavedAddress || savedAddresses.length === 0) return;
    const selected = savedAddresses.find(addr => addr.id === selectedAddressId) || savedAddresses[0];
    if (selected) {
      setAddressLine1(selected.street || '');
      setCity(selected.city || '');
      setStateValue(selected.state || '');
      setZipCode(selected.zip_code || '');
      if (selected.access_instructions && !entryInstructions) {
        setEntryInstructions(selected.access_instructions);
      }
    }
  }, [useSavedAddress, savedAddresses, selectedAddressId, entryInstructions]);

  useEffect(() => {
    if (successVisible) {
      Animated.spring(successScale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    } else {
      successScale.setValue(0.6);
    }
  }, [successVisible, successScale]);

  const formatDuration = (hours: number) => {
    return Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
  };

  const updateDuration = (delta: number) => {
    const next = Math.max(MIN_HOURS, Number((serviceDuration + delta).toFixed(1)));
    setServiceDuration(next);
  };

  const parseScheduledTime = (): string => {
    if (!selectedTime) {
      return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    }
    const now = new Date();
    const match = selectedTime.match(/(Today|Tomorrow)\\s+(\\d{1,2}):(\\d{2})\\s*(AM|PM)/i);
    if (!match) return new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const dayLabel = match[1];
    const hourRaw = Number.parseInt(match[2], 10);
    const minute = Number.parseInt(match[3], 10);
    const meridiem = match[4].toUpperCase();
    const hour = meridiem === 'PM' && hourRaw < 12 ? hourRaw + 12 : meridiem === 'AM' && hourRaw === 12 ? 0 : hourRaw;
    const scheduled = new Date(now);
    scheduled.setHours(hour, minute, 0, 0);
    if (dayLabel.toLowerCase() === 'tomorrow') {
      scheduled.setDate(scheduled.getDate() + 1);
    }
    return scheduled.toISOString();
  };

  const mapServiceType = (): 'express' | 'standard' | 'deep' => {
    const normalized = (selectedService || '').toLowerCase();
    if (normalized.includes('deep')) return 'deep';
    if (normalized.includes('express')) return 'express';
    return 'standard';
  };

  const handleContinue = async () => {
    if (!user?.id) {
      setAuthModalVisible(true);
      return;
    }
    if (!entryInstructions.trim()) {
      Alert.alert('Entry instructions required', 'Please add instructions so your cleaner can access your home.');
      return;
    }
    if (useSavedAddress && !selectedAddressId) {
      Alert.alert('Select an address', 'Choose a saved address or enter a new one.');
      return;
    }
    if (!hasPaymentMethod) {
      return;
    }
    if (!hideInputs) {
      if (!addressLine1 || !propertyType || !squareFeet) {
        Alert.alert('Missing details', 'Please complete the address and household fields.');
        return;
      }
    }

    try {
      setIsSubmitting(true);

      if (user?.id) {
        const userPayload = {
          id: user.id,
          role: user.role || 'customer',
          name: user.name || user.email || 'Customer',
          email: user.email || null,
          phone: user.phone || null,
          is_active: true,
        };
        const { error: userUpsertError } = await supabase
          .from('users')
          .upsert(userPayload, { onConflict: 'id' });
        if (userUpsertError) {
          console.warn('⚠️ User upsert failed before booking:', userUpsertError);
        }
      }

      if (!hideInputs) {
        await supabase.from('user_profiles').upsert({
          user_id: user.id,
          address_line1: addressLine1,
          city,
          state: stateValue,
          zip_code: zipCode,
          property_type: propertyType,
          square_feet: Number.parseInt(squareFeet, 10) || null,
          has_pets: hasPets,
        });
      }

      let addressId = selectedAddressId || null;
      if (!useSavedAddress || !addressId) {
        const { data: existingAddress } = await supabase
          .from('addresses')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_default', true)
          .limit(1)
          .single();

        addressId = existingAddress?.id || null;
        if (!addressId) {
          const { data: addressInsert, error: addressError } = await supabase
            .from('addresses')
            .insert({
              user_id: user.id,
              street: addressLine1 || 'Address on file',
              city: city || 'Unknown',
              state: stateValue || 'NA',
              zip_code: zipCode || '00000',
              country: 'US',
              is_default: true,
              access_instructions: entryInstructions,
            })
            .select('id')
            .single();

          if (addressError) throw addressError;
          addressId = addressInsert?.id;
        }
      } else if (addressId) {
        await supabase
          .from('addresses')
          .update({ access_instructions: entryInstructions })
          .eq('id', addressId)
          .eq('user_id', user.id);
      }

      const bookingResponse = await bookingService.createBooking({
        customer_id: user.id,
        cleaner_id: cleanerId,
        service_type: mapServiceType(),
        address_id: addressId,
        scheduled_time: parseScheduledTime(),
        estimated_duration: Math.round(serviceDuration * 60),
        add_ons: [],
        access_instructions: entryInstructions.trim(),
        bedrooms,
        bathrooms,
        square_feet: Number.parseInt(squareFeet, 10) || null,
        has_pets: hasPets,
        pet_details: null,
        payment_method_id: selectedPaymentMethodId || 'uncollected',
      });

      if (!bookingResponse.success || !bookingResponse.data) {
        console.error('❌ Booking creation failed:', bookingResponse.error);
        throw new Error(bookingResponse.error || 'Booking failed');
      }

      await notificationService.sendNotification({
        type: 'booking',
        title: 'Booking Confirmed',
        message: `Your booking with ${cleanerName || 'your pro'} is confirmed.`,
        fromUserId: cleanerId,
        fromUserName: cleanerName || 'ChoreHero',
        toUserId: user.id,
        relatedId: bookingResponse.data.booking.id,
      });

      setSuccessVisible(true);
      const bookingId = bookingResponse.data.booking.id;
      const addressSummary = [addressLine1, city, stateValue, zipCode].filter(Boolean).join(', ');
      setTimeout(() => {
        setSuccessVisible(false);
        setAddressLine1('');
        setCity('');
        setStateValue('');
        setZipCode('');
        setHideInputs(false);
        setEntryInstructions('');
        setBedrooms(1);
        setBathrooms(1);
        setSquareFeet('');
        setHasPets(false);
        setServiceDuration(DEFAULT_HOURS);
        setUseSavedAddress(false);
        setSelectedAddressId(null);
        navigation.navigate('BookingConfirmation', {
          bookingId,
          service: {
            title: selectedService || 'Standard Cleaning',
            duration: `${formatDuration(serviceDuration)} hrs`,
            price: estimatedTotal,
          },
          cleaner: {
            id: cleanerId,
            name: cleanerName || 'Pro',
            avatar: '',
            rating: 4.8,
            eta: '20-30 min',
          },
          address: addressSummary || 'Address on file',
          scheduledTime: parseScheduledTime(),
        });
      }, 1200);
    } catch (error) {
      Alert.alert('Booking failed', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const placesApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Service Configuration</Text>
          <Text style={styles.subtitle}>
            Set the details so your ChoreHero arrives ready and the pricing is accurate.
          </Text>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Service Duration</Text>
            <View style={styles.durationRow}>
              <TouchableOpacity
                style={[styles.durationButton, serviceDuration <= MIN_HOURS && styles.durationButtonDisabled]}
                onPress={() => updateDuration(-HOUR_STEP)}
                disabled={serviceDuration <= MIN_HOURS}
              >
                <Ionicons name="remove" size={18} color="#0F172A" />
              </TouchableOpacity>
              <View style={styles.durationValue}>
                <Text style={styles.durationText}>{formatDuration(serviceDuration)} hrs</Text>
              </View>
              <TouchableOpacity style={styles.durationButton} onPress={() => updateDuration(HOUR_STEP)}>
                <Ionicons name="add" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>
            <Text style={styles.durationHint}>Minimum 2 hours, 30 min increments.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Address & Access</Text>
            {savedAddresses.length > 0 && (
              <View style={styles.switchRow}>
                <Text style={styles.label}>Use saved address</Text>
                <Switch value={useSavedAddress} onValueChange={setUseSavedAddress} />
              </View>
            )}

            {useSavedAddress && savedAddresses.length > 0 ? (
              <View style={styles.pillRow}>
                {savedAddresses.map((address) => (
                  <TouchableOpacity
                    key={address.id}
                    style={[styles.addressPill, selectedAddressId === address.id && styles.addressPillActive]}
                    onPress={() => setSelectedAddressId(address.id)}
                  >
                    <Text style={[styles.addressPillText, selectedAddressId === address.id && styles.addressPillTextActive]}>
                      {address.nickname || address.street}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : hideInputs ? (
              <View style={styles.prefillSummary}>
                <Text style={styles.prefillText}>{addressLine1}</Text>
                <Text style={styles.prefillText}>{[city, stateValue, zipCode].filter(Boolean).join(', ')}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Street Address</Text>
                {placesApiKey ? (
                  <GooglePlacesAutocomplete
                    placeholder="Search address"
                    onPress={(data, details = null) => {
                      setAddressLine1(data.description || '');
                      if (details?.address_components) {
                        const componentMap: Record<string, string> = {};
                        details.address_components.forEach((component: any) => {
                          const type = component.types?.[0];
                          componentMap[type] = component.long_name;
                        });
                        setCity(componentMap.locality || '');
                        setStateValue(componentMap.administrative_area_level_1 || '');
                        setZipCode(componentMap.postal_code || '');
                      }
                    }}
                    fetchDetails
                    query={{ key: placesApiKey, language: 'en' }}
                    styles={{
                      textInput: styles.input,
                      listView: styles.placesList,
                    }}
                    textInputProps={{
                      value: addressLine1,
                      onChangeText: setAddressLine1,
                      placeholderTextColor: '#94A3B8',
                      keyboardType: 'default',
                      returnKeyType: 'done',
                    }}
                    enablePoweredByContainer={false}
                  />
                ) : (
                  <TextInput
                    style={styles.input}
                    value={addressLine1}
                    onChangeText={setAddressLine1}
                    placeholder="123 Main St"
                    keyboardType="default"
                    returnKeyType="done"
                  />
                )}

                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, styles.halfInput]}
                    placeholder="City"
                    value={city}
                    onChangeText={setCity}
                  />
                  <TextInput
                    style={[styles.input, styles.quarterInput]}
                    placeholder="State"
                    value={stateValue}
                    onChangeText={setStateValue}
                  />
                  <TextInput
                    style={[styles.input, styles.quarterInput]}
                    placeholder="ZIP"
                    value={zipCode}
                    onChangeText={(text) => setZipCode(text.replace(/\\D/g, '').slice(0, 5))}
                    keyboardType="number-pad"
                  />
                </View>
              </>
            )}

            <Text style={styles.label}>Entry Instructions</Text>
            <TextInput
              style={styles.input}
              value={entryInstructions}
              onChangeText={setEntryInstructions}
              placeholder="Key under mat, gate code 1234..."
              returnKeyType="done"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Property Details</Text>
            <Text style={styles.label}>Property Type</Text>
            <View style={styles.pillRow}>
              {(['Apartment', 'House', 'Condo'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.pill, propertyType === type && styles.pillActive]}
                  onPress={() => setPropertyType(type)}
                >
                  <Text style={[styles.pillText, propertyType === type && styles.pillTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Bedrooms</Text>
            <View style={styles.pillRow}>
              {BEDROOM_OPTIONS.map((count) => (
                <TouchableOpacity
                  key={`bed-${count}`}
                  style={[styles.pill, bedrooms === count && styles.pillActive]}
                  onPress={() => setBedrooms(count)}
                >
                  <Text style={[styles.pillText, bedrooms === count && styles.pillTextActive]}>{count}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Bathrooms</Text>
            <View style={styles.pillRow}>
              {BATHROOM_OPTIONS.map((count) => (
                <TouchableOpacity
                  key={`bath-${count}`}
                  style={[styles.pill, bathrooms === count && styles.pillActive]}
                  onPress={() => setBathrooms(count)}
                >
                  <Text style={[styles.pillText, bathrooms === count && styles.pillTextActive]}>{count}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.propertyGrid}>
              <View style={styles.propertyCell}>
                <Text style={styles.label}>Square Feet</Text>
                <TextInput
                  style={styles.input}
                  value={squareFeet}
                  onChangeText={(text) => setSquareFeet(text.replace(/\\D/g, ''))}
                  placeholder="1200"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.propertyCell}>
                <Text style={styles.label}>Pets</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>{hasPets ? 'Yes' : 'No'}</Text>
                  <Switch value={hasPets} onValueChange={setHasPets} />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Price Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                ${hourlyRate.toFixed(0)}/hr x {formatDuration(serviceDuration)} hrs
              </Text>
              <Text style={styles.summaryValue}>${subtotal.toFixed(0)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>Service Fee</Text>
              <Text style={styles.summaryValue}>${serviceFee.toFixed(0)}</Text>
            </View>
            <View style={styles.summaryTotalRow}>
              <Text style={styles.summaryTotal}>Total</Text>
              <Text style={styles.summaryTotal}>${estimatedTotal.toFixed(0)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            {paymentLoading ? (
              <Text style={styles.summaryText}>Loading payment methods…</Text>
            ) : hasPaymentMethod ? (
              <View style={styles.paymentRow}>
                <Ionicons name="card-outline" size={18} color="#0F172A" />
                <Text style={styles.paymentText}>
                  {paymentMethods.find(pm => pm.id === selectedPaymentMethodId)?.brand || 'Card'} ••••
                  {paymentMethods.find(pm => pm.id === selectedPaymentMethodId)?.last_four}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addCardButton}
                onPress={() => navigation.navigate('PaymentScreen', { fromBooking: true, bookingTotal: estimatedTotal, cleanerId })}
              >
                <Text style={styles.addCardText}>Add Card</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, !hasPaymentMethod && styles.primaryButtonDisabled]}
            onPress={handleContinue}
            disabled={isSubmitting || !hasPaymentMethod}
          >
            <LinearGradient colors={['#3ad3db', '#2BC8D4']} style={styles.primaryGradient}>
              <Text style={styles.primaryText}>
                {isSubmitting ? 'Booking…' : 'Pay & Confirm'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onOpenEmail={() => {
          setAuthModalVisible(false);
          navigation.navigate('AuthScreen');
        }}
      />

      <Modal transparent visible={successVisible} animationType="fade">
        <View style={styles.successOverlay}>
          <Animated.View style={[styles.successCard, { transform: [{ scale: successScale }] }]}>
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.successTitle}>Booked!</Text>
            <Text style={styles.successSubtitle}>Your ChoreHero is on the way.</Text>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  subtitle: { marginTop: 6, fontSize: 14, color: '#64748B' },
  card: {
    marginTop: 20,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  durationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  durationButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  durationButtonDisabled: { opacity: 0.4 },
  durationValue: {
    flex: 1,
    marginHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  durationText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  durationHint: { marginTop: 8, fontSize: 12, color: '#64748B' },
  label: { fontSize: 13, color: '#334155', marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 12,
    backgroundColor: '#ffffff',
  },
  row: { flexDirection: 'row', gap: 8 },
  halfInput: { flex: 1 },
  quarterInput: { flex: 0.5 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: {
    borderWidth: 1,
    borderColor: '#CBD5F5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  pillActive: { backgroundColor: '#3ad3db', borderColor: '#3ad3db' },
  pillText: { color: '#334155', fontWeight: '600' },
  pillTextActive: { color: '#ffffff' },
  addressPill: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
  addressPillActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  addressPillText: { color: '#334155', fontWeight: '600', fontSize: 12 },
  addressPillTextActive: { color: '#ffffff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  switchLabel: { fontSize: 13, color: '#334155', fontWeight: '600' },
  propertyGrid: { flexDirection: 'row', gap: 12, marginTop: 8 },
  propertyCell: { flex: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryText: { color: '#64748B', fontSize: 14 },
  summaryValue: { color: '#0F172A', fontWeight: '700' },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  summaryTotal: { color: '#0F172A', fontSize: 16, fontWeight: '800' },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paymentText: { color: '#0F172A', fontWeight: '600' },
  addCardButton: {
    borderWidth: 1,
    borderColor: '#3ad3db',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addCardText: { color: '#0F172A', fontWeight: '700' },
  primaryButton: { marginTop: 24, borderRadius: 16, overflow: 'hidden' },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryGradient: { paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
  prefillSummary: { gap: 6 },
  prefillText: { color: '#334155', fontSize: 14, fontWeight: '600' },
  placesList: { borderRadius: 12 },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCard: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 220,
  },
  successEmoji: { fontSize: 40 },
  successTitle: { fontSize: 20, fontWeight: '800', marginTop: 8, color: '#0F172A' },
  successSubtitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
});

export default BookingSummaryScreen;
