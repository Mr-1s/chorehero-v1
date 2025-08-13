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
import { demoAuth } from '../../services/demoAuth';

type StackParamList = {
  CustomerOnboarding: undefined;
  MainTabs: undefined;
};

type CustomerOnboardingNavigationProp = StackNavigationProp<StackParamList, 'CustomerOnboarding'>;

interface CustomerOnboardingProps {
  navigation: CustomerOnboardingNavigationProp;
}

interface OnboardingData {
  // Step 1: Basic Info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profilePhoto: string;
  
  // Step 2: Home Details
  address: string;
  city: string;
  state: string;
  zipCode: string;
  propertyType: 'apartment' | 'house' | 'condo' | 'other';
  squareFootage: string;
  bedrooms: string;
  bathrooms: string;
  
  // Step 3: Household Info
  hasPets: boolean;
  petDetails: string;
  hasAllergies: boolean;
  allergyDetails: string;
  hasChildren: boolean;
  specialInstructions: string;
  
  // Step 4: Preferences
  preferredProducts: 'standard' | 'eco-friendly' | 'bring-own';
  budgetRange: 'budget' | 'standard' | 'premium';
  cleaningFrequency: 'one-time' | 'weekly' | 'bi-weekly' | 'monthly';
  preferredTimes: string[];
  
  // Step 5: Emergency & Payment
  emergencyName: string;
  emergencyPhone: string;
  paymentMethod: string;
}

