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

type StackParamList = {
  CleanerOnboarding: undefined;
  MainTabs: undefined;
};

type CleanerOnboardingNavigationProp = StackNavigationProp<StackParamList, 'CleanerOnboarding'>;

interface CleanerOnboardingProps {
  navigation: CleanerOnboardingNavigationProp;
}

interface CleanerOnboardingData {
  // Step 1: Basic Info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profilePhoto: string;
  dateOfBirth: string;
  
  // Step 2: Professional Background
  yearsExperience: string;
  previousEmployer: string;
  references: string;
  hasInsurance: boolean;
  insuranceProvider: string;
  hasTransportation: boolean;
  transportationDetails: string;
  
  // Step 3: Service Area & Availability
  serviceRadius: string;
  serviceZip: string;
  availableDays: string[];
  availableHours: string;
  serviceTypes: string[];
  specializations: string[];
  
  // Step 4: Equipment & Pricing
  providesEquipment: boolean;
  equipmentDetails: string;
  providesSupplies: boolean;
  supplyDetails: string;
  hourlyRate: string;
  minimumBooking: string;
  
  // Step 5: Skills Assessment
  cleaningKnowledge: number;
  customerService: number;
  timeManagement: number;
  portfolioPhotos: string[];
  workSamples: string;
  auditionVideo: string;
  
  // Step 6: Legal & Verification
  hasWorkAuthorization: boolean;
  socialSecurityNumber: string;
  driversLicense: string;
  emergencyContact: string;
  emergencyPhone: string;
  backgroundCheckConsent: boolean;
}

