import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useBooking } from '../hooks/useBooking';
import { useAuth } from '../hooks/useAuth';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SERVICE_TYPES, ADD_ONS } from '../utils/constants';
import { ServiceType, TimeSlot } from '../types/booking';
import { Address } from '../types/user';

const { width: screenWidth } = Dimensions.get('window');

interface BookingFlowProps {
  booking: ReturnType<typeof useBooking>;
  onComplete: (paymentMethodId: string) => void;
  onError: (error: string) => void;
}

export const BookingFlow: React.FC<BookingFlowProps> = ({ booking, onComplete, onError }) => {
  // State for current step
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Auto-load time slots when service and date change
  useEffect(() => {
    if (booking.selectedService && selectedDate) {
      booking.loadAvailableTimeSlots(selectedDate);
    }
  }, [booking.selectedService, selectedDate]);

  // Step 1: Service Selection
  const renderServiceSelection = () => {
    return (
      <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepTitle}>Choose Your Service</Text>
        <Text style={styles.stepSubtitle}>
          Select the type of cleaning that fits your needs
        </Text>

        <View style={styles.serviceGrid}>
          {Object.entries(SERVICE_TYPES).map(([key, service]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.serviceCard,
                booking.selectedService === key && styles.serviceCardSelected,
              ]}
              onPress={() => booking.setSelectedService(key as ServiceType)}
              activeOpacity={0.7}
            >
              <View style={styles.serviceHeader}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.servicePrice}>${service.base_price}</Text>
              </View>
              
              <Text style={styles.serviceDuration}>~{service.estimated_duration} min</Text>
              <Text style={styles.serviceDescription}>{service.description}</Text>
              
              <Text style={styles.tasksLabel}>Includes:</Text>
              <View style={styles.tasksList}>
                {service.included_tasks.slice(0, 3).map((task, index) => (
                  <Text key={index} style={styles.taskItem}>• {task}</Text>
                ))}
                {service.included_tasks.length > 3 && (
                  <Text style={styles.taskMore}>
                    +{service.included_tasks.length - 3} more
                  </Text>
                )}
              </View>

              {booking.selectedService === key && (
                <View style={styles.selectedIndicator}>
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Add-ons */}
        {booking.selectedService && (
          <View style={styles.addOnsSection}>
            <Text style={styles.sectionTitle}>Add Extra Services</Text>
            <View style={styles.addOnsList}>
              {ADD_ONS.map((addOn) => (
                <TouchableOpacity
                  key={addOn.id}
                  style={[
                    styles.addOnCard,
                    booking.selectedAddOns.includes(addOn.id) && styles.addOnCardSelected,
                  ]}
                  onPress={() => booking.toggleAddOn(addOn.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.addOnContent}>
                    <View style={styles.addOnInfo}>
                      <Text style={styles.addOnName}>{addOn.name}</Text>
                      <Text style={styles.addOnDescription}>{addOn.description}</Text>
                      <Text style={styles.addOnTime}>+{addOn.estimated_time_minutes} min</Text>
                    </View>
                    <View style={styles.addOnPrice}>
                      <Text style={styles.addOnPriceText}>+${addOn.price}</Text>
                    </View>
                  </View>
                  
                  {booking.selectedAddOns.includes(addOn.id) && (
                    <View style={styles.addOnSelected}>
                      <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  // Step 2: Address and Time Selection
  const renderTimeSelection = () => {
    const today = new Date();
    const dates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      return date;
    });

    return (
      <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepTitle}>Choose Date & Time</Text>
        <Text style={styles.stepSubtitle}>
          Select when you'd like your cleaning service
        </Text>

        {/* Date Selection */}
        <View style={styles.dateSection}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datesList}>
            {dates.map((date) => {
              const dateString = date.toISOString().split('T')[0];
              const isSelected = selectedDate === dateString;
              const isToday = date.toDateString() === today.toDateString();
              const isTomorrow = date.toDateString() === new Date(today.getTime() + 24 * 60 * 60 * 1000).toDateString();
              
              return (
                <TouchableOpacity
                  key={dateString}
                  style={[styles.dateCard, isSelected && styles.dateCardSelected]}
                  onPress={() => setSelectedDate(dateString)}
                >
                  <Text style={[styles.dateDayName, isSelected && styles.dateSelectedText]}>
                    {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : date.toLocaleDateString('en', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dateNumber, isSelected && styles.dateSelectedText]}>
                    {date.getDate()}
                  </Text>
                  <Text style={[styles.dateMonth, isSelected && styles.dateSelectedText]}>
                    {date.toLocaleDateString('en', { month: 'short' })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Time Slots */}
        <View style={styles.timeSection}>
          <Text style={styles.sectionTitle}>Available Times</Text>
          
          {booking.isLoadingTimeSlots ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading available times...</Text>
            </View>
          ) : booking.availableTimeSlots.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={32} color={COLORS.text.disabled} />
              <Text style={styles.emptyText}>No available times for this date</Text>
              <Text style={styles.emptySubtext}>Try selecting a different date</Text>
            </View>
          ) : (
            <View style={styles.timeSlotsGrid}>
              {booking.availableTimeSlots.map((slot, index) => {
                const time = new Date(slot.datetime);
                const isSelected = booking.selectedTimeSlot?.datetime === slot.datetime;
                const isPeakTime = slot.price_modifier && slot.price_modifier > 1;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.timeSlot,
                      isSelected && styles.timeSlotSelected,
                      isPeakTime ? styles.timeSlotPeak : undefined,
                    ]}
                    onPress={() => booking.setSelectedTimeSlot(slot)}
                  >
                    <Text style={[
                      styles.timeSlotText,
                      isSelected && styles.timeSlotSelectedText,
                    ]}>
                      {time.toLocaleTimeString('en', { 
                        hour: 'numeric', 
                        minute: '2-digit',
                        hour12: true 
                      })}
                    </Text>
                    {isPeakTime && (
                      <Text style={styles.peakIndicator}>Peak</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Special Instructions */}
        <View style={styles.instructionsSection}>
          <Text style={styles.sectionTitle}>Special Instructions (Optional)</Text>
          <TextInput
            style={styles.instructionsInput}
            placeholder="Any special requests or instructions for your cleaner..."
            value={booking.specialInstructions}
            onChangeText={booking.setSpecialInstructions}
            multiline
            numberOfLines={3}
            maxLength={500}
          />
          <Text style={styles.characterCount}>
            {booking.specialInstructions.length}/500
          </Text>
        </View>
      </ScrollView>
    );
  };

  // Step 3: Review and Payment
  const renderReviewAndPayment = () => {
    const handlePayment = async () => {
      setIsProcessingPayment(true);
      
      try {
        // Mock payment processing - replace with actual Stripe integration
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const mockPaymentMethodId = 'pm_mock_payment_method';
        onComplete(mockPaymentMethodId);
      } catch (error) {
        onError('Payment failed. Please try again.');
      } finally {
        setIsProcessingPayment(false);
      }
    };

    return (
      <ScrollView style={styles.stepContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.stepTitle}>Review & Confirm</Text>
        <Text style={styles.stepSubtitle}>
          Please review your booking details
        </Text>

        {/* Cleaner Info */}
        {booking.selectedCleaner && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionTitle}>Your Cleaner</Text>
            <View style={styles.cleanerInfo}>
              <Image 
                source={{ uri: booking.selectedCleaner.avatar_url || 'https://via.placeholder.com/50' }}
                style={styles.cleanerAvatar}
              />
              <View style={styles.cleanerDetails}>
                <Text style={styles.cleanerName}>{booking.selectedCleaner.name}</Text>
                <View style={styles.cleanerRating}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.ratingText}>
                    {booking.selectedCleaner.rating_average.toFixed(1)} • {booking.selectedCleaner.total_jobs} jobs
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Service Details */}
        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>Service Details</Text>
          <View style={styles.serviceDetails}>
            <Text style={styles.serviceDetailName}>
              {booking.serviceDetails?.name}
            </Text>
            <Text style={styles.serviceDetailTime}>
              {booking.selectedTimeSlot && new Date(booking.selectedTimeSlot.datetime).toLocaleDateString('en', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
            <Text style={styles.serviceDetailDuration}>
              Estimated duration: {booking.serviceDetails?.estimated_duration} minutes
            </Text>
            
            {booking.selectedAddOnsDetails.length > 0 && (
              <View style={styles.addOnsReview}>
                <Text style={styles.addOnsReviewTitle}>Add-ons:</Text>
                {booking.selectedAddOnsDetails.map((addOn) => (
                  <Text key={addOn.id} style={styles.addOnReviewItem}>
                    • {addOn.name} (+${addOn.price})
                  </Text>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Pricing Breakdown */}
        {booking.formattedPricing && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewSectionTitle}>Pricing</Text>
            <View style={styles.pricingBreakdown}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Service</Text>
                <Text style={styles.priceValue}>
                  ${(parseFloat(booking.formattedPricing.subtotal) - parseFloat(booking.formattedPricing.platformFee) - parseFloat(booking.formattedPricing.tax)).toFixed(2)}
                </Text>
              </View>
              
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Platform fee</Text>
                <Text style={styles.priceValue}>${booking.formattedPricing.platformFee}</Text>
              </View>
              
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Tax</Text>
                <Text style={styles.priceValue}>${booking.formattedPricing.tax}</Text>
              </View>
              
              {parseFloat(booking.formattedPricing.tip) > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Tip</Text>
                  <Text style={styles.priceValue}>${booking.formattedPricing.tip}</Text>
                </View>
              )}
              
              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${booking.formattedPricing.total}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Payment Button */}
        <View style={styles.paymentSection}>
          <TouchableOpacity
            style={[styles.paymentButton, isProcessingPayment && styles.paymentButtonDisabled]}
            onPress={handlePayment}
            disabled={isProcessingPayment}
          >
            {isProcessingPayment ? (
              <ActivityIndicator size="small" color={COLORS.text.inverse} />
            ) : (
              <Text style={styles.paymentButtonText}>
                Confirm & Pay ${booking.formattedPricing?.total}
              </Text>
            )}
          </TouchableOpacity>
          
          <Text style={styles.paymentNote}>
            You'll be charged when the service is completed
          </Text>
        </View>
      </ScrollView>
    );
  };

  // Render current step
  const renderCurrentStep = () => {
    switch (booking.currentStep) {
      case 1:
        return renderServiceSelection();
      case 2:
        return renderTimeSelection();
      case 3:
        return renderReviewAndPayment();
      default:
        return renderServiceSelection();
    }
  };

  return (
    <View style={styles.container}>
      {renderCurrentStep()}
      
      {booking.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{booking.error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  stepTitle: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  stepSubtitle: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xl,
    lineHeight: TYPOGRAPHY.lineHeights.relaxed * TYPOGRAPHY.sizes.base,
  },
  
  // Service Selection Styles
  serviceGrid: {
    gap: SPACING.md,
  },
  serviceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  serviceCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  serviceName: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.text.primary,
  },
  servicePrice: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.primary,
  },
  serviceDuration: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
  },
  serviceDescription: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING.md,
    lineHeight: TYPOGRAPHY.lineHeights.normal * TYPOGRAPHY.sizes.base,
  },
  tasksLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  tasksList: {
    gap: 2,
  },
  taskItem: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
  },
  taskMore: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.disabled,
    fontStyle: 'italic',
  },
  selectedIndicator: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
  },
  
  // Add-ons Styles
  addOnsSection: {
    marginTop: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  addOnsList: {
    gap: SPACING.sm,
  },
  addOnCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.text.disabled,
    position: 'relative',
  },
  addOnCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  addOnContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  addOnInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  addOnName: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  addOnDescription: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  addOnTime: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.text.disabled,
  },
  addOnPrice: {
    alignItems: 'flex-end',
  },
  addOnPriceText: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.primary,
  },
  addOnSelected: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Date & Time Selection Styles
  dateSection: {
    marginBottom: SPACING.xl,
  },
  datesList: {
    paddingVertical: SPACING.sm,
  },
  dateCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginRight: SPACING.sm,
    alignItems: 'center',
    minWidth: 70,
    borderWidth: 1,
    borderColor: COLORS.text.disabled,
  },
  dateCardSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dateDayName: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  dateNumber: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  dateMonth: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
  },
  dateSelectedText: {
    color: COLORS.text.inverse,
  },
  
  timeSection: {
    marginBottom: SPACING.xl,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  timeSlot: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.text.disabled,
    minWidth: 80,
    alignItems: 'center',
  },
  timeSlotSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  timeSlotPeak: {
    borderColor: COLORS.warning,
  },
  timeSlotText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: COLORS.text.primary,
  },
  timeSlotSelectedText: {
    color: COLORS.text.inverse,
  },
  peakIndicator: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.warning,
    marginTop: 2,
  },
  
  instructionsSection: {
    marginBottom: SPACING.xl,
  },
  instructionsInput: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    borderWidth: 1,
    borderColor: COLORS.text.disabled,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  characterCount: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.text.disabled,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
  
  // Review Styles
  reviewSection: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  reviewSectionTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  cleanerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cleanerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: SPACING.md,
  },
  cleanerDetails: {
    flex: 1,
  },
  cleanerName: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  cleanerRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    marginLeft: SPACING.xs,
  },
  serviceDetails: {},
  serviceDetailName: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  serviceDetailTime: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  serviceDetailDuration: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
  },
  addOnsReview: {
    marginTop: SPACING.md,
  },
  addOnsReviewTitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  addOnReviewItem: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
  },
  
  // Pricing Styles
  pricingBreakdown: {},
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  priceLabel: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
  },
  priceValue: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.text.disabled,
    marginTop: SPACING.sm,
    paddingTop: SPACING.md,
  },
  totalLabel: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.text.primary,
  },
  totalValue: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.primary,
  },
  
  // Payment Styles
  paymentSection: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  paymentButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  paymentButtonDisabled: {
    backgroundColor: COLORS.text.disabled,
  },
  paymentButtonText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  paymentNote: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  
  // Loading and Empty States
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    marginTop: SPACING.md,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  
  // Error State
  errorContainer: {
    backgroundColor: COLORS.error,
    padding: SPACING.md,
    margin: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
  },
  errorText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.base,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.weights.medium,
  },
});