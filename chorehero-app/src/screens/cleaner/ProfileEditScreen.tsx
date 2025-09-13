import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Image,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../../components/Toast';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';

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
}

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
  const { user } = useAuth();
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
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasBookingTemplate, setHasBookingTemplate] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // In a real app, this would fetch from the database
      // For now, we'll use mock data or user data
      const mockProfile: CleanerProfile = {
        name: user?.name || 'Sarah Johnson',
        email: user?.email || 'sarah.johnson@email.com',
        phone: '+1 (555) 123-4567',
        bio: 'Professional cleaner with 5+ years of experience. I take pride in providing thorough, reliable cleaning services for busy families and professionals.',
        avatar_url: user?.avatar_url || 'https://images.unsplash.com/photo-1494790108755-2616b612b47c?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80',
        hourly_rate: 35,
        years_experience: 5,
        specialties: ['Deep Cleaning', 'Kitchen Specialist', 'Organization'],
        available_services: ['Standard Clean', 'Deep Clean', 'Kitchen Deep Clean'],
        coverage_area: 'San Francisco Bay Area',
        is_available: true,
        instant_booking: true,
        background_checked: true,
        verified: true,
      };

      setProfile(mockProfile);

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
      // In a real app, this would save to the database
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      try { (showToast as any) && showToast({ type: 'success', message: 'Profile updated' }); } catch {}
      navigation.goBack();
    } catch (error) {
      console.error('Error saving profile:', error);
      try { (showToast as any) && showToast({ type: 'error', message: 'Failed to save profile' }); } catch {}
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9F9F9" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3ad3db" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9F9F9" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#3ad3db" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Profile Picture */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Picture</Text>
          <TouchableOpacity style={styles.avatarContainer} onPress={handleImagePicker}>
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
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
            <TextInput
              style={styles.textInput}
              value={profile.phone}
              onChangeText={(text) => setProfile(prev => ({ ...prev, phone: text }))}
              placeholder="Phone number"
              keyboardType="phone-pad"
            />
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
            <Text style={styles.inputLabel}>Coverage Area</Text>
            <TextInput
              style={styles.textInput}
              value={profile.coverage_area}
              onChangeText={(text) => setProfile(prev => ({ ...prev, coverage_area: text }))}
              placeholder="Areas you serve"
            />
          </View>
        </View>

        {/* Specialties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specialties</Text>
          <Text style={styles.sectionDescription}>Select your areas of expertise</Text>
          
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
        </View>

        {/* Available Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Services</Text>
          <Text style={styles.sectionDescription}>Services you offer to customers</Text>
          
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
        </View>

        {/* Booking Template */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Booking Template</Text>
          <Text style={styles.sectionDescription}>Customize the booking steps, fields, and add-ons customers see when booking you.</Text>
          <TouchableOpacity
            style={styles.templateButton}
            onPress={() => navigation.navigate('BookingTemplate' as never)}
          >
            <Ionicons name="construct-outline" size={18} color="#3ad3db" />
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
              trackColor={{ false: '#E5E7EB', true: '#3ad3db' }}
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
              trackColor={{ false: '#E5E7EB', true: '#3ad3db' }}
              thumbColor={profile.instant_booking ? '#FFFFFF' : '#FFFFFF'}
            />
          </View>

          {/* Verification Status */}
          <View style={styles.verificationSection}>
            <Text style={styles.sectionTitle}>Verification Status</Text>
            
            <View style={styles.verificationItem}>
              <Ionicons 
                name={profile.background_checked ? "checkmark-circle" : "alert-circle-outline"} 
                size={20} 
                color={profile.background_checked ? "#10B981" : "#F59E0B"} 
              />
              <Text style={styles.verificationText}>Background Check</Text>
              {profile.background_checked && (
                <Text style={styles.verifiedBadge}>Verified</Text>
              )}
            </View>

            <View style={styles.verificationItem}>
              <Ionicons 
                name={profile.verified ? "checkmark-circle" : "alert-circle-outline"} 
                size={20} 
                color={profile.verified ? "#10B981" : "#F59E0B"} 
              />
              <Text style={styles.verificationText}>Identity Verified</Text>
              {profile.verified && (
                <Text style={styles.verifiedBadge}>Verified</Text>
              )}
            </View>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  saveButton: {
    padding: 8,
    marginRight: -8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3ad3db',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
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
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3ad3db',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
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
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    margin: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionChipSelected: {
    backgroundColor: '#3ad3db',
    borderColor: '#3ad3db',
  },
  optionChipText: {
    fontSize: 14,
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
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  verificationSection: {
    marginTop: 24,
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  verificationText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  verifiedBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bottomSpacing: {
    height: 40,
  },
  templateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  templateButtonText: {
    color: '#3ad3db',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CleanerProfileEditScreen;