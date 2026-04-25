/**
 * ProfileTypeScreen - Account selection.
 * Each card previews its role's brand: customer (teal) vs cleaner (orange),
 * so users feel the visual identity before committing.
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  Animated,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { wp, hp } from '../../utils/responsive';
import { navigationRef } from '../../navigation/navigationRef';

type StackParamList = {
  ProfileType: undefined;
  Welcome: undefined;
  LocationLock: undefined;
  CleanerOnboarding: undefined;
};

type ProfileTypeNavigationProp = {
  navigate: (name: keyof StackParamList) => void;
};

interface ProfileTypeScreenProps {
  navigation: ProfileTypeNavigationProp;
}

const CUSTOMER_TEAL = '#26B7C9';
const CUSTOMER_TEAL_DARK = '#047B9B';
const CLEANER_ORANGE = '#FFA52F';
const CLEANER_ORANGE_DARK = '#B45309';
const NEUTRAL_BG = '#F8FAFC';
const TEXT_PRIMARY = '#0F172A';
const TEXT_SECONDARY = '#475569';
const TEXT_MUTED = '#64748B';
const CARD_BORDER = '#E2E8F0';

const ProfileTypeScreen: React.FC<ProfileTypeScreenProps> = ({ navigation }) => {
  const { authUser, refreshUser } = useAuth();

  const customerScale = useRef(new Animated.Value(1)).current;
  const cleanerScale = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeIn, slideUp]);

  const trackEvent = (event: string) => {
    try {
      if (typeof (global as any).__analytics?.track === 'function') {
        (global as any).__analytics.track(event);
      }
    } catch {
      // no-op
    }
  };

  const pressIn = (anim: Animated.Value) => {
    Animated.spring(anim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const pressOut = (anim: Animated.Value) => {
    Animated.spring(anim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 8,
    }).start();
  };

  const [isPersistingRole, setIsPersistingRole] = React.useState(false);

  const handleSelect = async (type: 'customer' | 'cleaner') => {
    if (isPersistingRole) return;
    trackEvent(type === 'customer' ? 'profile_select_customer' : 'profile_select_pro');

    const userId = authUser?.user?.id;
    AsyncStorage.setItem('pending_auth_role', type).catch(() => {});

    // For not-yet-signed-in users, route to Welcome — auth required first.
    if (type === 'cleaner' && !userId) {
      Alert.alert('Sign In Required', 'Create or sign in to start a cleaner profile.', [
        { text: 'Sign In', onPress: () => navigation.navigate('Welcome') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }

    if (userId) {
      // Await the upsert before navigating so the AppNavigator's `getInitialRoute()`
      // sees `users.role` on next mount and doesn't bounce the user back to the
      // ProfileType picker (root cause of the "I already chose customer but the
      // app sends me back to account selection" report).
      setIsPersistingRole(true);
      try {
        const updates =
          type === 'customer'
            ? { role: 'customer', customer_onboarding_state: 'IDENTITY_PENDING', customer_onboarding_step: 1 }
            : { role: 'cleaner', cleaner_onboarding_state: 'APPLICANT', cleaner_onboarding_step: 1 };
        const profilePayload = {
          id: userId,
          email: authUser?.user?.email || null,
          name: authUser?.user?.name || null,
          phone: authUser?.user?.phone || null,
          username: (authUser?.user as any)?.username || null,
          ...updates,
        };
        const { error } = await supabase
          .from('users')
          .upsert(profilePayload, { onConflict: 'id' });
        if (error) {
          console.warn('Failed to persist onboarding state:', error);
        }
        await refreshUser();
      } catch (err) {
        console.warn('handleSelect upsert threw:', err);
      } finally {
        setIsPersistingRole(false);
      }
    }

    if (type === 'customer') {
      navigation.navigate('LocationLock');
      return;
    }

    navigation.navigate('CleanerOnboarding');
  };

  const handleBack = () => {
    const nav = navigation as { canGoBack?: () => boolean; goBack?: () => void };
    if (nav.canGoBack?.()) {
      nav.goBack?.();
      return;
    }
    // Never send role-picker back to MainTabs; fallback must stay in auth flow.
    if (navigationRef.isReady()) {
      navigationRef.navigate('Welcome' as never);
      return;
    }
    navigation.navigate('Welcome');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={NEUTRAL_BG} />
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerLogoBlock}>
          <Image
            source={require('../../../assets/app-logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.intro,
            {
              opacity: fadeIn,
              transform: [{ translateY: slideUp }],
            },
          ]}
        >
          <Text style={styles.eyebrow}>Welcome to ChoreHero</Text>
          <Text style={styles.title}>How will you use ChoreHero?</Text>
          <Text style={styles.subtitle}>
            Pick the experience that fits you today. You can switch from your settings later.
          </Text>
        </Animated.View>

        {/* Customer card — teal preview */}
        <Animated.View
          style={{
            opacity: fadeIn,
            transform: [{ translateY: slideUp }, { scale: customerScale }],
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPressIn={() => pressIn(customerScale)}
            onPressOut={() => pressOut(customerScale)}
            onPress={() => handleSelect('customer')}
            style={styles.cardWrap}
            accessibilityRole="button"
            accessibilityLabel="Continue as customer"
          >
            <View style={[styles.card, styles.cardCustomer]}>
              <LinearGradient
                colors={[`${CUSTOMER_TEAL}1A`, `${CUSTOMER_TEAL}05`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBubble, { backgroundColor: `${CUSTOMER_TEAL}1F` }]}>
                    <Ionicons name="home" size={26} color={CUSTOMER_TEAL_DARK} />
                  </View>
                  <View style={[styles.rolePill, { backgroundColor: `${CUSTOMER_TEAL}1A`, borderColor: `${CUSTOMER_TEAL}33` }]}>
                    <Text style={[styles.rolePillText, { color: CUSTOMER_TEAL_DARK }]}>Customer</Text>
                  </View>
                </View>

                <Text style={styles.cardTitle}>Find a ChoreHero</Text>
                <Text style={styles.cardSubtitle}>
                  Book trusted local pros for cleaning, handyman, and more.
                </Text>

                <View style={styles.bulletRow}>
                  <View style={styles.bullet}>
                    <Ionicons name="flash" size={14} color={CUSTOMER_TEAL_DARK} />
                    <Text style={styles.bulletText}>Same-day options</Text>
                  </View>
                  <View style={styles.bullet}>
                    <Ionicons name="shield-checkmark" size={14} color={CUSTOMER_TEAL_DARK} />
                    <Text style={styles.bulletText}>Verified pros</Text>
                  </View>
                  <View style={styles.bullet}>
                    <Ionicons name="videocam" size={14} color={CUSTOMER_TEAL_DARK} />
                    <Text style={styles.bulletText}>Video quotes</Text>
                  </View>
                </View>

                <View style={styles.ctaRow}>
                  <Text style={[styles.ctaText, { color: CUSTOMER_TEAL_DARK }]}>Get started</Text>
                  <Ionicons name="arrow-forward" size={18} color={CUSTOMER_TEAL_DARK} />
                </View>
              </LinearGradient>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Cleaner card — orange preview */}
        <Animated.View
          style={{
            opacity: fadeIn,
            transform: [{ translateY: slideUp }, { scale: cleanerScale }],
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPressIn={() => pressIn(cleanerScale)}
            onPressOut={() => pressOut(cleanerScale)}
            onPress={() => handleSelect('cleaner')}
            style={styles.cardWrap}
            accessibilityRole="button"
            accessibilityLabel="Continue as a cleaner"
          >
            <View style={[styles.card, styles.cardCleaner]}>
              <LinearGradient
                colors={[`${CLEANER_ORANGE}26`, `${CLEANER_ORANGE}08`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBubble, { backgroundColor: `${CLEANER_ORANGE}26` }]}>
                    <Ionicons name="briefcase" size={26} color={CLEANER_ORANGE_DARK} />
                  </View>
                  <View style={[styles.rolePill, { backgroundColor: `${CLEANER_ORANGE}1F`, borderColor: `${CLEANER_ORANGE}40` }]}>
                    <Text style={[styles.rolePillText, { color: CLEANER_ORANGE_DARK }]}>Pro</Text>
                  </View>
                </View>

                <Text style={styles.cardTitle}>Become a ChoreHero</Text>
                <Text style={styles.cardSubtitle}>
                  Grow your business with new bookings and recurring clients.
                </Text>

                <View style={styles.bulletRow}>
                  <View style={styles.bullet}>
                    <Ionicons name="cash" size={14} color={CLEANER_ORANGE_DARK} />
                    <Text style={styles.bulletText}>Set your rates</Text>
                  </View>
                  <View style={styles.bullet}>
                    <Ionicons name="calendar" size={14} color={CLEANER_ORANGE_DARK} />
                    <Text style={styles.bulletText}>Own your schedule</Text>
                  </View>
                  <View style={styles.bullet}>
                    <Ionicons name="megaphone" size={14} color={CLEANER_ORANGE_DARK} />
                    <Text style={styles.bulletText}>Win with video</Text>
                  </View>
                </View>

                <View style={styles.ctaRow}>
                  <Text style={[styles.ctaText, { color: CLEANER_ORANGE_DARK }]}>Start onboarding</Text>
                  <Ionicons name="arrow-forward" size={18} color={CLEANER_ORANGE_DARK} />
                </View>
              </LinearGradient>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.footer}>
          <Ionicons name="lock-closed" size={12} color={TEXT_MUTED} />
          <Text style={styles.footerText}>You can switch profile types later in settings</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: NEUTRAL_BG,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingTop: hp('1%'),
    paddingBottom: hp('1.2%'),
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  headerLogoBlock: {
    flex: 1,
    alignItems: 'center',
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerSpacer: { width: 40, height: 40 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: wp('5%'),
    paddingBottom: hp('5%'),
  },
  intro: {
    marginTop: hp('1.5%'),
    marginBottom: hp('3%'),
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: TEXT_MUTED,
    textTransform: 'uppercase',
    marginBottom: hp('0.8%'),
  },
  title: {
    fontSize: wp('7.5%'),
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.6,
    lineHeight: wp('9%'),
    marginBottom: hp('1%'),
  },
  subtitle: {
    fontSize: wp('3.8%'),
    color: TEXT_SECONDARY,
    lineHeight: wp('5.2%'),
  },
  cardWrap: {
    marginBottom: hp('2%'),
    borderRadius: 22,
  },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 4,
  },
  cardCustomer: {
    borderColor: `${CUSTOMER_TEAL}33`,
  },
  cardCleaner: {
    borderColor: `${CLEANER_ORANGE}40`,
  },
  cardGradient: {
    padding: wp('5%'),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('1.5%'),
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rolePill: {
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.5%'),
    borderRadius: 999,
    borderWidth: 1,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: wp('5.6%'),
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: wp('3.6%'),
    color: TEXT_SECONDARY,
    lineHeight: wp('5%'),
    marginBottom: hp('1.8%'),
  },
  bulletRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp('2%'),
    marginBottom: hp('2%'),
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.6%'),
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  bulletText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: hp('0.5%'),
  },
  ctaText: {
    fontSize: wp('3.8%'),
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: hp('1.5%'),
  },
  footerText: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontWeight: '500',
  },
});

export default ProfileTypeScreen;
