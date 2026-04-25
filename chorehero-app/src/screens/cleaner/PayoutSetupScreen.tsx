/**
 * Cleaner Stripe Connect onboarding entry point.
 *
 * Flow:
 *   1. Tap "Set up payouts" → calls `create-stripe-connect-link` edge function
 *   2. Opens the returned URL in `WebBrowser` (Stripe-hosted onboarding)
 *   3. On dismiss/return, calls `get-stripe-connect-status` to refresh the gate
 *   4. If `onboardingComplete`, mark the cleaner as ready to accept jobs
 *
 * The deep links `chorehero://stripe-connect-return` and `…-refresh` need to be
 * registered in app.json `scheme` (already `chorehero`).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { wp, hp } from '../../utils/responsive';
import { cleanerTheme } from '../../utils/theme';

const BRAND = cleanerTheme.colors.primary;
const BRAND_DARK = cleanerTheme.colors.primaryDark;

type StackParamList = {
  PayoutSetup: undefined;
  SettingsScreen: undefined;
};

type Props = {
  navigation: StackNavigationProp<StackParamList, 'PayoutSetup'>;
};

interface ConnectStatus {
  accountId: string | null;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements: string[];
}

const initialStatus: ConnectStatus = {
  accountId: null,
  onboardingComplete: false,
  payoutsEnabled: false,
  detailsSubmitted: false,
  requirements: [],
};

const PayoutSetupScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectStatus>(initialStatus);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase.functions.invoke('get-stripe-connect-status', {
        body: {},
      });
      if (error) {
        console.warn('get-stripe-connect-status error:', error.message);
        return;
      }
      if (data && typeof data === 'object') {
        setStatus({
          accountId: (data as ConnectStatus).accountId ?? null,
          onboardingComplete: !!(data as ConnectStatus).onboardingComplete,
          payoutsEnabled: !!(data as ConnectStatus).payoutsEnabled,
          detailsSubmitted: !!(data as ConnectStatus).detailsSubmitted,
          requirements: (data as ConnectStatus).requirements ?? [],
        });
      }
    } catch (e) {
      console.warn('get-stripe-connect-status threw:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void refreshStatus();
      return undefined;
    }, [refreshStatus])
  );

  useEffect(() => {
    // Direct deep-link return from Stripe: refresh immediately. The redirect
    // sometimes comes back through Linking even if WebBrowser already closed.
    const sub = Linking.addEventListener('url', () => {
      void refreshStatus();
    });
    return () => sub.remove();
  }, [refreshStatus]);

  const handleStart = useCallback(async () => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      const refreshUrl = Linking.createURL('stripe-connect-refresh');
      const returnUrl = Linking.createURL('stripe-connect-return');
      const { data, error } = await supabase.functions.invoke('create-stripe-connect-link', {
        body: { refreshUrl, returnUrl },
      });
      if (error || !data || !(data as { onboardingUrl?: string }).onboardingUrl) {
        const msg =
          (data as { error?: string } | null)?.error ||
          error?.message ||
          'Could not start payout setup';
        throw new Error(msg);
      }
      const url = (data as { onboardingUrl: string }).onboardingUrl;
      const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
      // Refresh whether they finished or cancelled — the cleaner may have
      // partially submitted info.
      await refreshStatus();
      if (result.type !== 'success') {
        // Not necessarily an error — they may have closed the sheet on purpose.
        return;
      }
    } catch (e) {
      Alert.alert('Payouts', e instanceof Error ? e.message : 'Could not start payout setup');
    } finally {
      setIsStarting(false);
    }
  }, [isStarting, refreshStatus]);

  const renderStatus = () => {
    if (isLoading) {
      return (
        <View style={styles.statusBox}>
          <ActivityIndicator color={BRAND} />
          <Text style={styles.statusBoxText}>Checking your payout status…</Text>
        </View>
      );
    }
    if (status.onboardingComplete) {
      return (
        <View style={[styles.statusBox, styles.statusBoxOk]}>
          <Ionicons name="checkmark-circle" size={22} color="#047857" />
          <View style={styles.statusBoxTextCol}>
            <Text style={styles.statusBoxTitle}>Payouts enabled</Text>
            <Text style={styles.statusBoxText}>
              You can accept jobs and get paid directly to your bank account.
            </Text>
          </View>
        </View>
      );
    }
    if (status.detailsSubmitted) {
      return (
        <View style={[styles.statusBox, styles.statusBoxPending]}>
          <Ionicons name="time" size={22} color={BRAND_DARK} />
          <View style={styles.statusBoxTextCol}>
            <Text style={styles.statusBoxTitle}>Verification in progress</Text>
            <Text style={styles.statusBoxText}>
              Stripe is reviewing your information. You'll be ready to accept jobs as soon as they finish.
            </Text>
          </View>
        </View>
      );
    }
    if (status.accountId) {
      return (
        <View style={[styles.statusBox, styles.statusBoxPending]}>
          <Ionicons name="alert-circle" size={22} color={BRAND_DARK} />
          <View style={styles.statusBoxTextCol}>
            <Text style={styles.statusBoxTitle}>Onboarding incomplete</Text>
            <Text style={styles.statusBoxText}>
              You started payout setup but haven't finished. Pick up where you left off below.
            </Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.statusBox}>
        <Ionicons name="card-outline" size={22} color={BRAND_DARK} />
        <View style={styles.statusBoxTextCol}>
          <Text style={styles.statusBoxTitle}>Set up payouts to start earning</Text>
          <Text style={styles.statusBoxText}>
            We use Stripe to send your earnings straight to your bank. It takes about 3 minutes.
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payouts</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {renderStatus()}

        <View style={styles.bulletList}>
          <Bullet icon="lock-closed-outline" text="Your bank info is handled by Stripe — we never see it." />
          <Bullet icon="cash-outline" text="Payouts arrive 1–2 business days after each completed job." />
          <Bullet icon="shield-checkmark-outline" text="Required by law for processing payments — same as Uber, DoorDash, etc." />
        </View>

        {!status.onboardingComplete && (
          <TouchableOpacity
            style={[styles.cta, isStarting && styles.ctaDisabled]}
            onPress={handleStart}
            disabled={isStarting}
            accessibilityRole="button"
            accessibilityLabel={status.accountId ? 'Continue payout setup' : 'Start payout setup'}
          >
            {isStarting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.ctaText}>
                {status.accountId ? 'Continue setup' : 'Set up payouts'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {status.requirements.length > 0 && (
          <View style={styles.requirementsBox}>
            <Text style={styles.requirementsTitle}>Stripe still needs:</Text>
            {status.requirements.map((r) => (
              <Text key={r} style={styles.requirementsItem}>
                • {r.replace(/_/g, ' ')}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const Bullet: React.FC<{ icon: keyof typeof Ionicons.glyphMap; text: string }> = ({ icon, text }) => (
  <View style={styles.bulletRow}>
    <Ionicons name={icon} size={18} color={BRAND_DARK} />
    <Text style={styles.bulletText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.5%'),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#0F172A',
  },
  content: {
    padding: wp('5%'),
    gap: hp('2%'),
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: wp('3%'),
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusBoxOk: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  statusBoxPending: {
    borderColor: 'rgba(255, 165, 47, 0.45)',
    backgroundColor: '#FFF7ED',
  },
  statusBoxTextCol: {
    flex: 1,
    gap: 2,
  },
  statusBoxTitle: {
    fontSize: wp('4%'),
    fontWeight: '700',
    color: '#0F172A',
  },
  statusBoxText: {
    fontSize: wp('3.4%'),
    color: '#475569',
    lineHeight: wp('5%'),
  },
  bulletList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: hp('1.4%'),
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: wp('3%'),
  },
  bulletText: {
    flex: 1,
    fontSize: wp('3.5%'),
    color: '#1F2937',
    lineHeight: wp('5%'),
  },
  cta: {
    backgroundColor: BRAND,
    borderRadius: 14,
    paddingVertical: hp('1.8%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: wp('4%'),
    fontWeight: '700',
  },
  requirementsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  requirementsTitle: {
    fontSize: wp('3.6%'),
    fontWeight: '700',
    color: '#0F172A',
  },
  requirementsItem: {
    fontSize: wp('3.3%'),
    color: '#475569',
  },
});

export default PayoutSetupScreen;
