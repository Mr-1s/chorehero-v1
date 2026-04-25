import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  StatusBar,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { milestoneNotificationService } from '../../services/milestoneNotificationService';
import { zipLookupService } from '../../services/zipLookupService';
import { setCleanerOnboardingOverride } from '../../utils/onboardingOverride';
import { useToast } from '../../components/Toast';
import { wp, hp } from '../../utils/responsive';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const CLEANER_BRAND = '#FFA52F';
const CLEANER_BRAND_DARK = '#B45309';
const CLEANER_BRAND_SOFT = '#FFF9F0';
const ORANGE_BORDER = 'rgba(255, 165, 47, 0.55)';

function parseOnboardingError(raw: string): { title: string; message: string } {
  const t = raw.replace(/^Failed to save user record:\s*/i, '').trim();
  if (/(users_phone|phone_key)/i.test(t) || (/duplicate|unique/i.test(t) && /phone/i.test(t))) {
    return {
      title: 'This phone number is already in use',
      message:
        'That number is linked to another account. Try signing in with it, or use a different phone number to create this profile.',
    };
  }
  if (/unique constraint|duplicate key/i.test(t)) {
    return {
      title: "We couldn’t save that",
      message:
        "Some of your information matches an account we already have. If you’re new here, double-check the fields or use Sign in.",
    };
  }
  return {
    title: "Something went wrong",
    message:
      t.length > 0 && t.length < 180
        ? t
        : "We couldn’t complete signup. Check your connection and try again, or use Sign in if you already have an account.",
  };
}

const ACCENT = CLEANER_BRAND;
const ACCENT_2 = CLEANER_BRAND;

const STEP_THEMES: Record<number, { icon: string; label: string; color: string }> = {
  1: { icon: '👋', label: 'Create Your Profile', color: ACCENT },
  2: { icon: '🗺️', label: 'Set Your Area', color: ACCENT_2 },
};

const SERVICE_CATEGORIES = [
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'mounting', label: 'Mounting' },
  { value: 'handyman', label: 'Handyman' },
  { value: 'organizing', label: 'Organizing' },
  { value: 'other', label: 'Other' },
] as const;

type StackParamList = {
  CleanerOnboarding: undefined;
  OnboardingComplete: undefined;
  MainTabs: undefined;
};

type CleanerOnboardingNavigationProp = StackNavigationProp<StackParamList, 'CleanerOnboarding'>;

interface CleanerOnboardingProps {
  navigation: CleanerOnboardingNavigationProp;
}

interface CleanerOnboardingData {
  // Step 1: Create Your Profile
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  serviceCategory: string;
  profilePhoto: string;
  // Step 2: Set Your Area
  serviceRadius: string;
  serviceZip: string;
}

