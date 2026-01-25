import React, { useState } from 'react';
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
  Animated,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';

type StackParamList = {
  TipAndReview: { 
    bookingId: string;
    cleanerId: string;
    cleanerName: string;
    cleanerPhoto: string;
    serviceTitle: string;
    serviceCost: number;
  };
};

type TipAndReviewScreenNavigationProp = StackNavigationProp<StackParamList, 'TipAndReview'>;

interface TipAndReviewScreenProps {
  navigation: TipAndReviewScreenNavigationProp;
  route: {
    params: {
      bookingId: string;
      cleanerId: string;
      cleanerName: string;
      cleanerPhoto: string;
      serviceTitle: string;
      serviceCost: number;
    };
  };
}

const TipAndReviewScreen: React.FC<TipAndReviewScreenProps> = ({ navigation, route }) => {
  const { bookingId, cleanerId, cleanerName, cleanerPhoto, serviceTitle, serviceCost } = route.params;
  
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [tipAmount, setTipAmount] = useState(() => Math.round((serviceCost * 20) / 100));
  const [customTip, setCustomTip] = useState('');
  const [selectedTipType, setSelectedTipType] = useState<'percentage' | 'fixed'>('percentage');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  // Predefined tip options
  const percentageTips = [15, 18, 20, 25];
  const fixedTips = [5, 10, 15, 20];

  const calculateTipAmount = (percentage: number) => {
    return Math.round((serviceCost * percentage) / 100);
  };

  const formatCurrency = (value: number) => {
    return value.toFixed(2);
  };

  const handleRatingPress = (selectedRating: number) => {
    setRating(selectedRating);
  };

  const handleTipSelection = (amount: number, type: 'percentage' | 'fixed') => {
    setSelectedTipType(type);
    if (type === 'percentage') {
      setTipAmount(calculateTipAmount(amount));
    } else {
      setTipAmount(amount);
    }
    setCustomTip('');
  };

  const handleCustomTip = (value: string) => {
    setCustomTip(value);
    const numericValue = parseFloat(value) || 0;
    setTipAmount(numericValue);
    setSelectedTipType('fixed');
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please provide a rating for your cleaner.');
      return;
    }

    if (review.trim().length < 10) {
      Alert.alert('Review Too Short', 'Please write at least 10 characters for your review.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      setShowThankYou(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to submit review and tip. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleNextClean = () => {
    setShowThankYou(false);
    navigation.navigate('NewBookingFlow' as any, {
      cleanerId,
      serviceType: serviceTitle,
      basePrice: serviceCost,
    });
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => handleRatingPress(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={40}
              color={star <= rating ? '#FFD700' : '#D1D5DB'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderTipOptions = () => {
    return (
      <View style={styles.tipOptionsContainer}>
        {/* Percentage Tips */}
        <Text style={styles.tipSectionTitle}>Percentage Tips</Text>
        <View style={styles.tipButtonsRow}>
          {percentageTips.map((percentage) => {
            const amount = calculateTipAmount(percentage);
            const isSelected = selectedTipType === 'percentage' && tipAmount === amount;
            return (
              <TouchableOpacity
                key={percentage}
                style={[styles.tipButton, isSelected && styles.selectedTipButton]}
                onPress={() => handleTipSelection(percentage, 'percentage')}
              >
                <Text style={[styles.tipButtonText, isSelected && styles.selectedTipButtonText]}>
                  {percentage}%
                </Text>
                <Text style={[styles.tipAmountText, isSelected && styles.selectedTipAmountText]}>
                  ${amount}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Fixed Amount Tips */}
        <Text style={styles.tipSectionTitle}>Fixed Amount</Text>
        <View style={styles.tipButtonsRow}>
          {fixedTips.map((amount) => {
            const isSelected = selectedTipType === 'fixed' && tipAmount === amount;
            return (
              <TouchableOpacity
                key={amount}
                style={[styles.tipButton, isSelected && styles.selectedTipButton]}
                onPress={() => handleTipSelection(amount, 'fixed')}
              >
                <Text style={[styles.tipButtonText, isSelected && styles.selectedTipButtonText]}>
                  ${amount}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom Tip */}
        <Text style={styles.tipSectionTitle}>Custom Amount</Text>
        <View style={styles.customTipContainer}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={styles.customTipInput}
            value={customTip}
            onChangeText={handleCustomTip}
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate & Tip</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Service Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.cleanerInfo}>
            <Image source={{ uri: cleanerPhoto }} style={styles.cleanerPhoto} />
            <View style={styles.cleanerDetails}>
              <Text style={styles.cleanerName}>{cleanerName}</Text>
              <Text style={styles.serviceTitle}>{serviceTitle}</Text>
              <Text style={styles.serviceCost}>Service Cost: ${formatCurrency(serviceCost)}</Text>
            </View>
          </View>
        </View>

        {/* Rating Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How was your experience?</Text>
          <Text style={styles.sectionSubtitle}>Rate your cleaner's service</Text>
          {renderStars()}
          {rating > 0 && (
            <Text style={styles.ratingText}>
              {rating === 5 ? 'Excellent!' : rating === 4 ? 'Great!' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Needs Improvement'}
            </Text>
          )}
        </View>

        {/* Review Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Leave a Review</Text>
          <Text style={styles.sectionSubtitle}>Share your experience to help other customers</Text>
          <TextInput
            style={styles.reviewInput}
            value={review}
            onChangeText={setReview}
            placeholder="Describe your experience with the cleaning service..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Text style={styles.characterCount}>{review.length}/500 characters</Text>
        </View>

        {/* Tip Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add a Tip (Optional)</Text>
          <Text style={styles.sectionSubtitle}>Show your appreciation for excellent service</Text>
          {renderTipOptions()}
          
          {tipAmount > 0 && (
            <View style={styles.tipSummary}>
              <LinearGradient
                colors={['#3ad3db', '#2BC8D4']}
                style={styles.tipSummaryGradient}
              >
                <Ionicons name="heart" size={20} color="#ffffff" />
                <Text style={styles.tipSummaryText}>
                  You're adding a ${tipAmount} tip
                </Text>
              </LinearGradient>
            </View>
          )}
        </View>

        {/* Total Summary */}
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Service Cost:</Text>
            <Text style={styles.totalAmount}>${formatCurrency(serviceCost)}</Text>
          </View>
          {tipAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tip:</Text>
              <Text style={styles.totalAmount}>${formatCurrency(tipAmount)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, styles.finalTotal]}>
            <Text style={styles.finalTotalLabel}>Total:</Text>
            <Text style={styles.finalTotalAmount}>${formatCurrency(serviceCost + tipAmount)}</Text>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity 
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <LinearGradient
            colors={isSubmitting ? ['#9CA3AF', '#6B7280'] : ['#3ad3db', '#2BC8D4']}
            style={styles.submitButtonGradient}
          >
            {isSubmitting ? (
              <Text style={styles.submitButtonText}>Submitting...</Text>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                <Text style={styles.submitButtonText}>Submit Review & Tip</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.bottomSpacing} />
      </ScrollView>
      <Modal transparent visible={showThankYou} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Thank You!</Text>
            <Text style={styles.modalSubtitle}>
              Want {cleanerName || 'your pro'} to come back?
            </Text>
            <TouchableOpacity style={styles.modalPrimaryButton} onPress={handleScheduleNextClean}>
              <Text style={styles.modalPrimaryText}>Schedule Next Clean</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSecondaryButton}
              onPress={() => {
                setShowThankYou(false);
                navigation.goBack();
              }}
            >
              <Text style={styles.modalSecondaryText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cleanerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cleanerPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  cleanerDetails: {
    flex: 1,
  },
  cleanerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  serviceTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  serviceCost: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3ad3db',
  },
  section: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  starButton: {
    padding: 8,
  },
  ratingText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#3ad3db',
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#ffffff',
    height: 120,
  },
  characterCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  tipOptionsContainer: {
    marginTop: 8,
  },
  tipSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    marginTop: 16,
  },
  tipButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tipButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  selectedTipButton: {
    borderColor: '#3ad3db',
    backgroundColor: '#F0FDFA',
  },
  tipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  selectedTipButtonText: {
    color: '#3ad3db',
  },
  tipAmountText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  selectedTipAmountText: {
    color: '#3ad3db',
  },
  customTipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  dollarSign: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginRight: 8,
  },
  customTipInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  tipSummary: {
    marginTop: 16,
  },
  tipSummaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tipSummaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  totalSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  finalTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  finalTotalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  finalTotalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3ad3db',
  },
  submitButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalPrimaryButton: {
    width: '100%',
    backgroundColor: '#26B7C9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSecondaryButton: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalSecondaryText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 32,
  },
});

export default TipAndReviewScreen; 