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
  Switch,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { bookingTemplateService, CustomBookingQuestion } from '../../services/bookingTemplateService';
import { bookingStateManager } from '../../services/bookingStateManager';
import { notificationService } from '../../services/notificationService';
import { stripeService } from '../../services/stripe';

const { width } = Dimensions.get('window');

// ===========================================
// TYPES
// ===========================================

type StackParamList = {
  NewBookingFlow: {
    cleanerId?: string;
    serviceType?: string;
    serviceName?: string;
    basePrice?: number;
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

type NewBookingFlowNavigationProp = StackNavigationProp<StackParamList, 'NewBookingFlow'>;

interface NewBookingFlowProps {
  navigation: NewBookingFlowNavigationProp;
  route: {
    params?: {
      cleanerId?: string;
      serviceType?: string;
      serviceName?: string;
      basePrice?: number;
    };
  };
}

interface ServiceType {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  duration: string;
  icon: keyof typeof Ionicons.glyphMap;
  popular?: boolean;
}

interface BookingData {
  // Step 1: Service
  selectedService: ServiceType | null;
  
  // Step 2: Date & Time
  selectedDate: string;
  selectedTime: string;
  isRecurring: boolean;
  recurringFrequency: string;
  
  // Step 3: Location & Details
  address: string;
  apartmentUnit: string;
  accessInstructions: string;
  homeType: string;
  bedrooms: string;
  bathrooms: string;
  squareFootage: string;
  hasPets: boolean;
  petDetails: string;
  hasAllergies: boolean;
  allergyDetails: string;
  preferredProducts: string;
  cleaningFrequency: string;
  preferredTimes: string;
  
  // Custom Questions (from cleaner template)
  customAnswers: Record<string, string>;
  
  // Calculated
  estimatedCost: number;
}

// ===========================================
// CONSTANTS
// ===========================================

const SERVICES: ServiceType[] = [
  {
    id: 'standard',
    name: 'Standard Cleaning',
    description: 'Regular maintenance clean for your home',
    basePrice: 80,
    duration: '2-3 hours',
    icon: 'home',
    popular: true,
  },
  {
    id: 'deep',
    name: 'Deep Cleaning',
    description: 'Thorough cleaning of every corner',
    basePrice: 150,
    duration: '4-5 hours',
    icon: 'sparkles',
  },
  {
    id: 'move-out',
    name: 'Move-Out Cleaning',
    description: 'Complete clean for moving day',
    basePrice: 200,
    duration: '5-6 hours',
    icon: 'cube',
  },
  {
    id: 'express',
    name: 'Express Clean',
    description: 'Quick tidy-up for busy days',
    basePrice: 50,
    duration: '1-1.5 hours',
    icon: 'flash',
  },
];

const TIME_SLOTS = [
  '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', 
  '4:00 PM', '5:00 PM'
];

// ===========================================
// COMPONENT
// ===========================================

const NewBookingFlowScreen: React.FC<NewBookingFlowProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const cleanerId = route.params?.cleanerId || '';
  
  // State
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [customQuestions, setCustomQuestions] = useState<CustomBookingQuestion[]>([]);
  const [hasCustomQuestions, setHasCustomQuestions] = useState(false);
  const totalSteps = hasCustomQuestions ? 4 : 4; // Always 4 steps, questions integrated into step 3
  
  // Coupon code state
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  
  const [data, setData] = useState<BookingData>({
    selectedService: null,
    selectedDate: '',
    selectedTime: '',
    isRecurring: false,
    recurringFrequency: '',
    address: '',
    apartmentUnit: '',
    accessInstructions: '',
    homeType: '',
    bedrooms: '',
    bathrooms: '',
    squareFootage: '',
    hasPets: false,
    petDetails: '',
    hasAllergies: false,
    allergyDetails: '',
    preferredProducts: '',
    cleaningFrequency: '',
    preferredTimes: '',
    customAnswers: {},
    estimatedCost: 0,
  });
  
  // Animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  
  // ===========================================
  // EFFECTS
  // ===========================================
  
  useEffect(() => {
    loadCleanerTemplate();
    loadSavedProgress();
  }, [cleanerId]);
  
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentStep / totalSteps) * 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep, totalSteps]);
  
  // Auto-save progress
  useEffect(() => {
    if (currentStep > 1 && cleanerId) {
      bookingStateManager.saveBookingProgress(cleanerId, currentStep, data);
    }
  }, [data, currentStep]);
  
  // ===========================================
  // LOADERS
  // ===========================================
  
  const loadCleanerTemplate = async () => {
    if (!cleanerId || cleanerId === 'undefined') return;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanerId);
    if (!isUuid) return;
    
    try {
      // Get active template
      const templateResult = await bookingTemplateService.getActiveTemplate(cleanerId);
      
      if (templateResult.success && templateResult.data?.id) {
        // Get custom questions
        const questionsResult = await bookingTemplateService.getTemplateQuestions(templateResult.data.id);
        
        if (questionsResult.success && Array.isArray(questionsResult.data) && questionsResult.data.length > 0) {
          setCustomQuestions(questionsResult.data);
          setHasCustomQuestions(true);
        } else {
          setCustomQuestions([]);
          setHasCustomQuestions(false);
        }
      } else {
        setCustomQuestions([]);
        setHasCustomQuestions(false);
      }
    } catch (error) {
      console.error('Error loading cleaner template:', error);
      setCustomQuestions([]);
      setHasCustomQuestions(false);
    }
  };
  
  const loadSavedProgress = async () => {
    if (!cleanerId) return;
    
    try {
      // Only load progress for THIS specific cleaner
      const savedProgress = await bookingStateManager.getBookingProgress(cleanerId);
      
      // Verify the saved progress is for this exact cleaner
      if (savedProgress && savedProgress.cleanerId === cleanerId) {
        Alert.alert(
          '📝 Resume Booking?',
          `You have a saved booking for this cleaner. Continue where you left off?`,
          [
            { 
              text: 'Start Fresh', 
              style: 'destructive',
              onPress: async () => {
                await bookingStateManager.clearBookingProgress(cleanerId);
                setCurrentStep(1);
              }
            },
            { 
              text: 'Continue', 
              style: 'default',
              onPress: () => {
                setData(savedProgress.bookingData);
                setCurrentStep(savedProgress.currentStep);
              }
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error loading saved progress:', error);
    }
  };
  
  // ===========================================
  // HANDLERS
  // ===========================================
  
  const updateData = (field: keyof BookingData, value: any) => {
    setData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Recalculate cost when service changes
      if (field === 'selectedService' && value) {
        updated.estimatedCost = value.basePrice;
      }
      
      return updated;
    });
  };
  
  const updateCustomAnswer = (questionId: string, answer: string) => {
    setData(prev => ({
      ...prev,
      customAnswers: {
        ...prev.customAnswers,
        [questionId]: answer,
      },
    }));
  };
  
  const validateStep = (step: number): string | null => {
    switch (step) {
      case 1:
        if (!data.selectedService) {
          return 'Please select a service type';
        }
        break;
      case 2:
        if (!data.selectedDate || !data.selectedTime) {
          return 'Please select a date and time';
        }
        break;
      case 3:
        if (!data.address) {
          return 'Please enter your address';
        }
        break;
    }
    return null;
  };
  
  const handleNext = () => {
    const error = validateStep(currentStep);
    if (error) {
      Alert.alert('Missing Information', error);
      return;
    }
    
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      handleBookingSubmit();
    }
  };
  
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      navigation.goBack();
    }
  };
  
  // Coupon code validation
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }
    
    setIsValidatingCoupon(true);
    setCouponError('');
    
    try {
      // Valid coupon codes (could be fetched from database in production)
      const validCoupons: Record<string, { discount: number; type: 'percent' | 'fixed'; description: string }> = {
        'WELCOME10': { discount: 10, type: 'percent', description: '10% off your first booking' },
        'SAVE15': { discount: 15, type: 'percent', description: '15% off any service' },
        'HERO20': { discount: 20, type: 'percent', description: '20% off - ChoreHero special' },
        'FIRST5': { discount: 5, type: 'fixed', description: '$5 off your first booking' },
        'CLEAN25': { discount: 25, type: 'percent', description: '25% off deep cleaning' },
      };
      
      const upperCode = couponCode.toUpperCase().trim();
      const coupon = validCoupons[upperCode];
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (coupon) {
        const basePrice = data.estimatedCost || data.selectedService?.basePrice || 80;
        let discountAmount = 0;
        
        if (coupon.type === 'percent') {
          discountAmount = Math.round(basePrice * (coupon.discount / 100));
        } else {
          discountAmount = coupon.discount;
        }
        
        setCouponDiscount(discountAmount);
        setCouponApplied(true);
        setCouponError('');
        
        // Haptic feedback for success
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        Alert.alert(
          '🎉 Coupon Applied!',
          `${coupon.description}\nYou save $${discountAmount}!`
        );
      } else {
        setCouponError('Invalid coupon code. Please try again.');
        setCouponApplied(false);
        setCouponDiscount(0);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.error('Coupon validation error:', error);
      setCouponError('Failed to validate coupon. Please try again.');
    } finally {
      setIsValidatingCoupon(false);
    }
  };
  
  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponDiscount(0);
    setCouponApplied(false);
    setCouponError('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const handleBookingSubmit = async () => {
    setIsLoading(true);
    
    try {
      if (!user) {
        Alert.alert('Error', 'Please log in to book a service.');
        return;
      }

      if (user.role === 'customer' && user.customer_onboarding_state !== 'TRANSACTION_READY') {
        Alert.alert(
          'Payment Required',
          'Please add a payment method before booking.',
          [{ text: 'Add Payment Method', onPress: () => navigation.navigate('PaymentScreen') }]
        );
        return;
      }

      // Parse the scheduled date and time properly
      // selectedDate is ISO format (YYYY-MM-DD) and selectedTime is like "10:00 AM"
      let scheduledDateTime: Date;
      try {
        // Parse ISO date (YYYY-MM-DD)
        const [year, month, day] = data.selectedDate.split('-').map(Number);
        const timeParts = data.selectedTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        
        if (year && month && day && timeParts) {
          let hours = parseInt(timeParts[1]);
          const minutes = parseInt(timeParts[2]);
          const isPM = timeParts[3]?.toUpperCase() === 'PM';
          
          // Convert to 24-hour format
          if (isPM && hours !== 12) hours += 12;
          if (!isPM && hours === 12) hours = 0;
          
          scheduledDateTime = new Date(year, month - 1, day, hours, minutes);
        } else {
          // Fallback: use current date + 1 day
          scheduledDateTime = new Date();
          scheduledDateTime.setDate(scheduledDateTime.getDate() + 1);
        }
      } catch {
        // Fallback
        scheduledDateTime = new Date();
        scheduledDateTime.setDate(scheduledDateTime.getDate() + 1);
      }

      // Calculate pricing
      const servicePrice = data.selectedService?.basePrice || 80;
      const platformFee = Math.round(servicePrice * 0.15); // 15% platform fee
      const totalAmount = servicePrice + platformFee;

      const jobDetailsParts = [
        data.homeType && `Home: ${data.homeType}`,
        data.bedrooms && `Beds: ${data.bedrooms}`,
        data.bathrooms && `Baths: ${data.bathrooms}`,
        data.squareFootage && `Sq Ft: ${data.squareFootage}`,
        data.hasPets ? `Pets: ${data.petDetails || 'Yes'}` : '',
        data.hasAllergies ? `Allergies: ${data.allergyDetails || 'Yes'}` : '',
        data.preferredProducts && `Products: ${data.preferredProducts}`,
        data.cleaningFrequency && `Frequency: ${data.cleaningFrequency}`,
        data.preferredTimes && `Preferred Times: ${data.preferredTimes}`,
      ].filter(Boolean) as string[];

      const baseRequest = `Service: ${data.selectedService?.name || 'Cleaning'}`;
      const specialRequests = [baseRequest, ...jobDetailsParts].join(' • ');

      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_id: user.id,
          cleaner_id: cleanerId,
          service_type: 'standard',
          status: 'pending',
          scheduled_time: scheduledDateTime.toISOString(),
          estimated_duration: 120, // 2 hours default
          service_base_price: servicePrice,
          platform_fee: platformFee,
          total_amount: totalAmount,
          address: data.address || '',
          apartment_unit: data.apartmentUnit || null,
          access_instructions: data.accessInstructions || null,
          special_instructions: specialRequests,
          bedrooms: data.bedrooms || null,
          bathrooms: data.bathrooms || null,
          square_feet: data.squareFootage ? Number(data.squareFootage) : null,
          has_pets: data.hasPets,
          pet_details: data.hasPets ? data.petDetails || null : null,
        })
        .select()
        .single();

      if (bookingError) {
        console.error('Booking creation error:', bookingError);
        throw new Error('Failed to create booking');
      }

      console.log('✅ Booking created:', booking.id);

      // 2. Update cleaner's stats (increment total_jobs) - non-blocking
      if (cleanerId) {
        try {
          const { error: statsError } = await supabase.rpc('increment_cleaner_bookings', {
            cleaner_user_id: cleanerId,
            booking_amount: totalPrice
          });
          
          if (statsError) {
            console.warn('Could not update cleaner stats:', statsError.message);
          } else {
            console.log('📊 Cleaner stats updated');
          }
        } catch (rpcError) {
          console.warn('RPC function may not exist:', rpcError);
          // Non-blocking - the function might not be created yet
        }
      }

      // 3. Send notification to cleaner
      if (cleanerId) {
        try {
          await notificationService.sendBookingNotification(
            booking.id,
            cleanerId,
            user.id,
            user.name || 'A customer',
            data.selectedService?.name || 'Cleaning Service',
            user.avatar_url
          );
          console.log('📬 Booking notification sent to cleaner');
        } catch (notifError) {
          console.warn('Could not send notification:', notifError);
        }
      }

      // 4. Clear saved booking progress
      if (cleanerId) {
        await bookingStateManager.clearBookingProgress(cleanerId);
      }

      // 5. Show success and navigate
      const displayDate = data.selectedDate 
        ? new Date(data.selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : 'your selected date';
      
      Alert.alert(
        '✅ Booking Confirmed!',
        `Your ${data.selectedService?.name} has been booked for ${displayDate} at ${data.selectedTime}.\n\nThe cleaner has been notified and will confirm shortly.`,
        [
          {
            text: 'View Booking',
            onPress: () => navigation.navigate('BookingConfirmation', {
              bookingId: booking.id,
              service: data.selectedService,
              cleaner: { id: cleanerId },
              address: data.address,
              scheduledTime: `${displayDate} at ${data.selectedTime}`,
            }),
          },
        ]
      );
    } catch (error) {
      console.error('Booking error:', error);
      Alert.alert('Error', 'Failed to create booking. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // ===========================================
  // RENDER HELPERS
  // ===========================================
  
  const renderProgressBar = () => {
    const progressWidth = progressAnim.interpolate({
      inputRange: [0, 100],
      outputRange: ['0%', '100%'],
    });
    
    const stepLabels = ['Service', 'Schedule', 'Location', 'Confirm'];
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <View style={styles.stepIndicators}>
          {stepLabels.map((label, index) => (
            <View key={label} style={styles.stepIndicatorWrapper}>
              <View style={[
                styles.stepDot,
                currentStep > index && styles.stepDotCompleted,
                currentStep === index + 1 && styles.stepDotActive,
              ]}>
                {currentStep > index + 1 ? (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                ) : (
                  <Text style={[
                    styles.stepDotText,
                    (currentStep >= index + 1) && styles.stepDotTextActive,
                  ]}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text style={[
                styles.stepLabel,
                currentStep === index + 1 && styles.stepLabelActive,
              ]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };
  
  // ===========================================
  // STEP 1: SERVICE SELECTION
  // ===========================================
  
  const renderStep1 = () => (
    <ScrollView 
      ref={scrollViewRef}
      style={styles.stepContainer}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.stepContentContainer}
    >
      <Text style={styles.stepTitle}>Choose Your Service</Text>
      <Text style={styles.stepSubtitle}>
        Select the type of cleaning that fits your needs
      </Text>
      
      <View style={styles.servicesGrid}>
        {SERVICES.map((service) => (
          <TouchableOpacity
            key={service.id}
            style={[
              styles.serviceCard,
              data.selectedService?.id === service.id && styles.serviceCardSelected,
            ]}
            onPress={() => updateData('selectedService', service)}
            activeOpacity={0.7}
          >
            {service.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>Popular</Text>
              </View>
            )}
            
            <View style={[
              styles.serviceIconContainer,
              data.selectedService?.id === service.id && styles.serviceIconContainerSelected,
            ]}>
              <Ionicons 
                name={service.icon} 
                size={28} 
                color={data.selectedService?.id === service.id ? '#fff' : '#3ad3db'} 
              />
            </View>
            
            <Text style={[
              styles.serviceName,
              data.selectedService?.id === service.id && styles.serviceNameSelected,
            ]}>
              {service.name}
            </Text>
            
            <Text style={[
              styles.serviceDescription,
              data.selectedService?.id === service.id && styles.serviceDescriptionSelected,
            ]}>
              {service.description}
            </Text>
            
            <View style={styles.serviceFooter}>
              <Text style={[
                styles.servicePrice,
                data.selectedService?.id === service.id && styles.servicePriceSelected,
              ]}>
                ${service.basePrice}
              </Text>
              <Text style={[
                styles.serviceDuration,
                data.selectedService?.id === service.id && styles.serviceDurationSelected,
              ]}>
                {service.duration}
              </Text>
            </View>
            
            {data.selectedService?.id === service.id && (
              <View style={styles.selectedCheckmark}>
                <Ionicons name="checkmark-circle" size={24} color="#3ad3db" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
  
  // ===========================================
  // STEP 2: DATE & TIME
  // ===========================================
  
  const renderStep2 = () => {
    const today = new Date();
    const dates = Array.from({ length: 14 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      return date;
    });
    
    return (
      <ScrollView 
        ref={scrollViewRef}
        style={styles.stepContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.stepContentContainer}
      >
        <Text style={styles.stepTitle}>Pick Your Time</Text>
        <Text style={styles.stepSubtitle}>
          Choose when you'd like us to come
        </Text>
        
        {/* Date Selection */}
        <Text style={styles.sectionTitle}>Select Date</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.dateScroll}
          contentContainerStyle={styles.dateScrollContent}
        >
          {dates.map((date, index) => {
            const isoDateString = date.toISOString().split('T')[0]; // YYYY-MM-DD format
            const displayDate = date.toLocaleDateString();
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNumber = date.getDate();
            const monthName = date.toLocaleDateString('en-US', { month: 'short' });
            const isToday = index === 0;
            const isSelected = data.selectedDate === isoDateString;
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateCard,
                  isSelected && styles.dateCardSelected,
                ]}
                onPress={() => updateData('selectedDate', isoDateString)}
              >
                <Text style={[
                  styles.dateDayName,
                  isSelected && styles.dateTextSelected,
                ]}>
                  {isToday ? 'Today' : dayName}
                </Text>
                <Text style={[
                  styles.dateDayNumber,
                  isSelected && styles.dateTextSelected,
                ]}>
                  {dayNumber}
                </Text>
                <Text style={[
                  styles.dateMonth,
                  isSelected && styles.dateTextSelected,
                ]}>
                  {monthName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        
        {/* Time Selection */}
        <Text style={styles.sectionTitle}>Select Time</Text>
        <View style={styles.timeGrid}>
          {TIME_SLOTS.map((time) => {
            const isSelected = data.selectedTime === time;
            
            return (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeButton,
                  isSelected && styles.timeButtonSelected,
                ]}
                onPress={() => updateData('selectedTime', time)}
              >
                <Text style={[
                  styles.timeText,
                  isSelected && styles.timeTextSelected,
                ]}>
                  {time}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* Recurring Option */}
        <View style={styles.recurringCard}>
          <View style={styles.recurringRow}>
            <View style={styles.recurringInfo}>
              <Ionicons name="repeat" size={24} color="#3ad3db" />
              <View style={styles.recurringTextContainer}>
                <Text style={styles.recurringTitle}>Make it recurring?</Text>
                <Text style={styles.recurringSubtitle}>Save 10% on regular cleanings</Text>
              </View>
            </View>
            <Switch
              value={data.isRecurring}
              onValueChange={(value) => updateData('isRecurring', value)}
              trackColor={{ false: '#E2E8F0', true: '#3ad3db' }}
              thumbColor="#fff"
            />
          </View>
          
          {data.isRecurring && (
            <View style={styles.frequencyRow}>
              {['Weekly', 'Bi-weekly', 'Monthly'].map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[
                    styles.frequencyButton,
                    data.recurringFrequency === freq && styles.frequencyButtonSelected,
                  ]}
                  onPress={() => updateData('recurringFrequency', freq)}
                >
                  <Text style={[
                    styles.frequencyText,
                    data.recurringFrequency === freq && styles.frequencyTextSelected,
                  ]}>
                    {freq}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    );
  };
  
  // ===========================================
  // STEP 3: LOCATION & DETAILS
  // ===========================================
  
  const renderStep3 = () => (
    <ScrollView 
      ref={scrollViewRef}
      style={styles.stepContainer}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.stepContentContainer}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.stepTitle}>Location & Details</Text>
      <Text style={styles.stepSubtitle}>
        Tell us where and any special instructions
      </Text>
      
      {/* Address */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Service Address *</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="location" size={20} color="#9CA3AF" style={styles.inputIcon} />
          <TextInput
            style={styles.textInput}
            value={data.address}
            onChangeText={(text) => updateData('address', text)}
            placeholder="Enter your full address"
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>
      
      {/* Apartment/Unit */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Apartment/Unit (Optional)</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="business" size={20} color="#9CA3AF" style={styles.inputIcon} />
          <TextInput
            style={styles.textInput}
            value={data.apartmentUnit}
            onChangeText={(text) => updateData('apartmentUnit', text)}
            placeholder="Apt 101, Unit 4B, etc."
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>
      
      {/* Access Instructions */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Access Instructions (Optional)</Text>
        <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={data.accessInstructions}
            onChangeText={(text) => updateData('accessInstructions', text)}
            placeholder="Gate code, key location, how to enter..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </View>

      {/* Home Details */}
      <View style={styles.customQuestionsDivider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>Home Details (Optional)</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Home Type</Text>
        <View style={styles.inputWrapper}>
          <Ionicons name="home-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
          <TextInput
            style={styles.textInput}
            value={data.homeType}
            onChangeText={(text) => updateData('homeType', text)}
            placeholder="House, Apartment, Condo..."
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      <View style={styles.inputRow}>
        <View style={[styles.inputGroup, styles.halfInput]}>
          <Text style={styles.inputLabel}>Bedrooms</Text>
          <TextInput
            style={styles.textInput}
            value={data.bedrooms}
            onChangeText={(text) => updateData('bedrooms', text)}
            placeholder="2"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
          />
        </View>
        <View style={[styles.inputGroup, styles.halfInput]}>
          <Text style={styles.inputLabel}>Bathrooms</Text>
          <TextInput
            style={styles.textInput}
            value={data.bathrooms}
            onChangeText={(text) => updateData('bathrooms', text)}
            placeholder="1"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Approx. Square Footage</Text>
        <TextInput
          style={styles.textInput}
          value={data.squareFootage}
          onChangeText={(text) => updateData('squareFootage', text)}
          placeholder="1200"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Pets in Home?</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{data.hasPets ? 'Yes' : 'No'}</Text>
          <Switch
            value={data.hasPets}
            onValueChange={(value) => updateData('hasPets', value)}
            trackColor={{ false: '#E5E7EB', true: '#22C55E' }}
            thumbColor="#FFFFFF"
          />
        </View>
        {data.hasPets && (
          <TextInput
            style={styles.textInput}
            value={data.petDetails}
            onChangeText={(text) => updateData('petDetails', text)}
            placeholder="Dog, cat, etc."
            placeholderTextColor="#9CA3AF"
          />
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Allergies or sensitivities?</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{data.hasAllergies ? 'Yes' : 'No'}</Text>
          <Switch
            value={data.hasAllergies}
            onValueChange={(value) => updateData('hasAllergies', value)}
            trackColor={{ false: '#E5E7EB', true: '#22C55E' }}
            thumbColor="#FFFFFF"
          />
        </View>
        {data.hasAllergies && (
          <TextInput
            style={styles.textInput}
            value={data.allergyDetails}
            onChangeText={(text) => updateData('allergyDetails', text)}
            placeholder="Describe allergies"
            placeholderTextColor="#9CA3AF"
          />
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Preferred Products</Text>
        <TextInput
          style={styles.textInput}
          value={data.preferredProducts}
          onChangeText={(text) => updateData('preferredProducts', text)}
          placeholder="Eco-friendly, unscented, etc."
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Cleaning Frequency</Text>
        <TextInput
          style={styles.textInput}
          value={data.cleaningFrequency}
          onChangeText={(text) => updateData('cleaningFrequency', text)}
          placeholder="Weekly, bi-weekly, one-time..."
          placeholderTextColor="#9CA3AF"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Preferred Times</Text>
        <TextInput
          style={styles.textInput}
          value={data.preferredTimes}
          onChangeText={(text) => updateData('preferredTimes', text)}
          placeholder="Mornings, weekends, etc."
          placeholderTextColor="#9CA3AF"
        />
      </View>
      
      {/* Custom Questions from Cleaner */}
      {Array.isArray(customQuestions) && customQuestions.length > 0 && (
        <>
          <View style={styles.customQuestionsDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Cleaner's Questions</Text>
            <View style={styles.dividerLine} />
          </View>
          
          {customQuestions.map((question) => (
            <View key={question.id} style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {question.question_text}
                {question.is_required && ' *'}
              </Text>
              
              {question.question_type === 'yes_no' ? (
                <View style={styles.yesNoRow}>
                  {['Yes', 'No'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.yesNoButton,
                        data.customAnswers[question.id] === option && styles.yesNoButtonSelected,
                      ]}
                      onPress={() => updateCustomAnswer(question.id, option)}
                    >
                      <Text style={[
                        styles.yesNoText,
                        data.customAnswers[question.id] === option && styles.yesNoTextSelected,
                      ]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : question.question_type === 'single_choice' && question.options ? (
                <View style={styles.choiceGrid}>
                  {question.options.map((option: string) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.choiceButton,
                        data.customAnswers[question.id] === option && styles.choiceButtonSelected,
                      ]}
                      onPress={() => updateCustomAnswer(question.id, option)}
                    >
                      <Text style={[
                        styles.choiceText,
                        data.customAnswers[question.id] === option && styles.choiceTextSelected,
                      ]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.textInput}
                    value={data.customAnswers[question.id] || ''}
                    onChangeText={(text) => updateCustomAnswer(question.id, text)}
                    placeholder={question.placeholder_text || 'Enter your answer'}
                    placeholderTextColor="#9CA3AF"
                    multiline={question.question_type === 'textarea'}
                    numberOfLines={question.question_type === 'textarea' ? 3 : 1}
                  />
                </View>
              )}
              
              {question.help_text && (
                <Text style={styles.helpText}>{question.help_text}</Text>
              )}
            </View>
          ))}
        </>
      )}
      
      {/* Security Note */}
      <View style={styles.securityNote}>
        <Ionicons name="shield-checkmark" size={20} color="#3ad3db" />
        <Text style={styles.securityNoteText}>
          Your information is secure and only shared with your cleaner
        </Text>
      </View>
    </ScrollView>
  );
  
  // ===========================================
  // STEP 4: CONFIRM & BOOK
  // ===========================================
  
  const renderStep4 = () => (
    <ScrollView 
      ref={scrollViewRef}
      style={styles.stepContainer}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.stepContentContainer}
    >
      <Text style={styles.stepTitle}>Confirm & Book</Text>
      <Text style={styles.stepSubtitle}>
        Review your booking details before confirming
      </Text>
      
      {/* Summary Card */}
      <View style={styles.summaryCard}>
        {/* Service */}
        <View style={styles.summarySection}>
          <View style={styles.summarySectionHeader}>
            <Ionicons name="sparkles" size={20} color="#3ad3db" />
            <Text style={styles.summarySectionTitle}>Service</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{data.selectedService?.name}</Text>
            <Text style={styles.summaryValue}>${data.selectedService?.basePrice}</Text>
          </View>
          <Text style={styles.summarySubtext}>
            {data.selectedService?.description}
          </Text>
        </View>
        
        <View style={styles.summaryDivider} />
        
        {/* Date & Time */}
        <View style={styles.summarySection}>
          <View style={styles.summarySectionHeader}>
            <Ionicons name="calendar" size={20} color="#3ad3db" />
            <Text style={styles.summarySectionTitle}>When</Text>
          </View>
          <Text style={styles.summaryText}>
            {data.selectedDate ? new Date(data.selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''} at {data.selectedTime}
          </Text>
          {data.isRecurring && (
            <View style={styles.recurringBadge}>
              <Ionicons name="repeat" size={14} color="#059669" />
              <Text style={styles.recurringBadgeText}>
                Recurring {data.recurringFrequency}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.summaryDivider} />
        
        {/* Location */}
        <View style={styles.summarySection}>
          <View style={styles.summarySectionHeader}>
            <Ionicons name="location" size={20} color="#3ad3db" />
            <Text style={styles.summarySectionTitle}>Where</Text>
          </View>
          <Text style={styles.summaryText}>
            {data.address}
            {data.apartmentUnit ? `, ${data.apartmentUnit}` : ''}
          </Text>
          {data.accessInstructions && (
            <Text style={styles.summarySubtext}>
              Note: {data.accessInstructions}
            </Text>
          )}
        </View>
        
        <View style={styles.summaryDivider} />
        
        {/* Coupon Discount Row */}
        {couponApplied && couponDiscount > 0 && (
          <View style={styles.summaryRow}>
            <View style={styles.discountRowLeft}>
              <Ionicons name="pricetag" size={16} color="#059669" />
              <Text style={styles.discountLabel}>Promo ({couponCode.toUpperCase()})</Text>
            </View>
            <Text style={styles.discountValue}>-${couponDiscount}</Text>
          </View>
        )}
        
        {/* Total */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total</Text>
          <View style={styles.totalValueContainer}>
            {couponApplied && couponDiscount > 0 && (
              <Text style={styles.totalValueOriginal}>${data.estimatedCost}</Text>
            )}
            <Text style={styles.totalValue}>
              ${Math.max(0, data.estimatedCost - couponDiscount)}
            </Text>
          </View>
        </View>
        
        {data.isRecurring && (
          <Text style={styles.discountNote}>
            🎉 10% discount applied for recurring booking
          </Text>
        )}
      </View>
      
      {/* Payment Method */}
      <View style={styles.paymentSection}>
        <View style={styles.summarySectionHeader}>
          <Ionicons name="card" size={20} color="#3ad3db" />
          <Text style={styles.summarySectionTitle}>Payment Method</Text>
        </View>
        
        {/* Saved Card (Demo) */}
        <TouchableOpacity style={styles.paymentMethodCard}>
          <View style={styles.paymentMethodIcon}>
            <Ionicons name="card" size={24} color="#3ad3db" />
          </View>
          <View style={styles.paymentMethodInfo}>
            <Text style={styles.paymentMethodTitle}>Visa •••• 4242</Text>
            <Text style={styles.paymentMethodSubtitle}>Expires 12/28</Text>
          </View>
          <Ionicons name="checkmark-circle" size={24} color="#3ad3db" />
        </TouchableOpacity>
        
        {/* Add New Card Option */}
        <TouchableOpacity style={styles.addPaymentMethod}>
          <Ionicons name="add-circle-outline" size={20} color="#6B7280" />
          <Text style={styles.addPaymentMethodText}>Add new payment method</Text>
        </TouchableOpacity>
      </View>
      
      {/* Coupon Code Section */}
      <View style={styles.couponSection}>
        <View style={styles.summarySectionHeader}>
          <Ionicons name="pricetag" size={20} color="#3ad3db" />
          <Text style={styles.summarySectionTitle}>Promo Code</Text>
        </View>
        
        {couponApplied ? (
          <View style={styles.couponAppliedContainer}>
            <View style={styles.couponAppliedBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#059669" />
              <Text style={styles.couponAppliedCode}>{couponCode.toUpperCase()}</Text>
              <Text style={styles.couponAppliedDiscount}>-${couponDiscount}</Text>
            </View>
            <TouchableOpacity onPress={handleRemoveCoupon} style={styles.removeCouponButton}>
              <Ionicons name="close-circle" size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.couponInputContainer}>
            <TextInput
              style={[styles.couponInput, couponError ? styles.couponInputError : null]}
              placeholder="Enter promo code"
              placeholderTextColor="#9CA3AF"
              value={couponCode}
              onChangeText={(text) => {
                setCouponCode(text);
                setCouponError('');
              }}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity 
              style={[styles.applyCouponButton, isValidatingCoupon && styles.applyCouponButtonDisabled]}
              onPress={handleApplyCoupon}
              disabled={isValidatingCoupon}
            >
              {isValidatingCoupon ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.applyCouponButtonText}>Apply</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
        
        {couponError ? (
          <View style={styles.couponErrorContainer}>
            <Ionicons name="alert-circle" size={14} color="#EF4444" />
            <Text style={styles.couponErrorText}>{couponError}</Text>
          </View>
        ) : null}
        
        <Text style={styles.couponHint}>
          Try: WELCOME10, SAVE15, or HERO20 for discounts
        </Text>
      </View>
      
      {/* Payment Info */}
      <View style={styles.paymentNote}>
        <Ionicons name="shield-checkmark" size={18} color="#059669" />
        <Text style={styles.paymentNoteText}>
          Secure payment powered by Stripe. You'll be charged after booking confirmation.
        </Text>
      </View>
      
      {/* Terms */}
      <Text style={styles.termsText}>
        By booking, you agree to our{' '}
        <Text style={styles.termsLink}>Terms of Service</Text>
        {' '}and{' '}
        <Text style={styles.termsLink}>Cancellation Policy</Text>
      </Text>
    </ScrollView>
  );
  
  // ===========================================
  // MAIN RENDER
  // ===========================================
  
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return renderStep1();
    }
  };
  
  const getButtonText = () => {
    if (isLoading) return 'Processing Payment...';
    if (currentStep === totalSteps) {
      const finalPrice = Math.max(0, data.estimatedCost - couponDiscount);
      return `Pay & Book • $${finalPrice}`;
    }
    return 'Continue';
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFBFC" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Cleaning</Text>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>
      
      {/* Progress */}
      {renderProgressBar()}
      
      {/* Content */}
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <View style={styles.content}>
          {renderCurrentStep()}
        </View>
        
        {/* Bottom Button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
            onPress={handleNext}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isLoading ? ['#9CA3AF', '#6B7280'] : ['#3ad3db', '#2BC8D4']}
              style={styles.continueButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.continueButtonText}>{getButtonText()}</Text>
                  {currentStep < totalSteps && (
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  )}
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ===========================================
// STYLES
// ===========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  
  // Progress
  progressContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  progressBar: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3ad3db',
    borderRadius: 3,
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  stepIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepIndicatorWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  stepDotActive: {
    backgroundColor: '#3ad3db',
    borderColor: '#3ad3db',
    shadowColor: '#3ad3db',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  stepDotCompleted: {
    backgroundColor: '#3ad3db',
    borderColor: '#3ad3db',
    shadowColor: '#3ad3db',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  stepDotText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  stepDotTextActive: {
    color: '#fff',
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.2,
  },
  stepLabelActive: {
    color: '#3ad3db',
    fontWeight: '700',
  },
  
  // Content
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContentContainer: {
    paddingTop: 24,
    paddingBottom: 40,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 28,
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
    marginTop: 24,
  },
  
  // Services Grid
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    width: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    position: 'relative',
    // Depth shadows
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  serviceCardSelected: {
    borderColor: '#3ad3db',
    borderWidth: 2,
    backgroundColor: '#F0FDFA',
    shadowColor: '#3ad3db',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  popularBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.2)',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
    letterSpacing: 0.3,
  },
  serviceIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(58, 211, 219, 0.15)',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  serviceIconContainerSelected: {
    backgroundColor: '#3ad3db',
    borderColor: '#3ad3db',
    shadowOpacity: 0.25,
  },
  serviceName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  serviceNameSelected: {
    color: '#0F172A',
  },
  serviceDescription: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 16,
  },
  serviceDescriptionSelected: {
    color: '#475569',
  },
  serviceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  servicePrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  servicePriceSelected: {
    color: '#3ad3db',
  },
  serviceDuration: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  serviceDurationSelected: {
    color: '#64748B',
  },
  selectedCheckmark: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Date Selection
  dateScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  dateScrollContent: {
    paddingRight: 20,
    gap: 10,
  },
  dateCard: {
    width: 70,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  dateCardSelected: {
    borderColor: '#3ad3db',
    backgroundColor: '#F0FDFA',
  },
  dateDayName: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    marginBottom: 4,
  },
  dateDayNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  dateMonth: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  dateTextSelected: {
    color: '#3ad3db',
  },
  
  // Time Grid
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  timeButtonSelected: {
    borderColor: '#3ad3db',
    backgroundColor: '#F0FDFA',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  timeTextSelected: {
    color: '#3ad3db',
  },
  
  // Recurring
  recurringCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recurringInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recurringTextContainer: {
    flex: 1,
  },
  recurringTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  recurringSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  frequencyButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  frequencyButtonSelected: {
    backgroundColor: '#3ad3db',
  },
  frequencyText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  frequencyTextSelected: {
    color: '#fff',
  },
  
  // Inputs
  inputGroup: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: 14,
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
    paddingTop: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  helpText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
    fontStyle: 'italic',
  },
  
  // Custom Questions
  customQuestionsDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  yesNoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  yesNoButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  yesNoButtonSelected: {
    borderColor: '#3ad3db',
    backgroundColor: '#F0FDFA',
  },
  yesNoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  yesNoTextSelected: {
    color: '#3ad3db',
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choiceButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  choiceButtonSelected: {
    borderColor: '#3ad3db',
    backgroundColor: '#F0FDFA',
  },
  choiceText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  choiceTextSelected: {
    color: '#3ad3db',
  },
  
  // Security Note
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    marginTop: 24,
  },
  securityNoteText: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
  },
  
  // Summary
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  summarySection: {
    paddingVertical: 4,
  },
  summarySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  summarySectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3ad3db',
  },
  summaryText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  summarySubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 16,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  recurringBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#3ad3db',
  },
  totalValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalValueOriginal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  discountRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  discountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  discountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  discountNote: {
    fontSize: 13,
    color: '#059669',
    marginTop: 8,
    textAlign: 'center',
  },
  paymentSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(58, 211, 219, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 2,
    borderColor: '#3ad3db',
  },
  paymentMethodIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  paymentMethodSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  addPaymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
  },
  addPaymentMethodText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  // Coupon Section Styles
  couponSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  couponInputContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  couponInput: {
    flex: 1,
    height: 48,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    letterSpacing: 1,
  },
  couponInputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  applyCouponButton: {
    backgroundColor: '#3ad3db',
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyCouponButtonDisabled: {
    opacity: 0.7,
  },
  applyCouponButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  couponAppliedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  couponAppliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  couponAppliedCode: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
    letterSpacing: 1,
  },
  couponAppliedDiscount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#059669',
    marginLeft: 8,
  },
  removeCouponButton: {
    padding: 4,
  },
  couponErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  couponErrorText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },
  couponHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 10,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  paymentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
  },
  paymentNoteText: {
    fontSize: 13,
    color: '#6B7280',
  },
  termsText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  termsLink: {
    color: '#3ad3db',
    fontWeight: '600',
  },
  
  // Bottom
  bottomContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
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
    paddingHorizontal: 24,
    gap: 8,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
});

export default NewBookingFlowScreen;
