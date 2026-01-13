import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Animated,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { COLORS, TYPOGRAPHY, SPACING } from '../../utils/constants';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';

type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  ServiceComplete: { bookingId: string; rating: number; review: string };
};

type RatingReviewNavigationProp = BottomTabNavigationProp<TabParamList, any>;

interface RatingReviewProps {
  navigation: RatingReviewNavigationProp;
  route: {
    params: {
      bookingId: string;
      cleaner: {
        id: string;
        name: string;
        avatar: string;
      };
      service: {
        title: string;
        completedAt: string;
      };
    };
  };
}

const { width } = Dimensions.get('window');

const RatingReviewScreen: React.FC<RatingReviewProps> = ({ navigation, route }) => {
  const { bookingId, cleaner, service } = route.params;
  const { user } = useAuth();
  
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const starAnimations = useRef(Array.from({ length: 5 }, () => new Animated.Value(1))).current;
  const submitButtonScale = useRef(new Animated.Value(1)).current;

  const ratingLabels = [
    '',
    'Poor',
    'Fair', 
    'Good',
    'Very Good',
    'Excellent'
  ];

  const reviewPlaceholders = [
    '',
    'What could be improved?',
    'What could have been better?',
    'How was your experience?',
    'What did you like most?',
    'Tell others what made this exceptional!'
  ];

  const handleStarPress = (selectedRating: number) => {
    setRating(selectedRating);
    
    // Animate stars
    starAnimations.forEach((anim, index) => {
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handlePhotoUpload = () => {
    // Mock photo upload
    Alert.alert('Photo Upload', 'Photo upload functionality would be implemented here');
    // Simulate adding a photo
    setPhotos(prev => [...prev, `https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&random=${Date.now()}`]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a rating before submitting.');
      return;
    }

    if (!user?.id) {
      Alert.alert('Error', 'Please log in to submit a review.');
      return;
    }

    setIsSubmitting(true);
    
    // Animate submit button
    Animated.sequence([
      Animated.timing(submitButtonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(submitButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      console.log('📝 Submitting review for booking:', bookingId);

      // Save review to database
      const { data: reviewData, error: reviewError } = await supabase
        .from('reviews')
        .insert({
          booking_id: bookingId,
          reviewer_id: user.id,
          reviewee_id: cleaner?.id,
          rating: rating,
          comment: review.trim() || null,
          review_type: 'customer_to_cleaner',
        })
        .select()
        .single();

      if (reviewError) {
        console.error('❌ Error saving review:', reviewError);
        // If reviews table doesn't exist, try updating booking directly
        if (reviewError.code === 'PGRST204' || reviewError.code === '42P01') {
          console.log('📝 Reviews table not found, updating booking with rating...');
          await supabase
            .from('bookings')
            .update({ 
              customer_rating: rating,
              customer_review: review.trim() || null 
            })
            .eq('id', bookingId);
        } else {
          throw reviewError;
        }
      }

      // Update cleaner's average rating
      if (cleaner?.id) {
        // Get all reviews for this cleaner
        const { data: allReviews } = await supabase
          .from('reviews')
          .select('rating')
          .eq('reviewee_id', cleaner.id);

        if (allReviews && allReviews.length > 0) {
          const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
          
          await supabase
            .from('cleaner_profiles')
            .update({ 
              rating_average: Math.round(avgRating * 10) / 10,
              total_reviews: allReviews.length 
            })
            .eq('user_id', cleaner.id);
        }
      }

      console.log('✅ Review submitted successfully');
      
      setIsSubmitting(false);
      
      Alert.alert(
        'Thank You! 🎉',
        'Your review has been submitted successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

    } catch (error) {
      console.error('❌ Error submitting review:', error);
      setIsSubmitting(false);
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Review?',
      'You can always leave a review later from your booking history.',
      [
        { text: 'Continue', style: 'cancel' },
        { text: 'Skip', onPress: () => navigation.navigate('Bookings') },
      ]
    );
  };

  const canSubmit = rating > 0 && !isSubmitting;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate & Review</Text>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipButton}>Skip</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Service Completed Card */}
        <View style={styles.serviceCard}>
          <BlurView intensity={20} style={styles.serviceCardBlur}>
            <View style={styles.serviceCardContent}>
              <View style={styles.completedHeader}>
                <View style={styles.completedIcon}>
                  <LinearGradient
                    colors={[COLORS.success, '#059669']}
                    style={styles.completedIconGradient}
                  >
                    <Ionicons name="checkmark" size={24} color={COLORS.text.inverse} />
                  </LinearGradient>
                </View>
                <View style={styles.completedInfo}>
                  <Text style={styles.completedTitle}>Service Completed!</Text>
                  <Text style={styles.completedSubtitle}>{service?.title || service?.name || 'Service'}</Text>
                  <Text style={styles.completedTime}>{service.completedAt}</Text>
                </View>
              </View>

              <View style={styles.cleanerInfo}>
                <Image source={{ uri: cleaner.avatar }} style={styles.cleanerAvatar} />
                <View style={styles.cleanerDetails}>
                  <Text style={styles.cleanerName}>{cleaner.name}</Text>
                  <Text style={styles.cleanerLabel}>Your Cleaner</Text>
                </View>
              </View>
            </View>
          </BlurView>
        </View>

        {/* Rating Section */}
        <View style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>How was your experience?</Text>
          <Text style={styles.sectionSubtitle}>Rate your overall satisfaction</Text>
          
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                style={styles.starButton}
                onPress={() => handleStarPress(star)}
                activeOpacity={0.7}
              >
                <Animated.View style={{ transform: [{ scale: starAnimations[star - 1] }] }}>
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color={star <= rating ? '#FFC93C' : COLORS.border}
                  />
                </Animated.View>
              </TouchableOpacity>
            ))}
          </View>

          {rating > 0 && (
            <Text style={styles.ratingLabel}>{ratingLabels[rating]}</Text>
          )}
        </View>

        {/* Review Section */}
        {rating > 0 && (
          <View style={styles.reviewSection}>
            <Text style={styles.sectionTitle}>Share your thoughts</Text>
            <Text style={styles.sectionSubtitle}>Help others by describing your experience</Text>
            
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={review}
                onChangeText={setReview}
                placeholder={reviewPlaceholders[rating]}
                placeholderTextColor={COLORS.text.disabled}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>{review.length}/500</Text>
            </View>
          </View>
        )}

        {/* Photo Upload Section */}
        {rating > 0 && (
          <View style={styles.photoSection}>
            <Text style={styles.sectionTitle}>Add Photos (Optional)</Text>
            <Text style={styles.sectionSubtitle}>Show others the quality of service</Text>
            
            <ScrollView
              horizontal
              style={styles.photosContainer}
              contentContainerStyle={styles.photosContent}
              showsHorizontalScrollIndicator={false}
            >
              <TouchableOpacity style={styles.addPhotoButton} onPress={handlePhotoUpload}>
                <Ionicons name="camera" size={24} color={COLORS.text.secondary} />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>

              {photos.map((photo, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri: photo }} style={styles.uploadedPhoto} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => handleRemovePhoto(index)}
                  >
                    <Ionicons name="close-circle" size={24} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Submit Button */}
      {rating > 0 && (
        <View style={styles.submitContainer}>
          <Animated.View style={{ transform: [{ scale: submitButtonScale }] }}>
            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              <LinearGradient
                colors={canSubmit ? [COLORS.primary, '#E97E0B'] : [COLORS.border, COLORS.border]}
                style={styles.submitButtonGradient}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={COLORS.text.inverse} />
                ) : (
                  <>
                    <Ionicons name="send" size={20} color={COLORS.text.inverse} />
                    <Text style={styles.submitButtonText}>Submit Review</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
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
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
  },
  skipButton: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: SPACING.xxxl,
  },
  serviceCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
    borderRadius: 20,
    overflow: 'hidden',
  },
  serviceCardBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  serviceCardContent: {
    padding: SPACING.lg,
  },
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  completedIcon: {
    marginRight: SPACING.md,
  },
  completedIconGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedInfo: {
    flex: 1,
  },
  completedTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  completedSubtitle: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING.xs,
  },
  completedTime: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.disabled,
  },
  cleanerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
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
  cleanerLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
  },
  ratingSection: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  sectionSubtitle: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  starButton: {
    paddingHorizontal: SPACING.sm,
  },
  ratingLabel: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.primary,
    textAlign: 'center',
  },
  reviewSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  textInputContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  textInput: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: SPACING.sm,
  },
  characterCount: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.disabled,
    textAlign: 'right',
  },
  photoSection: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  photosContainer: {
    maxHeight: 120,
  },
  photosContent: {
    alignItems: 'center',
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  addPhotoText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  photoContainer: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  uploadedPhoto: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
  },
  submitContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    shadowOpacity: 0.1,
    elevation: 2,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  submitButtonText: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.inverse,
    marginLeft: SPACING.sm,
  },
});

export default RatingReviewScreen; 