const CustomerOnboardingScreen: React.FC<CustomerOnboardingProps> = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [bypassMode, setBypassMode] = useState(false);
  const totalSteps = 5;
  const { refreshSession, isDemoMode, authUser } = useAuth();

  const [data, setData] = useState<OnboardingData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    profilePhoto: 'https://randomuser.me/api/portraits/lego/2.jpg',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    propertyType: 'apartment',
    squareFootage: '',
    bedrooms: '',
    bathrooms: '',
    hasPets: false,
    petDetails: '',
    hasAllergies: false,
    allergyDetails: '',
    hasChildren: false,
    specialInstructions: '',
    preferredProducts: 'standard',
    budgetRange: 'standard',
    cleaningFrequency: 'bi-weekly',
    preferredTimes: [],
    emergencyName: '',
    emergencyPhone: '',
    paymentMethod: '',
  });

  // scrolling helpers
  const scrollRef = useRef<ScrollView>(null);

  // Prefill from authenticated provider (Google/Apple)
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

  const updateData = (field: keyof OnboardingData, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): string | null => {
    switch (step) {
      case 1:
        if (!data.firstName || !data.lastName || !data.email || !data.phone) {
          return 'Please fill in all required fields';
        }
        if (!data.email.includes('@')) {
          return 'Please enter a valid email address';
        }
        break;
      case 2:
        if (!data.address || !data.city || !data.state || !data.zipCode) {
          return 'Please fill in all address fields';
        }
        break;
      case 5:
        if (!data.emergencyName || !data.emergencyPhone) {
          return 'Emergency contact information is required for safety';
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
      
      console.log('Customer onboarding completion - resolved user:', userId, userEmail);
      
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
              role: 'customer',
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
              role: 'customer',
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);

          if (userError) {
            console.error('Error updating user profile:', userError);
            throw new Error('Failed to update user record: ' + userError.message);
          }
        }

        // Create customer profile with available fields
        const { error: customerError } = await supabase
          .from('customer_profiles')
          .insert([{
            user_id: userId,
            preferred_language: 'en',
            special_preferences: `${data.specialInstructions || ''}\n\nProperty: ${data.propertyType}, ${data.squareFootage} sq ft\nBedrooms: ${data.bedrooms}, Bathrooms: ${data.bathrooms}\nCleaning Frequency: ${data.cleaningFrequency}\nPreferred Products: ${data.preferredProducts}\nBudget: ${data.budgetRange}\nPets: ${data.hasPets ? 'Yes - ' + data.petDetails : 'No'}\nAllergies: ${data.hasAllergies ? 'Yes - ' + data.allergyDetails : 'No'}\nChildren: ${data.hasChildren ? 'Yes' : 'No'}`,
          }]);

        // Also create an address record
        if (!customerError) {
          const { error: addressError } = await supabase
            .from('addresses')
            .insert([{
              user_id: userId,
              street: data.address,
              city: data.city,
              state: data.state,
              zip_code: data.zipCode,
              is_default: true,
              nickname: 'Home',
            }]);

          if (addressError) {
            console.error('Error creating address:', addressError);
          }
        }

        if (customerError) {
          console.error('Error creating customer profile:', customerError);
          throw new Error('Failed to create customer profile: ' + customerError.message);
        }

        // Clear any existing demo sessions for real authenticated users
        await demoAuth.clearDemoUser();
        console.log('Cleared all demo sessions for real authenticated user');

        Alert.alert(
          'Welcome to ChoreHero!',
          'Your account has been created successfully. You can now start booking cleaning services.',
          [
            {
              text: 'Start Exploring',
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
        // No auth user: show an error instead of switching to demo
        Alert.alert('Authentication required', 'Please sign in again to complete setup.');
      }
    } catch (error) {
      console.error('Onboarding completion error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete setup. Please try again.';
      Alert.alert('Setup Error', errorMessage);
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
      {isDemoMode && (
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
    <ScrollView ref={scrollRef} style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Let's get to know you</Text>
      <Text style={styles.stepSubtitle}>Basic information to set up your account</Text>

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
            placeholder="John"
          />
        </View>
        <View style={styles.inputHalf}>
          <Text style={styles.inputLabel}>Last Name *</Text>
          <TextInput
            style={styles.textInput}
            value={data.lastName}
            onChangeText={(text) => updateData('lastName', text)}
            placeholder="Doe"
          />
        </View>
      </View>

      <Text style={styles.inputLabel}>Email Address *</Text>
      <TextInput
        style={styles.textInput}
        value={data.email}
        onChangeText={(text) => updateData('email', text)}
        placeholder="john.doe@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.inputLabel}>Phone Number *</Text>
      <TextInput
        style={styles.textInput}
        value={data.phone}
        onChangeText={(text) => updateData('phone', text)}
        placeholder="+1 (555) 123-4567"
        keyboardType="phone-pad"
      />
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView ref={scrollRef} style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Tell us about your home</Text>
      <Text style={styles.stepSubtitle}>This helps us match you with the right cleaners</Text>

      <Text style={styles.inputLabel}>Street Address *</Text>
      <TextInput
        style={styles.textInput}
        value={data.address}
        onChangeText={(text) => updateData('address', text)}
        placeholder="123 Main Street"
      />

      <View style={styles.inputRow}>
        <View style={styles.inputHalf}>
          <Text style={styles.inputLabel}>City *</Text>
          <TextInput
            style={styles.textInput}
            value={data.city}
            onChangeText={(text) => updateData('city', text)}
            placeholder="San Francisco"
          />
        </View>
        <View style={styles.inputQuarter}>
          <Text style={styles.inputLabel}>State *</Text>
          <TextInput
            style={styles.textInput}
            value={data.state}
            onChangeText={(text) => updateData('state', text)}
            placeholder="CA"
            maxLength={2}
          />
        </View>
        <View style={styles.inputQuarter}>
          <Text style={styles.inputLabel}>ZIP *</Text>
          <TextInput
            style={styles.textInput}
            value={data.zipCode}
            onChangeText={(text) => updateData('zipCode', text)}
            placeholder="94102"
            keyboardType="numeric"
          />
        </View>
      </View>

      <Text style={styles.inputLabel}>Property Type</Text>
      <View style={styles.optionRow}>
        {['apartment', 'house', 'condo', 'other'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.optionButton,
              data.propertyType === type && styles.selectedOption
            ]}
            onPress={() => updateData('propertyType', type)}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.optionText,
                data.propertyType === type && styles.selectedOptionText
              ]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.inputRow}>
        <View style={styles.inputThird}>
          <Text style={styles.inputLabel}>Sq Ft (approx)</Text>
          <TextInput
            style={styles.textInput}
            value={data.squareFootage}
            onChangeText={(text) => updateData('squareFootage', text)}
            placeholder="1200"
            keyboardType="numeric"
          />
        </View>
        <View style={styles.inputThird}>
          <Text style={styles.inputLabel}>Bedrooms</Text>
          <TextInput
            style={styles.textInput}
            value={data.bedrooms}
            onChangeText={(text) => updateData('bedrooms', text)}
            placeholder="2"
            keyboardType="numeric"
          />
        </View>
        <View style={styles.inputThird}>
          <Text style={styles.inputLabel}>Bathrooms</Text>
          <TextInput
            style={styles.textInput}
            value={data.bathrooms}
            onChangeText={(text) => updateData('bathrooms', text)}
            placeholder="1.5"
            keyboardType="numeric"
          />
        </View>
      </View>
    </ScrollView>
  );

  const renderStep3 = () => (
    <ScrollView ref={scrollRef} style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Household details</Text>
      <Text style={styles.stepSubtitle}>Important for cleaner safety and service quality</Text>

      <View style={styles.switchRow}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>Do you have pets?</Text>
          <Text style={styles.switchDescription}>Dogs, cats, or other animals</Text>
        </View>
        <Switch
          value={data.hasPets}
          onValueChange={(value) => updateData('hasPets', value)}
          trackColor={{ false: '#D1D5DB', true: '#3ad3db' }}
          thumbColor={data.hasPets ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      {data.hasPets && (
        <>
          <Text style={styles.inputLabel}>Pet Details</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={data.petDetails}
            onChangeText={(text) => updateData('petDetails', text)}
            placeholder="e.g., 2 friendly dogs, 1 cat that hides..."
            multiline
            numberOfLines={3}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 300, animated: true }), 150)}
          />
        </>
      )}

      <View style={styles.switchRow}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>Any allergies or sensitivities?</Text>
          <Text style={styles.switchDescription}>Chemical sensitivities, respiratory issues</Text>
        </View>
        <Switch
          value={data.hasAllergies}
          onValueChange={(value) => updateData('hasAllergies', value)}
          trackColor={{ false: '#D1D5DB', true: '#3ad3db' }}
          thumbColor={data.hasAllergies ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      {data.hasAllergies && (
        <>
          <Text style={styles.inputLabel}>Allergy Details</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={data.allergyDetails}
            onChangeText={(text) => updateData('allergyDetails', text)}
            placeholder="e.g., asthma, chemical sensitivities..."
            multiline
            numberOfLines={3}
          />
        </>
      )}

      <View style={styles.switchRow}>
        <View style={styles.switchInfo}>
          <Text style={styles.switchLabel}>Children in the home?</Text>
          <Text style={styles.switchDescription}>Affects product choice and safety</Text>
        </View>
        <Switch
          value={data.hasChildren}
          onValueChange={(value) => updateData('hasChildren', value)}
          trackColor={{ false: '#D1D5DB', true: '#3ad3db' }}
          thumbColor={data.hasChildren ? '#ffffff' : '#f4f3f4'}
        />
      </View>

      <Text style={styles.inputLabel}>Special Instructions</Text>
      <TextInput
        style={[styles.textInput, styles.textArea]}
        value={data.specialInstructions}
        onChangeText={(text) => updateData('specialInstructions', text)}
        placeholder="Anything else cleaners should know? (parking, building access, fragile items, etc.)"
        multiline
        numberOfLines={4}
        onFocus={() => setTimeout(() => scrollRef.current?.scrollTo({ y: 400, animated: true }), 150)}
      />
    </ScrollView>
  );

  const renderStep4 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Your preferences</Text>
      <Text style={styles.stepSubtitle}>Help us find the perfect cleaner for you</Text>

      <Text style={styles.sectionTitle}>Cleaning Products</Text>
      <View style={styles.optionColumn}>
        {[
          { key: 'standard', label: 'Standard Products', desc: 'Regular cleaning products' },
          { key: 'eco-friendly', label: 'Eco-Friendly Only', desc: 'Green and natural products' },
          { key: 'bring-own', label: 'I\'ll Provide Products', desc: 'Use my own supplies' }
        ].map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.choiceCard,
              data.preferredProducts === option.key && styles.selectedCard
            ]}
            onPress={() => updateData('preferredProducts', option.key)}
          >
            <Text style={[
              styles.choiceLabel,
              data.preferredProducts === option.key && styles.selectedCardText
            ]}>
              {option.label}
            </Text>
            <Text style={[
              styles.choiceDescription,
              data.preferredProducts === option.key && styles.selectedCardText
            ]}>
              {option.desc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Budget Range</Text>
      <View style={styles.optionRow}>
        {[
          { key: 'budget', label: 'Budget', desc: '$25-40/hr' },
          { key: 'standard', label: 'Standard', desc: '$40-60/hr' },
          { key: 'premium', label: 'Premium', desc: '$60+/hr' }
        ].map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.budgetCard,
              data.budgetRange === option.key && styles.selectedCard
            ]}
            onPress={() => updateData('budgetRange', option.key)}
          >
            <Text style={[
              styles.choiceLabel,
              data.budgetRange === option.key && styles.selectedCardText
            ]}>
              {option.label}
            </Text>
            <Text style={[
              styles.choiceDescription,
              data.budgetRange === option.key && styles.selectedCardText
            ]}>
              {option.desc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Cleaning Frequency</Text>
      <View style={styles.optionRow}>
        {[
          { key: 'one-time', label: 'One-time' },
          { key: 'weekly', label: 'Weekly' },
          { key: 'bi-weekly', label: 'Bi-weekly' },
          { key: 'monthly', label: 'Monthly' }
        ].map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.optionButton,
              data.cleaningFrequency === option.key && styles.selectedOption
            ]}
            onPress={() => updateData('cleaningFrequency', option.key)}
          >
            <Text style={[
              styles.optionText,
              data.cleaningFrequency === option.key && styles.selectedOptionText
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderStep5 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Safety & Payment</Text>
      <Text style={styles.stepSubtitle}>Final steps to secure your account</Text>

      <View style={styles.safetySection}>
        <Ionicons name="shield-checkmark" size={24} color="#3ad3db" />
        <Text style={styles.safetyTitle}>Emergency Contact</Text>
        <Text style={styles.safetyDescription}>
          Required for your safety. This person will be contacted in case of emergency.
        </Text>
      </View>

      <Text style={styles.inputLabel}>Emergency Contact Name *</Text>
      <TextInput
        style={styles.textInput}
        value={data.emergencyName}
        onChangeText={(text) => updateData('emergencyName', text)}
        placeholder="Jane Doe"
      />

      <Text style={styles.inputLabel}>Emergency Contact Phone *</Text>
      <TextInput
        style={styles.textInput}
        value={data.emergencyPhone}
        onChangeText={(text) => updateData('emergencyPhone', text)}
        placeholder="+1 (555) 987-6543"
        keyboardType="phone-pad"
      />

      <View style={styles.paymentSection}>
        <Ionicons name="card" size={24} color="#3ad3db" />
        <Text style={styles.safetyTitle}>Payment Method</Text>
        <Text style={styles.safetyDescription}>
          You'll be able to add payment methods after account creation.
        </Text>
      </View>

      <View style={styles.agreementSection}>
        <Text style={styles.agreementText}>
          By creating an account, you agree to our{' '}
          <Text style={styles.linkText}>Terms of Service</Text>
          {' '}and{' '}
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
        <Text style={styles.headerTitle}>Create Account</Text>
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
                {isLoading ? 'Creating Account...' : currentStep === totalSteps ? 'Complete Setup' : 'Continue'}
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
  },
  inputHalf: {
    flex: 1,
  },
  inputThird: {
    flex: 1,
  },
  inputQuarter: {
    flex: 0.5,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  optionColumn: {
    gap: 12,
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
  selectedOption: {
    borderColor: '#3ad3db',
    backgroundColor: '#F0FDFA',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 24,
    marginBottom: 12,
  },
  choiceCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  selectedCard: {
    borderColor: '#3ad3db',
    backgroundColor: '#F0FDFA',
  },
  choiceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  choiceDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  selectedCardText: {
    color: '#3ad3db',
  },
  budgetCard: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  safetySection: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    marginBottom: 24,
  },
  safetyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 8,
  },
  safetyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  paymentSection: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FEF3F2',
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 24,
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

export default CustomerOnboardingScreen; 