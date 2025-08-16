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
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';

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
  username?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  specialPreferences?: string;
}

const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    email: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    specialPreferences: '',
  });

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      if (!user?.id) return;

      // Get user basic info
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('name, email, phone, username')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      // Get customer profile if customer
      let customerData = null;
      if (user.role === 'customer') {
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

      setProfile({
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        username: (userData as any)?.username || '',
        emergencyContactName: customerData?.emergency_contact_name || '',
        emergencyContactPhone: customerData?.emergency_contact_phone || '',
        specialPreferences: customerData?.special_preferences || '',
      });
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

      // Update users table
      const { error: userError } = await supabase
        .from('users')
        .update({
          name: profile.name.trim(),
          email: profile.email.trim() || null,
          phone: profile.phone.trim(),
          username: profile.username?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (userError) throw userError;

      // Update customer profile if customer
      if (user.role === 'customer') {
        const { error: customerError } = await supabase
          .from('customer_profiles')
          .upsert({
            user_id: user.id,
            emergency_contact_name: profile.emergencyContactName?.trim() || null,
            emergency_contact_phone: profile.emergencyContactPhone?.trim() || null,
            special_preferences: profile.specialPreferences?.trim() || null,
            updated_at: new Date().toISOString(),
          });

        if (customerError) throw customerError;
      }

      Alert.alert(
        'Success',
        'Profile updated successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile changes');
    } finally {
      setIsSaving(false);
    }
  };

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder?: string,
    keyboardType?: 'default' | 'email-address' | 'phone-pad',
    multiline?: boolean
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
      />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3ad3db" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
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
          onPress={saveProfile}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#3ad3db" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Basic Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          {renderInput(
            'Full Name *',
            profile.name,
            (text) => setProfile(prev => ({ ...prev, name: text })),
            'Enter your full name'
          )}

          {renderInput(
            'Email Address',
            profile.email,
            (text) => setProfile(prev => ({ ...prev, email: text })),
            'Enter your email address',
            'email-address'
          )}

          {renderInput(
            'Phone Number *',
            profile.phone,
            (text) => setProfile(prev => ({ ...prev, phone: text })),
            'Enter your phone number',
            'phone-pad'
          )}
        </View>

        {/* Customer-specific fields */}
        {user?.role === 'customer' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Emergency Contact</Text>
            
            {renderInput(
              'Emergency Contact Name',
              profile.emergencyContactName || '',
              (text) => setProfile(prev => ({ ...prev, emergencyContactName: text })),
              'Enter emergency contact name'
            )}

            {renderInput(
              'Emergency Contact Phone',
              profile.emergencyContactPhone || '',
              (text) => setProfile(prev => ({ ...prev, emergencyContactPhone: text })),
              'Enter emergency contact phone',
              'phone-pad'
            )}

            {renderInput(
              'Special Preferences',
              profile.specialPreferences || '',
              (text) => setProfile(prev => ({ ...prev, specialPreferences: text })),
              'Any special requests or preferences...',
              'default',
              true
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#3ad3db',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
});

export default EditProfileScreen;