const CleanerOnboardingScreen: React.FC<CleanerOnboardingProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [appErrorModal, setAppErrorModal] = useState<{ title: string; message: string } | null>(null);
  const hasAutoExited = useRef(false);
  const totalSteps = 2;
  const { refreshSession, refreshUser, authUser } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const getCleanerStateForStep = (step: number) => {
    if (step >= totalSteps) return 'STAGING';
    if (step >= 2) return 'SERVICE_DEFINED';
    return 'APPLICANT';
  };

  const resolveUserId = async () => {
    if (authUser?.user?.id) return authUser.user.id as string;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id;
  };

  const persistProgress = async (step: number) => {
    const userId = await resolveUserId();
    if (!userId) return;
    const state = getCleanerStateForStep(step);
    const { error } = await supabase
      .from('users')
      .update({
        cleaner_onboarding_state: state,
        cleaner_onboarding_step: step,
      })
      .eq('id', userId);
    if (error) {
      console.warn('Failed to persist onboarding progress:', error);
    }
  };

  useEffect(() => {
    const loadProgress = async () => {
      const userId = await resolveUserId();
      if (!userId) return;
      const { data, error } = await supabase
        .from('users')
        .select('cleaner_onboarding_step, cleaner_onboarding_state, role')
        .eq('id', userId)
        .single();
      if (error) return;
      if (data?.role && data.role !== 'cleaner') return;
      if (data?.cleaner_onboarding_step) {
        const step = Math.min(Math.max(data.cleaner_onboarding_step, 1), totalSteps);
        setCurrentStep(step);
      } else {
        await persistProgress(1);
      }
    };
    loadProgress();
  }, [authUser?.user?.id]);

  useEffect(() => {
    const resolveZip = async () => {
      const zip = (data?.serviceZip || '').trim();
      if (!zip || zip.length !== 5) return;
      try {
        setIsResolvingZip(true);
        const resolved = await zipLookupService.lookup(zip);
        const query = resolved ? `${resolved.city}, ${resolved.state}` : zip;
        const results = await Location.geocodeAsync(query);
        if (results?.[0]) {
          setServiceMapCenter({
            latitude: results[0].latitude,
            longitude: results[0].longitude,
          });
        }
      } catch {
        // no-op
      } finally {
        setIsResolvingZip(false);
      }
    };
    resolveZip();
  }, [data?.serviceZip]);

  useEffect(() => {
    const stepValue = authUser?.user?.cleaner_onboarding_step ?? 0;
    const stateValue = authUser?.user?.cleaner_onboarding_state;
    const shouldExit =
      authUser?.user?.role === 'cleaner' &&
      currentStep >= totalSteps &&
      (stateValue === 'STAGING' || stateValue === 'LIVE' || stepValue >= totalSteps);

    if (shouldExit && !hasAutoExited.current) {
      hasAutoExited.current = true;
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
  }, [
    authUser?.user?.role,
    authUser?.user?.cleaner_onboarding_state,
    authUser?.user?.cleaner_onboarding_step,
    currentStep,
    navigation,
    totalSteps,
  ]);

  const [data, setData] = useState<CleanerOnboardingData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    serviceCategory: 'cleaning',
    profilePhoto: `https://ui-avatars.com/api/?name=Cleaner&background=FFA52F&color=fff&size=160&font-size=0.4&format=png`,
    serviceRadius: '',
    serviceZip: '',
  });

  const scrollRef = useRef<ScrollView>(null);
  const confettiOpacity = useRef(new Animated.Value(0)).current;
  const [serviceMapCenter, setServiceMapCenter] = useState({
    latitude: 37.7749,
    longitude: -122.4194,
  });
  const [isResolvingZip, setIsResolvingZip] = useState(false);

  // Prefill from auth
  useEffect(() => {
    const u = authUser?.user as any;
    if (!u) return;
    const fullName: string | undefined = u.name || u.user_metadata?.full_name;
    const avatar: string | undefined = u.avatar_url || u.user_metadata?.picture;
    const emailFromAuth: string | undefined = u.email;
    const [firstName, ...rest] = (fullName || '').split(' ');
    setData(prev => ({
      ...prev,
      firstName: firstName || prev.firstName,
      lastName: rest.join(' ') || prev.lastName,
      email: emailFromAuth || prev.email,
      profilePhoto: avatar || prev.profilePhoto,
    }));
  }, [authUser]);

  const updateData = (field: keyof CleanerOnboardingData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): string | null => {
    switch (step) {
      case 1:
        if (!data.firstName?.trim() || !data.lastName?.trim()) return 'Please enter your first and last name';
        if (!data.email?.trim()) return 'Please enter your email';
        if (!data.phone?.trim()) return 'Please enter your phone number';
        break;
      case 2:
        if (!data.serviceRadius?.trim()) return 'Please select your service radius';
        break;
    }
    return null;
  };

  const handleNext = async () => {
    const error = validateStep(currentStep);
    if (error) {
      Alert.alert('Incomplete Information', error);
      return;
    }

    if (currentStep < totalSteps) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      persistProgress(nextStep);
    } else {
      handleComplete();
    }
  };

  const handleBack = async () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      persistProgress(prevStep);
      return;
    }
    try {
      await AsyncStorage.multiRemove([
        'last_route',
        'guest_user_role',
        'pending_auth_role',
        'cleaner_onboarding_complete',
      ]);
      setCleanerOnboardingOverride(false);
    } catch {
      // no-op
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'AuthScreen' as any }],
    });
  };

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      ),
    ]);
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Validate required fields
      if (!data.phone || data.phone.trim() === '') {
        Alert.alert('Missing Information', 'Please enter your phone number.');
        setIsLoading(false);
        return;
      }

      // Resolve current authenticated user robustly
      let userId: string | undefined;
      let userEmail: string | undefined;
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          'Get session'
        );
        if (session?.user) {
          userId = session.user.id;
          userEmail = session.user.email || undefined;
        }
      } catch {}
      if (!userId && authUser?.user?.id) {
        userId = authUser.user.id as string;
        userEmail = (authUser.user as any).email as string | undefined;
      }
      if (!userId) {
        await refreshSession();
        const { data: { session: session2 } } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          'Get session'
        );
        if (session2?.user) {
          userId = session2.user.id;
          userEmail = session2.user.email || undefined;
        }
      }
      
      // Don't log raw email or full user id (audit F-20: PII).
      console.log('Cleaner onboarding completion - resolved user:', userId ? `…${userId.slice(-4)}` : 'none');
      
      if (userId) {
        const usernameHint = (userEmail || '').split('@')[0]?.replace(/[^a-z0-9_]/gi, '')?.slice(0, 20) || `user_${userId.slice(0, 8)}`;
        let upsertUserError: any = null;
        try {
          const result = await withTimeout(
            supabase
              .from('users')
              .upsert([{
                id: userId,
                phone: data.phone,
                email: userEmail,
                name: `${data.firstName} ${data.lastName}`,
                username: usernameHint,
                role: 'cleaner',
                updated_at: new Date().toISOString(),
                cleaner_onboarding_state: 'STAGING',
                cleaner_onboarding_step: totalSteps,
              }], { onConflict: 'id' }),
            45000,
            'Upsert user record'
          );
          upsertUserError = result.error;
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (message.includes('timed out')) {
            console.warn('Upsert timed out, continuing and retrying in background');
            supabase
              .from('users')
              .upsert([{
                id: userId,
                phone: data.phone,
                email: userEmail,
                name: `${data.firstName} ${data.lastName}`,
                username: usernameHint,
                role: 'cleaner',
                updated_at: new Date().toISOString(),
                cleaner_onboarding_state: 'STAGING',
                cleaner_onboarding_step: totalSteps,
              }], { onConflict: 'id' })
              .then(() => {})
              .catch(() => {});
            upsertUserError = null;
          } else {
            throw error;
          }
        }

        if (upsertUserError) {
          console.error('Error upserting user record:', upsertUserError);
          throw new Error('Failed to save user record: ' + upsertUserError.message);
        }

        const serviceRadiusMiles = Number.parseInt((data.serviceRadius || '').replace(/\D+/g, ''), 10);
        const computedRadius = Number.isFinite(serviceRadiusMiles) ? serviceRadiusMiles : 10;
        const categoryLabel = SERVICE_CATEGORIES.find(c => c.value === data.serviceCategory)?.label || 'Cleaning';
        const bioSummary = `Professional ${categoryLabel.toLowerCase()} • Service radius: ${computedRadius} miles`;

        // Create cleaner profile
        const { error: cleanerError } = await withTimeout(
          supabase
            .from('cleaner_profiles')
            .insert([{
              user_id: userId,
              hourly_rate: 25.00,
              bio: bioSummary,
              years_experience: 0,
              specialties: [categoryLabel],
              service_radius_km: Math.round(computedRadius * 1.60934),
              verification_status: 'pending',
              background_check_status: 'pending',
              provides_equipment: true,
              provides_supplies: true,
              is_available: true,
            }]),
          15000,
          'Create cleaner profile'
        );

        if (cleanerError && cleanerError.code !== '23505') {
          console.error('Error creating cleaner profile:', cleanerError);
          throw new Error('Failed to create cleaner profile: ' + cleanerError.message);
        }

        // Mark onboarding complete (ID verification deferred to optional profile completion)
        await supabase
          .from('cleaner_profiles')
          .update({ onboarding_complete: true })
          .eq('user_id', userId);

        // Keep auth metadata in sync
        try {
          await supabase.auth.updateUser({
            data: {
              full_name: `${data.firstName} ${data.lastName}`,
              username: usernameHint,
            },
          });
        } catch (metadataError) {
          console.warn('⚠️ Failed to update auth metadata:', metadataError);
        }

        // Send welcome message and profile completion milestone
        try {
          await milestoneNotificationService.sendWelcomeMessage(userId);
          await milestoneNotificationService.sendProfileCompletedMessage(userId);
          console.log('✅ Sent welcome and profile completion notifications');
        } catch (notifError) {
          console.warn('⚠️ Failed to send milestone notifications:', notifError);
          // Don't block onboarding if notifications fail
        }

        console.log('Cleaner onboarding completed successfully for real user');
        setShowConfetti(true);
        Animated.timing(confettiOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          setTimeout(() => {
            Animated.timing(confettiOpacity, {
              toValue: 0,
              duration: 350,
              useNativeDriver: true,
            }).start(() => setShowConfetti(false));
          }, 1200);
        });
        try {
          await AsyncStorage.setItem('cleaner_onboarding_complete', 'true');
          setCleanerOnboardingOverride(true);
        } catch {}
        showToast({
          type: 'success',
          message: data.idFrontPhoto && data.idBackPhoto && data.selfiePhoto
            ? "You're all set! We’ll review your information and run a background check within 24–48 hours."
            : "You're all set! Complete ID verification anytime from your profile.",
        });
        try {
          // Refresh user data - App.tsx will auto-navigate when role is detected
          console.log('🔄 Refreshing user data after onboarding...');
          await withTimeout(refreshUser(), 8000, 'Refresh user');
        } catch (error) {
          console.error('Error refreshing user:', error);
        }
        // Land on Jobs tab (CleanerNavigator reads cleaner_just_onboarded)
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' as any }],
        });
      } else {
        Alert.alert('Authentication required', 'Please sign in again to complete setup.');
      }
    } catch (error) {
      console.error('Onboarding completion error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit application. Please try again.';
      setAppErrorModal(parseOnboardingError(errorMessage));
    } finally {
      setIsLoading(false);
    }
  };

  const stepTheme = STEP_THEMES[currentStep] || STEP_THEMES[1];
  const progressPct = (currentStep / totalSteps) * 100;
  const scrollContentBottomPad = keyboardVisible ? 12 : 100;
  const footPadBottom = (keyboardVisible ? 10 : 12) + (keyboardVisible ? 0 : insets.bottom);

  const renderProgressBar = () => (
    <View style={[styles.progressContainer, { borderBottomWidth: 3, borderBottomColor: stepTheme.color + '40' }]}>
      <View style={styles.progressHeader}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progressPct}%`,
                backgroundColor: stepTheme.color,
                shadowColor: stepTheme.color,
              },
            ]}
          />
        </View>
        <View style={styles.stepLabelsRow}>
          <Text style={[styles.stepLabelEmoji]}>{stepTheme.icon}</Text>
          <Text style={[styles.stepLabelText, { color: stepTheme.color }]}>
            {stepTheme.label}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderStep1 = () => (
    <ScrollView
      ref={scrollRef}
      style={styles.stepContainer}
      contentContainerStyle={{ paddingBottom: scrollContentBottomPad }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Create Your Profile</Text>
      <Text style={styles.stepSubtitle}>Get started in under a minute</Text>

      <TouchableOpacity
        style={styles.photoContainer}
        onPress={async () => {
          try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Permission required', 'Please allow photo access to set your profile image.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setData(prev => ({ ...prev, profilePhoto: result.assets[0].uri }));
            }
          } catch (e) {
            console.error('Image pick error', e);
          }
        }}
      >
        <Image source={{ uri: data.profilePhoto }} style={styles.profilePhoto} />
        <View style={styles.photoOverlay}>
          <Ionicons name="camera" size={20} color="#ffffff" />
        </View>
      </TouchableOpacity>
      <Text style={[styles.hintText, { textAlign: 'center', marginBottom: hp('1%') }]}>Profile photo (optional)</Text>

      <View style={styles.inputRow}>
        <View style={[styles.inputHalf, styles.inputWithCheck]}>
          <Text style={styles.inputLabel}>First Name *</Text>
          <View style={styles.inputRowWithCheck}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              value={data.firstName}
              onChangeText={(text) => updateData('firstName', text)}
              placeholder="Sarah"
            />
            {!!data.firstName?.trim() && <Ionicons name="checkmark-circle" size={22} color="#22C55E" style={styles.fieldCheck} />}
          </View>
        </View>
        <View style={[styles.inputHalf, styles.inputWithCheck]}>
          <Text style={styles.inputLabel}>Last Name *</Text>
          <View style={styles.inputRowWithCheck}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              value={data.lastName}
              onChangeText={(text) => updateData('lastName', text)}
              placeholder="Johnson"
            />
            {!!data.lastName?.trim() && <Ionicons name="checkmark-circle" size={22} color="#22C55E" style={styles.fieldCheck} />}
          </View>
        </View>
      </View>

      <View style={styles.inputWithCheck}>
        <Text style={styles.inputLabel}>Email *</Text>
        <TextInput
          style={styles.textInput}
          value={data.email}
          onChangeText={(text) => updateData('email', text)}
          placeholder="sarah@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputWithCheck}>
        <Text style={styles.inputLabel}>Phone *</Text>
        <TextInput
          style={styles.textInput}
          value={data.phone}
          onChangeText={(text) => updateData('phone', text)}
          placeholder="+1 (555) 123-4567"
          keyboardType="phone-pad"
        />
      </View>

      <Text style={styles.inputLabel}>What do you do?</Text>
      <Text style={styles.serviceCategoryHelper}>
        Pick the option that best describes your work. You can add more services later in the app.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.serviceChipScroll}
      >
        {SERVICE_CATEGORIES.map((cat) => {
          const selected = data.serviceCategory === cat.value;
          return (
            <TouchableOpacity
              key={cat.value}
              style={[styles.serviceChip, selected && styles.serviceChipSelected]}
              onPress={() => updateData('serviceCategory', cat.value)}
              activeOpacity={0.85}
            >
              <Text
                style={[styles.serviceChipText, selected && styles.serviceChipTextSelected]}
                numberOfLines={1}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </ScrollView>
  );

  const renderStep2 = () => {
    const radiusMiles = (data.serviceRadius || '').includes('5')
      ? 5
      : (data.serviceRadius || '').includes('10')
        ? 10
        : (data.serviceRadius || '').includes('20')
          ? 20
          : 10;
    const radiusMeters = radiusMiles * 1609.34;

    const handleUseCurrentLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Location Access', 'Please enable location permissions.');
          return;
        }
        const coords = await Location.getCurrentPositionAsync({});
        setServiceMapCenter({
          latitude: coords.coords.latitude,
          longitude: coords.coords.longitude,
        });
        const results = await Location.reverseGeocodeAsync({
          latitude: coords.coords.latitude,
          longitude: coords.coords.longitude,
        });
        const place = results[0];
        if (place?.postalCode) {
          updateData('serviceZip', place.postalCode);
        }
      } catch {
        Alert.alert('Location', 'Unable to use current location.');
      }
    };

    return (
      <ScrollView
        ref={scrollRef}
        style={styles.stepContainer}
        contentContainerStyle={{ paddingBottom: scrollContentBottomPad }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Set Your Area</Text>
        <Text style={styles.stepSubtitle}>Where do you want to work?</Text>

        <Text style={styles.inputLabel}>Service Radius *</Text>
        <View style={styles.optionRow}>
          {['5 miles', '10 miles', '20 miles'].map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionButton,
                data.serviceRadius === option && styles.selectedOption
              ]}
              onPress={() => updateData('serviceRadius', option)}
            >
              <Text style={[
                styles.optionText,
                data.serviceRadius === option && styles.selectedOptionText
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.serviceLocationRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Location (ZIP or GPS)</Text>
            <TextInput
              style={styles.textInput}
              value={data?.serviceZip ?? ''}
              onChangeText={(text) => updateData('serviceZip', text.replace(/\D/g, '').slice(0, 5))}
              placeholder="94110"
              keyboardType="number-pad"
            />
          </View>
          <TouchableOpacity style={styles.locationButton} onPress={handleUseCurrentLocation}>
            <Ionicons name="locate" size={18} color={ACCENT} />
            <Text style={styles.locationButtonText}>Use GPS</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapPreview}>
          <MapView
            style={styles.mapView}
            region={{
              latitude: serviceMapCenter.latitude,
              longitude: serviceMapCenter.longitude,
              latitudeDelta: 0.12,
              longitudeDelta: 0.12,
            }}
            onPress={(event) => {
              const { latitude, longitude } = event.nativeEvent.coordinate;
              setServiceMapCenter({ latitude, longitude });
            }}
          >
            <Circle
              center={serviceMapCenter}
              radius={radiusMeters}
              fillColor={STEP_THEMES[2].color + '25'}
              strokeColor={STEP_THEMES[2].color + 'CC'}
              strokeWidth={2}
            />
          </MapView>
          <View style={styles.mapHintContainer}>
            <Text style={[styles.mapHint, { color: STEP_THEMES[2].color, fontWeight: '600' }]}>
              {isResolvingZip ? 'Updating map from ZIP...' : `You'll see jobs within ${radiusMiles} miles`}
            </Text>
            <Text style={styles.mapHintSub}>
              {isResolvingZip ? '' : 'Tap the map or use GPS to set your center'}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      default: return renderStep1();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Become a Cleaner</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Bar */}
      {renderProgressBar()}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        enabled
      >
        {/* Current Step Content */}
        <View style={styles.content}>
          {renderCurrentStep()}
        </View>

        {/* Bottom Button — tight to keyboard; footPadBottom adds home indicator only when keyboard hidden */}
        <View style={[styles.bottomContainer, { paddingBottom: footPadBottom, paddingTop: keyboardVisible ? 8 : hp('1.2%') }]}>
          <TouchableOpacity 
            style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
            onPress={handleNext}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isLoading ? ['#9CA3AF', '#6B7280'] : [stepTheme.color, stepTheme.color]}
              style={styles.continueButtonGradient}
            >
              <Text style={styles.continueButtonText}>
                {isLoading
                  ? 'Starting...'
                  : currentStep === totalSteps
                    ? 'Start Earning'
                    : 'Continue'}
              </Text>
              {!isLoading && currentStep < totalSteps && (
                <Ionicons name="arrow-forward" size={20} color="#ffffff" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {showConfetti && (
        <Animated.View style={[styles.confettiOverlay, { opacity: confettiOpacity }]}>
          {Array.from({ length: 12 }).map((_, index) => (
            <View
              key={`confetti-${index}`}
              style={[
                styles.confettiDot,
                { left: 20 + index * 24, top: 80 + (index % 4) * 24 }
              ]}
            />
          ))}
        </Animated.View>
      )}

      <Modal visible={!!appErrorModal} transparent animationType="fade" onRequestClose={() => setAppErrorModal(null)}>
        <View style={styles.appErrRoot}>
          <Pressable
            style={styles.appErrBackdropPress}
            onPress={() => setAppErrorModal(null)}
            accessibilityLabel="Close dialog"
          />
          <View style={styles.appErrCard}>
            <View style={styles.appErrTopAccent} />
            <Text style={styles.appErrTitle}>{appErrorModal?.title}</Text>
            <Text style={styles.appErrBody}>{appErrorModal?.message}</Text>
            <TouchableOpacity style={styles.appErrButton} onPress={() => setAppErrorModal(null)} activeOpacity={0.85}>
              <Text style={styles.appErrButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '800',
    color: '#1F2937',
  },
  placeholder: {
    width: 32,
  },
  progressContainer: {
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressHeader: {
    flex: 1,
  },
  bypassContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2%'),
  },
  bypassLabel: {
    fontSize: wp('3%'),
    color: '#6B7280',
    fontWeight: '500',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    marginBottom: hp('1.2%'),
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 999,
    shadowColor: 'rgba(230, 178, 0, 0.5)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  progressText: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    textAlign: 'center',
  },
  stepLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('2%'),
    marginTop: hp('1%'),
  },
  stepLabelEmoji: {
    fontSize: wp('4.5%'),
  },
  stepLabelText: {
    fontSize: wp('3.5%'),
    fontWeight: '700',
  },
  stepCounter: {
    fontSize: wp('3%'),
    color: '#9CA3AF',
    marginLeft: 4,
  },
  profileStrengthBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: hp('2%'),
  },
  profileStrengthFill: {
    height: '100%',
    borderRadius: 999,
  },
  profileStrengthText: {
    fontSize: wp('3%'),
    color: '#6B7280',
    marginTop: hp('0.5%'),
  },
  radiusHint: {
    fontSize: 13,
    color: '#4ECDC4',
    fontWeight: '600',
    marginBottom: hp('1%'),
  },
  packageStrengthHint: {
    fontSize: 13,
    color: '#45B7D1',
    fontWeight: '600',
    marginBottom: hp('1%'),
  },
  proTip: {
    fontSize: wp('3%'),
    color: '#6B7280',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: wp('2%'),
    marginBottom: hp('1.5%'),
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: wp('5%'),
    paddingTop: hp('3%'),
  },
  stepTitle: {
    fontSize: wp('6%'),
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: hp('1%'),
  },
  stepSubtitle: {
    fontSize: wp('4%'),
    color: '#6B7280',
    marginBottom: hp('4%'),
    lineHeight: 24,
  },
  photoContainer: {
    alignSelf: 'center',
    marginBottom: hp('4%'),
    position: 'relative',
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: wp('10%'),
    borderWidth: 3,
    borderColor: '#E5E7EB',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: ACCENT,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#374151',
    marginBottom: hp('1%'),
    marginTop: hp('2%'),
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: wp('2%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    fontSize: wp('4%'),
    color: '#1F2937',
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    gap: wp('3%'),
    alignItems: 'flex-end',
  },
  inputHalf: {
    flex: 1,
  },
  inputWithCheck: {
    marginBottom: 0,
  },
  inputRowWithCheck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2%'),
  },
  fieldCheck: {
    marginLeft: 4,
  },
  hintText: {
    fontSize: wp('3%'),
    color: '#6B7280',
    marginTop: hp('0.5%'),
    marginLeft: 4,
  },
  rateHelper: {
    flex: 1,
    paddingLeft: wp('2%'),
  },
  rateHelperText: {
    fontSize: wp('3%'),
    color: '#6B7280',
    fontStyle: 'italic',
  },
  earningsRow: {
    flexDirection: 'row',
    gap: wp('3%'),
    alignItems: 'flex-start',
  },
  earningsBreakdown: {
    flex: 1,
    paddingTop: hp('0.7%'),
  },
  earningsLine: {
    fontSize: wp('3%'),
    color: '#6B7280',
    marginBottom: hp('0.7%'),
  },
  earningsValue: {
    fontSize: wp('4%'),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp('0.5%'),
  },
  rateWarning: {
    flexDirection: 'row',
    gap: wp('2%'),
    alignItems: 'flex-start',
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderRadius: wp('2.5%'),
    padding: 10,
    marginTop: hp('1.5%'),
  },
  rateWarningText: {
    flex: 1,
    fontSize: wp('3%'),
    color: '#9A3412',
    fontWeight: '600',
    lineHeight: 16,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp('2%'),
    marginTop: hp('1%'),
  },
  serviceLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: wp('3%'),
    marginTop: hp('0.5%'),
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('1.5%'),
    borderWidth: 1,
    borderColor: ACCENT,
    backgroundColor: CLEANER_BRAND_SOFT,
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1.5%'),
    borderRadius: wp('2.5%'),
    height: 48,
  },
  locationButtonText: {
    color: CLEANER_BRAND_DARK,
    fontWeight: '700',
    fontSize: wp('3%'),
  },
  serviceCategoryHelper: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: hp('1.2%'),
  },
  serviceChipScroll: {
    paddingVertical: 4,
    paddingRight: wp('2%'),
  },
  serviceChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  serviceChipSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  serviceChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  serviceChipTextSelected: {
    color: '#1F2937',
  },
  mapPreview: {
    marginTop: hp('1.5%'),
    backgroundColor: '#ffffff',
    borderRadius: wp('3%'),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mapView: {
    height: 160,
    width: '100%',
  },
  mapHintContainer: {
    padding: 12,
  },
  mapHint: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    textAlign: 'center',
  },
  mapHintSub: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 2,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp('2%'),
    marginTop: hp('1%'),
  },
  optionButton: {
    flex: 1,
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: wp('2%'),
    alignItems: 'center',
    backgroundColor: '#ffffff',
    minWidth: 80,
  },
  dayButton: {
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: wp('2%'),
    alignItems: 'center',
    backgroundColor: '#ffffff',
    width: 70,
  },
  serviceButton: {
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: wp('2%'),
    alignItems: 'center',
    backgroundColor: '#ffffff',
    minWidth: 120,
    marginBottom: hp('1%'),
  },
  selectedOption: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
  optionText: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  selectedOptionText: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: hp('2%'),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: hp('0.5%'),
  },
  switchDescription: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
  },
  lockedLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('1.5%'),
    marginTop: hp('1%'),
  },
  lockedInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('1.5%'),
  },
  videoAuditionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp('3%'),
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  videoAuditionTitle: {
    fontSize: wp('4%'),
    fontWeight: '700',
    color: '#1F2937',
    marginTop: hp('1%'),
  },
  videoAuditionText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: hp('0.7%'),
    marginBottom: hp('1.5%'),
  },
  videoUploaded: {
    marginBottom: hp('1.5%'),
    gap: wp('2%'),
  },
  previewCard: {
    backgroundColor: '#FFFBF0',
    borderRadius: wp('3%'),
    padding: 16,
    borderWidth: 1,
    borderColor: ACCENT,
    marginBottom: hp('2%'),
  },
  profilePreviewCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: wp('3%'),
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  profilePreviewPhoto: {
    width: 56,
    height: 56,
    borderRadius: wp('7%'),
    marginRight: 12,
  },
  profilePreviewContent: {
    flex: 1,
  },
  profilePreviewName: {
    fontSize: wp('4%'),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp('0.5%'),
  },
  profilePreviewBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: wp('2%'),
    paddingVertical: 2,
    borderRadius: wp('1.5%'),
    marginBottom: hp('0.7%'),
  },
  profilePreviewBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  profilePreviewBio: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: hp('0.5%'),
  },
  profilePreviewLocation: {
    fontSize: wp('3%'),
    color: '#9CA3AF',
  },
  videoUploadedText: {
    fontSize: wp('3%'),
    color: ACCENT,
    fontWeight: '600',
  },
  videoActionRow: {
    flexDirection: 'row',
    gap: wp('3%'),
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('1.5%'),
    backgroundColor: ACCENT,
    borderRadius: wp('2.5%'),
    paddingVertical: hp('1.5%'),
    flex: 1,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('1.5%'),
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: wp('2.5%'),
    paddingVertical: hp('1.5%'),
    flex: 1,
    backgroundColor: '#FFFBF0',
  },
  secondaryButtonText: {
    color: ACCENT,
    fontWeight: '700',
  },
  tipsCard: {
    marginTop: hp('2%'),
    backgroundColor: '#0F172A',
    borderRadius: wp('3%'),
    padding: 16,
  },
  tipsTitle: {
    color: '#FFFFFF',
    fontSize: wp('3.5%'),
    fontWeight: '700',
    marginBottom: hp('1%'),
  },
  tipsText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: wp('3%'),
    marginBottom: hp('0.5%'),
  },
  skillContainer: {
    marginBottom: hp('3%'),
  },
  skillLabel: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: hp('1.5%'),
  },
  starsContainer: {
    flexDirection: 'row',
    gap: wp('2%'),
  },
  portfolioSection: {
    marginTop: hp('3%'),
  },
  photoUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('2.5%'),
    borderWidth: 2,
    borderColor: ACCENT,
    borderStyle: 'dashed',
    borderRadius: wp('2%'),
    backgroundColor: '#FFFBF0',
    gap: wp('3%'),
  },
  photoUploadText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: ACCENT,
  },
  verificationSection: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFBF0',
    borderRadius: wp('3%'),
    marginBottom: hp('3%'),
  },
  verificationTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#1F2937',
    marginTop: hp('1%'),
    marginBottom: hp('1%'),
  },
  verificationDescription: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  idScanPlaceholder: {
    backgroundColor: '#F3F4F6',
    borderRadius: wp('3%'),
    padding: 24,
    alignItems: 'center',
    marginBottom: hp('1.5%'),
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  idScanLabel: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#374151',
    marginTop: hp('1%'),
  },
  idScanHint: {
    fontSize: wp('3%'),
    color: '#9CA3AF',
    marginTop: hp('0.5%'),
    fontStyle: 'italic',
  },
  idScanPreview: {
    width: '100%',
    height: 120,
    borderRadius: wp('2%'),
    resizeMode: 'cover',
  },
  agreementSection: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: wp('2%'),
    marginTop: hp('3%'),
  },
  agreementText: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  linkText: {
    color: ACCENT,
    fontWeight: '600',
  },
  confettiOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  confettiDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
    opacity: 0.85,
  },
  bottomContainer: {
    paddingHorizontal: wp('5%'),
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  appErrRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  appErrBackdropPress: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  appErrCard: {
    zIndex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: ORANGE_BORDER,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  appErrTopAccent: {
    height: 3,
    backgroundColor: ACCENT,
    borderRadius: 2,
    marginHorizontal: -6,
    marginTop: -8,
    marginBottom: 12,
  },
  appErrTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8, letterSpacing: -0.3 },
  appErrBody: { fontSize: 15, lineHeight: 22, color: '#475569', marginBottom: 20 },
  appErrButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  appErrButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  continueButton: {
    borderRadius: wp('3%'),
    overflow: 'hidden',
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('6%'),
    gap: wp('2%'),
  },
  continueButtonText: {
    fontSize: wp('4%'),
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default CleanerOnboardingScreen; 