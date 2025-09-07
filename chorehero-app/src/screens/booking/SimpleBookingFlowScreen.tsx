import React, { useState, useEffect, useRef } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { notificationService } from '../../services/notificationService';

import { bookingStateManager } from '../../services/bookingStateManager';
import { bookingService } from '../../services/booking';
import { useAuth } from '../../hooks/useAuth';
import { bookingDataPopulationService } from '../../services/bookingDataPopulationService';

type StackParamList = {
  SimpleBookingFlow: {
    cleanerId?: string;
    serviceType?: string;
    serviceId?: string;
    serviceName?: string;
    basePrice?: number;
    duration?: number;
  };
  BookingConfirmation: {
    bookingId: string;
    service?: any;
    cleaner?: any;
    address?: string;
    scheduledTime?: string;
  };
  MainTabs: undefined;
};

type SimpleBookingFlowNavigationProp = StackNavigationProp<StackParamList, 'SimpleBookingFlow'>;

interface SimpleBookingFlowProps {
  navigation: SimpleBookingFlowNavigationProp;
  route: {
    params?: {
      cleanerId?: string;
      serviceType?: string;
      serviceId?: string;
      serviceName?: string;
      basePrice?: number;
      duration?: number;
    };
  };
}

interface BookingData {
  // Step 1: Service Details
  serviceType: string;
  cleaningType: 'regular' | 'deep' | 'move-out' | 'post-construction';
  estimatedDuration: string;
  rooms: string[];
  specialRequests: string;
  
  // Step 2: Date & Time
  selectedDate: string;
  selectedTime: string;
  isRecurring: boolean;
  recurringFrequency: string;
  
  // Step 3: Address & Access
  address: string;
  apartmentNumber: string;
  accessInstructions: string;
  parkingInfo: string;
  
  // Step 4: Contact & Preferences
  contactName: string;
  contactPhone: string;
  cleanerGender: string;
  productPreference: 'standard' | 'eco-friendly' | 'customer-provided';
  petInfo: string;
  
  // Step 5: Pricing & Payment
  selectedCleaner: string;
  estimatedCost: number;
  paymentMethod: string;
}

