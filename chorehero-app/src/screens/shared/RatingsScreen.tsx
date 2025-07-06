import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { CameraView, CameraType, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { supabase } from '../../services/supabase';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../utils/constants';

const { width: screenWidth } = Dimensions.get('window');

type RootStackParamList = {
  RatingsScreen: {
    bookingId: string;
    otherParticipant: {
      id: string;
      name: string;
      avatar_url?: string;
      role: 'customer' | 'cleaner';
    };
  };
  CustomerHome: undefined;
  CleanerDashboard: undefined;
};

type RatingsScreenRouteProp = RouteProp<RootStackParamList, 'RatingsScreen'>;
type RatingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'RatingsScreen'>;

interface Rating {
  id: string;
  booking_id: string;
  rater_id: string;
  rated_id: string;
  rating: number;
  comment: string;
  video_testimonial_url?: string;
  service_quality?: number;
  communication?: number;
  punctuality?: number;
  cleanliness?: number;
  professionalism?: number;
  created_at: string;
}

interface RatingCriteria {
  service_quality: number;
  communication: number;
  punctuality: number;
  cleanliness: number;
  professionalism: number;
}

export const RatingsScreen: React.FC = () => {
  const route = useRoute<RatingsScreenRouteProp>();
  const navigation = useNavigation<RatingsScreenNavigationProp>();
  const { user } = useAuth();
  
  const { bookingId, otherParticipant } = route.params;
  
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [overallRating, setOverallRating] = useState(0);
  const [criteria, setCriteria] = useState<RatingCriteria>({
    service_quality: 0,
    communication: 0,
    punctuality: 0,
    cleanliness: 0,
    professionalism: 0,
  });
  const [comment, setComment] = useState('');
  const [videoTestimonialUri, setVideoTestimonialUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hasVideoPermission, setHasVideoPermission] = useState(false);
  const [existingRating, setExistingRating] = useState<Rating | null>(null);
  const [otherUserRating, setOtherUserRating] = useState<Rating | null>(null);
  const [showVideoTestimonial, setShowVideoTestimonial] = useState(false);
  
  const cameraRef = useRef<CameraView>(null);
  const recordingRef = useRef<any>(null);

  const ratingLabels = {
    service_quality: user?.role === 'customer' ? 'Service Quality' : 'Clear Instructions',
    communication: 'Communication',
    punctuality: 'Punctuality',
    cleanliness: user?.role === 'customer' ? 'Cleanliness Results' : 'Home Condition',
    professionalism: 'Professionalism',
  };

  const quickComments = {
    customer: [
      'Excellent work! Everything looks perfect.',
      'Great job, very thorough cleaning.',
      'Professional and reliable service.',
      'Exceeded my expectations!',
      'Will definitely book again.',
    ],
    cleaner: [
      'Great customer, clear instructions.',
      'Very welcoming and respectful.',
      'Home was well-prepared for cleaning.',
      'Pleasant to work with!',
      'Highly recommend this customer.',
    ],
  };

  useEffect(() => {
    requestVideoPermissions();
    loadExistingRatings();
  }, []);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

  const requestVideoPermissions = async () => {
    try {
      const cameraStatus = await requestCameraPermission();
      const audioStatus = await requestMicrophonePermission();
      setHasVideoPermission(cameraStatus.granted && audioStatus.granted);
    } catch (error) {
      console.error('Error requesting video permissions:', error);
    }
  };

  const loadExistingRatings = async () => {
    try {
      setIsLoading(true);
      
      // Load existing rating from current user
      const { data: existingData, error: existingError } = await supabase
        .from('ratings')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('rater_id', user?.id)
        .single();

      if (existingError && existingError.code !== 'PGRST116') {
        throw existingError;
      }

      if (existingData) {
        setExistingRating(existingData);
        setOverallRating(existingData.rating);
        setComment(existingData.comment);
        setCriteria({
          service_quality: existingData.service_quality || 0,
          communication: existingData.communication || 0,
          punctuality: existingData.punctuality || 0,
          cleanliness: existingData.cleanliness || 0,
          professionalism: existingData.professionalism || 0,
        });
        setVideoTestimonialUri(existingData.video_testimonial_url || null);
      }

      // Load rating from other user
      const { data: otherData, error: otherError } = await supabase
        .from('ratings')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('rater_id', otherParticipant.id)
        .single();

      if (otherError && otherError.code !== 'PGRST116') {
        throw otherError;
      }

      if (otherData) {
        setOtherUserRating(otherData);
      }
    } catch (error) {
      console.error('Error loading ratings:', error);
      Alert.alert('Error', 'Failed to load existing ratings.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateCriteria = (key: keyof RatingCriteria, value: number) => {
    setCriteria(prev => ({ ...prev, [key]: value }));
    
    // Update overall rating based on criteria average
    const newCriteria = { ...criteria, [key]: value };
    const average = Object.values(newCriteria).reduce((sum, val) => sum + val, 0) / 5;
    setOverallRating(Math.round(average));
  };

  const startVideoRecording = async () => {
    if (!cameraRef.current || !hasVideoPermission) {
      Alert.alert('Permission Required', 'Camera and microphone permissions are required to record video testimonials.');
      return;
    }
    
    try {
      setIsRecording(true);
      const videoRecordPromise = cameraRef.current?.recordAsync({
        maxDuration: 60, // 60 seconds max
      });
      
      recordingRef.current = videoRecordPromise;
      const data = await videoRecordPromise;
      setVideoTestimonialUri(data?.uri || null);
      setIsRecording(false);
    } catch (error) {
      console.error('Error recording video:', error);
      setIsRecording(false);
      Alert.alert('Error', 'Failed to record video testimonial. Please try again.');
    }
  };

  const stopVideoRecording = async () => {
    if (recordingRef.current) {
      setIsRecording(false);
      cameraRef.current?.stopRecording();
    }
  };

  const uploadVideoTestimonial = async (videoUri: string): Promise<string | null> => {
    try {
      const response = await fetch(videoUri);
      const blob = await response.blob();
      
      const fileName = `testimonials/${bookingId}_${user?.id}_${Date.now()}.mp4`;
      
      const { data, error } = await supabase.storage
        .from('videos')
        .upload(fileName, blob, {
          contentType: 'video/mp4',
          upsert: true,
        });

      if (error) {
        throw error;
      }

      const { data: urlData } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading video testimonial:', error);
      return null;
    }
  };

  const submitRating = async () => {
    if (!user?.id) return;
    
    if (overallRating === 0) {
      Alert.alert('Rating Required', 'Please provide a rating before submitting.');
      return;
    }

    try {
      setIsLoading(true);
      
      let videoUrl = videoTestimonialUri;
      
      // Upload video testimonial if recorded
      if (videoTestimonialUri && !videoTestimonialUri.startsWith('http')) {
        videoUrl = await uploadVideoTestimonial(videoTestimonialUri);
        if (!videoUrl) {
          Alert.alert('Warning', 'Failed to upload video testimonial, but rating will be saved without it.');
        }
      }

      const ratingData = {
        booking_id: bookingId,
        rater_id: user.id,
        rated_id: otherParticipant.id,
        rating: overallRating,
        comment: comment.trim(),
        video_testimonial_url: videoUrl,
        service_quality: criteria.service_quality,
        communication: criteria.communication,
        punctuality: criteria.punctuality,
        cleanliness: criteria.cleanliness,
        professionalism: criteria.professionalism,
        created_at: new Date().toISOString(),
      };

      let error;
      
      if (existingRating) {
        // Update existing rating
        const { error: updateError } = await supabase
          .from('ratings')
          .update({
            ...ratingData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingRating.id);
        error = updateError;
      } else {
        // Create new rating
        const { error: insertError } = await supabase
          .from('ratings')
          .insert(ratingData);
        error = insertError;
      }

      if (error) {
        throw error;
      }

      // Update booking status to rated if both parties have rated
      if (otherUserRating || existingRating) {
        await supabase
          .from('bookings')
          .update({
            status: 'rated',
            rating: overallRating,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId);
      }

      // Update user's average rating
      await updateUserAverageRating(otherParticipant.id);

      Alert.alert(
        'Thank You!',
        'Your rating has been submitted successfully.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate(user.role === 'customer' ? 'CustomerHome' : 'CleanerDashboard');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserAverageRating = async (userId: string) => {
    try {
      // Calculate new average rating
      const { data: ratings, error } = await supabase
        .from('ratings')
        .select('rating')
        .eq('rated_id', userId);

      if (error || !ratings || ratings.length === 0) return;

      const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      const roundedRating = Math.round(averageRating * 10) / 10;

      // Update user's average rating
      const { error: updateError } = await supabase
        .from('users')
        .update({ rating_average: roundedRating })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user average rating:', updateError);
      }
    } catch (error) {
      console.error('Error calculating average rating:', error);
    }
  };

  const renderStarRating = (rating: number, onPress: (rating: number) => void, size: number = 32) => (
    <View style={styles.starContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onPress(star)}>
          <Ionicons
            name={star <= rating ? 'star' : 'star-outline'}
            size={size}
            color={star <= rating ? COLORS.warning : COLORS.border}
            style={styles.star}
          />
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCriteriaRating = (key: keyof RatingCriteria) => (
    <View key={key} style={styles.criteriaContainer}>
      <Text style={styles.criteriaLabel}>{ratingLabels[key]}</Text>
      {renderStarRating(criteria[key], (rating) => updateCriteria(key, rating), 24)}
    </View>
  );

  const renderQuickComment = (text: string, index: number) => (
    <TouchableOpacity
      key={index}
      style={[
        styles.quickCommentButton,
        comment === text && styles.quickCommentSelected,
      ]}
      onPress={() => setComment(text)}
    >
      <Text style={[
        styles.quickCommentText,
        comment === text && styles.quickCommentTextSelected,
      ]}>
        {text}
      </Text>
    </TouchableOpacity>
  );

  const renderVideoTestimonial = () => (
    <View style={styles.videoSection}>
      <Text style={styles.sectionTitle}>Video Testimonial (Optional)</Text>
      <Text style={styles.sectionDescription}>
        Share your experience to help other {user?.role === 'customer' ? 'customers' : 'cleaners'} make informed decisions
      </Text>
      
      {videoTestimonialUri ? (
        <View style={styles.videoContainer}>
          <Video
            source={{ uri: videoTestimonialUri }}
            style={styles.videoPreview}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
          />
          <TouchableOpacity
            style={styles.retakeButton}
            onPress={() => setVideoTestimonialUri(null)}
          >
            <Ionicons name="refresh" size={20} color={COLORS.text.inverse} />
            <Text style={styles.retakeButtonText}>Re-record</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cameraSection}>
          {showVideoTestimonial && hasVideoPermission ? (
            <View style={styles.cameraContainer}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                facing="front"
                ratio="16:9"
              >
                <View style={styles.cameraControls}>
                  <TouchableOpacity
                    style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                    onPress={isRecording ? stopVideoRecording : startVideoRecording}
                  >
                    <Ionicons
                      name={isRecording ? "stop" : "videocam"}
                      size={32}
                      color={COLORS.text.inverse}
                    />
                  </TouchableOpacity>
                  {isRecording && (
                    <Text style={styles.recordingText}>Recording... (60s max)</Text>
                  )}
                </View>
              </CameraView>
              <TouchableOpacity
                style={styles.cancelVideoButton}
                onPress={() => setShowVideoTestimonial(false)}
              >
                <Text style={styles.cancelVideoButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.videoPromptButton}
              onPress={() => setShowVideoTestimonial(true)}
            >
              <Ionicons name="videocam-outline" size={48} color={COLORS.primary} />
              <Text style={styles.videoPromptText}>Record Video Testimonial</Text>
              <Text style={styles.videoPromptSubtext}>
                Help others by sharing your experience
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  if (isLoading && !existingRating) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const userRole = user?.role as 'customer' | 'cleaner';
  const comments = quickComments[userRole] || [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={{ uri: otherParticipant.avatar_url || 'https://via.placeholder.com/80' }}
            style={styles.userAvatar}
          />
          <Text style={styles.headerTitle}>
            Rate Your {otherParticipant.role === 'cleaner' ? 'Cleaner' : 'Customer'}
          </Text>
          <Text style={styles.userName}>{otherParticipant.name}</Text>
        </View>

        {/* Overall Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overall Rating</Text>
          {renderStarRating(overallRating, setOverallRating, 40)}
          <Text style={styles.ratingText}>
            {overallRating === 0 ? 'Tap to rate' : `${overallRating} out of 5 stars`}
          </Text>
        </View>

        {/* Detailed Criteria */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detailed Rating</Text>
          {Object.keys(criteria).map(key => renderCriteriaRating(key as keyof RatingCriteria))}
        </View>

        {/* Quick Comments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Comments</Text>
          <View style={styles.quickCommentsContainer}>
            {comments.map((text, index) => renderQuickComment(text, index))}
          </View>
        </View>

        {/* Custom Comment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Comments</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Share your experience..."
            placeholderTextColor={COLORS.text.secondary}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={styles.characterCount}>{comment.length}/500</Text>
        </View>

        {/* Video Testimonial */}
        {renderVideoTestimonial()}
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            overallRating === 0 && styles.submitButtonDisabled,
          ]}
          onPress={submitRating}
          disabled={overallRating === 0 || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.text.inverse} />
          ) : (
            <Text style={styles.submitButtonText}>
              {existingRating ? 'Update Rating' : 'Submit Rating'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.surface,
  },
  userAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  userName: {
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.text.secondary,
  },
  section: {
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  sectionDescription: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  starContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: SPACING.md,
  },
  star: {
    marginHorizontal: SPACING.xs,
  },
  ratingText: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    marginTop: SPACING.sm,
  },
  criteriaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  criteriaLabel: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    flex: 1,
  },
  quickCommentsContainer: {
    gap: SPACING.sm,
  },
  quickCommentButton: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  quickCommentSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickCommentText: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  quickCommentTextSelected: {
    color: COLORS.text.inverse,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    backgroundColor: COLORS.surface,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    textAlign: 'right',
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  videoSection: {
    padding: SPACING.lg,
  },
  cameraSection: {
    alignItems: 'center',
  },
  videoPromptButton: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
  },
  videoPromptText: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.medium,
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  videoPromptSubtext: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    marginTop: SPACING.xs,
  },
  cameraContainer: {
    width: '100%',
    alignItems: 'center',
  },
  camera: {
    width: screenWidth - (SPACING.lg * 2),
    height: 200,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  cameraControls: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recordButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonActive: {
    backgroundColor: COLORS.error,
  },
  recordingText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.sm,
    marginTop: SPACING.xs,
  },
  cancelVideoButton: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  cancelVideoButtonText: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
  },
  videoContainer: {
    alignItems: 'center',
  },
  videoPreview: {
    width: screenWidth - (SPACING.lg * 2),
    height: 200,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  retakeButtonText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.base,
    marginLeft: SPACING.xs,
  },
  submitContainer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.text.secondary,
  },
  submitButtonText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
}); 