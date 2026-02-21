import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  Image,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Video, ResizeMode } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { decode } from 'base64-arraybuffer';
import { uploadService } from '../../services/uploadService';
import { contentService } from '../../services/contentService';
import { milestoneNotificationService } from '../../services/milestoneNotificationService';
import { zipLookupService } from '../../services/zipLookupService';
import { setCleanerOnboardingOverride } from '../../utils/onboardingOverride';
import { useToast } from '../../components/Toast';

const VIDEO_LIMITS = { maxDurationSeconds: 45, minDurationSeconds: 5, maxFileSizeMB: 50 };
const INCLUDED_TASKS = ['Inside oven', 'Stovetop deep clean', 'Refrigerator', 'Baseboards', 'Cabinets', 'Countertops', 'Sinks', 'Floors'];

const STEP_THEMES: Record<number, { icon: string; label: string; color: string }> = {
  1: { icon: '👋', label: 'Introduce Yourself', color: '#FF6B6B' },
  2: { icon: '🗺️', label: 'Set Your Territory', color: '#4ECDC4' },
  3: { icon: '🎬', label: 'Create Your Offer', color: '#45B7D1' },
  4: { icon: '👀', label: 'Review', color: '#96CEB4' },
  5: { icon: '🔒', label: 'Verify ID', color: '#96CEB4' },
};

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
  // Step 1: Professional Profile
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profilePhoto: string;
  dateOfBirth: string;
  bio: string;
  specialty: string;
  // Step 2: Service Area & Availability
  serviceRadius: string;
  serviceZip: string;
  availableDays: string[];
  availableHours: string;
  serviceTypes: string[];
  specializations: string[];
  providesEquipment: boolean;
  providesSupplies: boolean;
  // Step 3: Create Package (video + pricing)
  packageVideoUri: string;
  packageTitle: string;
  packageType: 'fixed' | 'hourly' | 'contact';
  packagePrice: string;
  estimatedHours: number;
  includedTasks: string[];
  // Step 5: Background Check
  idFrontPhoto: string;
  idBackPhoto: string;
  selfiePhoto: string;
  backgroundCheckConsent: boolean;
}

