import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useBooking } from '../../hooks/useBooking';
import { useAuth } from '../../hooks/useAuth';
import { BookingFlow } from '../../components/BookingFlow';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../utils/constants';
import { Cleaner, Address } from '../../types/user';
import { ServiceType } from '../../types/booking';

const { width: screenWidth } = Dimensions.get('window');

interface BookingScreenProps {
  route: {
    params?: {
      selectedCleaner?: Cleaner;
      selectedAddress?: Address;
      selectedService?: ServiceType;
    };
  };
  navigation: any;
}

export const BookingScreen: React.FC<BookingScreenProps> = ({ route, navigation }) => {
  // Hooks
  const { user } = useAuth();
  const booking = useBooking();
  
  // Animation values
  const progressAnimation = new Animated.Value(0);
  const urgencyAnimation = new Animated.Value(0);
  
  // State
  const [showTimeWarning, setShowTimeWarning] = useState(false);

  // Initialize booking with route params
  useEffect(() => {
    booking.startBookingFlow();
    
    const { selectedCleaner, selectedAddress, selectedService } = route.params || {};
    
    if (selectedCleaner) {
      booking.setSelectedCleaner(selectedCleaner);
    }
    if (selectedAddress) {
      booking.setSelectedAddress(selectedAddress);
    }
    if (selectedService) {
      booking.setSelectedService(selectedService);
    }
  }, [route.params]);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnimation, {
      toValue: booking.progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [booking.progress]);

  // Handle time urgency
  useEffect(() => {
    if (booking.timeUrgency === 'high' && !showTimeWarning) {
      setShowTimeWarning(true);
      Animated.loop(
        Animated.sequence([
          Animated.timing(urgencyAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(urgencyAnimation, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [booking.timeUrgency, showTimeWarning]);

  // Handle booking completion
  const handleBookingComplete = useCallback(async (paymentMethodId: string) => {
    if (!user) {
      Alert.alert('Error', 'Please sign in to complete booking');
      return;
    }

    const response = await booking.createBooking(user.id, paymentMethodId);
    
    if (response.success) {
      const elapsedTime = booking.elapsedTime;
      const successMessage = elapsedTime <= 60 
        ? `🎉 Amazing! Booked in ${elapsedTime} seconds!`
        : `✅ Booking confirmed in ${elapsedTime} seconds`;
      
      Alert.alert(
        'Booking Confirmed!',
        successMessage,
        [
          {
            text: 'Track Cleaner',
            onPress: () => navigation.navigate('TrackingScreen', { 
              bookingId: response.data.booking.id 
            }),
          },
        ]
      );
    } else {
      Alert.alert('Booking Failed', response.error || 'Please try again');
    }
  }, [user, booking, navigation]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (booking.currentStep > 1) {
      booking.previousStep();
    } else {
      Alert.alert(
        'Exit Booking',
        'Are you sure you want to exit? Your progress will be lost.',
        [
          { text: 'Continue Booking', style: 'cancel' },
          { 
            text: 'Exit', 
            style: 'destructive',
            onPress: () => {
              booking.resetBooking();
              navigation.goBack();
            }
          },
        ]
      );
    }
  }, [booking, navigation]);

  // Get time display color
  const getTimeDisplayColor = () => {
    switch (booking.timeUrgency) {
      case 'high':
        return COLORS.error;
      case 'medium':
        return COLORS.warning;
      default:
        return COLORS.text.secondary;
    }
  };

  // Get urgency message
  const getUrgencyMessage = () => {
    if (booking.isTimeExpired) {
      return 'Take your time - quality matters most!';
    }
    
    switch (booking.timeUrgency) {
      case 'high':
        return `⚡ Only ${booking.timeRemaining}s left for the 60-second challenge!`;
      case 'medium':
        return `🚀 ${booking.timeRemaining}s remaining - you're doing great!`;
      default:
        return `⏱️ ${booking.timeRemaining}s left to beat the 60-second booking challenge!`;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Quick Booking</Text>
          <Text style={styles.stepIndicator}>
            Step {booking.currentStep} of {booking.totalSteps}
          </Text>
        </View>
        
        <View style={styles.timerContainer}>
          <Text style={[styles.timerText, { color: getTimeDisplayColor() }]}>
            {booking.elapsedTime}s
          </Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnimation.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                }),
                backgroundColor: booking.timeUrgency === 'high' 
                  ? COLORS.error 
                  : COLORS.primary,
              },
            ]}
          />
        </View>
      </View>

      {/* Time Challenge Banner */}
      {!booking.isTimeExpired && (
        <Animated.View
          style={[
            styles.timeBanner,
            {
              backgroundColor: booking.timeUrgency === 'high' 
                ? COLORS.error 
                : booking.timeUrgency === 'medium'
                ? COLORS.warning
                : COLORS.primary,
              opacity: booking.timeUrgency === 'high' 
                ? urgencyAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  })
                : 1,
            },
          ]}
        >
          <Text style={styles.timeBannerText}>
            {getUrgencyMessage()}
          </Text>
        </Animated.View>
      )}

      {/* Main Content */}
      <View style={styles.content}>
        <BookingFlow
          booking={booking}
          onComplete={handleBookingComplete}
          onError={(error) => Alert.alert('Error', error)}
        />
      </View>

      {/* Quick Actions Footer */}
      <View style={styles.footer}>
        <View style={styles.quickStats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {booking.formattedPricing?.total || '$--'}
            </Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          
          {booking.serviceDetails && (
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {booking.serviceDetails.estimated_duration}min
              </Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
          )}
          
          <View style={styles.stat}>
            <Text style={styles.statValue}>
              {booking.progress.toFixed(0)}%
            </Text>
            <Text style={styles.statLabel}>Complete</Text>
          </View>
        </View>

        {/* Navigation Buttons */}
        <View style={styles.navigationButtons}>
          {booking.currentStep > 1 && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={booking.previousStep}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          
          {booking.canProceedToNextStep && booking.currentStep < booking.totalSteps && (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                booking.currentStep === 1 ? styles.fullWidthButton : styles.halfWidthButton,
              ]}
              onPress={booking.nextStep}
            >
              <Text style={styles.primaryButtonText}>
                {booking.currentStep === booking.totalSteps - 1 ? 'Review' : 'Next'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.text.disabled,
  },
  backButton: {
    padding: SPACING.sm,
    marginRight: SPACING.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.text.primary,
  },
  stepIndicator: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  timerContainer: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
  },
  timerText: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.bold,
    fontFamily: 'monospace',
  },
  progressContainer: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.text.disabled,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  timeBanner: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  timeBannerText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  footer: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.text.disabled,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.lg,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.text.primary,
  },
  statLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.text.disabled,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidthButton: {
    flex: 1,
  },
  halfWidthButton: {
    flex: 1,
  },
  primaryButtonText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  secondaryButtonText: {
    color: COLORS.text.primary,
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
});