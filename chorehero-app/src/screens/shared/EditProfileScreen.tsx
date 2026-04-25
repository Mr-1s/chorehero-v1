import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { authService } from '../../services/auth';
import { wp, hp } from '../../utils/responsive';
import { resetToMainTabs } from '../../navigation/navigationRef';
import { cleanerTheme } from '../../utils/theme';
import ZipRegionSelector from '../../components/ZipRegionSelector';
import { formatCoverageArea, parseCoverageArea } from '../../utils/zipRegionMap';

const PRO_ORANGE = cleanerTheme.colors.primary;

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
  EditProfileScreen: undefined;
  Profile: undefined;
};

type EditProfileScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'EditProfileScreen'>;
};

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  specialPreferences?: string;
  // Cleaner-specific fields
  bio?: string;
  coverageArea?: string;
  hourlyRate?: string;
}

const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ navigation }) => {
  const { user, isCleaner: isCleanerAuth, isCustomer: isCustomerAuth, refreshUserSilent } = useAuth();
  // Prefer explicit `users.role` so a customer who happens to have a stray
  // cleaner_profiles row isn't validated as a cleaner (which previously made
  // every save attempt fail on missing zip / bio / hourly rate).
  const explicitRole = (user as { role?: string } | null | undefined)?.role;
  const isCleaner = explicitRole ? explicitRole === 'cleaner' : isCleanerAuth;
  const isCustomer = explicitRole ? explicitRole === 'customer' : isCustomerAuth;
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [selectedZip, setSelectedZip] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [showCleanerTips, setShowCleanerTips] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    specialPreferences: '',
    // Cleaner fields
    bio: '',
    coverageArea: '',
    hourlyRate: '',
  });

  useEffect(() => {
    loadUserProfile();
  }, [user?.id, isCleaner, isCustomer]);

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

  const cleanerCompletion = useMemo(() => {
    if (!isCleaner) return { done: 0, total: 0, pct: 0 };
    const checks = [
      profile.name.trim().length > 0 && profile.phone.trim().length > 0,
      !!selectedZip && !!selectedRegion && parseFloat(profile.hourlyRate || '') > 0,
      (profile.bio?.trim().length ?? 0) >= 10,
    ];
    const done = checks.filter(Boolean).length;
    return { done, total: 3, pct: Math.round((done / 3) * 100) };
  }, [isCleaner, profile, selectedZip, selectedRegion]);

  const loadUserProfile = async () => {
    try {
      if (!user?.id) return;

      // Get user basic info
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name, email, phone')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      // Get customer profile if customer
      let customerData = null;
      let cleanerData = null;

      if (isCustomer) {
        const { data, error } = await supabase
          .from('customer_profiles')
          .select('emergency_contact_name, emergency_contact_phone, special_preferences')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.warn('Error loading customer profile:', error);
        } else {
          customerData = data;
        }
      }

      // Get cleaner profile if cleaner
      if (isCleaner) {
        const { data, error } = await supabase
          .from('cleaner_profiles')
          .select('bio, coverage_area, hourly_rate')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.warn('Error loading cleaner profile:', error);
        } else {
          cleanerData = data;
        }
      }

      const coverageParsed = parseCoverageArea(cleanerData?.coverage_area || '');

      setProfile({
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        emergencyContactName: customerData?.emergency_contact_name || '',
        emergencyContactPhone: customerData?.emergency_contact_phone || '',
        specialPreferences: customerData?.special_preferences || '',
        bio: cleanerData?.bio || '',
        coverageArea: cleanerData?.coverage_area || '',
        hourlyRate: cleanerData?.hourly_rate?.toString() || '',
      });
      setSelectedZip(coverageParsed.zip);
      setSelectedRegion(coverageParsed.region);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile information');
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      setIsSaving(true);

      if (!user?.id) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Validate required fields
      if (!profile.name.trim()) {
        Alert.alert('Error', 'Name is required');
        return;
      }

      if (!profile.phone.trim()) {
        Alert.alert('Error', 'Phone number is required');
        return;
      }

      if (isCleaner) {
        if (!selectedZip || !selectedRegion) {
          Alert.alert('Error', 'Select ZIP code and region for your service area.');
          return;
        }
        const bio = profile.bio?.trim() ?? '';
        if (bio.length < 10) {
          Alert.alert(
            'Error',
            'Bio must be at least 10 characters (needed to post videos to the feed).'
          );
          return;
        }
        const hourRaw = profile.hourlyRate?.trim() ?? '';
        const hourParsed = parseFloat(hourRaw);
        if (hourRaw === '' || !Number.isFinite(hourParsed) || hourParsed <= 0) {
          Alert.alert('Error', 'Enter a valid hourly rate (greater than 0)');
          return;
        }
      }

      // Update users table
      const { error: userError } = await supabase
        .from('users')
        .update({
          name: profile.name.trim(),
          phone: profile.phone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (userError) throw userError;

      // Update customer profile if customer
      if (isCustomer) {
        const { error: customerError } = await supabase
          .from('customer_profiles')
          .upsert(
            {
              user_id: user.id,
              emergency_contact_name: profile.emergencyContactName?.trim() || null,
              emergency_contact_phone: profile.emergencyContactPhone?.trim() || null,
              special_preferences: profile.specialPreferences?.trim() || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );

        if (customerError) throw customerError;
      }

      // Update cleaner profile if cleaner
      if (isCleaner) {
        const hourParsed = parseFloat(profile.hourlyRate!.trim());
        const hourly_rate = Math.round(hourParsed * 100) / 100;

        const coverageArea = formatCoverageArea(selectedRegion, selectedZip);
        const { error: cleanerError } = await supabase
          .from('cleaner_profiles')
          .upsert(
            {
              user_id: user.id,
              bio: profile.bio?.trim() || null,
              coverage_area: coverageArea,
              hourly_rate,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );

        if (cleanerError) throw cleanerError;
      }

      await refreshUserSilent();

      Alert.alert(
        'Success',
        'Profile updated successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                resetToMainTabs();
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', userFacingSaveError(error) || 'Failed to save profile changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyPhone = async () => {
    const digits = (profile.phone || '').replace(/\D/g, '');
    if (digits.length !== 10) {
      Alert.alert('Invalid phone', 'Enter a valid 10-digit phone number before verification.');
      return;
    }
    try {
      const res = await authService.sendVerificationCode(digits);
      if (!res.success) {
        Alert.alert('Verification failed', res.error || 'Could not send verification code.');
        return;
      }
      (navigation as any).navigate('PhoneVerify', { phone: digits });
    } catch (e) {
      Alert.alert('Verification failed', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder?: string,
    keyboardType?: 'default' | 'email-address' | 'phone-pad',
    multiline?: boolean,
    helperText?: string,
    editable: boolean = true
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      {helperText ? <Text style={styles.inputHelper}>{helperText}</Text> : null}
      <TextInput
        style={[
          styles.input,
          multiline && styles.multilineInput,
          isCleaner && styles.inputCleaner,
          !editable && styles.inputDisabled,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        editable={editable}
      />
    </View>
  );

  const saveAccent = isCleaner ? PRO_ORANGE : '#26B7C9';

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={saveAccent} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              resetToMainTabs();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: saveAccent }]}
          onPress={saveProfile}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 24 + keyboardHeight + (Platform.OS === 'android' ? 16 : 0) },
          ]}
        >
          {isCleaner && (
            <View style={styles.strengthCard}>
              <View style={styles.strengthRow}>
                <Ionicons name="shield-checkmark" size={22} color={PRO_ORANGE} />
                <View style={styles.strengthTextCol}>
                  <Text style={styles.strengthTitle}>Profile for quotes &amp; your feed</Text>
                  <Text style={styles.strengthSub}>
                    Complete contact, service area, rate, and bio so you can take jobs and post video.
                  </Text>
                </View>
              </View>
              <View style={styles.meterTrack}>
                <View style={[styles.meterFill, { width: `${cleanerCompletion.pct}%` }]} />
              </View>
              <Text style={styles.strengthMeta}>
                {cleanerCompletion.done} of {cleanerCompletion.total} complete ({cleanerCompletion.pct}%)
              </Text>
            </View>
          )}

          <View style={[styles.cardSection, isCleaner && styles.cardSectionPro]}>
            <Text style={styles.cardSectionTitle}>
              {isCleaner ? 'Identity & contact' : 'Basic information'}
            </Text>
            {isCleaner && (
              <Text style={styles.cardSectionHint}>
                Shown to customers for booking and so we can reach you.
              </Text>
            )}

            {renderInput(
              isCleaner ? 'Full name *' : 'Full Name *',
              profile.name,
              (text) => setProfile((prev) => ({ ...prev, name: text })),
              'Enter your full name'
            )}

            {renderInput(
              isCleaner ? 'Email' : 'Email Address',
              profile.email,
              () => {},
              'Enter your email address',
              'email-address',
              false,
              'Email changes are managed in account security and cannot be edited here yet.',
              false
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone *</Text>
              <View style={styles.phoneRow}>
                <TextInput
                  style={[styles.input, styles.phoneInput, isCleaner && styles.inputCleaner]}
                  value={profile.phone}
                  onChangeText={(text) => setProfile((prev) => ({ ...prev, phone: text }))}
                  placeholder="Enter your phone number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                />
                <TouchableOpacity style={styles.verifyPhoneBtn} onPress={handleVerifyPhone}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={PRO_ORANGE} />
                  <Text style={styles.verifyPhoneText}>Verify</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {isCustomer && (
            <View style={styles.cardSection}>
              <Text style={styles.cardSectionTitle}>Emergency contact</Text>
              {renderInput(
                'Emergency Contact Name',
                profile.emergencyContactName || '',
                (text) => setProfile((prev) => ({ ...prev, emergencyContactName: text })),
                'Enter emergency contact name'
              )}

              {renderInput(
                'Emergency Contact Phone',
                profile.emergencyContactPhone || '',
                (text) => setProfile((prev) => ({ ...prev, emergencyContactPhone: text })),
                'Enter emergency contact phone',
                'phone-pad'
              )}

              {renderInput(
                'Special Preferences',
                profile.specialPreferences || '',
                (text) => setProfile((prev) => ({ ...prev, specialPreferences: text })),
                'Any special requests or preferences...',
                'default',
                true
              )}
            </View>
          )}

          {isCleaner && (
            <View style={[styles.cardSection, styles.cardSectionPro]}>
              <View style={styles.inputGroup}>
                <View style={styles.infoPillRow}>
                  <Text style={styles.inputLabel}>Service area *</Text>
                  <TouchableOpacity
                    style={[styles.infoPill, showCleanerTips && styles.infoPillActive]}
                    onPress={() => setShowCleanerTips((prev) => !prev)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="information-circle-outline"
                      size={14}
                      color={showCleanerTips ? '#B45309' : '#64748B'}
                    />
                    <Text style={[styles.infoPillText, showCleanerTips && styles.infoPillTextActive]}>
                      {showCleanerTips ? 'Hide tips' : 'Tips'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {showCleanerTips ? (
                  <Text style={styles.inputHelper}>
                    Select ZIP first, then choose the exact region you serve.
                  </Text>
                ) : null}
                <ZipRegionSelector
                  zip={selectedZip}
                  region={selectedRegion}
                  onChangeZip={(zip) => {
                    setSelectedZip(zip);
                    setSelectedRegion('');
                    setProfile((prev) => ({ ...prev, coverageArea: '' }));
                  }}
                  onChangeRegion={(region) => {
                    setSelectedRegion(region);
                    setProfile((prev) => ({ ...prev, coverageArea: formatCoverageArea(region, selectedZip) }));
                  }}
                  accentColor={PRO_ORANGE}
                />
              </View>

              {renderInput(
                'Hourly rate (USD) *',
                profile.hourlyRate || '',
                (text) => setProfile((prev) => ({ ...prev, hourlyRate: text.replace(/[^0-9.]/g, '') })),
                'e.g. 35',
                'phone-pad',
                false,
                showCleanerTips
                  ? 'A fair starting rate for quotes. You can refine per job when sending video quotes.'
                  : undefined
              )}

              {renderInput(
                'Bio *',
                profile.bio || '',
                (text) => setProfile((prev) => ({ ...prev, bio: text })),
                'Experience, specialties, and what makes you a great pro.',
                'default',
                true,
                showCleanerTips
                  ? 'At least 10 characters—helps customers and your feed trust you.'
                  : undefined
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: hp('1.5%'),
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
    width: 44,
    height: 44,
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
  saveButton: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    borderRadius: wp('5%'),
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
  },
  strengthCard: {
    marginHorizontal: wp('4%'),
    marginTop: hp('1%'),
    marginBottom: hp('0.5%'),
    backgroundColor: '#FFF9F0',
    borderRadius: wp('3.5%'),
    padding: wp('4%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 47, 0.35)',
  },
  strengthRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  strengthTextCol: { flex: 1 },
  strengthTitle: { fontSize: wp('3.8%'), fontWeight: '700', color: '#1F2937' },
  strengthSub: { fontSize: wp('3.1%'), color: '#6B7280', marginTop: 4, lineHeight: 18 },
  meterTrack: {
    marginTop: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 165, 47, 0.2)',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    backgroundColor: PRO_ORANGE,
    borderRadius: 3,
  },
  strengthMeta: { marginTop: 6, fontSize: wp('2.8%'), color: '#6B7280' },
  cardSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: wp('4%'),
    marginTop: hp('1.2%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('2.2%'),
    borderRadius: wp('3.5%'),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardSectionPro: {
    borderColor: 'rgba(255, 165, 47, 0.25)',
  },
  infoPillRow: {
    marginBottom: hp('0.4%'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  infoPillActive: {
    borderColor: 'rgba(255,165,47,0.45)',
    backgroundColor: '#FFF7ED',
  },
  infoPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  infoPillTextActive: {
    color: '#B45309',
  },
  cardSectionTitle: {
    fontSize: wp('4%'),
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cardSectionHint: {
    fontSize: wp('3.1%'),
    color: '#6B7280',
    marginBottom: hp('1.2%'),
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: hp('2%'),
  },
  inputLabel: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  inputHelper: {
    fontSize: wp('2.9%'),
    color: '#9CA3AF',
    marginBottom: 6,
    lineHeight: 17,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: wp('2.5%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.3%'),
    fontSize: wp('4%'),
    color: '#1F2937',
    backgroundColor: '#FAFAFA',
  },
  inputCleaner: {
    borderColor: 'rgba(255, 165, 47, 0.35)',
  },
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#6B7280',
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phoneInput: { flex: 1 },
  verifyPhoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 47, 0.45)',
    backgroundColor: '#FFF9F0',
  },
  verifyPhoneText: { fontSize: 12, fontWeight: '700', color: '#B45309' },
});

export default EditProfileScreen;