const CleanerOnboardingScreen: React.FC<CleanerOnboardingProps> = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const hasAutoExited = useRef(false);
  const totalSteps = 5;
  const { refreshSession, refreshUser, authUser } = useAuth();
  const { showToast } = useToast();

  const getCleanerStateForStep = (step: number) => {
    if (step >= totalSteps) return 'STAGING';
    if (step >= 4) return 'STAGING';
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
    profilePhoto: `https://ui-avatars.com/api/?name=Cleaner&background=3ad3db&color=fff&size=160&font-size=0.4&format=png`,
    dateOfBirth: '',
    bio: '',
    specialty: '',
    serviceRadius: '',
    serviceZip: '',
    availableDays: [],
    availableHours: '',
    serviceTypes: [],
    specializations: [],
    providesEquipment: true,
    providesSupplies: true,
    packageVideoUri: '',
    packageTitle: '',
    packageType: 'fixed',
    packagePrice: '',
    estimatedHours: 2,
    includedTasks: [],
    idFrontPhoto: '',
    idBackPhoto: '',
    selfiePhoto: '',
    backgroundCheckConsent: false,
  });

  const scrollRef = useRef<ScrollView>(null);
  const confettiOpacity = useRef(new Animated.Value(0)).current;
  const [serviceMapCenter, setServiceMapCenter] = useState({
    latitude: 37.7749,
    longitude: -122.4194,
  });
  const [isResolvingZip, setIsResolvingZip] = useState(false);

  // Prefill from provider
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

  const toggleArrayItem = (field: 'availableDays' | 'serviceTypes' | 'specializations', item: string) => {
    const arr = data[field];
    const updated = arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];
    updateData(field, updated);
  };

  const toggleIncludedTask = (task: string) => {
    const updated = data.includedTasks.includes(task)
      ? data.includedTasks.filter(t => t !== task)
      : [...data.includedTasks, task];
    updateData('includedTasks', updated);
  };

  const validateStep = (step: number): string | null => {
    switch (step) {
      case 1:
        if (!data.firstName?.trim() || !data.lastName?.trim() || !data.email?.trim() || !data.phone?.trim() || !data.dateOfBirth?.trim()) {
          return 'Please fill in name, email, phone, and date of birth';
        }
        break;
      case 2:
        if (!data.serviceRadius?.trim()) return 'Please select your service radius';
        break;
      case 3:
        if (!data.packageVideoUri) return 'Please record or upload a video for your package';
        if (!data.packageTitle?.trim()) return 'Please enter a package name';
        if (data.packageType !== 'contact' && (!data.packagePrice?.trim() || parseFloat(data.packagePrice) <= 0)) {
          return 'Please enter a valid price';
        }
        break;
      case 5:
        if (!data.idFrontPhoto) return 'Please capture a photo of your ID (front)';
        if (!data.idBackPhoto) return 'Please capture a photo of your ID (back)';
        if (!data.selfiePhoto) return 'Please take a selfie';
        if (!data.backgroundCheckConsent) return 'Please consent to the background check to continue';
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

    if (currentStep === 3 && data.packageVideoUri) {
      // Upload video and create package before moving to Step 4
      await refreshSession();
      const userId = await resolveUserId();
      if (!userId) {
        Alert.alert('Authentication required', 'Please sign in again.');
        return;
      }
      setIsUploadingVideo(true);
      try {
        const response = await uploadService.uploadFile(
          data.packageVideoUri,
          'video',
          (p) => setVideoUploadProgress(p.progress),
          { maxFileSize: VIDEO_LIMITS.maxFileSizeMB * 1024 * 1024 }
        );
        if (!response.success || !response.url) {
          throw new Error(response.error || 'Upload failed');
        }
        let thumbnailUrl: string | undefined;
        try {
          const thumb = await VideoThumbnails.getThumbnailAsync(data.packageVideoUri, { time: 1000, quality: 0.7 });
          const thumbRes = await uploadService.uploadFile(thumb.uri, 'image');
          if (thumbRes.success && thumbRes.url) thumbnailUrl = thumbRes.url;
        } catch {}
        const priceCents = data.packageType !== 'contact' && data.packagePrice
          ? Math.round(parseFloat(data.packagePrice) * 100)
          : undefined;
        const postRes = await contentService.createPost(userId, {
          title: data.packageTitle,
          description: data.bio || '',
          content_type: 'video',
          media_url: response.url,
          thumbnail_url: thumbnailUrl,
          status: 'published',
          tags: ['cleaning', 'onboarding'],
          is_bookable: true,
          package_type: data.packageType,
          base_price_cents: priceCents,
          estimated_hours: data.packageType !== 'contact' ? data.estimatedHours : undefined,
          included_tasks: data.includedTasks.length ? data.includedTasks : undefined,
        });
        if (!postRes.success) throw new Error(postRes.error);
        setCurrentStep(4);
        persistProgress(4);
      } catch (err) {
        console.error('Package upload error:', err);
        Alert.alert('Upload Failed', err instanceof Error ? err.message : 'Please try again.');
      } finally {
        setIsUploadingVideo(false);
        setVideoUploadProgress(0);
      }
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
      
      console.log('Cleaner onboarding completion - resolved user:', userId, userEmail);
      
      if (userId) {
        // Upsert user record (avoids a separate read that can hang)
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
        const availabilitySummary = data.availableDays.length
          ? `${data.availableDays.join(', ')} • ${data.availableHours || 'Flexible'}`
          : 'Flexible';
        const bioSummary = [
          data.bio || 'Professional cleaner',
          data.specialty ? `Specialty: ${data.specialty}` : null,
          `Availability: ${availabilitySummary}`,
          `Service Radius: ${computedRadius} miles`,
          `Equipment: ${data.providesEquipment ? 'Yes' : 'No'}`,
          `Supplies: ${data.providesSupplies ? 'Yes' : 'No'}`,
        ]
          .filter(Boolean)
          .join('\n');

        // Derive hourly_rate from first package for backward compatibility
        const packagePrice = data.packageType !== 'contact' ? parseFloat(data.packagePrice) : 0;
        const hourlyRate = data.packageType === 'hourly' ? packagePrice : (data.packageType === 'fixed' && data.estimatedHours > 0 ? packagePrice / data.estimatedHours : 25);

        // Create cleaner profile
        const { error: cleanerError } = await withTimeout(
          supabase
            .from('cleaner_profiles')
            .insert([{
              user_id: userId,
              hourly_rate: hourlyRate > 0 ? hourlyRate : 25.00,
              bio: bioSummary,
              years_experience: 0,
              specialties: data.specialty ? [data.specialty] : ['standard_cleaning'],
              service_radius_km: Math.round(computedRadius * 1.60934),
              verification_status: 'pending',
              background_check_status: 'pending', // Triggered at first booking
              provides_equipment: data.providesEquipment,
              provides_supplies: data.providesSupplies,
              is_available: true, // Immediately bookable
            }]),
          15000,
          'Create cleaner profile'
        );

        if (cleanerError && cleanerError.code !== '23505') {
          console.error('Error creating cleaner profile:', cleanerError);
          throw new Error('Failed to create cleaner profile: ' + cleanerError.message);
        }

        // Step 5: Upload verification docs and create background check (MVP manual review)
        if (data.idFrontPhoto && data.idBackPhoto && data.selfiePhoto) {
          try {
            const uploadToStorage = async (uri: string, path: string): Promise<string> => {
              const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
              const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
              const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
              const { data: uploadData, error } = await supabase.storage
                .from('verification-docs')
                .upload(path, decode(base64), { contentType: mime, upsert: true });
              if (error) throw error;
              return uploadData.path;
            };
            const idFrontPath = await uploadToStorage(data.idFrontPhoto, `${userId}/id-front.jpg`);
            const idBackPath = await uploadToStorage(data.idBackPhoto, `${userId}/id-back.jpg`);
            const selfiePath = await uploadToStorage(data.selfiePhoto, `${userId}/selfie.jpg`);

            const { error: bcError } = await supabase.from('background_checks').insert({
              cleaner_id: userId,
              id_front_url: idFrontPath,
              id_back_url: idBackPath,
              selfie_url: selfiePath,
              status: 'pending_review',
              submitted_at: new Date().toISOString(),
            });
            if (bcError) throw bcError;

            await supabase
              .from('cleaner_profiles')
              .update({ verification_status: 'pending', onboarding_complete: true })
              .eq('user_id', userId);
          } catch (verifErr) {
            console.error('Verification upload error:', verifErr);
            if (String(verifErr).includes('Bucket not found') || String(verifErr).includes('verification-docs')) {
              Alert.alert('Setup Required', 'Please create the verification-docs storage bucket in Supabase Dashboard.');
            }
            throw verifErr;
          }
        }

        // Keep auth metadata in sync so the UI can show a name immediately
        try {
          await supabase.auth.updateUser({
            data: {
              full_name: `${data.firstName} ${data.lastName}`,
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
          message:
            "You're all set! We’ll review your information and run a background check within 24–48 hours.",
        });
        try {
          // Refresh user data - App.tsx will auto-navigate when role is detected
          console.log('🔄 Refreshing user data after onboarding...');
          await withTimeout(refreshUser(), 8000, 'Refresh user');
        } catch (error) {
          console.error('Error refreshing user:', error);
        }
        // Ensure we leave onboarding even if role propagation is delayed
        navigation.reset({
          index: 0,
          routes: [{ name: 'OnboardingComplete' as any }],
        });
      } else {
        Alert.alert('Authentication required', 'Please sign in again to complete setup.');
      }
    } catch (error) {
      console.error('Onboarding completion error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit application. Please try again.';
      Alert.alert('Application Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const stepTheme = STEP_THEMES[currentStep] || STEP_THEMES[1];
  const progressPct = (currentStep / totalSteps) * 100;

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
          <Text style={styles.stepCounter}>Step {currentStep} of {totalSteps}</Text>
        </View>
      </View>
    </View>
  );

  const renderStep1 = () => (
    <ScrollView
      ref={scrollRef}
      style={styles.stepContainer}
      contentContainerStyle={{ paddingBottom: 140 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Professional Profile</Text>
      <Text style={styles.stepSubtitle}>Let's set up your cleaner profile</Text>

      {(() => {
        const fields = [!!data.firstName?.trim(), !!data.lastName?.trim(), !!data.email?.trim(), !!data.phone?.trim(), !!data.dateOfBirth?.trim(), !!data.profilePhoto && !data.profilePhoto.includes('ui-avatars'), !!data.bio?.trim()];
        const filled = fields.filter(Boolean).length;
        const pct = Math.round((filled / 7) * 100);
        return pct > 0 ? (
          <View style={styles.profileStrengthBar}>
            <View style={[styles.profileStrengthFill, { width: `${pct}%`, backgroundColor: stepTheme.color }]} />
            <Text style={styles.profileStrengthText}>Profile {pct}% complete</Text>
          </View>
        ) : null;
      })()}

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

      <View style={styles.inputRow}>
        <View style={[styles.inputHalf, styles.inputWithCheck]}>
          <Text style={styles.inputLabel}>First Name *</Text>
          <View style={styles.inputRowWithCheck}>
            <TextInput
              style={[styles.textInput, { flex: 1 }]}
              value={data.firstName}
              onChangeText={(text) => updateData('firstName', text)}
              placeholder="Sarah"
              onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 140, animated: true }), 150)}
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
              onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 160, animated: true }), 150)}
            />
            {!!data.lastName?.trim() && <Ionicons name="checkmark-circle" size={22} color="#22C55E" style={styles.fieldCheck} />}
          </View>
        </View>
      </View>

      <View style={styles.inputWithCheck}>
        <Text style={styles.inputLabel}>Email Address *</Text>
        <View style={styles.inputRowWithCheck}>
          <TextInput
            style={[styles.textInput, { flex: 1 }]}
            value={data.email}
            onChangeText={(text) => updateData('email', text)}
            placeholder="sarah.johnson@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 190, animated: true }), 150)}
          />
          {!!data.email?.trim() && <Ionicons name="checkmark-circle" size={22} color="#22C55E" style={styles.fieldCheck} />}
        </View>
      </View>

      <View style={styles.inputWithCheck}>
        <Text style={styles.inputLabel}>Phone Number *</Text>
        <View style={styles.inputRowWithCheck}>
          <TextInput
            style={[styles.textInput, { flex: 1 }]}
            value={data.phone}
            onChangeText={(text) => updateData('phone', text)}
            placeholder="+1 (555) 123-4567"
            keyboardType="phone-pad"
            onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 240, animated: true }), 150)}
          />
          {!!data.phone?.trim() && <Ionicons name="checkmark-circle" size={22} color="#22C55E" style={styles.fieldCheck} />}
        </View>
      </View>

      <View style={styles.inputWithCheck}>
        <Text style={styles.inputLabel}>Date of Birth *</Text>
        <View style={styles.inputRowWithCheck}>
          <TextInput
            style={[styles.textInput, { flex: 1 }]}
            value={data.dateOfBirth}
            onChangeText={(text) => updateData('dateOfBirth', text)}
            placeholder="MM/DD/YYYY"
            onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 300, animated: true }), 150)}
          />
          {!!data.dateOfBirth?.trim() && <Ionicons name="checkmark-circle" size={22} color="#22C55E" style={styles.fieldCheck} />}
        </View>
      </View>

      <Text style={styles.inputLabel}>Bio / Specialty</Text>
      <TextInput
        style={[styles.textInput, styles.textArea]}
        value={data.bio}
        onChangeText={(text) => updateData('bio', text)}
        placeholder="e.g. Deep cleaning specialist, 5+ years experience..."
        multiline
        numberOfLines={3}
      />

      <Text style={[styles.inputLabel, { marginTop: 24 }]}>Preview</Text>
      <View style={styles.profilePreviewCard}>
        <Image source={{ uri: data.profilePhoto }} style={styles.profilePreviewPhoto} />
        <View style={styles.profilePreviewContent}>
          <Text style={styles.profilePreviewName}>
            {data.firstName || data.lastName ? `${data.firstName} ${data.lastName}`.trim() || 'Your Name' : 'Your Name'}
          </Text>
          <View style={styles.profilePreviewBadge}>
            <Text style={styles.profilePreviewBadgeText}>⭐ New Hero</Text>
          </View>
          <Text style={styles.profilePreviewBio} numberOfLines={3}>
            {data.bio?.trim() || 'Your bio will appear here...'}
          </Text>
          <Text style={styles.profilePreviewLocation}>📍 {data.serviceZip || 'Your area'}</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderStep2 = () => {
    const radiusMiles = (data.serviceRadius || '').includes('5')
      ? 5
      : data.serviceRadius.includes('10')
        ? 10
        : data.serviceRadius.includes('20')
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
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Service Area & Availability</Text>
        <Text style={styles.stepSubtitle}>Where and when do you want to work?</Text>

        <Text style={styles.inputLabel}>Service Radius *</Text>
        {data.serviceRadius ? (
          <Text style={styles.radiusHint}>
            You'll see jobs within {data.serviceRadius.replace(/\D/g, '') || '10'} miles of your location
          </Text>
        ) : null}
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
            <Text style={styles.inputLabel}>Service ZIP (optional)</Text>
            <TextInput
              style={styles.textInput}
              value={data?.serviceZip ?? ''}
              onChangeText={(text) => updateData('serviceZip', text.replace(/\D/g, '').slice(0, 5))}
              placeholder="94110"
              keyboardType="number-pad"
            />
          </View>
          <TouchableOpacity style={styles.locationButton} onPress={handleUseCurrentLocation}>
            <Ionicons name="locate" size={18} color="#26B7C9" />
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

      <Text style={styles.inputLabel}>Available Days</Text>
      <View style={styles.optionGrid}>
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
          <TouchableOpacity
            key={day}
            style={[
              styles.dayButton,
              data.availableDays.includes(day) && styles.selectedOption
            ]}
            onPress={() => toggleArrayItem('availableDays', day)}
          >
            <Text style={[
              styles.optionText,
              data.availableDays.includes(day) && styles.selectedOptionText
            ]}>
              {day.slice(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.inputLabel}>Preferred Hours</Text>
      <View style={styles.optionRow}>
        {['Morning (6-12)', 'Afternoon (12-6)', 'Evening (6-10)', 'Flexible'].map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionButton,
              data.availableHours === option && styles.selectedOption
            ]}
            onPress={() => updateData('availableHours', option)}
          >
            <Text style={[
              styles.optionText,
              data.availableHours === option && styles.selectedOptionText
            ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.inputLabel}>Service Types *</Text>
      <View style={styles.optionGrid}>
        {['Residential', 'Commercial', 'Deep Cleaning', 'Regular Maintenance', 'Move-out', 'Post-Construction'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.serviceButton,
              data.serviceTypes.includes(type) && styles.selectedOption
            ]}
            onPress={() => toggleArrayItem('serviceTypes', type)}
          >
            <Text style={[
              styles.optionText,
              data.serviceTypes.includes(type) && styles.selectedOptionText
            ]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.inputLabel}>Specializations</Text>
      <View style={styles.optionGrid}>
        {['Kitchen', 'Bathroom', 'Carpet', 'Windows', 'Eco-Friendly', 'Pet-Safe'].map((spec) => (
          <TouchableOpacity
            key={spec}
            style={[
              styles.serviceButton,
              data.specializations.includes(spec) && styles.selectedOption
            ]}
            onPress={() => toggleArrayItem('specializations', spec)}
          >
            <Text style={[
              styles.optionText,
              data.specializations.includes(spec) && styles.selectedOptionText
            ]}>
              {spec}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.inputLabel, { marginTop: 24 }]}>What do you provide?</Text>
      <View style={styles.switchRow}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>Cleaning equipment (vacuum, mop, etc.)</Text>
          <Text style={styles.switchDescription}>Bring your own tools</Text>
        </View>
        <Switch
          value={data.providesEquipment}
          onValueChange={(v) => updateData('providesEquipment', v)}
          trackColor={{ false: '#D1D5DB', true: '#26B7C9' }}
          thumbColor={data.providesEquipment ? '#ffffff' : '#f4f3f4'}
        />
      </View>
      <View style={styles.switchRow}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>Cleaning supplies (sprays, cloths, etc.)</Text>
          <Text style={styles.switchDescription}>Bring your own products</Text>
        </View>
        <Switch
          value={data.providesSupplies}
          onValueChange={(v) => updateData('providesSupplies', v)}
          trackColor={{ false: '#D1D5DB', true: '#26B7C9' }}
          thumbColor={data.providesSupplies ? '#ffffff' : '#f4f3f4'}
        />
      </View>
      </ScrollView>
    );
  };

  const renderStep3 = () => {
    const handleRecordVideo = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow camera access to record your intro video.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: VIDEO_LIMITS.maxDurationSeconds,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        updateData('packageVideoUri', result.assets[0].uri);
      }
    };

    const handleUploadVideo = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo access to upload your video.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: VIDEO_LIMITS.maxDurationSeconds,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        updateData('packageVideoUri', result.assets[0].uri);
      }
    };

    return (
      <ScrollView
        ref={scrollRef}
        style={styles.stepContainer}
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Create Your First Package</Text>
        <Text style={styles.stepSubtitle}>Record or upload a video, then add pricing</Text>

        <Text style={styles.inputLabel}>Video *</Text>
        {!data.packageVideoUri ? (
          <>
            <View style={[styles.videoAuditionCard, { borderColor: STEP_THEMES[3].color + '60' }]}>
              <Ionicons name="videocam" size={28} color={STEP_THEMES[3].color} />
              <Text style={styles.videoAuditionTitle}>Your Hero Audition</Text>
              <Text style={styles.videoAuditionText}>Share your vibe and specialty. 15-45 seconds.</Text>
              <View style={styles.videoActionRow}>
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: STEP_THEMES[3].color }]} onPress={handleRecordVideo} activeOpacity={0.8}>
                  <Ionicons name="camera" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Record</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: STEP_THEMES[3].color }]} onPress={handleUploadVideo} activeOpacity={0.8}>
                  <Ionicons name="cloud-upload" size={18} color={STEP_THEMES[3].color} />
                  <Text style={[styles.secondaryButtonText, { color: STEP_THEMES[3].color }]}>Upload</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={[styles.tipsCard, { backgroundColor: STEP_THEMES[3].color + '15', borderWidth: 1, borderColor: STEP_THEMES[3].color + '30' }]}>
              <Text style={[styles.tipsTitle, { color: STEP_THEMES[3].color }]}>Recording tips</Text>
              <Text style={styles.tipsText}>• Smile! Customers book friendly cleaners more often</Text>
              <Text style={styles.tipsText}>• Mention your specialty (kitchen, deep clean, etc.)</Text>
              <Text style={styles.tipsText}>• Show your equipment if you bring your own</Text>
            </View>
          </>
        ) : (
          <View style={styles.videoUploaded}>
            <Video source={{ uri: data.packageVideoUri }} style={{ height: 180, borderRadius: 12 }} useNativeControls resizeMode={ResizeMode.CONTAIN} />
            <TouchableOpacity style={[styles.secondaryButton, { marginTop: 8 }]} onPress={() => updateData('packageVideoUri', '')}>
              <Text style={styles.secondaryButtonText}>Change Video</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.inputLabel}>Package name *</Text>
        <TextInput
          style={styles.textInput}
          value={data.packageTitle}
          onChangeText={(t) => updateData('packageTitle', t)}
          placeholder="e.g. Deep Kitchen Clean"
        />

        <Text style={styles.inputLabel}>Price type</Text>
        <View style={styles.optionRow}>
          {(['fixed', 'hourly', 'contact'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.optionButton, data.packageType === t && styles.selectedOption]}
              onPress={() => updateData('packageType', t)}
            >
              <Text style={[styles.optionText, data.packageType === t && styles.selectedOptionText]}>
                {t === 'fixed' ? 'Fixed' : t === 'hourly' ? 'Hourly' : 'Contact'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {data.packageType !== 'contact' && (
          <>
            <Text style={styles.inputLabel}>{data.packageType === 'fixed' ? 'Total price ($)' : 'Hourly rate ($)'}</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={data.packagePrice}
              onChangeText={(p) => updateData('packagePrice', p)}
              placeholder={data.packageType === 'fixed' ? '299' : '45'}
            />
          </>
        )}

        {data.packageType === 'hourly' && (
          <>
            <Text style={styles.inputLabel}>Estimated hours for typical job</Text>
            <View style={styles.optionRow}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.dayButton, data.estimatedHours === h && styles.selectedOption]}
                  onPress={() => updateData('estimatedHours', h)}
                >
                  <Text style={[styles.optionText, data.estimatedHours === h && styles.selectedOptionText]}>{h}h</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.inputLabel}>What's included</Text>
        {data.includedTasks.length > 0 && (
          <Text style={styles.packageStrengthHint}>
            Package strength: {data.includedTasks.length} tasks
          </Text>
        )}
        {data.packageType !== 'contact' && data.packagePrice && (
          <Text style={styles.proTip}>💡 Similar heroes charge ${data.packageType === 'fixed' ? '250-350' : '40-60/hr'} for this type of service</Text>
        )}
        <View style={styles.optionGrid}>
          {INCLUDED_TASKS.map((task) => (
            <TouchableOpacity
              key={task}
              style={[styles.serviceButton, data.includedTasks.includes(task) && styles.selectedOption]}
              onPress={() => toggleIncludedTask(task)}
            >
              <Text style={[styles.optionText, data.includedTasks.includes(task) && styles.selectedOptionText]}>
                {data.includedTasks.includes(task) ? '✓ ' : ''}{task}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderStep5 = () => {
    const capturePhoto = async (field: 'idFrontPhoto' | 'idBackPhoto' | 'selfiePhoto') => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow camera access to capture your ID.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: field === 'selfiePhoto' ? [1, 1] : [4, 3],
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        updateData(field, result.assets[0].uri);
      }
    };

    return (
      <ScrollView
        ref={scrollRef}
        style={styles.stepContainer}
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Final Step: Verify ID</Text>
        <Text style={styles.stepSubtitle}>This keeps everyone safe. Usually takes 2 minutes.</Text>

        <View style={styles.verificationSection}>
          <Ionicons name="shield-checkmark" size={32} color="#26B7C9" />
          <Text style={styles.verificationTitle}>Quick identity verification</Text>
          <Text style={styles.verificationDescription}>
            Capture photos of your ID and a selfie. We'll review within 24 hours.
          </Text>
        </View>

        <TouchableOpacity style={styles.idScanPlaceholder} onPress={() => capturePhoto('idFrontPhoto')}>
          {data.idFrontPhoto ? (
            <Image source={{ uri: data.idFrontPhoto }} style={styles.idScanPreview} />
          ) : (
            <>
              <Ionicons name="card-outline" size={40} color="#9CA3AF" />
              <Text style={styles.idScanLabel}>ID Front</Text>
              <Text style={styles.idScanHint}>Tap to capture</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.idScanPlaceholder} onPress={() => capturePhoto('idBackPhoto')}>
          {data.idBackPhoto ? (
            <Image source={{ uri: data.idBackPhoto }} style={styles.idScanPreview} />
          ) : (
            <>
              <Ionicons name="card-outline" size={40} color="#9CA3AF" />
              <Text style={styles.idScanLabel}>ID Back</Text>
              <Text style={styles.idScanHint}>Tap to capture</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.idScanPlaceholder} onPress={() => capturePhoto('selfiePhoto')}>
          {data.selfiePhoto ? (
            <Image source={{ uri: data.selfiePhoto }} style={styles.idScanPreview} />
          ) : (
            <>
              <Ionicons name="person-outline" size={40} color="#9CA3AF" />
              <Text style={styles.idScanLabel}>Selfie</Text>
              <Text style={styles.idScanHint}>Tap to capture</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <View style={styles.lockedInline}>
              <Ionicons name="lock-closed" size={14} color="#26B7C9" />
              <Text style={styles.switchLabel}>I consent to a background check *</Text>
            </View>
            <Text style={styles.switchDescription}>Required to join ChoreHero</Text>
          </View>
          <Switch
            value={data.backgroundCheckConsent}
            onValueChange={(v) => updateData('backgroundCheckConsent', v)}
            trackColor={{ false: '#D1D5DB', true: '#26B7C9' }}
            thumbColor={data.backgroundCheckConsent ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        <View style={styles.agreementSection}>
          <Text style={styles.agreementText}>
            By continuing, you agree to our{' '}
            <Text style={styles.linkText}>Background Check Policy</Text>
            {' and '}
            <Text style={styles.linkText}>Privacy Policy</Text>.
          </Text>
        </View>
      </ScrollView>
    );
  };

  const renderStep4 = () => (
    <ScrollView
      ref={scrollRef}
      style={styles.stepContainer}
      contentContainerStyle={{ paddingBottom: 140 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Review Your Profile</Text>
      <Text style={styles.stepSubtitle}>Customers will see this</Text>

      <View style={styles.previewCard}>
        <Text style={styles.inputLabel}>{data.packageTitle || 'Your package'}</Text>
        <Text style={styles.earningsValue}>
          {data.packageType === 'contact'
            ? 'Contact for price'
            : data.packageType === 'fixed'
              ? `$${data.packagePrice || '0'}`
              : `$${data.packagePrice || '0'}/hr • Est. ${data.estimatedHours}h`}
        </Text>
        {data.includedTasks.length > 0 && (
          <Text style={styles.rateHelperText}>✓ {data.includedTasks.join(' ✓ ')}</Text>
        )}
      </View>

      <View style={styles.verificationSection}>
        <Ionicons name="shield-checkmark" size={24} color="#26B7C9" />
        <Text style={styles.verificationTitle}>You're ready!</Text>
        <Text style={styles.verificationDescription}>
          Background check will be triggered after your first booking.
        </Text>
      </View>
    </ScrollView>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      default: return renderStep1();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {/* Current Step Content */}
        <View style={styles.content}>
          {renderCurrentStep()}
        </View>

        {/* Bottom Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity 
            style={[styles.continueButton, (isLoading || isUploadingVideo) && styles.continueButtonDisabled]}
            onPress={handleNext}
            disabled={isLoading || isUploadingVideo}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={(isLoading || isUploadingVideo) ? ['#9CA3AF', '#6B7280'] : [stepTheme.color, stepTheme.color]}
              style={styles.continueButtonGradient}
            >
              <Text style={styles.continueButtonText}>
                {isUploadingVideo
                  ? `Uploading... ${Math.round(videoUploadProgress)}%`
                  : isLoading
                    ? 'Launching...'
                    : currentStep === totalSteps
                      ? 'Launch My Hero Career'
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  placeholder: {
    width: 32,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    gap: 8,
  },
  bypassLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#26B7C9',
    borderRadius: 999,
    shadowColor: '#26B7C9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  stepLabelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  stepLabelEmoji: {
    fontSize: 18,
  },
  stepLabelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepCounter: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  profileStrengthBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 16,
  },
  profileStrengthFill: {
    height: '100%',
    borderRadius: 999,
  },
  profileStrengthText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  radiusHint: {
    fontSize: 13,
    color: '#4ECDC4',
    fontWeight: '600',
    marginBottom: 8,
  },
  packageStrengthHint: {
    fontSize: 13,
    color: '#45B7D1',
    fontWeight: '600',
    marginBottom: 8,
  },
  proTip: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
    lineHeight: 24,
  },
  photoContainer: {
    alignSelf: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#E5E7EB',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#26B7C9',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
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
    gap: 8,
  },
  fieldCheck: {
    marginLeft: 4,
  },
  rateHelper: {
    flex: 1,
    paddingLeft: 8,
  },
  rateHelperText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  earningsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  earningsBreakdown: {
    flex: 1,
    paddingTop: 6,
  },
  earningsLine: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  earningsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  rateWarning: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  rateWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#9A3412',
    fontWeight: '600',
    lineHeight: 16,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  serviceLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 4,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#26B7C9',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    height: 48,
  },
  locationButtonText: {
    color: '#26B7C9',
    fontWeight: '700',
    fontSize: 12,
  },
  mapPreview: {
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
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
    fontSize: 14,
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
    gap: 8,
    marginTop: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    minWidth: 80,
  },
  dayButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    width: 70,
  },
  serviceButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    minWidth: 120,
    marginBottom: 8,
  },
  selectedOption: {
    borderColor: '#26B7C9',
    backgroundColor: '#26B7C9',
  },
  optionText: {
    fontSize: 14,
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  lockedLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  lockedInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  videoAuditionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  videoAuditionText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 6,
    marginBottom: 12,
  },
  videoUploaded: {
    marginBottom: 12,
    gap: 8,
  },
  previewCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#26B7C9',
    marginBottom: 16,
  },
  profilePreviewCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
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
    borderRadius: 28,
    marginRight: 12,
  },
  profilePreviewContent: {
    flex: 1,
  },
  profilePreviewName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  profilePreviewBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
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
    marginBottom: 4,
  },
  profilePreviewLocation: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  videoUploadedText: {
    fontSize: 12,
    color: '#26B7C9',
    fontWeight: '600',
  },
  videoActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#26B7C9',
    borderRadius: 10,
    paddingVertical: 12,
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
    gap: 6,
    borderWidth: 1,
    borderColor: '#26B7C9',
    borderRadius: 10,
    paddingVertical: 12,
    flex: 1,
    backgroundColor: '#F0FDFA',
  },
  secondaryButtonText: {
    color: '#26B7C9',
    fontWeight: '700',
  },
  tipsCard: {
    marginTop: 16,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
  },
  tipsTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  tipsText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginBottom: 4,
  },
  skillContainer: {
    marginBottom: 24,
  },
  skillLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  portfolioSection: {
    marginTop: 24,
  },
  photoUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    borderWidth: 2,
    borderColor: '#26B7C9',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
    gap: 12,
  },
  photoUploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#26B7C9',
  },
  verificationSection: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    marginBottom: 24,
  },
  verificationTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 8,
  },
  verificationDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  idScanPlaceholder: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  idScanLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  idScanHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
    fontStyle: 'italic',
  },
  idScanPreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  agreementSection: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginTop: 24,
  },
  agreementText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  linkText: {
    color: '#26B7C9',
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
    backgroundColor: '#26B7C9',
    opacity: 0.85,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  continueButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});

export default CleanerOnboardingScreen; 