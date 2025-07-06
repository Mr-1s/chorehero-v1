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
  Platform,
  Dimensions,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions, Camera } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { stripeService } from '../../services/stripe';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../utils/constants';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ProfileData {
  name: string;
  bio: string;
  experience: string;
  specialties: string[];
  hourlyRate: string;
}

interface VerificationStatus {
  backgroundCheck: 'pending' | 'completed' | 'failed';
  stripeConnect: 'pending' | 'completed' | 'failed';
  videoProfile: 'pending' | 'completed' | 'failed';
}

export const ProfileScreen: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [hasVideoPermission, setHasVideoPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<ProfileData>({
    name: user?.name || '',
    bio: '',
    experience: '',
    specialties: [],
    hourlyRate: '25',
  });
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>({
    backgroundCheck: 'pending',
    stripeConnect: 'pending',
    videoProfile: 'pending',
  });

  const cameraRef = useRef<CameraView>(null);
  const recordingRef = useRef<any>(null);

  const steps = [
    { title: 'Profile Info', icon: 'person-outline' },
    { title: 'Video Intro', icon: 'videocam-outline' },
    { title: 'Background Check', icon: 'shield-checkmark-outline' },
    { title: 'Payment Setup', icon: 'card-outline' },
  ];

  const specialtyOptions = [
    'Regular Cleaning',
    'Deep Cleaning',
    'Kitchen Specialist',
    'Bathroom Specialist',
    'Window Cleaning',
    'Carpet Cleaning',
    'Office Cleaning',
    'Pet-Friendly',
  ];

  useEffect(() => {
    requestPermissions();
    loadProfile();
  }, []);

  const requestPermissions = async () => {
    try {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      const { status: audioStatus } = await Camera.requestMicrophonePermissionsAsync();
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      
      setHasVideoPermission(cameraStatus === 'granted' && audioStatus === 'granted');
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      
      // Load existing profile data if available
      if (user?.id) {
        const response = await authService.getCleanerProfile(user.id);
        if (response.success && response.data) {
          const profile = response.data;
          setProfileData({
            name: profile.name || user.name || '',
            bio: profile.bio || '',
            experience: profile.experience || '',
            specialties: profile.specialties || [],
            hourlyRate: profile.hourly_rate?.toString() || '25',
          });
          setVideoUri(profile.video_profile_url || null);
          setVerificationStatus({
            backgroundCheck: profile.background_check_status || 'pending',
            stripeConnect: profile.stripe_connect_status || 'pending',
            videoProfile: profile.video_profile_url ? 'completed' : 'pending',
          });
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpecialtyToggle = (specialty: string) => {
    setProfileData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty],
    }));
  };

  const startRecording = async () => {
    if (!cameraRef.current || !hasVideoPermission) return;
    
    try {
      setIsRecording(true);
      const videoRecordPromise = cameraRef.current.recordAsync({
        maxDuration: 30, // 30 seconds max
      });
      
      recordingRef.current = videoRecordPromise;
      const data = await videoRecordPromise;
      setVideoUri(data?.uri || null);
      setIsRecording(false);
    } catch (error) {
      console.error('Error recording video:', error);
      setIsRecording(false);
      Alert.alert('Error', 'Failed to record video. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (recordingRef.current) {
      setIsRecording(false);
      cameraRef.current?.stopRecording();
    }
  };

  const uploadVideo = async () => {
    if (!videoUri || !user?.id) return;
    
    try {
      setIsLoading(true);
      
      // Upload video to Supabase storage
      const response = await authService.uploadCleanerVideo(user.id, videoUri);
      if (response.success) {
        setVerificationStatus(prev => ({
          ...prev,
          videoProfile: 'completed',
        }));
        Alert.alert('Success', 'Video uploaded successfully!');
        return true;
      } else {
        throw new Error(response.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      Alert.alert('Error', 'Failed to upload video. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const initiateBackgroundCheck = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      
      const response = await authService.initiateBackgroundCheck(user.id, {
        firstName: user.name?.split(' ')[0] || '',
        lastName: user.name?.split(' ')[1] || '',
        email: user.email || '',
        phone: user.phone || '',
      });
      
      if (response.success) {
        setVerificationStatus(prev => ({
          ...prev,
          backgroundCheck: 'completed',
        }));
        Alert.alert('Success', 'Background check initiated successfully!');
        return true;
      } else {
        throw new Error(response.message || 'Background check failed');
      }
    } catch (error) {
      console.error('Error initiating background check:', error);
      Alert.alert('Error', 'Failed to initiate background check. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const setupStripeConnect = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      
      const response = await stripeService.createConnectAccount(user.id);
      if (response.success && response.data?.onboarding_url) {
        // In a real app, you'd open this URL in a web view
        Alert.alert(
          'Stripe Connect Setup',
          'Please complete your payment setup in the browser.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Browser', 
              onPress: () => {
                // Open browser with response.data.onboarding_url
                console.log('Stripe onboarding URL:', response.data.onboarding_url);
                setVerificationStatus(prev => ({
                  ...prev,
                  stripeConnect: 'completed',
                }));
              }
            },
          ]
        );
        return true;
      } else {
        throw new Error(response.message || 'Stripe setup failed');
      }
    } catch (error) {
      console.error('Error setting up Stripe Connect:', error);
      Alert.alert('Error', 'Failed to setup payment processing. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoading(true);
      
      const response = await authService.updateCleanerProfile(user.id, {
        name: profileData.name,
        bio: profileData.bio,
        experience: profileData.experience,
        specialties: profileData.specialties,
        hourly_rate: parseFloat(profileData.hourlyRate),
      });
      
      if (response.success) {
        Alert.alert('Success', 'Profile updated successfully!');
        refreshUser();
        return true;
      } else {
        throw new Error(response.message || 'Profile update failed');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextStep = async () => {
    switch (activeStep) {
      case 0:
        // Validate profile info
        if (!profileData.name.trim() || !profileData.bio.trim()) {
          Alert.alert('Error', 'Please fill in all required fields.');
          return;
        }
        const profileSaved = await saveProfile();
        if (profileSaved) setActiveStep(1);
        break;
      case 1:
        // Video upload
        if (!videoUri) {
          Alert.alert('Error', 'Please record your video introduction.');
          return;
        }
        const videoUploaded = await uploadVideo();
        if (videoUploaded) setActiveStep(2);
        break;
      case 2:
        // Background check
        const backgroundCheckStarted = await initiateBackgroundCheck();
        if (backgroundCheckStarted) setActiveStep(3);
        break;
      case 3:
        // Stripe setup
        await setupStripeConnect();
        break;
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {steps.map((step, index) => (
        <View key={index} style={styles.stepItem}>
          <View style={[
            styles.stepCircle,
            index <= activeStep && styles.stepCircleActive,
          ]}>
            <Ionicons
              name={step.icon as any}
              size={20}
              color={index <= activeStep ? COLORS.text.inverse : COLORS.text.secondary}
            />
          </View>
          <Text style={[
            styles.stepTitle,
            index <= activeStep && styles.stepTitleActive,
          ]}>
            {step.title}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderProfileInfo = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDescription}>
        Tell customers about yourself and your cleaning services
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="Full Name"
        placeholderTextColor={COLORS.text.secondary}
        value={profileData.name}
        onChangeText={(text) => setProfileData(prev => ({ ...prev, name: text }))}
      />
      
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Tell customers about your cleaning experience..."
        placeholderTextColor={COLORS.text.secondary}
        value={profileData.bio}
        onChangeText={(text) => setProfileData(prev => ({ ...prev, bio: text }))}
        multiline
        numberOfLines={4}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Years of Experience"
        placeholderTextColor={COLORS.text.secondary}
        value={profileData.experience}
        onChangeText={(text) => setProfileData(prev => ({ ...prev, experience: text }))}
      />
      
      <View style={styles.rateContainer}>
        <Text style={styles.rateLabel}>Hourly Rate ($)</Text>
        <TextInput
          style={styles.rateInput}
          value={profileData.hourlyRate}
          onChangeText={(text) => setProfileData(prev => ({ ...prev, hourlyRate: text }))}
          keyboardType="numeric"
        />
      </View>
      
      <Text style={styles.specialtiesTitle}>Specialties</Text>
      <View style={styles.specialtiesContainer}>
        {specialtyOptions.map((specialty) => (
          <TouchableOpacity
            key={specialty}
            style={[
              styles.specialtyChip,
              profileData.specialties.includes(specialty) && styles.specialtyChipSelected,
            ]}
            onPress={() => handleSpecialtyToggle(specialty)}
          >
            <Text style={[
              styles.specialtyText,
              profileData.specialties.includes(specialty) && styles.specialtyTextSelected,
            ]}>
              {specialty}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderVideoIntro = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDescription}>
        Record a 30-second introduction video to build trust with customers
      </Text>
      
      {videoUri ? (
        <View style={styles.videoContainer}>
          <Video
            source={{ uri: videoUri }}
            style={styles.videoPreview}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
          />
          <TouchableOpacity
            style={styles.rerecordButton}
            onPress={() => setVideoUri(null)}
          >
            <Ionicons name="refresh" size={20} color={COLORS.text.inverse} />
            <Text style={styles.rerecordButtonText}>Re-record</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cameraContainer}>
          {hasVideoPermission ? (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="front"
            >
              <View style={styles.cameraControls}>
                <TouchableOpacity
                  style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                  onPress={isRecording ? stopRecording : startRecording}
                >
                  <Ionicons
                    name={isRecording ? "stop" : "videocam"}
                    size={32}
                    color={COLORS.text.inverse}
                  />
                </TouchableOpacity>
                {isRecording && (
                  <Text style={styles.recordingText}>Recording... (30s max)</Text>
                )}
              </View>
            </CameraView>
          ) : (
            <View style={styles.permissionContainer}>
              <Ionicons name="camera-outline" size={48} color={COLORS.text.secondary} />
              <Text style={styles.permissionText}>
                Camera permission required to record video
              </Text>
              <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
                <Text style={styles.permissionButtonText}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderBackgroundCheck = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDescription}>
        Complete your background check to build trust with customers
      </Text>
      
      <View style={styles.verificationCard}>
        <View style={styles.verificationHeader}>
          <Ionicons name="shield-checkmark" size={24} color={COLORS.primary} />
          <Text style={styles.verificationTitle}>Background Check</Text>
        </View>
        
        <Text style={styles.verificationDescription}>
          We partner with trusted verification providers to ensure customer safety.
          This process typically takes 1-2 business days.
        </Text>
        
        <View style={styles.verificationStatus}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text style={[
            styles.statusText,
            verificationStatus.backgroundCheck === 'completed' && styles.statusCompleted,
            verificationStatus.backgroundCheck === 'failed' && styles.statusFailed,
          ]}>
            {verificationStatus.backgroundCheck === 'completed' && 'Verified ✓'}
            {verificationStatus.backgroundCheck === 'pending' && 'Pending'}
            {verificationStatus.backgroundCheck === 'failed' && 'Failed'}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderPaymentSetup = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepDescription}>
        Set up your payment processing to receive earnings
      </Text>
      
      <View style={styles.verificationCard}>
        <View style={styles.verificationHeader}>
          <Ionicons name="card" size={24} color={COLORS.primary} />
          <Text style={styles.verificationTitle}>Payment Processing</Text>
        </View>
        
        <Text style={styles.verificationDescription}>
          We use Stripe to process payments securely. You'll keep 70% of your earnings,
          and payments are transferred to your bank account weekly.
        </Text>
        
        <View style={styles.verificationStatus}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text style={[
            styles.statusText,
            verificationStatus.stripeConnect === 'completed' && styles.statusCompleted,
          ]}>
            {verificationStatus.stripeConnect === 'completed' ? 'Connected ✓' : 'Not Connected'}
          </Text>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {renderStepIndicator()}
        
        <View style={styles.content}>
          {activeStep === 0 && renderProfileInfo()}
          {activeStep === 1 && renderVideoIntro()}
          {activeStep === 2 && renderBackgroundCheck()}
          {activeStep === 3 && renderPaymentSetup()}
        </View>
      </ScrollView>
      
      <View style={styles.navigationContainer}>
        {activeStep > 0 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setActiveStep(activeStep - 1)}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNextStep}
          disabled={isLoading}
        >
          <Text style={styles.nextButtonText}>
            {activeStep === 3 ? 'Complete Setup' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
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
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
  },
  scrollView: {
    flex: 1,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.surface,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  stepCircleActive: {
    backgroundColor: COLORS.primary,
  },
  stepTitle: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  stepTitleActive: {
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
  },
  stepContent: {
    paddingVertical: SPACING.xl,
  },
  stepDescription: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  rateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  rateLabel: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    marginRight: SPACING.md,
  },
  rateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    backgroundColor: COLORS.surface,
  },
  specialtiesTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  specialtyChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  specialtyChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  specialtyText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
  },
  specialtyTextSelected: {
    color: COLORS.text.inverse,
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
  rerecordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  rerecordButtonText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.base,
    marginLeft: SPACING.xs,
  },
  cameraContainer: {
    alignItems: 'center',
  },
  camera: {
    width: screenWidth - (SPACING.lg * 2),
    height: 300,
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
  permissionContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  permissionText: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginVertical: SPACING.md,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  permissionButtonText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  verificationCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  verificationTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginLeft: SPACING.md,
  },
  verificationDescription: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    lineHeight: 24,
    marginBottom: SPACING.lg,
  },
  verificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    marginRight: SPACING.sm,
  },
  statusText: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
  },
  statusCompleted: {
    color: COLORS.success,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  statusFailed: {
    color: COLORS.error,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  backButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButtonText: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  nextButtonText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
}); 