import React, { useState, useRef, useEffect } from 'react';
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
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useRoute, RouteProp } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

type StackParamList = {
  BookingFlow: {
    cleanerId?: string;
    serviceType?: string;
    location?: {
      address: string;
      latitude: number;
      longitude: number;
    };
  };
  BookingConfirmation: {
    bookingId: string;
    service: any;
    cleaner: any;
    address: string;
    scheduledTime: string;
  };
  MainTabs: undefined;
};

type BookingFlowProps = {
  navigation: StackNavigationProp<StackParamList, 'BookingFlow'>;
  route: RouteProp<StackParamList, 'BookingFlow'>;
};

type BookingStep = 'location' | 'service' | 'addons' | 'schedule' | 'payment' | 'review';

interface ServiceOption {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  duration: number;
  popular?: boolean;
}

interface AddOn {
  id: string;
  name: string;
  price: number;
  icon: string;
  description: string;
}

interface TimeSlot {
  id: string;
  time: string;
  label: string;
  available: boolean;
  price?: number; // surge pricing
}

const BookingFlowScreen: React.FC<BookingFlowProps> = ({ navigation, route }) => {
  const { cleanerId, serviceType: initialServiceType, location: initialLocation } = route.params || {};
  
  const [currentStep, setCurrentStep] = useState<BookingStep>('location');
  const [isLoading, setIsLoading] = useState(false);
  const [startTime] = useState(Date.now());
  
  // Form data
  const [location, setLocation] = useState(initialLocation?.address || '');
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [selectedDate, setSelectedDate] = useState('today');
  const [specialInstructions, setSpecialInstructions] = useState('');
  
  // Animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const services: ServiceOption[] = [
    {
      id: 'express',
      name: 'Express Clean',
      description: 'Quick maintenance clean',
      basePrice: 45,
      duration: 30,
      popular: true,
    },
    {
      id: 'standard',
      name: 'Standard Clean',
      description: 'Comprehensive cleaning',
      basePrice: 75,
      duration: 90,
      popular: true,
    },
    {
      id: 'deep',
      name: 'Deep Clean',
      description: 'Thorough detailed clean',
      basePrice: 150,
      duration: 180,
    },
  ];

  const addOns: AddOn[] = [
    {
      id: 'inside_fridge',
      name: 'Inside Fridge',
      price: 15,
      icon: 'snow-outline',
      description: 'Clean inside refrigerator',
    },
    {
      id: 'inside_oven',
      name: 'Inside Oven',
      price: 20,
      icon: 'flame-outline',
      description: 'Deep clean oven interior',
    },
    {
      id: 'inside_cabinets',
      name: 'Inside Cabinets',
      price: 25,
      icon: 'file-tray-outline',
      description: 'Organize and clean cabinets',
    },
    {
      id: 'laundry',
      name: 'Laundry',
      price: 10,
      icon: 'shirt-outline',
      description: 'Wash and fold clothes',
    },
  ];

  const timeSlots: TimeSlot[] = [
    { id: '1', time: '9:00 AM', label: 'Morning', available: true },
    { id: '2', time: '11:00 AM', label: 'Late Morning', available: true },
    { id: '3', time: '1:00 PM', label: 'Afternoon', available: false },
    { id: '4', time: '3:00 PM', label: 'Late Afternoon', available: true, price: 5 },
    { id: '5', time: '5:00 PM', label: 'Evening', available: true, price: 10 },
  ];

  useEffect(() => {
    updateProgress();
  }, [currentStep]);

  const updateProgress = () => {
    const steps = ['location', 'service', 'addons', 'schedule', 'payment', 'review'];
    const progress = (steps.indexOf(currentStep) + 1) / steps.length;
    
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const animateStepTransition = () => {
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const calculateTotal = () => {
    if (!selectedService) return 0;
    
    let total = selectedService.basePrice;
    
    // Add-ons
    selectedAddOns.forEach(addonId => {
      const addon = addOns.find(a => a.id === addonId);
      if (addon) total += addon.price;
    });
    
    // Time slot surge pricing
    if (selectedTimeSlot?.price) {
      total += selectedTimeSlot.price;
    }
    
    return total;
  };

  const getElapsedTime = () => {
    return Math.round((Date.now() - startTime) / 1000);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'location':
        return location.trim().length > 0;
      case 'service':
        return selectedService !== null;
      case 'addons':
        return true; // Optional step
      case 'schedule':
        return selectedTimeSlot !== null;
      case 'payment':
        return true; // Assume payment method is selected
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canProceed()) return;
    
    animateStepTransition();
    
    const steps: BookingStep[] = ['location', 'service', 'addons', 'schedule', 'payment', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    } else {
      handleBookingComplete();
    }
  };

  const handleBack = () => {
    const steps: BookingStep[] = ['location', 'service', 'addons', 'schedule', 'payment', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex > 0) {
      animateStepTransition();
      setCurrentStep(steps[currentIndex - 1]);
    } else {
      navigation.goBack();
    }
  };

  const handleBookingComplete = async () => {
    setIsLoading(true);
    
    try {
      // Simulate booking creation
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const elapsedTime = getElapsedTime();
      
      // Navigate to confirmation
      navigation.replace('BookingConfirmation', {
        bookingId: 'booking-' + Date.now(),
        service: {
          title: selectedService?.name || 'Service',
          duration: `${selectedService?.duration || 0} min`,
          price: calculateTotal(),
        },
        cleaner: {
          id: cleanerId || '1',
          name: 'Sarah Martinez',
          avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
          rating: 4.9,
          eta: '15 min',
        },
        address: location,
        scheduledTime: `${selectedDate === 'today' ? 'Today' : 'Tomorrow'} at ${selectedTimeSlot?.time || ''}`,
      });
      
      // Show success message with timing
      if (elapsedTime <= 60) {
        Alert.alert('🎉 Amazing!', `Booking completed in ${elapsedTime} seconds!`);
      }
      
    } catch (error) {
      Alert.alert('Error', 'Failed to create booking. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBackground}>
        <Animated.View 
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.progressText}>
        {getElapsedTime()}s • Step {['location', 'service', 'addons', 'schedule', 'payment', 'review'].indexOf(currentStep) + 1} of 6
      </Text>
    </View>
  );

  const renderLocationStep = () => (
    <Animated.View style={[styles.stepContainer, { opacity: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
      <Text style={styles.stepTitle}>Where should we clean?</Text>
      <Text style={styles.stepSubtitle}>Enter your address for accurate pricing</Text>
      
      <View style={styles.locationContainer}>
        <View style={styles.inputWrapper}>
          <Ionicons name="location-outline" size={20} color="#6B7280" />
          <TextInput
            style={styles.locationInput}
            placeholder="123 Main St, San Francisco, CA"
            placeholderTextColor="#9CA3AF"
            value={location}
            onChangeText={setLocation}
            autoFocus
          />
        </View>
        
        <TouchableOpacity style={styles.currentLocationButton}>
          <Ionicons name="navigate" size={16} color="#3ad3db" />
          <Text style={styles.currentLocationText}>Use current location</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.recentAddresses}>
        <Text style={styles.recentTitle}>Recent addresses</Text>
        {['123 Home St, SF', '456 Work Ave, SF'].map((addr, index) => (
          <TouchableOpacity 
            key={index}
            style={styles.recentAddress}
            onPress={() => setLocation(addr)}
          >
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.recentAddressText}>{addr}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderServiceStep = () => (
    <Animated.View style={[styles.stepContainer, { opacity: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
      <Text style={styles.stepTitle}>Choose your service</Text>
      <Text style={styles.stepSubtitle}>What type of cleaning do you need?</Text>
      
      <View style={styles.servicesContainer}>
        {services.map((service) => (
          <TouchableOpacity
            key={service.id}
            style={[
              styles.serviceCard,
              selectedService?.id === service.id && styles.selectedServiceCard,
            ]}
            onPress={() => setSelectedService(service)}
          >
            {service.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularText}>Popular</Text>
              </View>
            )}
            
            <View style={styles.serviceHeader}>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.servicePrice}>${service.basePrice}</Text>
            </View>
            
            <Text style={styles.serviceDescription}>{service.description}</Text>
            <Text style={styles.serviceDuration}>{service.duration} minutes</Text>
            
            {selectedService?.id === service.id && (
              <View style={styles.selectedIndicator}>
                <Ionicons name="checkmark-circle" size={24} color="#3ad3db" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );

  const renderAddOnsStep = () => (
    <Animated.View style={[styles.stepContainer, { opacity: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
      <Text style={styles.stepTitle}>Any extras?</Text>
      <Text style={styles.stepSubtitle}>Add specialized cleaning services</Text>
      
      <View style={styles.addOnsContainer}>
        {addOns.map((addon) => (
          <TouchableOpacity
            key={addon.id}
            style={[
              styles.addonCard,
              selectedAddOns.includes(addon.id) && styles.selectedAddonCard,
            ]}
            onPress={() => {
              if (selectedAddOns.includes(addon.id)) {
                setSelectedAddOns(selectedAddOns.filter(id => id !== addon.id));
              } else {
                setSelectedAddOns([...selectedAddOns, addon.id]);
              }
            }}
          >
            <View style={styles.addonHeader}>
              <Ionicons name={addon.icon as any} size={24} color="#3ad3db" />
              <View style={styles.addonInfo}>
                <Text style={styles.addonName}>{addon.name}</Text>
                <Text style={styles.addonDescription}>{addon.description}</Text>
              </View>
              <Text style={styles.addonPrice}>+${addon.price}</Text>
            </View>
            
            {selectedAddOns.includes(addon.id) && (
              <View style={styles.addonSelected}>
                <Ionicons name="checkmark-circle" size={20} color="#3ad3db" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity style={styles.skipButton}>
        <Text style={styles.skipButtonText}>Skip - no extras needed</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderScheduleStep = () => (
    <Animated.View style={[styles.stepContainer, { opacity: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
      <Text style={styles.stepTitle}>When works for you?</Text>
      <Text style={styles.stepSubtitle}>Choose your preferred time</Text>
      
      <View style={styles.dateSelector}>
        <TouchableOpacity
          style={[styles.dateButton, selectedDate === 'today' && styles.selectedDateButton]}
          onPress={() => setSelectedDate('today')}
        >
          <Text style={[styles.dateButtonText, selectedDate === 'today' && styles.selectedDateButtonText]}>
            Today
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dateButton, selectedDate === 'tomorrow' && styles.selectedDateButton]}
          onPress={() => setSelectedDate('tomorrow')}
        >
          <Text style={[styles.dateButtonText, selectedDate === 'tomorrow' && styles.selectedDateButtonText]}>
            Tomorrow
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.timeSlotsContainer}>
        {timeSlots.map((slot) => (
          <TouchableOpacity
            key={slot.id}
            style={[
              styles.timeSlot,
              !slot.available && styles.unavailableTimeSlot,
              selectedTimeSlot?.id === slot.id && styles.selectedTimeSlot,
            ]}
            onPress={() => slot.available && setSelectedTimeSlot(slot)}
            disabled={!slot.available}
          >
            <Text style={[
              styles.timeSlotTime,
              !slot.available && styles.unavailableText,
              selectedTimeSlot?.id === slot.id && styles.selectedTimeSlotText,
            ]}>
              {slot.time}
            </Text>
            <Text style={[
              styles.timeSlotLabel,
              !slot.available && styles.unavailableText,
              selectedTimeSlot?.id === slot.id && styles.selectedTimeSlotText,
            ]}>
              {slot.label}
            </Text>
            {slot.price && (
              <Text style={[styles.surgePrice, selectedTimeSlot?.id === slot.id && styles.selectedTimeSlotText]}>
                +${slot.price}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
      
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsLabel}>Special instructions (optional)</Text>
        <TextInput
          style={styles.instructionsInput}
          placeholder="Any specific requests or notes..."
          placeholderTextColor="#9CA3AF"
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          numberOfLines={3}
        />
      </View>
    </Animated.View>
  );

  const renderPaymentStep = () => (
    <Animated.View style={[styles.stepContainer, { opacity: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
      <Text style={styles.stepTitle}>Payment method</Text>
      <Text style={styles.stepSubtitle}>Choose how you'd like to pay</Text>
      
      <View style={styles.paymentMethods}>
        <TouchableOpacity style={styles.paymentMethod}>
          <View style={styles.paymentMethodIcon}>
            <Ionicons name="card" size={24} color="#3ad3db" />
          </View>
          <View style={styles.paymentMethodInfo}>
            <Text style={styles.paymentMethodName}>Credit Card</Text>
            <Text style={styles.paymentMethodDetails}>•••• 4242</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.addPaymentMethod}>
          <Ionicons name="add-circle-outline" size={24} color="#3ad3db" />
          <Text style={styles.addPaymentMethodText}>Add payment method</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.paymentSummary}>
        <Text style={styles.summaryTitle}>Payment Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Service</Text>
          <Text style={styles.summaryValue}>${selectedService?.basePrice || 0}</Text>
        </View>
        {selectedAddOns.map(addonId => {
          const addon = addOns.find(a => a.id === addonId);
          return addon ? (
            <View key={addon.id} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{addon.name}</Text>
              <Text style={styles.summaryValue}>+${addon.price}</Text>
            </View>
          ) : null;
        })}
        {selectedTimeSlot?.price && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Peak time</Text>
            <Text style={styles.summaryValue}>+${selectedTimeSlot.price}</Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>${calculateTotal()}</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderReviewStep = () => (
    <Animated.View style={[styles.stepContainer, { opacity: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
      <Text style={styles.stepTitle}>Review & Book</Text>
      <Text style={styles.stepSubtitle}>Confirm your cleaning service</Text>
      
      <View style={styles.reviewContainer}>
        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>Service Details</Text>
          <Text style={styles.reviewText}>{selectedService?.name}</Text>
          <Text style={styles.reviewSubtext}>{selectedService?.duration} minutes</Text>
        </View>
        
        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>Location</Text>
          <Text style={styles.reviewText}>{location}</Text>
        </View>
        
        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>Schedule</Text>
          <Text style={styles.reviewText}>
            {selectedDate === 'today' ? 'Today' : 'Tomorrow'} at {selectedTimeSlot?.time}
          </Text>
        </View>
        
        {selectedAddOns.length > 0 && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionTitle}>Add-ons</Text>
            {selectedAddOns.map(addonId => {
              const addon = addOns.find(a => a.id === addonId);
              return addon ? (
                <Text key={addon.id} style={styles.reviewText}>{addon.name}</Text>
              ) : null;
            })}
          </View>
        )}
        
        <View style={[styles.reviewSection, styles.totalSection]}>
          <Text style={styles.reviewSectionTitle}>Total</Text>
          <Text style={styles.reviewTotal}>${calculateTotal()}</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'location': return renderLocationStep();
      case 'service': return renderServiceStep();
      case 'addons': return renderAddOnsStep();
      case 'schedule': return renderScheduleStep();
      case 'payment': return renderPaymentStep();
      case 'review': return renderReviewStep();
      default: return renderLocationStep();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView 
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quick Booking</Text>
          <TouchableOpacity onPress={() => navigation.navigate('MainTabs')}>
            <Text style={styles.exitText}>Exit</Text>
          </TouchableOpacity>
        </View>

        {renderProgressBar()}

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderCurrentStep()}
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[
              styles.nextButton,
              !canProceed() && styles.disabledButton,
            ]}
            onPress={handleNext}
            disabled={!canProceed() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>
                  {currentStep === 'review' ? 'Book Now' : 'Continue'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
  exitText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressBackground: {
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
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  stepContainer: {
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
  },
  locationContainer: {
    marginBottom: 32,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 16,
  },
  locationInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 12,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  currentLocationText: {
    fontSize: 14,
    color: '#3ad3db',
    fontWeight: '500',
    marginLeft: 8,
  },
  recentAddresses: {
    marginTop: 24,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  recentAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 8,
  },
  recentAddressText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 12,
  },
  servicesContainer: {
    gap: 16,
  },
  serviceCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  selectedServiceCard: {
    borderColor: '#3ad3db',
    backgroundColor: '#F0FDFA',
  },
  popularBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  servicePrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3ad3db',
  },
  serviceDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  serviceDuration: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  selectedIndicator: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  addOnsContainer: {
    gap: 12,
  },
  addonCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  selectedAddonCard: {
    borderColor: '#3ad3db',
    backgroundColor: '#F0FDFA',
  },
  addonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addonInfo: {
    flex: 1,
    marginLeft: 16,
  },
  addonName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  addonDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  addonPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3ad3db',
  },
  addonSelected: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 16,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  dateSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  dateButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedDateButton: {
    backgroundColor: '#3ad3db',
    borderColor: '#3ad3db',
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  selectedDateButtonText: {
    color: '#FFFFFF',
  },
  timeSlotsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  timeSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedTimeSlot: {
    backgroundColor: '#3ad3db',
    borderColor: '#3ad3db',
  },
  unavailableTimeSlot: {
    backgroundColor: '#F3F4F6',
    opacity: 0.5,
  },
  timeSlotTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  timeSlotLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  selectedTimeSlotText: {
    color: '#FFFFFF',
  },
  unavailableText: {
    color: '#9CA3AF',
  },
  surgePrice: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  instructionsContainer: {
    marginTop: 24,
  },
  instructionsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  instructionsInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    fontSize: 14,
    color: '#1F2937',
    textAlignVertical: 'top',
  },
  paymentMethods: {
    gap: 12,
    marginBottom: 32,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  paymentMethodIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  paymentMethodDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  addPaymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#3ad3db',
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  addPaymentMethodText: {
    fontSize: 14,
    color: '#3ad3db',
    fontWeight: '500',
    marginLeft: 8,
  },
  paymentSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3ad3db',
  },
  reviewContainer: {
    gap: 24,
  },
  reviewSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  reviewSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  reviewSubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewTotal: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3ad3db',
  },
  bottomActions: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  nextButton: {
    backgroundColor: '#3ad3db',
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledButton: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default BookingFlowScreen; 