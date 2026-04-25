/**
 * Quote Accept - Payment flow for accepting a video quote.
 * USE_FAKE_PAYMENT: insert booking directly. Real: Stripe PaymentSheet → confirm-quote-payment.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useStripe } from '@stripe/stripe-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { jobQuoteService, Quote } from '../../services/jobQuoteService';
import { geocodeMailingAddress } from '../../services/addressGeocoding';
import { colors, typography, radii, spacing } from '../../utils/theme';

const USE_FAKE_PAYMENT = process.env.EXPO_PUBLIC_USE_FAKE_PAYMENT === 'true';
const PLATFORM_FEE_PCT = 0.20;

export default function QuoteAcceptScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { jobId, quoteId } = route.params || {};
  const [quote, setQuote] = useState<(Quote & { job?: any }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!quoteId) {
      setLoading(false);
      return;
    }
    (async () => {
      const res = await jobQuoteService.getQuote(quoteId);
      if (res.success && res.data) {
        setQuote(res.data);
      }
      setLoading(false);
    })();
  }, [quoteId]);

  const handleAcceptAndPay = async () => {
    if (!quote || !user?.id) {
      Alert.alert('Error', 'Missing quote or user');
      return;
    }
    if (quote.status !== 'pending' && quote.status !== 'viewed') {
      Alert.alert('Error', 'Quote no longer available');
      return;
    }

    setPaying(true);
    try {
      if (USE_FAKE_PAYMENT) {
        await handleFakePayment();
      } else {
        await handleRealPayment();
      }
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  const handleFakePayment = async () => {
    if (!quote) throw new Error('Quote not found');
    const job = quote.job;
    if (!job) throw new Error('Job not found');

    let addressId = job.address_id;
    if (!addressId && (job.street || job.city || job.zip_code)) {
      let lat: number | undefined;
      let lng: number | undefined;
      if (job.latitude != null && job.longitude != null) {
        const la = Number(job.latitude);
        const lo = Number(job.longitude);
        if (Number.isFinite(la) && Number.isFinite(lo)) {
          lat = la;
          lng = lo;
        }
      }
      if (lat == null || lng == null) {
        const g = await geocodeMailingAddress({
          street: job.street || 'Address',
          city: job.city || '',
          state: job.state || '',
          zip_code: job.zip_code || '',
          country: 'US',
        });
        if (g) {
          lat = g.latitude;
          lng = g.longitude;
        }
      }
      const { data: newAddr, error: addrErr } = await supabase
        .from('addresses')
        .insert({
          user_id: user!.id,
          street: job.street || 'Address',
          city: job.city || 'City',
          state: job.state || 'State',
          zip_code: job.zip_code || '00000',
          is_default: false,
          ...(lat != null && lng != null ? { latitude: lat, longitude: lng } : {}),
        })
        .select('id')
        .single();
      if (addrErr || !newAddr) throw new Error('Failed to create address');
      addressId = newAddr.id;
    }
    if (!addressId) throw new Error('Job address required');

    const totalAmount = (quote.price_cents || 0) / 100;
    const platformFee = totalAmount * PLATFORM_FEE_PCT;
    const serviceSubtotal = totalAmount - platformFee;
    const scheduledTime = new Date();
    scheduledTime.setDate(scheduledTime.getDate() + 1);
    scheduledTime.setHours(10, 0, 0, 0);

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        customer_id: user!.id,
        cleaner_id: quote.pro_id,
        quote_id: quote.id,
        job_id: quote.job_id,
        service_type: 'standard',
        status: 'confirmed',
        address_id: addressId,
        scheduled_time: scheduledTime.toISOString(),
        estimated_duration: 120,
        service_base_price: serviceSubtotal,
        platform_fee: platformFee,
        add_ons_total: 0,
        tax: 0,
        tip: 0,
        total_amount: totalAmount,
        cleaner_earnings: serviceSubtotal,
        stripe_payment_intent_id: 'FAKE_' + Date.now(),
        payment_status: 'succeeded',
        special_instructions: 'Booked from your quote',
        messaging_enabled: true,
      })
      .select('id')
      .single();

    if (error) throw error;
    if (!booking) throw new Error('Failed to create booking');

    await supabase.from('quotes').update({ status: 'accepted' }).eq('id', quote.id);
    await supabase
      .from('jobs')
      .update({ status: 'booked', booked_at: new Date().toISOString() })
      .eq('id', quote.job_id);
    await supabase
      .from('quotes')
      .update({ status: 'declined' })
      .eq('job_id', quote.job_id)
      .neq('id', quote.id);

    navigation.replace('BookingConfirmed', { bookingId: booking.id });
  };

  const handleRealPayment = async () => {
    console.log('=== STARTING PAYMENT ===');

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error('Supabase URL not configured');

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    // Debug logging for 401 diagnosis
    console.log('Session exists:', !!sessionData?.session);
    console.log('Token exists:', !!accessToken);
    console.log('Token first 20 chars:', accessToken?.substring(0, 20));
    console.log('Supabase URL:', supabaseUrl);
    console.log('Full URL:', `${supabaseUrl}/functions/v1/create-quote-payment-intent`);

    if (!accessToken) {
      Alert.alert('Auth Error', 'You are not logged in. Please sign in again.');
      return;
    }

    // create-quote-payment-intent has verify_jwt=false; no Authorization needed.
    const createRes = await fetch(`${supabaseUrl}/functions/v1/create-quote-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ quote_id: quote!.id }),
    });

    const responseText = await createRes.text();
    let createResult: { error?: string; clientSecret?: string; client_secret?: string; payment_intent_id?: string };
    try {
      createResult = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error(
        createRes.ok
          ? 'Invalid response from server'
          : `Server error (HTTP ${createRes.status}): ${responseText.substring(0, 100)}`
      );
    }

    if (createResult.error) {
      if (createRes.status === 401) {
        throw new Error('Session expired. Please sign out and sign in again, then retry payment.');
      }
      throw new Error(createResult.error);
    }

    const clientSecret = createResult.clientSecret || createResult.client_secret;
    const paymentIntentId = createResult.payment_intent_id;
    if (!clientSecret) {
      const serverMsg = createResult.error || (createRes.ok ? '' : `Server error (HTTP ${createRes.status})`);
      throw new Error(serverMsg || 'No client secret in response');
    }

    const { error: initError } = await initPaymentSheet({
      paymentIntentClientSecret: clientSecret,
      merchantDisplayName: 'Chore Hero',
      style: 'automatic',
      allowsDelayedPaymentMethods: false,
      returnURL: Linking.createURL('stripe-redirect'),
    });
    if (initError) throw new Error(`Stripe init failed: ${initError.message}`);

    const { error: paymentError } = await presentPaymentSheet();
    if (paymentError) {
      console.log('Stripe payment error:', paymentError);
      if (paymentError.code !== 'Canceled') {
        Alert.alert('Payment Failed', paymentError.message);
      }
      return;
    }

    console.log('Stripe payment successful, confirming...');

    const confirmRes = await fetch(`${supabaseUrl}/functions/v1/confirm-quote-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        quote_id: quote!.id,
        payment_intent_id: paymentIntentId,
      }),
    });
    const confirmResult = await confirmRes.json();
    console.log('Confirm result:', confirmResult);

    if (confirmResult.error || !confirmResult.success) {
      console.error('Confirm error:', confirmResult.error);
      throw new Error(confirmResult.error || 'Failed to confirm payment');
    }

    navigation.replace('BookingConfirmed', { bookingId: confirmResult.booking_id });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={colors.primaryTeal} style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (!quote) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backHit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.errorText}>Quote not found</Text>
        <TouchableOpacity style={styles.ghostButton} onPress={() => navigation.goBack()}>
          <Text style={styles.ghostButtonText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const price = (quote.price_cents || 0) / 100;
  const proName = (quote.pro as any)?.name || 'Pro';
  const jobHeadline = quote.job?.headline || 'Service';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backHit}
          disabled={paying}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Pay for quote
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroIconWrap}>
          <Ionicons name="shield-checkmark" size={28} color={colors.primaryTeal} />
        </View>
        <Text style={styles.screenSubtitle}>Review and complete checkout securely with Stripe.</Text>

        <View style={styles.card}>
          <Text style={styles.cardKicker}>Summary</Text>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Service</Text>
            <Text style={styles.value} numberOfLines={2}>
              {jobHeadline}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.label}>Pro</Text>
            <Text style={styles.value}>{proName}</Text>
          </View>
          <View style={styles.amountBlock}>
            <Text style={styles.label}>Total</Text>
            <Text style={styles.amount}>${price.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.notice}>
          <Ionicons
            name={USE_FAKE_PAYMENT ? 'flask-outline' : 'lock-closed-outline'}
            size={18}
            color={colors.primaryTealDark}
            style={styles.noticeIcon}
          />
          <Text style={styles.noticeText}>
            {USE_FAKE_PAYMENT
              ? 'Test mode: no real card charge.'
              : `You’ll pay $${price.toFixed(2)} with Stripe. In test mode the sheet shows a TEST badge; it disappears with live keys.`}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.payButton, paying && styles.disabled]}
          onPress={handleAcceptAndPay}
          disabled={paying}
          activeOpacity={0.9}
        >
          {paying ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <>
              <Ionicons name="card-outline" size={22} color={colors.textInverse} style={styles.payIcon} />
              <Text style={styles.payButtonText}>
                {USE_FAKE_PAYMENT ? 'Confirm booking (test)' : `Pay $${price.toFixed(2)}`}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelTouchable}
          onPress={() => navigation.goBack()}
          disabled={paying}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.neutralBg,
  },
  backHit: { padding: spacing.xs, marginRight: spacing.xs },
  headerTitle: {
    flex: 1,
    fontSize: typography.sizes.titleMd,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  heroIconWrap: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryTealSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  screenSubtitle: {
    textAlign: 'center',
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  card: {
    backgroundColor: colors.neutralBg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  cardKicker: {
    fontSize: typography.sizes.captionSm,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.md,
  },
  summaryRow: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    color: colors.textMuted,
    marginBottom: 4,
  },
  value: {
    fontSize: typography.sizes.bodyLg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  amountBlock: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  amount: {
    fontSize: typography.sizes.titleLg + 4,
    fontWeight: typography.weights.extrabold,
    color: colors.primaryTeal,
    letterSpacing: -0.4,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primaryTealSoft,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryTealBorder,
  },
  noticeIcon: { marginRight: spacing.sm, marginTop: 2 },
  noticeText: {
    flex: 1,
    color: colors.primaryTealDark,
    fontSize: typography.sizes.caption,
    lineHeight: 20,
  },
  payButton: {
    backgroundColor: colors.primaryTeal,
    paddingVertical: 16,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    shadowColor: colors.primaryTeal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  payIcon: { marginRight: 2 },
  disabled: { opacity: 0.65 },
  payButtonText: {
    color: colors.textInverse,
    fontSize: typography.sizes.titleSm,
    fontWeight: typography.weights.bold,
  },
  cancelTouchable: { padding: spacing.md, alignItems: 'center' },
  cancelText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
  },
  ghostButton: { padding: spacing.lg, alignItems: 'center' },
  ghostButtonText: { color: colors.primaryTeal, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold },
  errorText: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
  loader: {
    marginTop: 48,
  },
});
