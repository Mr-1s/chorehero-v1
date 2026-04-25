import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { getMainTabBarChromeHeight } from '../../navigation/mainTabsChromeLayout';
import { supabase } from '../../services/supabase';
import { authService } from '../../services/auth';
import * as Linking from 'expo-linking';
import { useStripe } from '@stripe/stripe-react-native';
import { wp, hp } from '../../utils/responsive';

const PAYMENT_METHODS_STORAGE_KEY = 'chorehero_saved_payment_methods';

/**
 * Extract a useful error from a Supabase Edge Function call.
 * supabase-js v2 returns the parsed body in `data` when the function returns
 * JSON. When it errors with a non-2xx, the parsed body is on `fnError.context`
 * (a Response object) and we have to read it ourselves.
 */
async function parseEdgeFunctionError(
  data: unknown,
  fnError: { context?: { json?: () => Promise<unknown>; status?: number; text?: () => Promise<string> }; message?: string } | null | undefined
): Promise<string> {
  // Body that supabase-js parsed for us.
  if (data && typeof data === 'object' && 'error' in data) {
    const e = (data as { error?: string }).error;
    if (typeof e === 'string' && e.length) return e;
  }
  // Body that supabase-js left on the FunctionsHttpError context.
  const ctx = fnError?.context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body && typeof body === 'object' && 'error' in body) {
        const e = (body as { error?: string }).error;
        if (typeof e === 'string' && e.length) return e;
      }
    } catch {
      try {
        if (typeof ctx.text === 'function') {
          const text = await ctx.text();
          if (text) return text;
        }
      } catch {
        // ignore
      }
    }
  }
  const status = ctx?.status;
  const base = fnError?.message || 'Request failed';
  if (status === 404) {
    return 'Payment service is not deployed yet. Please contact support.';
  }
  if (status === 401 || status === 403) {
    return 'Your session expired. Please sign in again.';
  }
  if (/non-2xx/i.test(base)) {
    return 'Payment service returned an error. Please try again, or contact support if it continues.';
  }
  return base;
}

// Theme colors
const THEMES = {
  customer: {
    primary: '#047B9B',
    primaryLight: '#E0F7FA',
    primaryDark: '#0e7490',
    accent: '#26B7C9',
  },
  cleaner: {
    primary: '#F59E0B',
    primaryLight: '#FEF3C7',
    primaryDark: '#D97706',
    accent: '#FBBF24',
  },
};

type StackParamList = {
  PaymentScreen: {
    bookingId?: string;
    bookingTotal?: number;
    cleanerId?: string;
    fromBooking?: boolean;
    paymentIntent?: string;
  };
  BookingConfirmed: {
    bookingId: string;
    paymentId: string;
  };
  MainTabs: undefined;
};

type PaymentScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'PaymentScreen'>;
  route: RouteProp<StackParamList, 'PaymentScreen'>;
};

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank' | 'digital';
  provider: string;
  last4: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  nickname?: string;
}

interface BillingAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