const SimpleBookingFlowScreen: React.FC<SimpleBookingFlowProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [bypassMode, setBypassMode] = useState(false);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const totalSteps = 5;

  const cleanerId = route.params?.cleanerId || '';

  const [data, setData] = useState<BookingData>({
    serviceType: route.params?.serviceType || route.params?.serviceName || '',
    cleaningType: 'regular',
    estimatedDuration: '',
    rooms: [],
    specialRequests: '',
    selectedDate: '',
    selectedTime: '',
    isRecurring: false,
    recurringFrequency: '',
    address: '',
    apartmentNumber: '',
    accessInstructions: '',
    parkingInfo: '',
    contactName: '',
    contactPhone: '',
    cleanerGender: 'no preference',
    productPreference: 'standard',
    petInfo: '',
    selectedCleaner: route.params?.cleanerId || '',
    estimatedCost: 0,
    paymentMethod: '',
  });

  // Move useRef to component level to avoid hooks order issues
  const scrollViewRef = useRef<ScrollView>(null);

  // Load saved booking progress on component mount
  useEffect(() => {
    const loadBookingProgress = async () => {
      if (!cleanerId) {
        setIsLoadingProgress(false);
        return;
      }

      try {
        const savedProgress = await bookingStateManager.getBookingProgress(cleanerId);
        
        if (savedProgress) {
          console.log(`🔄 Restoring booking progress for cleaner ${cleanerId} at step ${savedProgress.currentStep}`);
          
          // Restore data and current step
          setData(savedProgress.bookingData);
          setCurrentStep(savedProgress.currentStep);
          
          // Show user they're resuming
          Alert.alert(
            '📝 Resume Booking',
            `You have an in-progress booking with this cleaner. Resuming at step ${savedProgress.currentStep} of ${totalSteps}.`,
            [{ text: 'Continue', style: 'default' }]
          );
        } else if (user?.id) {
          // No saved progress, try to auto-populate from user profile
          console.log('🚀 Auto-populating booking form from user profile...');
          
          const populatedData = await bookingDataPopulationService.populateBookingForm(user.id, cleanerId);
          
          if (populatedData.populatedFields.length > 0) {
            console.log(`✅ Auto-populated ${populatedData.populatedFields.length} fields:`, populatedData.populatedFields);
            
            // Merge populated data with existing form data
            setData(prevData => ({
              ...prevData,
              contactName: populatedData.contactName || prevData.contactName,
              contactPhone: populatedData.contactPhone || prevData.contactPhone,
              address: populatedData.address || prevData.address,
              apartmentNumber: populatedData.apartmentNumber || prevData.apartmentNumber,
              accessInstructions: populatedData.accessInstructions || prevData.accessInstructions,
              parkingInfo: populatedData.parkingInfo || prevData.parkingInfo,
              productPreference: populatedData.productPreference || prevData.productPreference,
              petInfo: populatedData.petInfo || prevData.petInfo,
              specialRequests: populatedData.specialRequests || prevData.specialRequests,
              paymentMethod: populatedData.paymentMethod || prevData.paymentMethod,
            }));
            
            // Show user what was auto-filled
            if (populatedData.populatedFields.length >= 3) {
              Alert.alert(
                '✨ Smart Form Filled',
                `We've pre-filled ${populatedData.populatedFields.length} fields from your profile to save you time. You can review and modify them as needed.`,
                [{ text: 'Got it!', style: 'default' }]
              );
            }
          }
        }
      } catch (error) {
        console.error('❌ Failed to load booking progress:', error);
      } finally {
        setIsLoadingProgress(false);
      }
    };

    loadBookingProgress();
  }, [cleanerId, user?.id]);

  // Save progress whenever data or step changes
  useEffect(() => {
    const saveProgress = async () => {
      if (!cleanerId || isLoadingProgress || currentStep === 1) return;

      try {
        await bookingStateManager.saveBookingProgress(cleanerId, currentStep, data);
      } catch (error) {
        console.error('❌ Failed to save booking progress:', error);
      }
    };

    // Debounce the save operation
    const timeoutId = setTimeout(saveProgress, 1000);
    return () => clearTimeout(timeoutId);
  }, [data, currentStep, cleanerId, isLoadingProgress]);

  const updateData = (field: keyof BookingData, value: any) => {
    setData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate estimated cost when relevant fields change
      if (['cleaningType', 'estimatedDuration', 'rooms'].includes(field)) {
        updated.estimatedCost = calculateEstimatedCost(updated);
      }
      
      return updated;
    });
  };

  const toggleRoom = (room: string) => {
    const updatedRooms = data.rooms.includes(room)
      ? data.rooms.filter(r => r !== room)
      : [...data.rooms, room];
    updateData('rooms', updatedRooms);
  };

  const calculateEstimatedCost = (bookingData: BookingData): number => {
    let baseCost = 80; // Base hourly rate
    
    // Adjust for cleaning type
    const typeMultipliers = {
      'regular': 1.0,
      'deep': 1.5,
      'move-out': 1.8,
      'post-construction': 2.0,
    };
    
    baseCost *= typeMultipliers[bookingData.cleaningType];
    
    // Adjust for duration
    const duration = parseInt(bookingData.estimatedDuration) || 2;
    
    // Adjust for room count
    const roomBonus = Math.max(0, bookingData.rooms.length - 2) * 20;
    
    return Math.round(baseCost * duration + roomBonus);
  };

  const validateStep = (step: number): string | null => {
    switch (step) {
      case 1:
        if (!data.serviceType || !data.cleaningType || data.rooms.length === 0) {
          return 'Please select service type, cleaning type, and at least one room';
        }
        break;
      case 2:
        if (!data.selectedDate || !data.selectedTime) {
          return 'Please select a date and time for your booking';
        }
        break;
      case 3:
        if (!data.address) {
          return 'Please provide the service address';
        }
        break;
      case 4:
        if (!data.contactName || !data.contactPhone) {
          return 'Please provide contact information';
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
      handleBookingSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleBookingSubmit = async () => {
    setIsLoading(true);
    try {
      let bookingResult;
      let bookingId;

      // Check if this is a demo user creating a real booking
      const isDemoUser = user?.id?.startsWith('demo_') || !user?.id;
      
      if (isDemoUser && user?.id) {
        console.log('🎭 Demo user creating real booking');
        
        // TODO: Implement real booking creation with proper validation and payment processing
        // This would require:
        // 1. Valid address_id from user's saved addresses
        // 2. Payment method setup and payment_method_id
        // 3. Proper service type validation
        // 4. Real-time availability checking
        console.log('📝 Booking creation placeholder - implement real booking logic here');

        // For now, create a placeholder booking result
        bookingResult = {
          success: true,
          data: {
            id: `booking_${Date.now()}`,
            message: 'Booking placeholder created successfully'
          }
        };

        if (bookingResult.success) {
          bookingId = bookingResult.data.id;
          console.log('✅ Real booking created for demo user:', bookingId);
        } else {
          throw new Error(bookingResult.error || 'Failed to create booking');
        }
      } else {
        // For real users, use the actual booking service (TODO: implement)
        console.log('👤 Real user booking - using simulation for now');
        await new Promise(resolve => setTimeout(resolve, 2000));
        bookingId = `booking_${Date.now()}`;
        
        // Send notification to cleaner (simulation)
        if (user?.id) {
          try {
            await notificationService.sendBookingNotification(
              bookingId,
              route.params?.cleanerId || 'cleaner-1',
              user.id,
              user.name || 'Customer',
              route.params?.serviceName || data.serviceType || 'Cleaning Service',
              user.avatar_url
            );
          } catch (error) {
            console.error('Error sending booking notification:', error);
          }
        }
      }
      
      // Clear booking progress since booking is completed
      if (cleanerId) {
        await bookingStateManager.clearBookingProgress(cleanerId);
        console.log('🗑️ Cleared booking progress after successful booking');
      }
      
      Alert.alert(
        'Booking Confirmed!',
        `Your cleaning service has been booked for ${data.selectedDate} at ${data.selectedTime}. Total cost: $${data.estimatedCost}`,
        [
          {
            text: 'View Booking',
            onPress: () => navigation.navigate('BookingConfirmation', { 
              bookingId,
              service: {
                title: route.params?.serviceName || data.serviceType || 'Cleaning Service',
                duration: data.estimatedDuration,
                price: data.estimatedCost
              },
              cleaner: {
                id: 'cleaner-1',
                name: 'Sarah Martinez',
                avatar: 'https://randomuser.me/api/portraits/women/32.jpg',
                rating: 4.9,
                eta: '15-30 min'
              },
              address: data.address,
              scheduledTime: `${data.selectedDate} at ${data.selectedTime}`
            })
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to create booking. Please try again.');
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

  const renderStep1 = () => {
    const handleSpecialRequestsFocus = () => {
      // Auto-scroll to middle of screen when special requests is focused
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 300, animated: true });
      }, 300); // Small delay to ensure keyboard is up
    };

    return (
      <ScrollView 
        ref={scrollViewRef}
        style={styles.stepContainer} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stepTitle}>Service Details</Text>
        <Text style={styles.stepSubtitle}>What type of cleaning do you need?</Text>

        <Text style={[styles.sectionTitle, styles.serviceTypeTitle]}>Service Type</Text>
      <View style={styles.optionRow}>
        {['Residential', 'Commercial', 'Apartment', 'House'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.optionButton,
              data.serviceType === type && styles.selectedOption
            ]}
            onPress={() => updateData('serviceType', type)}
          >
            <Text 
              style={[
                styles.optionText,
                data.serviceType === type && styles.selectedOptionText
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Cleaning Type</Text>
      <View style={styles.optionColumn}>
        {[
          { key: 'regular', label: 'Regular Cleaning', desc: 'Standard maintenance cleaning', price: '+$0' },
          { key: 'deep', label: 'Deep Cleaning', desc: 'Thorough, detailed cleaning', price: '+50%' },
          { key: 'move-out', label: 'Move-out Cleaning', desc: 'Complete cleaning for moving', price: '+80%' },
          { key: 'post-construction', label: 'Post-Construction', desc: 'After renovation cleanup', price: '+100%' }
        ].map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.cleaningTypeCard,
              data.cleaningType === option.key && styles.selectedCard
            ]}
            onPress={() => updateData('cleaningType', option.key as any)}
          >
            <View style={styles.cleaningTypeHeader}>
              <Text style={[
                styles.cleaningTypeLabel,
                data.cleaningType === option.key && styles.selectedCardText
              ]}>
                {option.label}
              </Text>
              <Text style={[
                styles.cleaningTypePrice,
                data.cleaningType === option.key && styles.selectedCardText
              ]}>
                {option.price}
              </Text>
            </View>
            <Text style={[
              styles.cleaningTypeDesc,
              data.cleaningType === option.key && styles.selectedCardText
            ]}>
              {option.desc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Rooms to Clean</Text>
      <View style={styles.roomGrid}>
        {['Living Room', 'Kitchen', 'Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Bathroom 1', 'Bathroom 2', 'Dining Room', 'Office', 'Laundry Room'].map((room) => (
          <TouchableOpacity
            key={room}
            style={[
              styles.roomButton,
              data.rooms.includes(room) && styles.selectedOption
            ]}
            onPress={() => toggleRoom(room)}
          >
            <Text style={[
              styles.roomText,
              data.rooms.includes(room) && styles.selectedOptionText
            ]}>
              {room}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Estimated Duration</Text>
      <View style={styles.optionRow}>
        {['1 hour', '2 hours', '3 hours', '4+ hours'].map((duration) => (
          <TouchableOpacity
            key={duration}
            style={[
              styles.optionButton,
              data.estimatedDuration === duration && styles.selectedOption
            ]}
            onPress={() => updateData('estimatedDuration', duration)}
          >
            <Text style={[
              styles.optionText,
              data.estimatedDuration === duration && styles.selectedOptionText
            ]}>
              {duration}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Special Requests</Text>
      <TextInput
        style={[styles.textInput, styles.textArea]}
        value={data.specialRequests}
        onChangeText={(text) => updateData('specialRequests', text)}
        onFocus={handleSpecialRequestsFocus}
        placeholder="Any specific areas or tasks you'd like us to focus on..."
        multiline
        numberOfLines={3}
      />
    </ScrollView>
  );
};

  const renderStep2 = () => {
    const today = new Date();
    const dates = Array.from({ length: 14 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      return date;
    });

    const timeSlots = [
      '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
      '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'
    ];

    return (
      <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepTitle}>Date & Time</Text>
        <Text style={styles.stepSubtitle}>When would you like your cleaning?</Text>

        <Text style={styles.sectionTitle}>Select Date</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
          {dates.map((date, index) => {
            const dateString = date.toLocaleDateString();
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNumber = date.getDate();
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateCard,
                  data.selectedDate === dateString && styles.selectedDateCard
                ]}
                onPress={() => updateData('selectedDate', dateString)}
              >
                <Text style={[
                  styles.dayName,
                  data.selectedDate === dateString && styles.selectedDateText
                ]}>
                  {dayName}
                </Text>
                <Text style={[
                  styles.dayNumber,
                  data.selectedDate === dateString && styles.selectedDateText
                ]}>
                  {dayNumber}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>Select Time</Text>
        <View style={styles.timeGrid}>
          {timeSlots.map((time) => (
            <TouchableOpacity
              key={time}
              style={[
                styles.timeButton,
                data.selectedTime === time && styles.selectedOption
              ]}
              onPress={() => updateData('selectedTime', time)}
            >
              <Text style={[
                styles.timeText,
                data.selectedTime === time && styles.selectedOptionText
              ]}>
                {time}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.recurringSection}>
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchLabel}>Make this recurring?</Text>
              <Text style={styles.switchDescription}>Schedule regular cleanings</Text>
            </View>
            <Switch
              value={data.isRecurring}
              onValueChange={(value) => updateData('isRecurring', value)}
              trackColor={{ false: '#D1D5DB', true: '#3ad3db' }}
              thumbColor={data.isRecurring ? '#ffffff' : '#f4f3f4'}
            />
          </View>

          {data.isRecurring && (
            <>
              <Text style={styles.inputLabel}>Frequency</Text>
              <View style={styles.optionRow}>
                {['Weekly', 'Bi-weekly', 'Monthly'].map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    style={[
                      styles.optionButton,
                      data.recurringFrequency === freq && styles.selectedOption
                    ]}
                    onPress={() => updateData('recurringFrequency', freq)}
                  >
                    <Text style={[
                      styles.optionText,
                      data.recurringFrequency === freq && styles.selectedOptionText
                    ]}>
                      {freq}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderStep3 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Address & Access</Text>
      <Text style={styles.stepSubtitle}>Where should we come for the cleaning?</Text>

      <Text style={styles.inputLabel}>Service Address *</Text>
      <TextInput
        style={styles.textInput}
        value={data.address}
        onChangeText={(text) => updateData('address', text)}
        placeholder="123 Main Street, City, State 12345"
      />

      <Text style={styles.inputLabel}>Apartment/Unit Number</Text>
      <TextInput
        style={styles.textInput}
        value={data.apartmentNumber}
        onChangeText={(text) => updateData('apartmentNumber', text)}
        placeholder="Unit 4B, Apt 101, etc."
      />

      <Text style={styles.inputLabel}>Access Instructions</Text>
      <TextInput
        style={[styles.textInput, styles.textArea]}
        value={data.accessInstructions}
        onChangeText={(text) => updateData('accessInstructions', text)}
        placeholder="Building codes, key location, buzzer number, etc."
        multiline
        numberOfLines={3}
      />

      <Text style={styles.inputLabel}>Parking Information</Text>
      <TextInput
        style={[styles.textInput, styles.textArea]}
        value={data.parkingInfo}
        onChangeText={(text) => updateData('parkingInfo', text)}
        placeholder="Where can the cleaner park? Any restrictions or guest parking?"
        multiline
        numberOfLines={2}
      />

      <View style={styles.safetyNote}>
        <Ionicons name="shield-checkmark" size={20} color="#3ad3db" />
        <Text style={styles.safetyNoteText}>
          Your address is secure and only shared with your assigned cleaner.
        </Text>
      </View>
    </ScrollView>
  );

  const renderStep4 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Contact & Preferences</Text>
      <Text style={styles.stepSubtitle}>Help us match you with the right cleaner</Text>

      <Text style={styles.inputLabel}>Contact Name *</Text>
      <TextInput
        style={styles.textInput}
        value={data.contactName}
        onChangeText={(text) => updateData('contactName', text)}
        placeholder="Your name"
      />

      <Text style={styles.inputLabel}>Contact Phone *</Text>
      <TextInput
        style={styles.textInput}
        value={data.contactPhone}
        onChangeText={(text) => updateData('contactPhone', text)}
        placeholder="+1 (555) 123-4567"
        keyboardType="phone-pad"
      />

      <Text style={styles.sectionTitle}>Cleaner Preference</Text>
      <View style={styles.optionRow}>
        {['No preference', 'Female', 'Male'].map((pref) => (
          <TouchableOpacity
            key={pref}
            style={[
              styles.optionButton,
              data.cleanerGender === pref && styles.selectedOption
            ]}
            onPress={() => updateData('cleanerGender', pref)}
          >
            <Text 
              style={[
                styles.optionText,
                data.cleanerGender === pref && styles.selectedOptionText
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {pref}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Cleaning Products</Text>
      <View style={styles.optionColumn}>
        {[
          { key: 'standard', label: 'Standard Products', desc: 'Cleaner brings regular products' },
          { key: 'eco-friendly', label: 'Eco-Friendly', desc: 'Green and natural products only' },
          { key: 'customer-provided', label: 'I\'ll Provide', desc: 'Use my own products' }
        ].map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.preferenceCard,
              data.productPreference === option.key && styles.selectedCard
            ]}
            onPress={() => updateData('productPreference', option.key as any)}
          >
            <Text style={[
              styles.preferenceLabel,
              data.productPreference === option.key && styles.selectedCardText
            ]}>
              {option.label}
            </Text>
            <Text style={[
              styles.preferenceDesc,
              data.productPreference === option.key && styles.selectedCardText
            ]}>
              {option.desc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.inputLabel}>Pet Information</Text>
      <TextInput
        style={[styles.textInput, styles.textArea]}
        value={data.petInfo}
        onChangeText={(text) => updateData('petInfo', text)}
        placeholder="Do you have pets? Any special instructions for our cleaner?"
        multiline
        numberOfLines={2}
        onFocus={() => {
          // Auto-scroll to middle of screen when pet info input is focused
          setTimeout(() => {
            scrollViewRef.current?.scrollTo({ y: 400, animated: true });
          }, 100);
        }}
      />
    </ScrollView>
  );

  const renderStep5 = () => (
    <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.stepTitle}>Review & Payment</Text>
      <Text style={styles.stepSubtitle}>Confirm your booking details</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Booking Summary</Text>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Service:</Text>
          <Text style={styles.summaryValue}>{data.cleaningType.charAt(0).toUpperCase() + data.cleaningType.slice(1)} Cleaning</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Date & Time:</Text>
          <Text style={styles.summaryValue}>{data.selectedDate} at {data.selectedTime}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Duration:</Text>
          <Text style={styles.summaryValue}>{data.estimatedDuration}</Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Rooms:</Text>
          <Text style={styles.summaryValue}>{data.rooms.length} rooms</Text>
        </View>
        
        <View style={styles.summaryDivider} />
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryTotal}>Total Cost:</Text>
          <Text style={styles.summaryPrice}>${data.estimatedCost}</Text>
        </View>
      </View>

      <View style={styles.paymentSection}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <TouchableOpacity style={styles.paymentButton}>
          <Ionicons name="card" size={24} color="#3ad3db" />
          <Text style={styles.paymentButtonText}>Add Payment Method</Text>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>
        
        <Text style={styles.paymentNote}>
          You'll be charged after the cleaning is completed. A $20 authorization will be placed on your card.
        </Text>
      </View>

      <View style={styles.termsSection}>
        <Text style={styles.termsText}>
          By booking, you agree to our{' '}
          <Text style={styles.linkText}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.linkText}>Cancellation Policy</Text>.
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

  if (isLoadingProgress) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <View style={styles.loadingContent}>
          <Text style={styles.loadingText}>Loading booking progress...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Cleaning</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Bar */}
      {renderProgressBar()}

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
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
                {isLoading ? 'Creating Booking...' : currentStep === totalSteps ? `Book Now - $${data.estimatedCost}` : 'Continue'}
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  placeholder: {
    width: 32,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
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
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3ad3db',
    borderRadius: 8,
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
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
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.8,
  },
  stepSubtitle: {
    fontSize: 17,
    color: '#64748B',
    marginBottom: 32,
    lineHeight: 26,
    fontWeight: '400',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 32,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  serviceTypeTitle: {
    marginTop: 16, // Reduced from 32 for tighter spacing after Service Details
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: '#0F172A',
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
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
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    minWidth: 85,
    maxWidth: 95,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedOption: {
    borderColor: '#3ad3db',
    backgroundColor: '#F0FDFA',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 14,
  },
  selectedOptionText: {
    color: '#3ad3db',
  },
  cleaningTypeCard: {
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  selectedCard: {
    borderColor: '#3ad3db',
    backgroundColor: '#F0FDFA',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    transform: [{ scale: 1.02 }],
  },
  cleaningTypeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cleaningTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  cleaningTypePrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc9a00',
  },
  cleaningTypeDesc: {
    fontSize: 14,
    color: '#6B7280',
  },
  selectedCardText: {
    color: '#3ad3db',
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  roomButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    minWidth: 110,
  },
  roomText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  dateScroll: {
    marginTop: 8,
  },
  dateCard: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginRight: 8,
    minWidth: 60,
  },
  selectedDateCard: {
    borderColor: '#3ad3db',
    backgroundColor: '#F0FDFA',
  },
  dayName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 4,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  selectedDateText: {
    color: '#3ad3db',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  timeButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    minWidth: 90,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  recurringSection: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
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
  safetyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F0FDFA',
    borderRadius: 8,
    marginTop: 24,
    gap: 12,
  },
  safetyNoteText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  preferenceCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  preferenceDesc: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryCard: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    flex: 1,
    textAlign: 'right',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  summaryTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  summaryPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3ad3db',
  },
  paymentSection: {
    marginBottom: 24,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: 12,
  },
  paymentButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    flex: 1,
  },
  paymentNote: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    lineHeight: 16,
  },
  termsSection: {
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 24,
  },
  termsText: {
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
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 10,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
});

export default SimpleBookingFlowScreen; 