const CleanerOnboardingScreen: React.FC<CleanerOnboardingProps> = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [bypassMode, setBypassMode] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const hasAutoExited = useRef(false);
  const totalSteps = 6;
  const { refreshSession, refreshUser, authUser } = useAuth();
  const { showToast } = useToast();

  const getCleanerStateForStep = (step: number) => {
    if (step >= totalSteps) return 'STAGING';
    if (step >= 5) return 'STAGING';
    if (step >= 3) return 'SERVICE_DEFINED';
    if (step >= 2) return 'UNDER_REVIEW';
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
    yearsExperience: '',
    previousEmployer: '',
    references: '',
    hasInsurance: false,
    insuranceProvider: '',
    hasTransportation: true,
    transportationDetails: '',
    serviceRadius: '',
    serviceZip: '',
    availableDays: [],
    availableHours: '',
    serviceTypes: [],
    specializations: [],
    providesEquipment: true,
    equipmentDetails: '',
    providesSupplies: true,
    supplyDetails: '',
    hourlyRate: '',
    minimumBooking: '',
    cleaningKnowledge: 0,
    customerService: 0,
    timeManagement: 0,
    portfolioPhotos: [],
    workSamples: '',
    auditionVideo: '',
    hasWorkAuthorization: false,
    socialSecurityNumber: '',
    driversLicense: '',
    emergencyContact: '',
    emergencyPhone: '',
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

  const toggleArrayItem = (field: keyof CleanerOnboardingData, item: string) => {
    const currentArray = data[field] as string[];
    const updatedArray = currentArray.includes(item)
      ? currentArray.filter(i => i !== item)
      : [...currentArray, item];
    updateData(field, updatedArray);
  };

  const validateStep = (step: number): string | null => {
    switch (step) {
      case 1:
        if (!data.firstName || !data.lastName || !data.email || !data.phone) {
          return 'Please fill in all required fields';
        }
        break;
      case 2:
        if (!data.yearsExperience || !data.hasInsurance) {
          return 'Professional background information is required';
        }
        break;
      case 3:
        if (!data.serviceRadius || data.serviceTypes.length === 0) {
          return 'Please specify your service area and types';
        }
        break;
      case 5:
        break;
      case 6:
        if (!data.hasWorkAuthorization || !data.emergencyContact || !data.backgroundCheckConsent) {
          return 'Legal verification and consent are required';
        }
        break;
    }
    return null;
  };

  const handleNext = () => {
    if (!bypassMode) {
      const error = validateStep(currentStep);
      if (error) {
        Alert.alert('Incomplete Information', error);
        return;
      }
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
          `Experience: ${data.yearsExperience || 'N/A'}`,
          `Services: ${data.serviceTypes?.join(', ') || 'Standard cleaning'}`,
          `Transportation: ${data.hasTransportation ? 'Yes' : 'No'}`,
          `Availability: ${availabilitySummary}`,
          `Service Radius: ${computedRadius} miles`,
          data.workSamples ? `Work Samples: ${data.workSamples}` : null,
          `Authorized to work: ${data.hasWorkAuthorization ? 'Yes' : 'No'}`,
          `Emergency Contact: ${data.emergencyContact} (${data.emergencyPhone})`,
          `Background Check Consent: ${data.backgroundCheckConsent ? 'Yes' : 'No'}`,
        ]
          .filter(Boolean)
          .join('\n');

        // Create cleaner profile with available fields
        const { error: cleanerError } = await withTimeout(
          supabase
            .from('cleaner_profiles')
            .insert([{
              user_id: userId,
              hourly_rate: Number.parseFloat(data.hourlyRate) || 25.00,
              bio: bioSummary,
              years_experience: Number.parseInt(data.yearsExperience || '0', 10) || 0,
              specialties: data.serviceTypes?.length ? data.serviceTypes : ['standard_cleaning'],
              service_radius_km: Math.round(computedRadius * 1.60934), // Convert miles to km
              verification_status: 'pending',
              background_check_status: 'pending',
              is_available: false, // Will be activated after verification
            }]),
          15000,
          'Create cleaner profile'
        );

        // Also create an address record for the cleaner if complete
        if (!cleanerError) {
          const hasAddress =
            Boolean(data.address?.trim()) &&
            Boolean(data.city?.trim()) &&
            Boolean(data.state?.trim()) &&
            Boolean(data.zipCode?.trim());

          if (hasAddress) {
            const { error: addressError } = await withTimeout(
              supabase
                .from('addresses')
                .insert([{
                  user_id: userId,
                  street: data.address?.trim(),
                  city: data.city?.trim(),
                  state: data.state?.trim(),
                  zip_code: data.zipCode?.trim(),
                  is_default: true,
                  nickname: 'Service Address',
                }]),
              15000,
              'Create address'
            );

            if (addressError) {
              console.error('Error creating cleaner address:', addressError);
            }
          } else {
            console.warn('Skipping cleaner address insert due to missing fields');
          }
        }

        if (cleanerError && cleanerError.code !== '23505') {
          console.error('Error creating cleaner profile:', cleanerError);
          throw new Error('Failed to create cleaner profile: ' + cleanerError.message);
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
          await AsyncStorage.setItem('last_route', JSON.stringify({ name: 'MainTabs' }));
          await AsyncStorage.setItem('cleaner_onboarding_complete', 'true');
          setCleanerOnboardingOverride(true);
        } catch {}
        showToast({
          type: 'success',
          message:
            'Hero launch confirmed! We’ll review your information and run a background check within 24–48 hours.',
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
          routes: [{ name: 'MainTabs' }],
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

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${(currentStep / totalSteps) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>Step {currentStep} of {totalSteps}</Text>
      </View>
      {false && ( // Demo mode removed
        <View style={styles.bypassContainer}>
          <Text style={styles.bypassLabel}>Bypass Mode</Text>
          <Switch
            value={bypassMode}
            onValueChange={setBypassMode}
            trackColor={{ false: '#767577', true: '#26B7C9' }}
            thumbColor={bypassMode ? '#ffffff' : '#f4f3f4'}
          />
        </View>
      )}
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
        <View style={styles.inputHalf}>
          <Text style={styles.inputLabel}>First Name *</Text>
          <TextInput
            style={styles.textInput}
            value={data.firstName}
            onChangeText={(text) => updateData('firstName', text)}
            placeholder="Sarah"
            onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 140, animated: true }), 150)}
          />
        </View>
        <View style={styles.inputHalf}>
          <Text style={styles.inputLabel}>Last Name *</Text>
          <TextInput
            style={styles.textInput}
            value={data.lastName}
            onChangeText={(text) => updateData('lastName', text)}
            placeholder="Johnson"
            onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 160, animated: true }), 150)}
          />
        </View>
      </View>

      <Text style={styles.inputLabel}>Email Address *</Text>
      <TextInput
        style={styles.textInput}
        value={data.email}
        onChangeText={(text) => updateData('email', text)}
        placeholder="sarah.johnson@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 190, animated: true }), 150)}
      />

      <Text style={styles.inputLabel}>Phone Number *</Text>
      <TextInput
        style={styles.textInput}
        value={data.phone}
        onChangeText={(text) => updateData('phone', text)}
        placeholder="+1 (555) 123-4567"
        keyboardType="phone-pad"
        onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 240, animated: true }), 150)}
      />

      <Text style={styles.inputLabel}>Date of Birth *</Text>
      <TextInput
        style={styles.textInput}
        value={data.dateOfBirth}
        onChangeText={(text) => updateData('dateOfBirth', text)}
        placeholder="MM/DD/YYYY"
        onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 300, animated: true }), 150)}
      />
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView
      ref={scrollRef}
      style={styles.stepContainer}
      contentContainerStyle={{ paddingBottom: 140 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Professional Background</Text>
      <Text style={styles.stepSubtitle}>Tell us about your cleaning experience</Text>

      <Text style={styles.inputLabel}>Years of Experience *</Text>
      <View style={styles.optionRow}>
        {['Less than 1', '1-2 years', '3-5 years', '5+ years'].map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionButton,
              data.yearsExperience === option && styles.selectedOption
            ]}
            onPress={() => updateData('yearsExperience', option)}
          >
            <Text style={[
              styles.optionText,
              data.yearsExperience === option && styles.selectedOptionText
            ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.inputLabel}>Previous Employer/Experience</Text>
          <TextInput
        style={[styles.textInput, styles.textArea]}
        value={data.previousEmployer}
        onChangeText={(text) => updateData('previousEmployer', text)}
        placeholder="Previous cleaning companies, independent work, or relevant experience..."
        multiline
            numberOfLines={3}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 300, animated: true }), 150)}
      />

      <Text style={styles.inputLabel}>References</Text>
          <TextInput
        style={[styles.textInput, styles.textArea]}
        value={data.references}
        onChangeText={(text) => updateData('references', text)}
        placeholder="Previous employers or clients who can vouch for your work..."
        multiline
            numberOfLines={3}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 380, animated: true }), 150)}
      />

      <View style={styles.switchRow}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>Do you have liability insurance? *</Text>
          <Text style={styles.switchDescription}>Required for all cleaners</Text>
        </View>
        <Switch
          value={data.hasInsurance}
          onValueChange={(value) => updateData('hasInsurance', value)}
          trackColor={{ false: '#D1D5DB', true: '#26B7C9' }}
          thumbColor={data.hasInsurance ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      {data.hasInsurance && (
        <>
          <Text style={styles.inputLabel}>Insurance Provider</Text>
          <TextInput
            style={styles.textInput}
            value={data.insuranceProvider}
            onChangeText={(text) => updateData('insuranceProvider', text)}
            placeholder="Insurance company name"
          />
        </>
      )}

      <View style={styles.switchRow}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>Do you have reliable transportation?</Text>
          <Text style={styles.switchDescription}>Car, bike, or public transit</Text>
        </View>
        <Switch
          value={data.hasTransportation}
          onValueChange={(value) => updateData('hasTransportation', value)}
          trackColor={{ false: '#D1D5DB', true: '#26B7C9' }}
          thumbColor={data.hasTransportation ? '#ffffff' : '#f4f3f4'}
        />
      </View>
    </ScrollView>
  );

  const renderStep3 = () => {
    const radiusMiles = data.serviceRadius.includes('5')
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
              fillColor="rgba(38, 183, 201, 0.15)"
              strokeColor="rgba(38, 183, 201, 0.7)"
              strokeWidth={2}
            />
          </MapView>
          <Text style={styles.mapHint}>
            {isResolvingZip ? 'Updating map from ZIP...' : 'Tap the map or use GPS to set your service area.'}
          </Text>
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
      <Text style={styles.stepTitle}>Equipment & Pricing</Text>
      <Text style={styles.stepSubtitle}>Set up your service offerings</Text>

      <View style={styles.switchRow}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>Do you provide cleaning equipment?</Text>
          <Text style={styles.switchDescription}>Vacuum, mop, microfiber cloths, etc.</Text>
        </View>
        <Switch
          value={data.providesEquipment}
          onValueChange={(value) => updateData('providesEquipment', value)}
          trackColor={{ false: '#D1D5DB', true: '#26B7C9' }}
          thumbColor={data.providesEquipment ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>Do you provide cleaning supplies?</Text>
          <Text style={styles.switchDescription}>All-purpose cleaners, glass cleaner, etc.</Text>
        </View>
        <Switch
          value={data.providesSupplies}
          onValueChange={(value) => updateData('providesSupplies', value)}
          trackColor={{ false: '#D1D5DB', true: '#26B7C9' }}
          thumbColor={data.providesSupplies ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      <Text style={styles.inputLabel}>Earnings Calculator</Text>
      <View style={styles.earningsRow}>
        <View style={styles.inputHalf}>
          <TextInput
            style={styles.textInput}
            value={data.hourlyRate}
            onChangeText={(text) => updateData('hourlyRate', text)}
            placeholder="45"
            keyboardType="numeric"
          />
          <Text style={styles.rateHelperText}>Hourly rate</Text>
        </View>
        <View style={styles.earningsBreakdown}>
          <Text style={styles.earningsLine}>Rate - 20% fee = Your pay</Text>
          <Text style={styles.earningsValue}>
            {data.hourlyRate
              ? `$${((Number.parseFloat(data.hourlyRate) || 0) * 0.8).toFixed(0)}/hr take-home`
              : '$0/hr take-home'}
          </Text>
          <Text style={styles.rateHelperText}>Local average: $35-65/hr</Text>
        </View>
      </View>
      {Number.parseFloat(data.hourlyRate) > 100 && (
        <View style={styles.rateWarning}>
          <Ionicons name="alert-circle" size={16} color="#F97316" />
          <Text style={styles.rateWarningText}>
            This is significantly higher than the local average. High rates may lead to fewer bookings.
          </Text>
        </View>
      )}

      <Text style={styles.inputLabel}>Minimum Booking (hours)</Text>
      <View style={styles.optionRow}>
        {['1 hour', '2 hours', '3 hours', '4 hours'].map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionButton,
              data.minimumBooking === option && styles.selectedOption
            ]}
            onPress={() => updateData('minimumBooking', option)}
          >
            <Text style={[
              styles.optionText,
              data.minimumBooking === option && styles.selectedOptionText
            ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.inputLabel}>What equipment/supplies do you provide?</Text>
      <TextInput
        style={[styles.textInput, styles.textArea]}
        value={data.equipmentDetails}
        onChangeText={(text) => updateData('equipmentDetails', text)}
        placeholder="List the equipment and supplies you bring to each job..."
        multiline
        numberOfLines={4}
      />
    </ScrollView>
  );

  const renderStep5 = () => {
    const handleRecordVideo = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow camera access to record your audition.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 30,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        updateData('auditionVideo', result.assets[0].uri);
      }
    };

    const handleUploadVideo = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo access to upload your audition.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 30,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        updateData('auditionVideo', result.assets[0].uri);
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
        <Text style={styles.stepTitle}>Hero Audition</Text>
        <Text style={styles.stepSubtitle}>Record a 15-30 second intro video</Text>

        <View style={styles.videoAuditionCard}>
          <Ionicons name="videocam" size={28} color="#26B7C9" />
          <Text style={styles.videoAuditionTitle}>Video Audition</Text>
          <Text style={styles.videoAuditionText}>
            Share your vibe and specialty. Short and authentic wins.
          </Text>
          {data.auditionVideo ? (
            <View style={styles.videoUploaded}>
              <Ionicons name="checkmark-circle" size={18} color="#26B7C9" />
              <Text style={styles.videoUploadedText}>Video ready to submit</Text>
            </View>
          ) : null}
          <View style={styles.videoActionRow}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleRecordVideo}>
              <Ionicons name="camera" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Record</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleUploadVideo}>
              <Ionicons name="cloud-upload" size={18} color="#26B7C9" />
              <Text style={styles.secondaryButtonText}>Upload</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>Recording Tips</Text>
          <Text style={styles.tipsText}>1. Find good lighting.</Text>
          <Text style={styles.tipsText}>2. Smile!</Text>
          <Text style={styles.tipsText}>3. Mention your specialty.</Text>
        </View>
      </ScrollView>
    );
  };

  const renderStep6 = () => (
    <ScrollView
      ref={scrollRef}
      style={styles.stepContainer}
      contentContainerStyle={{ paddingBottom: 140 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Legal & Verification</Text>
      <Text style={styles.stepSubtitle}>Final step to complete your application</Text>

      <View style={styles.verificationSection}>
        <Ionicons name="shield-checkmark" size={24} color="#26B7C9" />
        <Text style={styles.verificationTitle}>Background Check Required</Text>
        <Text style={styles.verificationDescription}>
          All cleaners must pass a background check for customer safety and trust.
        </Text>
      </View>

      <View style={styles.lockedLabelRow}>
        <Ionicons name="lock-closed" size={16} color="#26B7C9" />
        <Text style={styles.inputLabel}>SSN (Last 4) *</Text>
      </View>
      <TextInput
        style={styles.textInput}
        value={data.socialSecurityNumber}
        onChangeText={(text) => updateData('socialSecurityNumber', text)}
        placeholder="1234"
        keyboardType="number-pad"
        secureTextEntry
      />

      <View style={styles.lockedLabelRow}>
        <Ionicons name="lock-closed" size={16} color="#26B7C9" />
        <Text style={styles.inputLabel}>Driver's License *</Text>
      </View>
      <TextInput
        style={styles.textInput}
        value={data.driversLicense}
        onChangeText={(text) => updateData('driversLicense', text)}
        placeholder="A1234567"
        autoCapitalize="characters"
      />

      <View style={styles.switchRow}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>I am authorized to work in the US *</Text>
          <Text style={styles.switchDescription}>Required for all contractors</Text>
        </View>
        <Switch
          value={data.hasWorkAuthorization}
          onValueChange={(value) => updateData('hasWorkAuthorization', value)}
          trackColor={{ false: '#D1D5DB', true: '#26B7C9' }}
          thumbColor={data.hasWorkAuthorization ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      <Text style={styles.inputLabel}>Emergency Contact Name *</Text>
      <TextInput
        style={styles.textInput}
        value={data.emergencyContact}
        onChangeText={(text) => updateData('emergencyContact', text)}
        placeholder="John Doe"
      />

      <Text style={styles.inputLabel}>Emergency Contact Phone *</Text>
      <TextInput
        style={styles.textInput}
        value={data.emergencyPhone}
        onChangeText={(text) => updateData('emergencyPhone', text)}
        placeholder="+1 (555) 987-6543"
        keyboardType="phone-pad"
      />

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
          onValueChange={(value) => updateData('backgroundCheckConsent', value)}
          trackColor={{ false: '#D1D5DB', true: '#26B7C9' }}
          thumbColor={data.backgroundCheckConsent ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      <View style={styles.agreementSection}>
        <Text style={styles.agreementText}>
          By submitting this application, you agree to our{' '}
          <Text style={styles.linkText}>Cleaner Terms of Service</Text>
          {', '}
          <Text style={styles.linkText}>Background Check Policy</Text>
          {', and '}
          <Text style={styles.linkText}>Privacy Policy</Text>.
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
      case 6: return renderStep6();
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
            style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
            onPress={handleNext}
            disabled={isLoading}
          >
            <LinearGradient
              colors={isLoading ? ['#9CA3AF', '#6B7280'] : ['#26B7C9', '#26B7C9']}
              style={styles.continueButtonGradient}
            >
              <Text style={styles.continueButtonText}>
                {isLoading
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
  mapHint: {
    fontSize: 12,
    color: '#6B7280',
    padding: 10,
    textAlign: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
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