import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  Image,
  Switch,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../../components/Toast';
import * as ImagePicker from 'expo-image-picker';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { uploadService } from '../../services/uploadService';
import { wp, hp } from '../../utils/responsive';
import { navigationRef, resetToMainTabs } from '../../navigation/navigationRef';
import { useCleanerStore } from '../../store/cleanerStore';
import ZipRegionSelector from '../../components/ZipRegionSelector';
import { formatCoverageArea, parseCoverageArea } from '../../utils/zipRegionMap';

function leaveEditor(navigation: { canGoBack: () => boolean; goBack: () => void }) {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    resetToMainTabs();
  }
}

function formatPostgrestError(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const x = e as { message: string; details?: string; hint?: string };
    return [x.message, x.details, x.hint].filter(Boolean).join('\n');
  }
  return String(e);
}

function userFacingSaveError(e: unknown): string {
  const raw = formatPostgrestError(e);
  if (/schema cache|could not find.*column|does not exist/i.test(raw)) {
    return "We couldn't save your profile. Please try again, or contact support if this continues.";
  }
  return raw;
}

type StackParamList = {
  Home: undefined;
  CleanerProfileEdit: undefined;
  Profile: undefined;
};

type CleanerProfileEditProps = {
  navigation: StackNavigationProp<StackParamList, 'CleanerProfileEdit'>;
};

interface CleanerProfile {
  name: string;
  email: string;
  phone: string;
  bio: string;
  avatar_url: string;
  hourly_rate: number;
  years_experience: number;
  specialties: string[];
  available_services: string[];
  coverage_area: string;
  is_available: boolean;
  instant_booking: boolean;
  background_checked: boolean;
  verified: boolean;
  /** From `cleaner_profiles.verification_status` */
  verification_status?: string | null;
  /** From `cleaner_profiles.background_check_date` */
  background_check_date?: string | null;
}

const AVAILABILITY_STORAGE_KEY = 'cleaner_availability_settings_v1';
const AVAILABILITY_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const SPECIALTY_OPTIONS = [
  'Deep Cleaning',
  'Regular Cleaning',
  'Kitchen Specialist',
  'Bathroom Specialist',
  'Window Cleaning',
  'Carpet Cleaning',
  'Laundry Services',
  'Organization',
  'Move-in/Move-out',
  'Post-Construction',
];

const SERVICE_OPTIONS = [
  'Standard Clean',
  'Deep Clean',
  'Express Clean',
  'Kitchen Deep Clean',
  'Bathroom Sanitization',
  'Window Washing',
  'Laundry & Folding',
  'Organization Service',
];

