/**
 * WelcomeScreen - BiteSight-inspired auth entry.
 * Phone primary, social sign-in, guest browse. Replaces AuthScreen as default entry.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { supabase } from '../../services/supabase';
import { consumePostAuthRoute } from '../../utils/authPendingAction';
import { getResetToMainTabsChoresAction } from '../../navigation/mainTabsContentNavigation';
import { getGuestSession } from '../../utils/guestSession';
import { wp, hp } from '../../utils/responsive';

WebBrowser.maybeCompleteAuthSession();

type StackParamList = {
  Welcome: undefined;
  AuthScreen: { presetRole?: 'customer' | 'cleaner' } | undefined;
  PhoneVerify: { phone: string };
  ProfileType: undefined;
  MainTabs: undefined;
};

type WelcomeScreenNavigationProp = {
  navigate: (name: keyof StackParamList, params?: any) => void;
  reset: (config: { index: number; routes: { name: keyof StackParamList; params?: any }[] }) => void;
};

interface WelcomeScreenProps {
  navigation: WelcomeScreenNavigationProp;
}

const TEAL = '#00BCD4';
const TEAL_DARK = '#00ACC1';

const formatPhoneInput = (text: string): string => {
  const digits = text.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const isValidPhone = (text: string): boolean => {
  const digits = text.replace(/\D/g, '');
  return digits.length === 10 && /^[2-9]\d{2}[2-9]\d{2}\d{4}$/.test(digits);
};

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [isReturningGuest, setIsReturningGuest] = useState(false);
  const { refreshSession, enterGuestMode } = useAuth();

  useEffect(() => {
    trackEvent('welcome_screen_view');
    getGuestSession().then((s) => setIsReturningGuest(!!s));
  }, []);

  const trackEvent = (event: string, props?: Record<string, unknown>) => {
    try {
      if (typeof (global as any).__analytics?.track === 'function') {
        (global as any).__analytics.track(event, props);
      }
    } catch {
      // Analytics stub - no-op if not configured
    }
  };

  const handlePostAuthRedirect = async (): Promise<boolean> => {
    const route = await consumePostAuthRoute();
    if (!route?.name) return false;
    const p = route.params as { screen?: string; params?: Record<string, unknown> } | undefined;
    if (route.name === 'MainTabs' && p?.screen === 'Content') {
      navigation.dispatch(getResetToMainTabsChoresAction(p.params as any));
      return true;
    }
    if (route.name === 'VideoFeed') {
      navigation.dispatch(getResetToMainTabsChoresAction(route.params as any));
      return true;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: route.name as keyof StackParamList, params: route.params }],
    });
    return true;
  };

  const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), ms)
      ),
    ]);
  };

  /**
   * Welcome is the customer-facing entry point ("Find heroes in your neighborhood").
   * Pre-stamp the pending role as customer before opening AuthScreen so a brand-new
   * email signup can skip the redundant ProfileType picker and land in customer
   * onboarding directly. Cleaners reach signup through Settings → "Become a ChoreHero"
   * which already sets the role to cleaner.
   */
  const goToEmailAuth = async (presetRole: 'customer' | 'cleaner' = 'customer') => {
    try {
      await AsyncStorage.setItem('pending_auth_role', presetRole);
    } catch {
      // no-op
    }
    navigation.navigate('AuthScreen', { presetRole });
  };

  const handlePhoneContinue = async () => {
    if (!isValidPhone(phone)) return;
    setPhoneLoading(true);
    try {
      trackEvent('phone_submit');
      const response = await authService.sendVerificationCode(phone);
      if (response.success && response.data?.requires_verification) {
        const digits = phone.replace(/\D/g, '');
        navigation.navigate('PhoneVerify', { phone: `+1${digits}` });
      } else {
        Alert.alert(
          'Phone Sign-In',
          response.error || 'Unable to send verification code. Try "Sign in with email" or use Apple/Google.',
          [
            { text: 'OK' },
            { text: 'Sign in with email', onPress: () => goToEmailAuth() },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        'Phone Sign-In',
        'Something went wrong. Try "Sign in with email" or use Apple/Google.',
        [
          { text: 'OK' },
          { text: 'Sign in with email', onPress: () => goToEmailAuth() },
        ]
      );
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const redirectUri = makeRedirectUri({
        native: 'chorehero://auth',
        scheme: 'chorehero',
        preferLocalhost: false,
      });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUri, skipBrowserRedirect: true },
      });
      if (error) {
        Alert.alert('Google Sign-in Failed', error.message);
        return;
      }
      if (data?.url) {
        await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        await withTimeout(refreshSession(), 8000).catch(() => {});
        trackEvent('social_signin_google');
        const redirected = await handlePostAuthRedirect();
        if (!redirected) await refreshSession();
      } else {
        Alert.alert('Google Sign-in', 'Unable to start Google authentication.');
      }
    } catch (e) {
      Alert.alert('Google Sign-in Error', e instanceof Error ? e.message : 'Unexpected error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setIsLoading(true);
      const redirectUri = makeRedirectUri({
        native: 'chorehero://auth',
        scheme: 'chorehero',
        preferLocalhost: false,
      });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: redirectUri, skipBrowserRedirect: true },
      });
      if (error) {
        Alert.alert('Apple Sign-in Failed', error.message);
        return;
      }
      if (data?.url) {
        await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        await withTimeout(refreshSession(), 8000).catch(() => {});
        trackEvent('social_signin_apple');
        const redirected = await handlePostAuthRedirect();
        if (!redirected) await refreshSession();
      } else {
        Alert.alert('Apple Sign-in', 'Unable to start Apple authentication.');
      }
    } catch (e) {
      Alert.alert('Apple Sign-in Error', e instanceof Error ? e.message : 'Unexpected error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBrowseWithoutSignIn = async () => {
    trackEvent('guest_browse_start');
    await enterGuestMode();
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
          <View style={styles.heroSection}>
            <Image
              source={require('../../../assets/app-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.headline}>
              {isReturningGuest ? 'Welcome back!' : 'Find heroes in your neighborhood'}
            </Text>
            <Text style={styles.subhead}>
              {isReturningGuest
                ? 'Continue browsing or sign up to book'
                : 'Watch real work, book instantly'}
            </Text>
          </View>

          {/* Phone input */}
          <View style={styles.formSection}>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>+1</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder="(555) 123-4567"
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={(t) => setPhone(formatPhoneInput(t))}
                keyboardType="phone-pad"
                maxLength={14}
                editable={!phoneLoading}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.continueButton,
                (!isValidPhone(phone) || phoneLoading) && styles.continueButtonDisabled,
              ]}
              onPress={handlePhoneContinue}
              disabled={!isValidPhone(phone) || phoneLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>
                {phoneLoading ? 'Sending...' : 'Continue'}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
              >
                <Ionicons name="logo-google" size={20} color="#DB4437" />
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={handleAppleSignIn}
                disabled={isLoading}
              >
                <Ionicons name="logo-apple" size={20} color="#000000" />
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.guestLink}
              onPress={handleBrowseWithoutSignIn}
              activeOpacity={0.7}
            >
              <Text style={styles.guestLinkText}>Browse without signing in</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.emailLink}
              onPress={() => goToEmailAuth()}
              activeOpacity={0.7}
            >
              <Text style={styles.emailLinkText}>Sign in with email</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: wp('6%'),
    paddingTop: hp('4%'),
    paddingBottom: hp('8%'),
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: hp('5%'),
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: hp('2%'),
  },
  headline: {
    fontSize: wp('6%'),
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subhead: {
    fontSize: wp('4%'),
    color: '#6B7280',
    textAlign: 'center',
  },
  formSection: {
    gap: 16,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    height: 56,
  },
  countryCode: {
    paddingHorizontal: 16,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    height: '100%',
    justifyContent: 'center',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  continueButton: {
    height: 56,
    backgroundColor: TEAL,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#9CA3AF',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  guestLink: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  guestLinkText: {
    fontSize: 15,
    fontWeight: '500',
    color: TEAL,
    textDecorationLine: 'underline',
  },
  emailLink: {
    alignSelf: 'center',
    marginTop: 4,
    paddingVertical: 4,
  },
  emailLinkText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});

export default WelcomeScreen;
