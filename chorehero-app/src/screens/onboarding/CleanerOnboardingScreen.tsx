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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';

import { supabase } from '../../services/supabase';

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
  const totalSteps = 6;
  const { refreshSession, authUser } = useAuth();

  const [data, setData] = useState<CleanerOnboardingData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    profilePhoto: 'https://randomuser.me/api/portraits/lego/3.jpg',
    dateOfBirth: '',
    yearsExperience: '',
    previousEmployer: '',
    references: '',
    hasInsurance: false,
    insuranceProvider: '',
    hasTransportation: true,
    transportationDetails: '',
    serviceRadius: '',
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
    hasWorkAuthorization: false,
    socialSecurityNumber: '',
    driversLicense: '',
    emergencyContact: '',
    emergencyPhone: '',
    backgroundCheckConsent: false,
  });

  const scrollRef = useRef<ScrollView>(null);

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
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
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
        const { data: { session } } = await supabase.auth.getSession();
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
        const { data: { session: session2 } } = await supabase.auth.getSession();
        if (session2?.user) {
          userId = session2.user.id;
          userEmail = session2.user.email || undefined;
        }
      }
      
      console.log('Cleaner onboarding completion - resolved user:', userId, userEmail);
      
      if (userId) {
        // First, ensure user record exists in our database
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('id', userId)
          .single();

        if (checkError && checkError.code === 'PGRST116') {
          // User doesn't exist, create the record
          console.log('User record not found, creating...');
          const { error: createUserError } = await supabase
            .from('users')
            .insert([{
              id: userId,
              phone: data.phone,
              email: userEmail,
              name: `${data.firstName} ${data.lastName}`,
              role: 'cleaner',
            }]);
          
          if (createUserError) {
            console.error('Error creating user record:', createUserError);
            throw new Error('Failed to create user record: ' + createUserError.message);
          }
        } else if (checkError) {
          console.error('Error checking user existence:', checkError);
          throw new Error('Database error: ' + checkError.message);
        } else {
          // User exists, update it
          const { error: userError } = await supabase
            .from('users')
            .update({
              name: `${data.firstName} ${data.lastName}`,
              phone: data.phone,
              role: 'cleaner',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);

          if (userError) {
            console.error('Error updating user profile:', userError);
            throw new Error('Failed to update user record: ' + userError.message);
          }
        }

        // Create cleaner profile with available fields
        const { error: cleanerError } = await supabase
          .from('cleaner_profiles')
          .insert([{
            user_id: userId,
            hourly_rate: parseFloat(data.hourlyRate) || 25.00,
            bio: `${data.bio || ''}\n\nExperience: ${data.experienceYears} years\nServices: ${data.serviceTypes?.join(', ') || 'Standard cleaning'}\nTransportation: ${data.transportation}\nAvailability: ${Object.entries(data.availability || {}).filter(([day, available]) => available).map(([day]) => day).join(', ')}\nService Radius: ${data.serviceRadius} miles\n\nSkills:\n- Cleaning Knowledge: ${data.cleaningKnowledge}/5\n- Customer Service: ${data.customerService}/5\n- Time Management: ${data.timeManagement}/5\n\nWork Samples: ${data.workSamples || 'None provided'}\n\nAuthorized to work: ${data.hasWorkAuthorization ? 'Yes' : 'No'}\nEmergency Contact: ${data.emergencyContact} (${data.emergencyPhone})\nBackground Check Consent: ${data.backgroundCheckConsent ? 'Yes' : 'No'}`,
            years_experience: parseInt(data.experienceYears) || 0,
            specialties: data.serviceTypes || ['standard_cleaning'],
            service_radius_km: Math.round((parseInt(data.serviceRadius) || 10) * 1.60934), // Convert miles to km
            verification_status: 'pending',
            is_available: false, // Will be activated after verification
          }]);

        // Also create an address record for the cleaner
        if (!cleanerError) {
          const { error: addressError } = await supabase
            .from('addresses')
            .insert([{
              user_id: userId,
              street: data.address,
              city: data.city,
              state: data.state,
              zip_code: data.zipCode,
              is_default: true,
              nickname: 'Service Address',
            }]);

          if (addressError) {
            console.error('Error creating cleaner address:', addressError);
          }
        }

        if (cleanerError) {
          console.error('Error creating cleaner profile:', cleanerError);
          throw new Error('Failed to create cleaner profile: ' + cleanerError.message);
        }



        console.log('Cleaner onboarding completed successfully for real user');
        Alert.alert(
          'Application Submitted!',
          'Your cleaner application has been submitted. We\'ll review your information and run a background check. You\'ll hear from us within 24-48 hours.',
          [
            {
              text: 'Got it',
              onPress: async () => {
                try {
                  await refreshSession();
                  navigation.navigate('MainTabs');
                } catch (error) {
                  console.error('Error refreshing session:', error);
                  navigation.navigate('MainTabs');
                }
              }
            }
          ]
        );
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
            trackColor={{ false: '#767577', true: '#3ad3db' }}
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
          trackColor={{ false: '#D1D5DB', true: '#3ad3db' }}
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
          trackColor={{ false: '#D1D5DB', true: '#3ad3db' }}
          thumbColor={data.hasTransportation ? '#ffffff' : '#f4f3f4'}
        />
      </View>
    </ScrollView>
  );

  const renderStep3 = () => (
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
        {['5 miles', '10 miles', '15 miles', '20+ miles'].map((option) => (
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
          trackColor={{ false: '#D1D5DB', true: '#3ad3db' }}
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
          trackColor={{ false: '#D1D5DB', true: '#3ad3db' }}
          thumbColor={data.providesSupplies ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      <Text style={styles.inputLabel}>Hourly Rate ($)</Text>
      <View style={styles.inputRow}>
        <View style={styles.inputHalf}>
          <TextInput
            style={styles.textInput}
            value={data.hourlyRate}
            onChangeText={(text) => updateData('hourlyRate', text)}
            placeholder="45"
            keyboardType="numeric"
          />
        </View>
        <View style={styles.rateHelper}>
          <Text style={styles.rateHelperText}>Local average: $35-65/hr</Text>
        </View>
      </View>

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
    const renderSkillRating = (skill: string, value: number, field: keyof CleanerOnboardingData) => (
      <View style={styles.skillContainer}>
        <Text style={styles.skillLabel}>{skill}</Text>
        <View style={styles.starsContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => updateData(field, star)}
            >
              <Ionicons
                name={star <= value ? 'star' : 'star-outline'}
                size={32}
                color={star <= value ? '#FFD700' : '#D1D5DB'}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );

    return (
      <ScrollView
        ref={scrollRef}
        style={styles.stepContainer}
        contentContainerStyle={{ paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Skills Assessment</Text>
        <Text style={styles.stepSubtitle}>Rate your abilities (optional but recommended)</Text>

        {renderSkillRating('Cleaning Knowledge', data.cleaningKnowledge, 'cleaningKnowledge')}
        {renderSkillRating('Customer Service', data.customerService, 'customerService')}
        {renderSkillRating('Time Management', data.timeManagement, 'timeManagement')}

        <Text style={styles.inputLabel}>Work Samples/Portfolio</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          value={data.workSamples}
          onChangeText={(text) => updateData('workSamples', text)}
          placeholder="Describe your best work or provide links to photos of completed jobs..."
          multiline
          numberOfLines={4}
          onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 350, animated: true }), 150)}
        />

        <View style={styles.portfolioSection}>
          <Text style={styles.inputLabel}>Add Photos (Coming Soon)</Text>
          <TouchableOpacity style={styles.photoUploadButton}>
            <Ionicons name="camera" size={24} color="#3ad3db" />
            <Text style={styles.photoUploadText}>Upload Before/After Photos</Text>
          </TouchableOpacity>
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
        <Ionicons name="shield-checkmark" size={24} color="#3ad3db" />
        <Text style={styles.verificationTitle}>Background Check Required</Text>
        <Text style={styles.verificationDescription}>
          All cleaners must pass a background check for customer safety and trust.
        </Text>
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>I am authorized to work in the US *</Text>
          <Text style={styles.switchDescription}>Required for all contractors</Text>
        </View>
        <Switch
          value={data.hasWorkAuthorization}
          onValueChange={(value) => updateData('hasWorkAuthorization', value)}
          trackColor={{ false: '#D1D5DB', true: '#3ad3db' }}
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
          <Text style={styles.switchLabel}>I consent to a background check *</Text>
          <Text style={styles.switchDescription}>Required to join ChoreHero</Text>
        </View>
        <Switch
          value={data.backgroundCheckConsent}
          onValueChange={(value) => updateData('backgroundCheckConsent', value)}
          trackColor={{ false: '#D1D5DB', true: '#3ad3db' }}
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
        {currentStep > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
        )}
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
              colors={isLoading ? ['#9CA3AF', '#6B7280'] : ['#3ad3db', '#2BC8D4']}
              style={styles.continueButtonGradient}
            >
              <Text style={styles.continueButtonText}>
                {isLoading ? 'Submitting Application...' : currentStep === totalSteps ? 'Submit Application' : 'Continue'}
              </Text>
              {!isLoading && currentStep < totalSteps && (
                <Ionicons name="arrow-forward" size={20} color="#ffffff" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    fontWeight: '700',
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
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3ad3db',
    borderRadius: 2,
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
    fontWeight: '700',
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
    backgroundColor: '#3ad3db',
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
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
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
    borderColor: '#3ad3db',
    backgroundColor: '#F0FDFA',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  selectedOptionText: {
    color: '#3ad3db',
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
    borderColor: '#3ad3db',
    borderStyle: 'dashed',
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
    gap: 12,
  },
  photoUploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3ad3db',
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
    color: '#3ad3db',
    fontWeight: '600',
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