const CleanerProfileEditScreen: React.FC<CleanerProfileEditProps> = ({ navigation }) => {
  const { user, refreshUserSilent } = useAuth();
  const refreshCleanerDashboard = useCleanerStore((s) => s.refreshData);
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [specialtiesOpen, setSpecialtiesOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [availabilityDaysLine, setAvailabilityDaysLine] = useState<string>('');
  const [availabilityHoursLine, setAvailabilityHoursLine] = useState<string>('');
  const [profile, setProfile] = useState<CleanerProfile>({
    name: '',
    email: '',
    phone: '',
    bio: '',
    avatar_url: '',
    hourly_rate: 25,
    years_experience: 1,
    specialties: [],
    available_services: [],
    coverage_area: '',
    is_available: true,
    instant_booking: false,
    background_checked: false,
    verified: false,
    verification_status: null,
    background_check_date: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasBookingTemplate, setHasBookingTemplate] = useState(false);
  const [selectedZip, setSelectedZip] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const { showToast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadAvailabilitySummary = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(AVAILABILITY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          activeDays?: Record<string, boolean>;
          dayHours?: Record<string, { start: string; end: string }>;
        };
        const activeDays = parsed.activeDays || {};
        const dayHours = parsed.dayHours || {};
        const enabled = AVAILABILITY_DAYS.filter((d) => activeDays[d]);
        setAvailabilityDaysLine(
          enabled.length ? enabled.join(', ') : 'No recurring days set yet'
        );
        if (enabled.length && dayHours[enabled[0]]) {
          setAvailabilityHoursLine(
            `${dayHours[enabled[0]].start} – ${dayHours[enabled[0]].end} (sample window)`
          );
        } else {
          setAvailabilityHoursLine('Set hours per day in the calendar');
        }
      } else {
        setAvailabilityDaysLine('Using defaults — tap Manage to customize');
        setAvailabilityHoursLine('Mon–Fri typical hours until you save');
      }
    } catch {
      setAvailabilityDaysLine('Open calendar to set availability');
      setAvailabilityHoursLine('');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAvailabilitySummary();
    }, [loadAvailabilitySummary])
  );

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const subHide = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const loadProfile = async () => {
    try {
      const { supabase } = await import('../../services/supabase');
      
      // Fetch actual cleaner profile from database
      const { data: cleanerData, error: cleanerError } = await supabase
        .from('cleaner_profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      // Fetch user data
      const { data: userData } = await supabase
        .from('users')
        .select('name, email, phone, avatar_url')
        .eq('id', user?.id)
        .single();

      const vStatus = (cleanerData as any)?.verification_status as string | undefined;
      const bgDate = (cleanerData as any)?.background_check_date as string | null | undefined;
      const realProfile: CleanerProfile = {
        name: userData?.name || user?.name || '',
        email: userData?.email || user?.email || '',
        phone: userData?.phone || '',
        bio: cleanerData?.bio || '',
        avatar_url: userData?.avatar_url || user?.avatar_url || '',
        hourly_rate: cleanerData?.hourly_rate || 0,
        years_experience: cleanerData?.years_experience || 0,
        specialties: cleanerData?.specialties || [],
        available_services: cleanerData?.available_services || [],
        coverage_area: cleanerData?.coverage_area || '',
        is_available: cleanerData?.is_available ?? true,
        instant_booking: cleanerData?.instant_booking ?? false,
        background_checked: !!(cleanerData as any)?.background_checked || !!bgDate,
        verified: vStatus === 'verified' || !!(cleanerData as any)?.verified,
        verification_status: vStatus ?? null,
        background_check_date: bgDate ?? null,
      };

      setProfile(realProfile);

      const parsedCoverage = parseCoverageArea(realProfile.coverage_area);
      setSelectedZip(parsedCoverage.zip);
      setSelectedRegion(parsedCoverage.region);

      // Ensure default booking template exists for this cleaner
      try {
        const { supabase } = await import('../../services/supabase');
        const { data, error } = await supabase
          .from('cleaner_booking_templates')
          .select('user_id')
          .eq('user_id', user?.id)
          .single();
        if (error && (error as any).code === 'PGRST116') {
          await supabase.rpc('ensure_default_booking_template', { p_user_id: user?.id });
        }
        setHasBookingTemplate(true);
      } catch (e) {
        console.warn('Booking template ensure failed (non-blocking):', e);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      try { (showToast as any) && showToast({ type: 'error', message: 'Failed to load profile' }); } catch {}
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { supabase } = await import('../../services/supabase');
      const uid = user?.id;
      if (!uid) {
        try { (showToast as any) && showToast({ type: 'error', message: 'Not signed in' }); } catch {}
        return;
      }

      if (!selectedZip || !selectedRegion) {
        try { (showToast as any) && showToast({ type: 'error', message: 'Select ZIP code and region for service area' }); } catch {}
        return;
      }
      const bioText = (profile.bio || '').trim();
      if (bioText.length < 10) {
        try { (showToast as any) && showToast({ type: 'error', message: 'Bio must be at least 10 characters' }); } catch {}
        return;
      }

      const coverageArea = formatCoverageArea(selectedRegion, selectedZip);

      const safeHourly = Number.isFinite(profile.hourly_rate) && profile.hourly_rate > 0
        ? profile.hourly_rate
        : 25;
      let avatarToSave = profile.avatar_url;
      if (avatarToSave?.startsWith('file://')) {
        const upload = await uploadService.uploadFile(avatarToSave, 'image');
        if (!upload.success || !upload.url) {
          throw new Error(upload.error || 'Could not upload profile photo');
        }
        avatarToSave = upload.url;
      }
      
      // Update user table
      const { error: userError } = await supabase
        .from('users')
        .update({
          name: profile.name,
          phone: profile.phone,
          avatar_url: avatarToSave || null,
        })
        .eq('id', uid);
      
      if (userError) throw userError;

      // Insert or update cleaner_profiles (no row = update was a silent no-op before)
      const { error: cleanerError } = await supabase
        .from('cleaner_profiles')
        .upsert(
          {
            user_id: uid,
            bio: profile.bio,
            hourly_rate: safeHourly,
            years_experience: profile.years_experience,
            specialties: profile.specialties,
            available_services: profile.available_services,
            coverage_area: coverageArea,
            is_available: profile.is_available,
            instant_booking: profile.instant_booking,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      
      if (cleanerError) throw cleanerError;

      await refreshUserSilent();
      void refreshCleanerDashboard();

      try { (showToast as any) && showToast({ type: 'success', message: 'Profile updated successfully!' }); } catch {}
      leaveEditor(navigation);
    } catch (error) {
      console.error('Error saving profile:', error);
      const msg = userFacingSaveError(error) || 'Failed to save profile';
      try { (showToast as any) && showToast({ type: 'error', message: msg }); } catch {}
    } finally {
      setSaving(false);
    }
  };

  const handleImagePicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      try { (showToast as any) && showToast({ type: 'warning', message: 'Photo permission required' }); } catch {}
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfile(prev => ({
        ...prev,
        avatar_url: result.assets[0].uri,
      }));
    }
  };

  const toggleSpecialty = (specialty: string) => {
    setProfile(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty],
    }));
  };

  const toggleService = (service: string) => {
    setProfile(prev => ({
      ...prev,
      available_services: prev.available_services.includes(service)
        ? prev.available_services.filter(s => s !== service)
        : [...prev.available_services, service],
    }));
  };

  const handleVerifyPhone = async () => {
    const digits = (profile.phone || '').replace(/\D/g, '');
    if (digits.length !== 10) {
      try { (showToast as any) && showToast({ type: 'warning', message: 'Enter a valid 10-digit phone number first' }); } catch {}
      return;
    }
    const res = await authService.sendVerificationCode(digits);
    if (!res.success) {
      try { (showToast as any) && showToast({ type: 'error', message: res.error || 'Could not send code' }); } catch {}
      return;
    }
    (navigation as any).navigate('PhoneVerify', { phone: digits });
  };

  const openBookingCustomization = () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('BookingCustomization' as never);
    } else {
      try {
        (showToast as any) && showToast({ type: 'error', message: 'Please try again in a moment.' });
      } catch {
        // no-op
      }
    }
  };

  const openProServicesPricing = () => {
    (navigation as any).navigate('ProServices');
  };

  const openCalendarSettings = () => {
    (navigation as any).navigate('CalendarSettings');
  };

  const openSettingsForTrust = () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('SettingsScreen' as never);
    }
  };

  const trustMilestones = (() => {
    const idOk = profile.verification_status === 'verified';
    const bgOk = !!profile.background_check_date || profile.background_checked;
    const bioOk = (profile.bio || '').trim().length >= 10;
    const rateOk = profile.hourly_rate > 0;
    const pts = [idOk, bgOk, bioOk, rateOk].filter(Boolean).length;
    const pct = Math.round((pts / 4) * 100);
    return { idOk, bgOk, bioOk, rateOk, pts, pct };
  })();

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9F9F9" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFA52F" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9F9F9" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => leaveEditor(navigation)}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={styles.saveButtonFilled}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonFilledText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 32 + keyboardHeight + (Platform.OS === 'android' ? 12 : 0) }}
        >
        {/* Profile strength */}
        <View style={styles.strengthCard}>
          <Text style={styles.strengthTitle}>Pro profile</Text>
          <Text style={styles.strengthSub}>
            Complete bio, service area, and rate so you can get booked and show up in the feed.
          </Text>
        </View>

        {/* Profile Picture */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Picture</Text>
          <TouchableOpacity style={styles.avatarContainer} onPress={handleImagePicker}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={40} color="#9CA3AF" />
              </View>
            )}
            <View style={styles.avatarOverlay}>
              <Ionicons name="camera" size={24} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.textInput}
              value={profile.name}
              onChangeText={(text) => setProfile(prev => ({ ...prev, name: text }))}
              placeholder="Enter your full name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={[styles.textInput, styles.disabledInput]}
              value={profile.email}
              editable={false}
              placeholder="Email address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Phone Number</Text>
            <View style={styles.phoneRow}>
              <TextInput
                style={[styles.textInput, styles.phoneInput]}
                value={profile.phone}
                onChangeText={(text) => setProfile(prev => ({ ...prev, phone: text }))}
                placeholder="Phone number"
                keyboardType="phone-pad"
              />
              <TouchableOpacity style={styles.verifyPhoneBtn} onPress={handleVerifyPhone}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#B45309" />
                <Text style={styles.verifyPhoneText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={profile.bio}
              onChangeText={(text) => setProfile(prev => ({ ...prev, bio: text }))}
              placeholder="Tell customers about yourself..."
              multiline
              numberOfLines={4}
            />
          </View>
        </View>

        {/* Professional Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professional Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Hourly Rate ($)</Text>
            <TextInput
              style={styles.textInput}
              value={profile.hourly_rate.toString()}
              onChangeText={(text) => setProfile(prev => ({ ...prev, hourly_rate: parseInt(text) || 0 }))}
              placeholder="Hourly rate"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Years of Experience</Text>
            <TextInput
              style={styles.textInput}
              value={profile.years_experience.toString()}
              onChangeText={(text) => setProfile(prev => ({ ...prev, years_experience: parseInt(text) || 0 }))}
              placeholder="Years of experience"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Service area *</Text>
            <Text style={styles.inputHelperText}>Select ZIP first, then choose your local region.</Text>
            <ZipRegionSelector
              zip={selectedZip}
              region={selectedRegion}
              onChangeZip={(zip) => {
                setSelectedZip(zip);
                setSelectedRegion('');
                setProfile(prev => ({ ...prev, coverage_area: '' }));
              }}
              onChangeRegion={(region) => {
                setSelectedRegion(region);
                setProfile(prev => ({ ...prev, coverage_area: formatCoverageArea(region, selectedZip) }));
              }}
              accentColor="#FFA52F"
            />
          </View>
        </View>

        {/* Availability — same data as Calendar settings (AsyncStorage) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <Text style={styles.sectionDescription}>
            Customers see you as bookable when your profile and calendar align. Manage recurring days and hours here.
          </Text>
          <View style={styles.availabilityCard}>
            <View style={styles.availabilityRow}>
              <Ionicons name="calendar-outline" size={22} color="#FFA52F" />
              <View style={styles.availabilityTextCol}>
                <Text style={styles.availabilityPrimary}>{availabilityDaysLine}</Text>
                {availabilityHoursLine ? (
                  <Text style={styles.availabilitySecondary}>{availabilityHoursLine}</Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity style={styles.availabilityManageBtn} onPress={openCalendarSettings}>
              <Text style={styles.availabilityManageText}>Manage calendar</Text>
              <Ionicons name="chevron-forward" size={18} color="#B45309" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Specialties — collapsible */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setSpecialtiesOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityState={{ expanded: specialtiesOpen }}
          >
            <View style={styles.accordionHeaderTextCol}>
              <Text style={styles.accordionSectionTitle}>Specialties</Text>
              <Text style={styles.accordionSectionSub}>Tap to expand — your expertise tags</Text>
            </View>
            <Ionicons name={specialtiesOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#64748B" />
          </TouchableOpacity>
          {specialtiesOpen ? (
            <View style={styles.optionsGrid}>
              {SPECIALTY_OPTIONS.map((specialty) => (
                <TouchableOpacity
                  key={specialty}
                  style={[
                    styles.optionChip,
                    profile.specialties.includes(specialty) && styles.optionChipSelected,
                  ]}
                  onPress={() => toggleSpecialty(specialty)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      profile.specialties.includes(specialty) && styles.optionChipTextSelected,
                    ]}
                  >
                    {specialty}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.accordionCollapsedHint}>
              {profile.specialties.length
                ? `${profile.specialties.length} selected — expand to edit`
                : 'None selected yet'}
            </Text>
          )}
        </View>

        {/* Available Services — collapsible */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => setServicesOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityState={{ expanded: servicesOpen }}
          >
            <View style={styles.accordionHeaderTextCol}>
              <Text style={styles.accordionSectionTitle}>Available services</Text>
              <Text style={styles.accordionSectionSub}>
                High-level services you advertise — set catalog prices & booking questions in Services
              </Text>
            </View>
            <Ionicons name={servicesOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#64748B" />
          </TouchableOpacity>
          {servicesOpen ? (
            <View style={styles.optionsGrid}>
              {SERVICE_OPTIONS.map((service) => (
                <TouchableOpacity
                  key={service}
                  style={[
                    styles.optionChip,
                    profile.available_services.includes(service) && styles.optionChipSelected,
                  ]}
                  onPress={() => toggleService(service)}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      profile.available_services.includes(service) && styles.optionChipTextSelected,
                    ]}
                  >
                    {service}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.accordionCollapsedHint}>
              {profile.available_services.length
                ? `${profile.available_services.length} selected — expand to edit`
                : 'None selected yet'}
            </Text>
          )}
          <TouchableOpacity style={styles.pricingCta} onPress={openProServicesPricing}>
            <Ionicons name="pricetags-outline" size={20} color="#FFFFFF" />
            <Text style={styles.pricingCtaText}>Set price & booking options per service</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Booking Template */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Template</Text>
          <Text style={styles.sectionDescription}>Customize the booking steps, fields, and add-ons customers see when booking you.</Text>
          <TouchableOpacity style={styles.templateButton} onPress={openBookingCustomization}>
            <Ionicons name="construct-outline" size={18} color="#FFA52F" />
            <Text style={styles.templateButtonText}>Customize Booking Flow</Text>
          </TouchableOpacity>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Available for Work</Text>
              <Text style={styles.settingDescription}>Accept new booking requests</Text>
            </View>
            <Switch
              value={profile.is_available}
              onValueChange={(value) => setProfile(prev => ({ ...prev, is_available: value }))}
              trackColor={{ false: '#E5E7EB', true: '#FFA52F' }}
              thumbColor={profile.is_available ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Instant Booking</Text>
              <Text style={styles.settingDescription}>Allow customers to book immediately</Text>
            </View>
            <Switch
              value={profile.instant_booking}
              onValueChange={(value) => setProfile(prev => ({ ...prev, instant_booking: value }))}
              trackColor={{ false: '#E5E7EB', true: '#FFA52F' }}
              thumbColor={profile.instant_booking ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>

          {/* Trust & verification — gamified progress */}
          <View style={styles.verificationSection}>
            <Text style={styles.sectionTitle}>Trust score</Text>
            <Text style={styles.trustSub}>
              Complete each milestone to boost how much customers trust your profile. This mirrors what we show in search and booking.
            </Text>
            <View style={styles.trustScoreCard}>
              <View style={styles.trustScoreHeader}>
                <Text style={styles.trustScoreValue}>{trustMilestones.pct}%</Text>
                <Text style={styles.trustScoreLabel}>profile strength</Text>
              </View>
              <View style={styles.trustBarTrack}>
                <View style={[styles.trustBarFill, { width: `${trustMilestones.pct}%` }]} />
              </View>
            </View>

            <View style={styles.milestoneList}>
              <View style={styles.milestoneRow}>
                <View style={[styles.milestoneIcon, trustMilestones.idOk && styles.milestoneIconDone]}>
                  <Ionicons name="id-card-outline" size={18} color={trustMilestones.idOk ? '#FFFFFF' : '#92400E'} />
                </View>
                <View style={styles.milestoneBody}>
                  <Text style={styles.milestoneTitle}>Identity verified</Text>
                  <Text style={styles.milestoneHint}>
                    {trustMilestones.idOk ? 'Completed — you show as verified.' : 'Finish ID check in Settings when prompted.'}
                  </Text>
                </View>
                {trustMilestones.idOk ? (
                  <View style={styles.xpPill}>
                    <Text style={styles.xpPillText}>+25 XP</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={openSettingsForTrust} hitSlop={8}>
                    <Text style={styles.milestoneCta}>Settings</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.milestoneRow}>
                <View style={[styles.milestoneIcon, trustMilestones.bgOk && styles.milestoneIconDone]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={trustMilestones.bgOk ? '#FFFFFF' : '#92400E'} />
                </View>
                <View style={styles.milestoneBody}>
                  <Text style={styles.milestoneTitle}>Background check</Text>
                  <Text style={styles.milestoneHint}>
                    {trustMilestones.bgOk ? 'On file — great for trust.' : 'Submit or track status from Settings.'}
                  </Text>
                </View>
                {trustMilestones.bgOk ? (
                  <View style={styles.xpPill}>
                    <Text style={styles.xpPillText}>+25 XP</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={openSettingsForTrust} hitSlop={8}>
                    <Text style={styles.milestoneCta}>Settings</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.milestoneRow}>
                <View style={[styles.milestoneIcon, trustMilestones.bioOk && styles.milestoneIconDone]}>
                  <Ionicons name="document-text-outline" size={18} color={trustMilestones.bioOk ? '#FFFFFF' : '#92400E'} />
                </View>
                <View style={styles.milestoneBody}>
                  <Text style={styles.milestoneTitle}>Strong bio</Text>
                  <Text style={styles.milestoneHint}>
                    {trustMilestones.bioOk ? 'Bio meets minimum length.' : 'Add at least 10 characters above.'}
                  </Text>
                </View>
                {trustMilestones.bioOk ? (
                  <View style={styles.xpPill}>
                    <Text style={styles.xpPillText}>+25 XP</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.milestoneRow}>
                <View style={[styles.milestoneIcon, trustMilestones.rateOk && styles.milestoneIconDone]}>
                  <Ionicons name="cash-outline" size={18} color={trustMilestones.rateOk ? '#FFFFFF' : '#92400E'} />
                </View>
                <View style={styles.milestoneBody}>
                  <Text style={styles.milestoneTitle}>Public rate</Text>
                  <Text style={styles.milestoneHint}>
                    {trustMilestones.rateOk ? 'Hourly rate is set.' : 'Set an hourly rate in Professional Details.'}
                  </Text>
                </View>
                {trustMilestones.rateOk ? (
                  <View style={styles.xpPill}>
                    <Text style={styles.xpPillText}>+25 XP</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
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
    width: 44,
    height: 44,
    borderRadius: wp('5.5%'),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#1F2937',
  },
  saveButtonFilled: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.8%'),
    minWidth: 64,
    borderRadius: wp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFA52F',
  },
  saveButtonFilledText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  kav: { flex: 1 },
  strengthCard: {
    marginHorizontal: wp('5%'),
    marginBottom: hp('0.5%'),
    backgroundColor: '#FFF9F0',
    borderRadius: wp('3%'),
    padding: wp('3.5%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 47, 0.3)',
  },
  strengthTitle: { fontSize: wp('3.8%'), fontWeight: '700', color: '#1F2937' },
  strengthSub: { fontSize: wp('3%'), color: '#6B7280', marginTop: 4, lineHeight: 18 },
  inputHelperText: { fontSize: wp('2.9%'), color: '#9CA3AF', marginBottom: 6, lineHeight: 16 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: wp('4%'),
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: hp('2%'),
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2.5%'),
    borderRadius: wp('4%'),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: hp('2%'),
  },
  sectionDescription: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginBottom: hp('2%'),
  },
  avatarContainer: {
    alignSelf: 'center',
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFA52F',
    borderRadius: wp('5%'),
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
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
  disabledInput: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  optionChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: wp('5%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    margin: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionChipSelected: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  optionChipText: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: '#6B7280',
  },
  optionChipTextSelected: {
    color: '#FFFFFF',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: hp('2%'),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: wp('4%'),
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: hp('0.5%'),
  },
  settingDescription: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
  },
  verificationSection: {
    marginTop: hp('3%'),
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('1.5%'),
  },
  verificationText: {
    fontSize: wp('4%'),
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  verifiedBadge: {
    fontSize: wp('3%'),
    fontWeight: '600',
    color: '#10B981',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('3%'),
  },
  bottomSpacing: {
    height: 40,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: wp('3%'),
    marginTop: hp('1%'),
    gap: wp('2%'),
  },
  templateButtonText: {
    color: '#FFA52F',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phoneInput: { flex: 1 },
  verifyPhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 47, 0.45)',
    backgroundColor: '#FFF9F0',
  },
  verifyPhoneText: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  accordionSectionTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  accordionSectionSub: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginBottom: 0,
    lineHeight: 20,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('1%'),
  },
  accordionHeaderTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  accordionCollapsedHint: {
    fontSize: wp('3.2%'),
    color: '#64748B',
    marginTop: 4,
  },
  pricingCta: {
    marginTop: hp('2%'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFA52F',
    paddingVertical: hp('1.6%'),
    paddingHorizontal: wp('3%'),
    borderRadius: wp('3%'),
  },
  pricingCtaText: {
    color: '#FFFFFF',
    fontSize: wp('3.6%'),
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  availabilityCard: {
    marginTop: hp('1%'),
    backgroundColor: '#FFF9F0',
    borderRadius: wp('3%'),
    padding: wp('3.5%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 47, 0.35)',
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  availabilityTextCol: {
    flex: 1,
  },
  availabilityPrimary: {
    fontSize: wp('3.6%'),
    fontWeight: '600',
    color: '#1F2937',
  },
  availabilitySecondary: {
    fontSize: wp('3.1%'),
    color: '#64748B',
    marginTop: 4,
  },
  availabilityManageBtn: {
    marginTop: hp('1.5%'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: hp('1%'),
  },
  availabilityManageText: {
    fontSize: wp('3.5%'),
    fontWeight: '700',
    color: '#B45309',
  },
  trustSub: {
    fontSize: wp('3.2%'),
    color: '#6B7280',
    marginBottom: hp('1.5%'),
    lineHeight: 18,
  },
  trustScoreCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: wp('3%'),
    padding: wp('3.5%'),
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: hp('2%'),
  },
  trustScoreHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  trustScoreValue: {
    fontSize: wp('7%'),
    fontWeight: '800',
    color: '#B45309',
  },
  trustScoreLabel: {
    fontSize: wp('3.2%'),
    fontWeight: '600',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trustBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    overflow: 'hidden',
  },
  trustBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#FFA52F',
  },
  milestoneList: {
    gap: hp('1.2%'),
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('1%'),
    paddingHorizontal: wp('2%'),
    backgroundColor: '#FAFAF9',
    borderRadius: wp('2.5%'),
    borderWidth: 1,
    borderColor: '#E7E5E4',
  },
  milestoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  milestoneIconDone: {
    backgroundColor: '#10B981',
  },
  milestoneBody: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: wp('3.6%'),
    fontWeight: '700',
    color: '#1F2937',
  },
  milestoneHint: {
    fontSize: wp('3%'),
    color: '#6B7280',
    marginTop: 2,
  },
  milestoneCta: {
    fontSize: wp('3.2%'),
    fontWeight: '700',
    color: '#FFA52F',
  },
  xpPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  xpPillText: {
    fontSize: wp('2.8%'),
    fontWeight: '800',
    color: '#047857',
  },
});

export default CleanerProfileEditScreen;