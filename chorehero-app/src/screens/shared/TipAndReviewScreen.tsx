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
import { wp, hp } from '../../utils/responsive';

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
    navigation.navigate('UnifiedBooking' as any, {
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
              color={star <= rating ? '#E6B200' : '#D1D5DB'}
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
                colors={['#26B7C9', '#047B9B']}
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
            colors={isSubmitting ? ['#9CA3AF', '#6B7280'] : ['#26B7C9', '#047B9B']}
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
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: wp('4.5%'),
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
    borderRadius: wp('3%'),
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
    borderRadius: wp('7.5%'),
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  cleanerDetails: {
    flex: 1,
  },
  cleanerName: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp('0.5%'),
  },
  serviceTitle: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginBottom: hp('0.5%'),
  },
  serviceCost: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#26B7C9',
  },
  section: {
    backgroundColor: '#ffffff',
    marginHorizontal: wp('4%'),
    marginBottom: hp('2%'),
    borderRadius: wp('3%'),
    padding: 20,
  },
  sectionTitle: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp('1%'),
  },
  sectionSubtitle: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginBottom: hp('2.5%'),
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: hp('2%'),
  },
  starButton: {
    padding: 8,
  },
  ratingText: {
    textAlign: 'center',
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#26B7C9',
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: wp('2%'),
    padding: 16,
    fontSize: wp('4%'),
    color: '#1F2937',
    backgroundColor: '#ffffff',
    height: 120,
  },
  characterCount: {
    textAlign: 'right',
    fontSize: wp('3%'),
    color: '#9CA3AF',
    marginTop: hp('1%'),
  },
  tipOptionsContainer: {
    marginTop: hp('1%'),
  },
  tipSectionTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#374151',
    marginBottom: hp('1.5%'),
    marginTop: hp('2%'),
  },
  tipButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp('1%'),
  },
  tipButton: {
    flex: 1,
    marginHorizontal: wp('1%'),
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('2%'),
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: wp('2%'),
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  selectedTipButton: {
    borderColor: '#26B7C9',
    backgroundColor: '#F0FDFA',
  },
  tipButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#374151',
  },
  selectedTipButtonText: {
    color: '#26B7C9',
  },
  tipAmountText: {
    fontSize: wp('3%'),
    color: '#6B7280',
    marginTop: 2,
  },
  selectedTipAmountText: {
    color: '#26B7C9',
  },
  customTipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: wp('2%'),
    paddingHorizontal: wp('4%'),
    backgroundColor: '#ffffff',
  },
  dollarSign: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#374151',
    marginRight: 8,
  },
  customTipInput: {
    flex: 1,
    paddingVertical: hp('1.5%'),
    fontSize: wp('4%'),
    color: '#1F2937',
  },
  tipSummary: {
    marginTop: hp('2%'),
  },
  tipSummaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    borderRadius: wp('2%'),
  },
  tipSummaryText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  totalSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: wp('4%'),
    marginBottom: hp('2%'),
    borderRadius: wp('3%'),
    padding: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
  },
  finalTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: hp('1.5%'),
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: wp('4%'),
    color: '#6B7280',
  },
  totalAmount: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#1F2937',
  },
  finalTotalLabel: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#1F2937',
  },
  finalTotalAmount: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#26B7C9',
  },
  submitButton: {
    marginHorizontal: wp('4%'),
    marginBottom: hp('2%'),
    borderRadius: wp('3%'),
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('6%'),
  },
  submitButtonText: {
    fontSize: wp('4%'),
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
    borderRadius: wp('4%'),
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: '#111827',
    marginBottom: hp('1%'),
  },
  modalSubtitle: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: hp('2.5%'),
  },
  modalPrimaryButton: {
    width: '100%',
    backgroundColor: '#26B7C9',
    paddingVertical: hp('1.5%'),
    borderRadius: wp('3%'),
    alignItems: 'center',
    marginBottom: hp('1.5%'),
  },
  modalPrimaryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSecondaryButton: {
    width: '100%',
    paddingVertical: hp('1.2%'),
    borderRadius: wp('3%'),
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalSecondaryText: {
    color: '#374151',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 32,
  },
});

export default TipAndReviewScreen; 