const PaymentScreen: React.FC<PaymentScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const tabBarChromeBottom = getMainTabBarChromeHeight(insets.bottom);
  const { bookingId, bookingTotal, cleanerId, fromBooking, paymentIntent } = route.params || {};
  const { user, isCleaner } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  
  // Dynamic theme based on user role
  const theme = isCleaner ? THEMES.cleaner : THEMES.customer;
  
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  // Synchronous double-submit guard. `isProcessing` is React state and the
  // first paint may not flip the disabled prop before a fast double-tap fires.
  const addCardInFlightRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'methods' | 'billing' | 'history'>('methods');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    firstName: '',
    lastName: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
  });
  const [autoSaveCards, setAutoSaveCards] = useState(true);

  useEffect(() => {
    void loadPaymentData();
  }, [user?.id]);

  const mapRowToMethod = (row: {
    id: string;
    type: string;
    last_four: string | null;
    brand: string | null;
    exp_month: number | null;
    exp_year: number | null;
    is_default: boolean | null;
  }): PaymentMethod => {
    const b = (row.brand || 'card').toLowerCase();
    const pretty = b.charAt(0).toUpperCase() + b.slice(1);
    return {
      id: row.id,
      type: 'card',
      provider: row.type === 'card' ? pretty : 'Card',
      last4: row.last_four || '----',
      brand: b,
      expiryMonth: row.exp_month ?? undefined,
      expiryYear: row.exp_year ?? undefined,
      isDefault: !!row.is_default,
    };
  };

  const loadPaymentData = async () => {
    setIsLoading(true);
    try {
      if (user?.id) {
        const { data, error } = await supabase
          .from('payment_methods')
          .select('id, type, last_four, brand, exp_month, exp_year, is_default')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (error) {
          const storageKey = `${PAYMENT_METHODS_STORAGE_KEY}_${user.id}`;
          const stored = await AsyncStorage.getItem(storageKey);
          const local: PaymentMethod[] = stored ? JSON.parse(stored) : [];
          setPaymentMethods(local);
          setSelectedMethodId(
            local.find((m) => m.isDefault)?.id || local[0]?.id || null
          );
        } else {
          const rows = data ?? [];
          const methods = rows.map((r) => mapRowToMethod(r as any));
          setPaymentMethods(methods);
          setSelectedMethodId(
            methods.find((m) => m.isDefault)?.id || methods[0]?.id || null
          );
        }
      } else {
        const stored = await AsyncStorage.getItem(PAYMENT_METHODS_STORAGE_KEY);
        const local: PaymentMethod[] = stored ? JSON.parse(stored) : [];
        setPaymentMethods(local);
        setSelectedMethodId(
          local.find((m) => m.isDefault)?.id || local[0]?.id || null
        );
      }

      setBillingAddress({
        firstName: '',
        lastName: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US',
      });
    } catch {
      setPaymentMethods([]);
      setSelectedMethodId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCardWithStripe = async () => {
    if (!user?.id) {
      Alert.alert('Sign in required', 'Add a card after you sign in.');
      return;
    }
    if (!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      // Without the publishable key the Stripe SDK silently rejects every
      // setup-sheet invocation, which previously surfaced as a generic error.
      Alert.alert(
        'Payments not configured',
        'This build is missing the Stripe publishable key. Please update the app or contact support.'
      );
      return;
    }
    if (addCardInFlightRef.current) {
      // Double-tap guard — synchronous and survives React state batching.
      return;
    }
    addCardInFlightRef.current = true;
    setIsProcessing(true);
    try {
      // create-setup-intent returns 404 when the auth user has no row in
      // public.users. Backfill it first so the very first card-add doesn't fail.
      const ensureRes = await authService.ensureUserExists(user.id, {
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        phone: (user as { phone?: string }).phone ?? undefined,
        role: (user.role as 'customer' | 'cleaner' | undefined) ?? 'customer',
      });
      if (!ensureRes.success) {
        throw new Error(ensureRes.error || 'Could not prepare your account for payments.');
      }

      const { data, error: fnError } = await supabase.functions.invoke('create-setup-intent', {
        body: {},
      });
      if (fnError || !data || !(data as { clientSecret?: string }).clientSecret) {
        const msg = await parseEdgeFunctionError(data, fnError as any);
        throw new Error(msg || 'Could not start card setup');
      }
      if (!(data as { setupIntentId?: string }).setupIntentId) {
        const msg = await parseEdgeFunctionError(data, fnError as any);
        throw new Error(msg || 'Missing setup intent from server');
      }

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'ChoreHero',
        setupIntentClientSecret: (data as { clientSecret: string }).clientSecret,
        allowsDelayedPaymentMethods: false,
        returnURL: Linking.createURL('stripe-redirect'),
        defaultBillingDetails: { name: (user as { name?: string })?.name || '' },
      });
      if (initError) throw new Error(initError.message);

      const { error: sheetError } = await presentPaymentSheet();
      if (sheetError) {
        if (sheetError.code === 'Canceled') {
          return;
        }
        throw new Error(sheetError.message);
      }

      const { data: fin, error: finErr } = await supabase.functions.invoke('finalize-setup-intent', {
        body: { setupIntentId: (data as { setupIntentId: string }).setupIntentId },
      });
      if (finErr || !fin || (fin as { error?: string }).error) {
        const msg = await parseEdgeFunctionError(fin, finErr as any);
        throw new Error(msg || 'Could not save card');
      }

      if (user.role === 'customer') {
        await supabase
          .from('users')
          .update({
            customer_onboarding_state: 'TRANSACTION_READY',
            customer_onboarding_step: 5,
          })
          .eq('id', user.id);
      }

      await loadPaymentData();
      Alert.alert('Success', 'Payment method saved');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add card');
    } finally {
      setIsProcessing(false);
      addCardInFlightRef.current = false;
    }
  };

  const handleSetDefault = async (methodId: string) => {
    if (!user?.id) {
      const updated = paymentMethods.map((m) => ({ ...m, isDefault: m.id === methodId }));
      setPaymentMethods(updated);
      setSelectedMethodId(methodId);
      await AsyncStorage.setItem(PAYMENT_METHODS_STORAGE_KEY, JSON.stringify(updated));
      return;
    }
    const { error: a } = await supabase
      .from('payment_methods')
      .update({ is_default: false })
      .eq('user_id', user.id);
    if (a) {
      Alert.alert('Error', a.message);
      return;
    }
    const { error: b } = await supabase
      .from('payment_methods')
      .update({ is_default: true })
      .eq('id', methodId);
    if (b) {
      Alert.alert('Error', b.message);
      return;
    }
    await loadPaymentData();
  };

  const handleDeleteMethod = (methodId: string) => {
    Alert.alert('Remove Payment Method', 'Are you sure you want to remove this payment method?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (user?.id) {
            const { error } = await supabase.from('payment_methods').delete().eq('id', methodId);
            if (error) {
              Alert.alert('Error', error.message);
              return;
            }
            await loadPaymentData();
          } else {
            const updated = paymentMethods.filter((m) => m.id !== methodId);
            setPaymentMethods(updated);
            setSelectedMethodId(updated[0]?.id || null);
            await AsyncStorage.setItem(
              PAYMENT_METHODS_STORAGE_KEY,
              JSON.stringify(updated)
            );
          }
        },
      },
    ]);
  };

  const handleProcessPayment = async () => {
    if (!selectedMethodId && !fromBooking) {
      Alert.alert('No Payment Method', 'Please select a payment method');
      return;
    }

    setIsProcessing(true);
    try {
      // Secure payment flow: requires bookingId (amount computed server-side)
      if (fromBooking && bookingId && user?.id) {
        // 1. Create payment intent via Supabase edge function (secure: only bookingId, amount server-side)
        const { data: intentData, error: intentError } = await supabase.functions.invoke(
          'create-payment-intent',
          {
            body: { bookingId },
          }
        );

        if (intentError || !intentData?.clientSecret) {
          throw new Error(intentError?.message || intentData?.error || 'Failed to create payment intent');
        }

        const { clientSecret } = intentData;

        // 2. Initialize Stripe PaymentSheet
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'ChoreHero',
          paymentIntentClientSecret: clientSecret,
          allowsDelayedPaymentMethods: false,
          returnURL: Linking.createURL('stripe-redirect'),
          defaultBillingDetails: {
            name: user?.name || '',
          },
        });

        if (initError) throw new Error(initError.message);

        // 3. Present PaymentSheet — this is where the user enters/confirms card
        const { error: paymentError } = await presentPaymentSheet();

        if (paymentError) {
          if (paymentError.code === 'Canceled') {
            // User dismissed — not an error
            setIsProcessing(false);
            return;
          }
          // Mark booking payment as failed
          await supabase
            .from('bookings')
            .update({ payment_status: 'failed', status: 'payment_failed' })
            .eq('stripe_payment_intent_id', clientSecret.split('_secret_')[0]);
          throw new Error(paymentError.message);
        }

        // 4. Payment confirmed by Stripe — webhook will finalize booking
        const paymentId = clientSecret.split('_secret_')[0]; // payment intent id
        navigation.navigate('BookingConfirmed', {
          bookingId: bookingId || 'pending',
          paymentId,
        });
      } else {
        // Payment methods management only (no actual charge)
        Alert.alert('Success', 'Payment method updated successfully');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Payment Failed', error instanceof Error ? error.message : 'Please try again or use a different payment method');
    } finally {
      setIsProcessing(false);
    }
  };

  const getCardIcon = (brand?: string) => {
    switch (brand) {
      case 'visa': return 'card';
      case 'mastercard': return 'card';
      case 'amex': return 'card';
      default: return 'card-outline';
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'apple pay': return 'logo-apple';
      case 'google pay': return 'logo-google';
      case 'paypal': return 'logo-paypal';
      default: return 'card';
    }
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {[
        { id: 'methods', label: 'Payment', icon: 'card-outline' },
        { id: 'billing', label: 'Billing', icon: 'location-outline' },
        { id: 'history', label: 'History', icon: 'time-outline' },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[
            styles.tab, 
            activeTab === tab.id && [styles.activeTab, { borderBottomColor: theme.primary }]
          ]}
          onPress={() => setActiveTab(tab.id as any)}
        >
          <Ionicons 
            name={tab.icon as any} 
            size={20} 
            color={activeTab === tab.id ? theme.primary : '#6B7280'} 
          />
          <Text style={[
            styles.tabText, 
            activeTab === tab.id && [styles.activeTabText, { color: theme.primary }]
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPaymentMethod = (method: PaymentMethod) => (
    <View key={method.id} style={styles.paymentMethodCard}>
      <TouchableOpacity
        style={styles.methodSelector}
        onPress={() => setSelectedMethodId(method.id)}
      >
        <View style={styles.methodLeft}>
          <View style={[styles.methodIcon, { backgroundColor: theme.primaryLight }]}>
            <Ionicons 
              name={method.type === 'digital' ? getProviderIcon(method.provider) : getCardIcon(method.brand)}
              size={24} 
              color={theme.primary} 
            />
          </View>
          <View style={styles.methodInfo}>
            <Text style={styles.methodProvider}>{method.provider}</Text>
            <Text style={styles.methodDetails}>
              {method.type === 'digital' ? method.provider : `•••• •••• •••• ${method.last4}`}
            </Text>
            {method.nickname && (
              <Text style={styles.methodNickname}>{method.nickname}</Text>
            )}
          </View>
        </View>
        
        <View style={styles.methodRight}>
          {method.isDefault && (
            <View style={[styles.defaultBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.defaultText}>Default</Text>
            </View>
          )}
          <View style={[
            styles.radioButton,
            selectedMethodId === method.id && [styles.radioButtonSelected, { borderColor: theme.primary }]
          ]}>
            {selectedMethodId === method.id && (
              <View style={[styles.radioButtonInner, { backgroundColor: theme.primary }]} />
            )}
          </View>
        </View>
      </TouchableOpacity>
      
      <View style={styles.methodActions}>
        {!method.isDefault && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSetDefault(method.id)}
          >
            <Text style={styles.actionButtonText}>Set as Default</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteMethod(method.id)}
        >
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderBillingForm = () => (
    <View style={styles.billingForm}>
      <Text style={styles.sectionTitle}>Billing Address</Text>
      
      <View style={styles.inputRow}>
        <View style={[styles.inputGroup, { flex: 1, marginRight: wp('3%') }]}>
          <Text style={styles.inputLabel}>First Name</Text>
          <TextInput
            style={styles.textInput}
            value={billingAddress.firstName}
            onChangeText={(text) => setBillingAddress(prev => ({ ...prev, firstName: text }))}
            placeholder="John"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.inputLabel}>Last Name</Text>
          <TextInput
            style={styles.textInput}
            value={billingAddress.lastName}
            onChangeText={(text) => setBillingAddress(prev => ({ ...prev, lastName: text }))}
            placeholder="Doe"
          />
        </View>
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Address Line 1</Text>
        <TextInput
          style={styles.textInput}
          value={billingAddress.addressLine1}
          onChangeText={(text) => setBillingAddress(prev => ({ ...prev, addressLine1: text }))}
          placeholder="123 Main Street"
        />
      </View>
      
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Address Line 2 (Optional)</Text>
        <TextInput
          style={styles.textInput}
          value={billingAddress.addressLine2}
          onChangeText={(text) => setBillingAddress(prev => ({ ...prev, addressLine2: text }))}
          placeholder="Apartment, suite, etc."
        />
      </View>
      
      <View style={styles.inputRow}>
        <View style={[styles.inputGroup, { flex: 2, marginRight: wp('3%') }]}>
          <Text style={styles.inputLabel}>City</Text>
          <TextInput
            style={styles.textInput}
            value={billingAddress.city}
            onChangeText={(text) => setBillingAddress(prev => ({ ...prev, city: text }))}
            placeholder="San Francisco"
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1, marginRight: wp('3%') }]}>
          <Text style={styles.inputLabel}>State</Text>
          <TextInput
            style={styles.textInput}
            value={billingAddress.state}
            onChangeText={(text) => setBillingAddress(prev => ({ ...prev, state: text }))}
            placeholder="CA"
            maxLength={2}
          />
        </View>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.inputLabel}>ZIP</Text>
          <TextInput
            style={styles.textInput}
            value={billingAddress.zipCode}
            onChangeText={(text) => setBillingAddress(prev => ({ ...prev, zipCode: text }))}
            placeholder="94102"
            keyboardType="numeric"
          />
        </View>
      </View>
      
      <View style={styles.switchContainer}>
        <Text style={styles.switchLabel}>Automatically save new payment methods</Text>
        <Switch
          value={autoSaveCards}
          onValueChange={setAutoSaveCards}
          trackColor={{ false: '#E5E7EB', true: theme.primary }}
          thumbColor="#FFFFFF"
        />
      </View>
    </View>
  );

  const renderPaymentHistory = () => (
    <View style={styles.historyContainer}>
      <Text style={styles.sectionTitle}>Payment History</Text>
      <View style={styles.emptyHistory}>
        <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
        <Text style={styles.emptyHistoryText}>No payment history yet</Text>
        <Text style={styles.emptyHistorySubtext}>
          Your payment history will appear here after you make your first booking.
        </Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Loading payment information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 24 }} />
      </View>

      {bookingTotal && (
        <View style={[styles.totalContainer, { backgroundColor: theme.primary }]}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalAmount}>${bookingTotal.toFixed(2)}</Text>
        </View>
      )}

      {renderTabBar()}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarChromeBottom + hp('2%') }}
      >
        {activeTab === 'methods' && (
          <View style={styles.methodsContainer}>
            <View style={styles.methodsHeader}>
              <Text style={styles.sectionTitle}>Payment Methods</Text>
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: theme.primaryLight }]}
                onPress={handleAddCardWithStripe}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons name="add" size={20} color={theme.primary} />
                )}
                <Text style={[styles.addButtonText, { color: theme.primary }]}>Add Method</Text>
              </TouchableOpacity>
            </View>
            
            {paymentMethods.length > 0 ? (
              paymentMethods.map(renderPaymentMethod)
            ) : (
              <View style={styles.emptyMethods}>
                <Ionicons name="card-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyMethodsText}>No payment methods</Text>
                <Text style={styles.emptyMethodsSubtext}>
                  Add a payment method to get started with bookings.
                </Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'billing' && renderBillingForm()}
        {activeTab === 'history' && renderPaymentHistory()}
      </ScrollView>

      {fromBooking && bookingTotal && selectedMethodId && (
        <View style={[styles.bottomContainer, { marginBottom: tabBarChromeBottom }]}>
          <BlurView intensity={95} style={styles.bottomBlur}>
            <TouchableOpacity 
              style={[styles.processButton, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
              onPress={handleProcessPayment}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
                  <Text style={styles.processButtonText}>
                    Complete Payment • ${bookingTotal.toFixed(2)}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </BlurView>
        </View>
      )}

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: wp('4%'),
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: wp('11%'),
    height: wp('11%'),
    borderRadius: wp('5.5%'),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#1F2937',
  },
  totalContainer: {
    backgroundColor: '#047B9B', // Will be overridden dynamically
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: wp('3.5%'),
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: hp('0.5%'),
  },
  totalAmount: {
    fontSize: wp('6%'),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('3%'),
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#047B9B', // Will be overridden dynamically
  },
  tabText: {
    fontSize: wp('3.2%'),
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#047B9B', // Will be overridden dynamically
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto',
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  methodsContainer: {
    padding: wp('5%'),
  },
  methodsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('2.5%'),
  },
  sectionTitle: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: '#1F2937',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F7FA', // Will be overridden dynamically
    borderRadius: wp('5%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
  },
  addButtonText: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#047B9B', // Will be overridden dynamically
    marginLeft: 6,
  },
  paymentMethodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp('4%'),
    padding: wp('5%'),
    marginBottom: hp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  methodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  methodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodIcon: {
    width: wp('12%'),
    height: wp('12%'),
    borderRadius: wp('3%'),
    backgroundColor: '#E0F7FA', // Will be overridden dynamically
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp('4%'),
  },
  methodInfo: {
    flex: 1,
  },
  methodProvider: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: hp('0.5%'),
  },
  methodDetails: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginBottom: 2,
  },
  methodNickname: {
    fontSize: wp('3%'),
    color: '#9CA3AF',
  },
  methodRight: {
    alignItems: 'center',
  },
  defaultBadge: {
    backgroundColor: '#047B9B', // Will be overridden dynamically
    borderRadius: wp('3%'),
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    marginBottom: hp('1%'),
  },
  defaultText: {
    fontSize: wp('2.5%'),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: wp('3%'),
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#047B9B', // Will be overridden dynamically
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: wp('1.5%'),
    backgroundColor: '#047B9B', // Will be overridden dynamically
  },
  methodActions: {
    flexDirection: 'row',
    gap: wp('3%'),
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: wp('3%'),
    paddingVertical: hp('1.5%'),
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: '#374151',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    color: '#DC2626',
  },
  emptyMethods: {
    alignItems: 'center',
    paddingVertical: hp('5%'),
  },
  emptyMethodsText: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#374151',
    marginTop: hp('2%'),
    marginBottom: hp('1%'),
  },
  emptyMethodsSubtext: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    textAlign: 'center',
  },
  billingForm: {
    padding: wp('5%'),
  },
  inputGroup: {
    marginBottom: hp('2.5%'),
  },
  inputLabel: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: '#374151',
    marginBottom: hp('1%'),
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: wp('3%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    fontSize: wp('4%'),
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: hp('2%'),
  },
  switchLabel: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: '#374151',
    flex: 1,
    marginRight: wp('4%'),
  },
  historyContainer: {
    padding: wp('5%'),
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: hp('5%'),
  },
  emptyHistoryText: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#374151',
    marginTop: hp('2%'),
    marginBottom: hp('1%'),
  },
  emptyHistorySubtext: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    textAlign: 'center',
  },
  bottomContainer: {
    height: hp('12%'),
  },
  bottomBlur: {
    flex: 1,
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    justifyContent: 'center',
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#047B9B', // Will be overridden dynamically
    borderRadius: wp('4%'),
    paddingVertical: hp('2%'),
    gap: wp('2%'),
    shadowColor: '#047B9B', // Will be overridden dynamically
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  processButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default PaymentScreen; 