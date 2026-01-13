import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { uploadService, type UploadProgress, type UploadResponse } from '../../services/uploadService';
import { contentService } from '../../services/contentService';
import { contentAnalyticsService, type VideoWithStats, type ContentPerformanceSummary } from '../../services/contentAnalyticsService';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../utils/constants';
import { supabase } from '../../services/supabase';
import { useToast } from '../../components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, EmptyStateConfigs } from '../../components/EmptyState';
import { getOptimalListProps, memoryManager, performanceMonitor, optimizeImageUri } from '../../utils/performance';
import MetricCard from '../../components/cleaner/MetricCard';
import { Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 12) / 2; // 20px padding each side, 12px gap

// Video upload limits
const VIDEO_LIMITS = {
  maxDurationSeconds: 45,
  minDurationSeconds: 5,
  maxFileSizeMB: 50,
  allowedFormats: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime'],
};

type StackParamList = {
  VideoUpload: undefined;
  CleanerProfile: undefined;
};

type VideoUploadNavigationProp = StackNavigationProp<StackParamList, 'VideoUpload'>;

interface VideoUploadProps {
  navigation: VideoUploadNavigationProp;
}

interface UploadedVideo {
  id: string;
  uri: string;
  title: string;
  description?: string;
  duration: number;
  uploadDate: string;
  status: 'uploading' | 'processing' | 'live' | 'failed';
  views: number;
  bookings: number;
  likes: number;
  comments: number;
}

const VideoUploadScreen: React.FC<VideoUploadProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const NAV_CLEARANCE = 110; // CleanerFloatingNavigation: height ~80 + bottom offset ~30
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [uploadDetails, setUploadDetails] = useState<UploadProgress | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [videos, setVideos] = useState<UploadedVideo[]>([]);

  // Video details for social-media style posting
  const [videoTitle, setVideoTitle] = useState('');
  const [videoDescription, setVideoDescription] = useState('');
  const [videoServiceType, setVideoServiceType] = useState('');
  const [showVideoDetailsModal, setShowVideoDetailsModal] = useState(false);
  const [pendingVideoUri, setPendingVideoUri] = useState<string | null>(null);
  const [videoThumbnailUri, setVideoThumbnailUri] = useState<string | null>(null);
  const [showServiceTypePicker, setShowServiceTypePicker] = useState(false);

  // Service type options for categorizing videos
  const SERVICE_TYPE_OPTIONS = [
    { id: 'standard_clean', label: 'Standard Cleaning', icon: 'home-outline' },
    { id: 'deep_clean', label: 'Deep Cleaning', icon: 'sparkles-outline' },
    { id: 'kitchen', label: 'Kitchen Cleaning', icon: 'restaurant-outline' },
    { id: 'bathroom', label: 'Bathroom Cleaning', icon: 'water-outline' },
    { id: 'bedroom', label: 'Bedroom Cleaning', icon: 'bed-outline' },
    { id: 'living_room', label: 'Living Room', icon: 'tv-outline' },
    { id: 'move_out', label: 'Move Out Clean', icon: 'car-outline' },
    { id: 'office', label: 'Office Cleaning', icon: 'briefcase-outline' },
    { id: 'carpet', label: 'Carpet Cleaning', icon: 'layers-outline' },
    { id: 'window', label: 'Window Cleaning', icon: 'grid-outline' },
    { id: 'laundry', label: 'Laundry Service', icon: 'shirt-outline' },
    { id: 'other', label: 'Other Service', icon: 'ellipsis-horizontal-outline' },
  ];
  
  // Video action menu
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [selectedVideoForMenu, setSelectedVideoForMenu] = useState<UploadedVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [performanceSummary, setPerformanceSummary] = useState<ContentPerformanceSummary>({
    totalViews: 0,
    totalBookings: 0,
    totalRevenue: 0,
    conversionRate: 0,
    avgViewsPerVideo: 0,
    videoCount: 0,
  });

  const videoRef = useRef<Video>(null);

  // Check if cleaner profile is complete before allowing uploads
  const checkProfileComplete = async (): Promise<{ isComplete: boolean; missingFields: string[] }> => {
    if (!user?.id) {
      return { isComplete: false, missingFields: ['Account'] };
    }

    try {
      const { data: profile, error } = await supabase
        .from('cleaner_profiles')
        .select('hourly_rate, bio, coverage_area, specialties')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking profile:', error);
        return { isComplete: false, missingFields: ['Profile data'] };
      }

      const missingFields: string[] = [];

      if (!profile) {
        return { isComplete: false, missingFields: ['Complete profile setup'] };
      }

      if (!profile.hourly_rate || profile.hourly_rate <= 0) {
        missingFields.push('Hourly rate');
      }

      if (!profile.bio || profile.bio.trim().length < 10) {
        missingFields.push('Bio/Description (min 10 characters)');
      }

      if (!profile.coverage_area || profile.coverage_area.trim().length < 3) {
        missingFields.push('Service area/Location');
      }

      return {
        isComplete: missingFields.length === 0,
        missingFields
      };
    } catch (error) {
      console.error('Profile check error:', error);
      return { isComplete: false, missingFields: ['Profile verification'] };
    }
  };

  // Fetch real data from database
  const loadContentData = useCallback(async () => {
    if (!user?.id || user.id.startsWith('demo_')) {
      setIsLoading(false);
      return;
    }

    try {
      console.log('📊 Loading content analytics for user:', user.id);
      
      // Fetch performance summary
      const summary = await contentAnalyticsService.getPerformanceSummary(user.id);
      setPerformanceSummary(summary);
      
      // Fetch videos with stats
      const videosWithStats = await contentAnalyticsService.getVideosWithStats(user.id);
      
      // Convert to UploadedVideo format
      const formattedVideos: UploadedVideo[] = videosWithStats.map(v => ({
        id: v.id,
        uri: v.uri,
        title: v.title,
        duration: v.duration || 45,
        uploadDate: v.uploadDate,
        status: v.status as 'uploading' | 'processing' | 'live' | 'failed',
        views: v.views,
        bookings: v.bookings,
      }));
      
      setVideos(formattedVideos);
      console.log(`✅ Loaded ${formattedVideos.length} videos with analytics`);
    } catch (error) {
      console.error('❌ Error loading content data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  // Load data on mount
  useEffect(() => {
    loadContentData();
  }, [loadContentData]);

  // Pull to refresh handler
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadContentData();
  }, [loadContentData]);

  // Use real data from performanceSummary
  const { totalViews, totalBookings, conversionRate, avgViewsPerVideo } = performanceSummary;

  const handleCameraUpload = async () => {
    try {
      console.log('🎥 Starting camera upload...');
      
      // Check if user is authenticated and not a demo user
      if (!user || user.id.startsWith('demo_')) {
        Alert.alert(
          'Account Required',
          'You need to create a real account to upload videos. Demo accounts cannot post content.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Create Account', 
              onPress: () => navigation.navigate('Auth' as any)
            }
          ]
        );
        return;
      }

      // Ensure user is a cleaner
      if (user.role !== 'cleaner') {
        Alert.alert(
          'Cleaner Account Required',
          'Only cleaners can upload videos. Please switch to a cleaner account.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      // Check if profile is complete with mandatory fields
      const profileCheck = await checkProfileComplete();
      if (!profileCheck.isComplete) {
        Alert.alert(
          '⚠️ Complete Your Profile First',
          `Before uploading videos, please complete your profile:\n\n• ${profileCheck.missingFields.join('\n• ')}\n\nThis helps customers understand your services and pricing.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Edit Profile', 
              onPress: () => navigation.navigate('ProfileEdit' as any)
            }
          ]
        );
        return;
      }
      
      // Request permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('📷 Camera permission status:', status);
      
      if (status !== 'granted') {
        try { (showToast as any) && showToast({ type: 'warning', message: 'Camera permission required' }); } catch {}
        return;
      }

      console.log('🎬 Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: VIDEO_LIMITS.maxDurationSeconds,
        quality: 0.5, // Lower quality = smaller file size (free tier limit)
      });

      console.log('📹 Camera result:', result);

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('✅ Video selected from camera:', asset.uri);
        
        // Check file size FIRST
        const MAX_FILE_SIZE_MB = 50; // 50MB max per video
        const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
        
        try {
          const fileInfo = await FileSystem.getInfoAsync(asset.uri, { size: true });
          const fileSize = (fileInfo as any).size || 0;
          const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
          console.log(`📦 File size: ${fileSizeMB}MB`);
          
          if (fileSize > MAX_FILE_SIZE_BYTES) {
            Alert.alert(
              'Video Too Large',
              `This video is ${fileSizeMB}MB but the maximum is ${MAX_FILE_SIZE_MB}MB.\n\nTry recording a shorter video or at lower resolution.`,
              [{ text: 'OK', style: 'default' }]
            );
            return;
          }
        } catch (sizeError) {
          console.warn('Could not check file size:', sizeError);
        }
        
        // Check video duration (safety check, camera should enforce limit)
        const durationSeconds = asset.duration ? asset.duration / 1000 : 0;
        console.log(`📏 Video duration: ${durationSeconds}s`);
        
        if (durationSeconds > VIDEO_LIMITS.maxDurationSeconds) {
          Alert.alert(
            'Video Too Long',
            `Please record a video that's ${VIDEO_LIMITS.maxDurationSeconds} seconds or less.`,
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
        
        setSelectedVideo(asset.uri);
        // Generate thumbnail from video
        const thumbnail = await generateThumbnail(asset.uri);
        setVideoThumbnailUri(thumbnail);
        // Show modal to add title/description before uploading
        setPendingVideoUri(asset.uri);
        setVideoTitle('');
        setVideoDescription('');
        setShowVideoDetailsModal(true);
      } else {
        console.log('❌ Camera upload canceled or no video selected');
      }
    } catch (error) {
      console.error('🚨 Camera upload error:', error);
      try { (showToast as any) && showToast({ type: 'error', message: 'Failed to record video' }); } catch {}
    }
  };

  const handleLibraryUpload = async () => {
    try {
      console.log('📱 Starting library upload...');
      
      // Check if user is authenticated and not a demo user
      if (!user || user.id.startsWith('demo_')) {
        Alert.alert(
          'Account Required',
          'You need to create a real account to upload videos. Demo accounts cannot post content.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Create Account', 
              onPress: () => navigation.navigate('Auth' as any)
            }
          ]
        );
        return;
      }

      // Ensure user is a cleaner
      if (user.role !== 'cleaner') {
        Alert.alert(
          'Cleaner Account Required',
          'Only cleaners can upload videos. Please switch to a cleaner account.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      // Check if profile is complete with mandatory fields
      const profileCheck = await checkProfileComplete();
      if (!profileCheck.isComplete) {
        Alert.alert(
          '⚠️ Complete Your Profile First',
          `Before uploading videos, please complete your profile:\n\n• ${profileCheck.missingFields.join('\n• ')}\n\nThis helps customers understand your services and pricing.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Edit Profile', 
              onPress: () => navigation.navigate('ProfileEdit' as any)
            }
          ]
        );
        return;
      }
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: VIDEO_LIMITS.maxDurationSeconds,
        quality: 0.5, // Lower quality = smaller file size (free tier limit)
      });

      console.log('📚 Library result:', result);

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('✅ Video selected from library:', asset.uri);
        
        // Check file size FIRST (before anything else)
        const MAX_FILE_SIZE_MB = 50; // 50MB max per video
        const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
        
        try {
          const fileInfo = await FileSystem.getInfoAsync(asset.uri, { size: true });
          const fileSize = (fileInfo as any).size || 0;
          const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
          console.log(`📦 File size: ${fileSizeMB}MB`);
          
          if (fileSize > MAX_FILE_SIZE_BYTES) {
            Alert.alert(
              'Video Too Large',
              `This video is ${fileSizeMB}MB but the maximum is ${MAX_FILE_SIZE_MB}MB.\n\nTips to reduce size:\n• Record a shorter video (30-45 sec)\n• Use the editor to trim\n• Record at lower resolution`,
              [{ text: 'OK', style: 'default' }]
            );
            return;
          }
        } catch (sizeError) {
          console.warn('Could not check file size:', sizeError);
          // Continue anyway - Supabase will reject if too large
        }
        
        // Check video duration
        const durationSeconds = asset.duration ? asset.duration / 1000 : 0;
        console.log(`📏 Video duration: ${durationSeconds}s`);
        
        if (durationSeconds > VIDEO_LIMITS.maxDurationSeconds) {
          Alert.alert(
            'Video Too Long',
            `Please select a video that's ${VIDEO_LIMITS.maxDurationSeconds} seconds or less. Your video is ${Math.round(durationSeconds)} seconds.\n\nTip: Use the built-in editor to trim your video!`,
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
        
        if (durationSeconds < VIDEO_LIMITS.minDurationSeconds) {
          Alert.alert(
            'Video Too Short',
            `Videos should be at least ${VIDEO_LIMITS.minDurationSeconds} seconds long to showcase your work.`,
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
        
        setSelectedVideo(asset.uri);
        // Generate thumbnail from video
        const thumbnail = await generateThumbnail(asset.uri);
        setVideoThumbnailUri(thumbnail);
        // Show modal to add title/description before uploading
        setPendingVideoUri(asset.uri);
        setVideoTitle('');
        setVideoDescription('');
        setShowVideoDetailsModal(true);
      } else {
        console.log('❌ Library upload canceled or no video selected');
      }
    } catch (error) {
      console.error('🚨 Library upload error:', error);
      try { (showToast as any) && showToast({ type: 'error', message: 'Failed to select video' }); } catch {}
    }
  };

  // Called when user confirms title/description in modal
  const handleConfirmVideoDetails = () => {
    setShowVideoDetailsModal(false);
    if (pendingVideoUri) {
      handleVideoUpload(pendingVideoUri);
      setPendingVideoUri(null);
    }
  };

  // Generate video thumbnail
  const generateThumbnail = async (videoUri: string): Promise<string | null> => {
    try {
      console.log('📸 Generating video thumbnail...');
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 1000, // Get thumbnail at 1 second mark
        quality: 0.7,
      });
      console.log('✅ Thumbnail generated:', uri);
      return uri;
    } catch (error) {
      console.warn('⚠️ Failed to generate thumbnail:', error);
      return null;
    }
  };

  // Cancel video upload
  const handleCancelVideoDetails = () => {
    setShowVideoDetailsModal(false);
    setPendingVideoUri(null);
    setSelectedVideo(null);
    setVideoTitle('');
    setVideoDescription('');
    setVideoServiceType('');
    setVideoThumbnailUri(null);
  };

  const handleVideoUpload = async (videoUri: string) => {
    // Clear previous errors
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      console.log('🎬 Starting video upload process for:', videoUri);
      
      // Validate the video (soft validation - don't block on errors)
      try {
      const validation = await uploadService.validateFile(videoUri, {
          maxFileSize: 50 * 1024 * 1024, // 50MB max
          allowedTypes: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime']
      });

      if (!validation.isValid) {
          console.warn('⚠️ Video validation warning:', validation.error);
          // Continue anyway - Supabase will do final validation
        } else {
          console.log('✅ Video validation passed');
        }
      } catch (validationError) {
        console.warn('⚠️ Validation check failed, proceeding anyway:', validationError);
      }

      console.log('📤 Starting upload to Supabase...');

      // Start the robust upload
      const response = await uploadService.uploadFile(
        videoUri,
        'video',
        (progress: UploadProgress) => {
          console.log(`📊 Upload progress: ${progress.progress}%, ${progress.bytesTransferred}/${progress.totalBytes} bytes`);
          setUploadDetails(progress);
          setUploadProgress(progress.progress);
          
          if (progress.error) {
            console.error('❌ Upload progress error:', progress.error);
            setUploadError(progress.error);
          }
        },
        {
          maxFileSize: 50 * 1024 * 1024, // 50MB max
          allowedTypes: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime'],
          maxRetries: 3,
          retryDelay: 2000
        }
      );

      setActiveUploadId(response.uploadId || null);

      if (response.success) {
        console.log('✅ Video upload completed successfully:', response.url);
        
        // Create content post in database so it appears in Feed and Discover
        if (user?.id && response.url) {
          try {
            console.log('📝 Creating content post for uploaded video...');
            // Build tags array with service type
            const tags = ['cleaning', 'professional'];
            if (videoServiceType) {
              tags.unshift(videoServiceType); // Add service type as first tag
            }
            
            // Upload thumbnail if we have one
            let thumbnailUrl: string | undefined;
            if (videoThumbnailUri) {
              try {
                console.log('📤 Uploading thumbnail...');
                const thumbnailResponse = await uploadService.uploadFile(
                  videoThumbnailUri,
                  'image',
                  undefined,
                  { maxFileSize: 5 * 1024 * 1024 } // 5MB max for thumbnails
                );
                if (thumbnailResponse.success && thumbnailResponse.url) {
                  thumbnailUrl = thumbnailResponse.url;
                  console.log('✅ Thumbnail uploaded:', thumbnailUrl);
                }
              } catch (thumbError) {
                console.warn('⚠️ Thumbnail upload failed:', thumbError);
              }
            }
            
            const contentResponse = await contentService.createPost(user.id, {
              title: videoTitle || 'New Cleaning Video',
              description: videoDescription || 'Check out my latest cleaning work!',
              content_type: 'video' as const,
              media_url: response.url,
              thumbnail_url: thumbnailUrl, // Include the thumbnail
              status: 'published' as const,
              tags: tags
            });

            if (contentResponse.success) {
              console.log('✅ Content post created successfully');
            } else {
              console.error('❌ Failed to create content post:', contentResponse.error);
            }
          } catch (error) {
            console.error('❌ Error creating content post:', error);
          }
        }
        
        // Create local video entry for this screen
        const newVideo: UploadedVideo = {
          id: response.uploadId || Date.now().toString(),
          uri: response.url || videoUri,
          title: videoTitle || 'New Cleaning Video',
          description: videoDescription || '',
          duration: 45,
          uploadDate: new Date().toISOString().split('T')[0],
          status: 'live', // Set to live since we've published it
          views: 0,
          bookings: 0,
          likes: 0,
          comments: 0,
        };

        setVideos(prev => [newVideo, ...prev]);
        
        try { (showToast as any) && showToast({ type: 'success', message: '🎬 Video is now live! Customers can discover your work.' }); } catch {}
        setSelectedVideo(null);

        // Clear upload state
        setUploadDetails(null);
        setActiveUploadId(null);

        // Refresh analytics data to include new video
        setTimeout(() => loadContentData(), 1000);

      } else {
        // Handle different error types
        let errorTitle = 'Upload Failed';
        let errorMessage = response.error || 'Please try again';
        let showRetry = true;

        switch (response.errorCode) {
          case 'VALIDATION_FAILED':
            errorTitle = 'Invalid File';
            showRetry = false;
            break;
          case 'FILE_TOO_LARGE':
            errorTitle = 'File Too Large';
            errorMessage = 'Please choose a video under 50MB';
            showRetry = false;
            break;
          case 'UNSUPPORTED_TYPE':
            errorTitle = 'Unsupported Format';
            errorMessage = 'Please use MP4, MOV, or AVI format';
            showRetry = false;
            break;
          case 'NETWORK_OFFLINE':
            errorTitle = 'No Internet';
            errorMessage = 'Check your connection and try again';
            break;
          case 'RATE_LIMITED':
            errorTitle = 'Too Many Uploads';
            errorMessage = 'Please wait before uploading again';
            showRetry = false;
            break;
        }

        setUploadError(errorMessage);

        try { (showToast as any) && showToast({ type: 'error', message: errorMessage }); } catch {}
        if (showRetry) handleVideoUpload(videoUri);
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error.message || 'An unexpected error occurred';
      setUploadError(errorMessage);
      
      try { (showToast as any) && showToast({ type: 'error', message: errorMessage }); } catch {}
    } finally {
      setIsUploading(false);
      // Keep progress visible for a moment if successful
      if (!uploadError) {
        setTimeout(() => {
          setUploadProgress(0);
          setUploadDetails(null);
        }, 2000);
      }
    }
  };

  // Cancel upload function
  const handleCancelUpload = () => {
    if (activeUploadId) {
      const cancelled = uploadService.cancelUpload(activeUploadId);
      if (cancelled) {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadDetails(null);
        setActiveUploadId(null);
        setUploadError(null);
        Alert.alert('Upload Cancelled', 'The upload has been cancelled');
      }
    }
  };

  const renderUploadOptions = () => (
    <View style={styles.uploadSection}>
      <Text style={styles.sectionTitle}>Upload New Video</Text>
      <Text style={styles.sectionSubtitle}>
        Show your cleaning skills with a 30-45 second video
      </Text>

      <View style={styles.uploadButtons}>
        <TouchableOpacity style={styles.uploadButton} onPress={handleCameraUpload}>
          <Ionicons name="videocam" size={24} color="#ffffff" />
          <Text style={styles.uploadButtonText}>Record Video</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadButton} onPress={handleLibraryUpload}>
          <Ionicons name="images" size={24} color="#ffffff" />
          <Text style={styles.uploadButtonText}>Library</Text>
        </TouchableOpacity>
      </View>

      {selectedVideo && (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>Video Preview</Text>
          <Video
            ref={videoRef}
            source={{ uri: selectedVideo }}
            style={styles.videoPreview}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
          />
        </View>
      )}

      {isUploading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
              {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Processing...'}
            </Text>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleCancelUpload}
            >
              <Ionicons name="close" size={20} color={COLORS.error} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
          
          {uploadDetails && (
            <View style={styles.progressDetails}>
              {uploadDetails.bytesTransferred > 0 && (
                <Text style={styles.progressDetailText}>
                  {Math.round(uploadDetails.bytesTransferred / 1024 / 1024 * 10) / 10}MB / 
                  {Math.round(uploadDetails.totalBytes / 1024 / 1024 * 10) / 10}MB
                </Text>
              )}
              {uploadError && (
                <Text style={styles.errorText}>{uploadError}</Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderAnalyticsOverview = () => (
    <View style={styles.analyticsSection}>
      <Text style={styles.sectionTitle}>Content Performance</Text>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      ) : (
      <View style={styles.analyticsGrid}>
          <MetricCard
            value={totalViews.toLocaleString()}
            label="Total Views"
            icon="eye-outline"
            iconColor="#3B82F6"
            delay={0}
            compact
            style={styles.performanceCard}
          />
          <MetricCard
            value={totalBookings}
            label="Bookings Generated"
            icon="calendar-outline"
            iconColor="#10B981"
            delay={50}
            compact
            style={styles.performanceCard}
          />
          <MetricCard
            value={`${conversionRate}%`}
            label="Conversion Rate"
            icon="trending-up-outline"
            iconColor="#F59E0B"
            delay={100}
            compact
            style={styles.performanceCard}
          />
          <MetricCard
            value={avgViewsPerVideo}
            label="Avg Views/Video"
            icon="analytics-outline"
            iconColor="#8B5CF6"
            delay={150}
            compact
            style={styles.performanceCard}
          />
        </View>
      )}
    </View>
  );

  const renderVideoItem = ({ item, index }: { item: UploadedVideo; index: number }) => (
    <View style={styles.videoCard}>
      {/* Video Thumbnail with Gradient Overlay */}
      <View style={styles.thumbnailContainer}>
      <Video
        source={{ uri: item.uri }}
        style={styles.videoThumbnail}
        resizeMode={ResizeMode.COVER}
        shouldPlay={false}
      />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)']}
          style={styles.thumbnailGradient}
        />
        
        {/* Play Button Overlay */}
        <View style={styles.playButtonOverlay}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={20} color="#FFFFFF" />
          </View>
          </View>
        
        {/* Duration Badge */}
        <View style={styles.durationBadge}>
          <Ionicons name="time-outline" size={10} color="#FFFFFF" />
          <Text style={styles.durationText}>{item.duration || 30}s</Text>
      </View>

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{item.status === 'live' ? 'LIVE' : item.status.toUpperCase()}</Text>
        </View>
        </View>
        
{/* Video Info */}
      <View style={styles.videoInfo}>
        <View style={styles.videoHeader}>
          <Text style={styles.videoTitle} numberOfLines={1}>{item.title}</Text>
          <TouchableOpacity 
            style={styles.moreButton} 
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => handleOpenVideoMenu(item)}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#6B7280" />
        </TouchableOpacity>
        </View>
        
        <Text style={styles.videoDate}>
          <Ionicons name="calendar-outline" size={11} color="#9CA3AF" /> {item.uploadDate}
        </Text>
        
        {/* Engagement Stats Row */}
        <View style={styles.engagementRow}>
          <View style={styles.engagementItem}>
            <Ionicons name="heart" size={16} color="#EF4444" />
            <Text style={styles.engagementText}>{item.likes || 0}</Text>
          </View>
          <View style={styles.engagementItem}>
            <Ionicons name="chatbubble" size={15} color="#3B82F6" />
            <Text style={styles.engagementText}>{item.comments || 0}</Text>
          </View>
          <View style={styles.engagementItem}>
            <Ionicons name="eye" size={16} color="#F59E0B" />
            <Text style={styles.engagementText}>{item.views}</Text>
          </View>
        </View>
        
        {/* Bookings Badge */}
        <View style={styles.bookingsBadge}>
          <Ionicons name="calendar-outline" size={14} color="#10B981" />
          <Text style={styles.bookingsText}>{item.bookings} bookings from this video</Text>
        </View>
      </View>
    </View>
  );

  // Video menu actions
  const handleOpenVideoMenu = (video: UploadedVideo) => {
    setSelectedVideoForMenu(video);
    setShowVideoMenu(true);
  };

  const handleDeleteVideo = async () => {
    if (!selectedVideoForMenu) return;
    
    Alert.alert(
      'Delete Video',
      'Are you sure you want to delete this video? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Remove from local state
              setVideos(prev => prev.filter(v => v.id !== selectedVideoForMenu.id));
              showToast({ type: 'success', message: 'Video deleted' });
              setShowVideoMenu(false);
              setSelectedVideoForMenu(null);
            } catch (error) {
              showToast({ type: 'error', message: 'Failed to delete video' });
            }
          },
        },
      ]
    );
  };

  const handleViewVideoAnalytics = () => {
    if (!selectedVideoForMenu) return;
    Alert.alert(
      'Video Analytics',
      `📊 ${selectedVideoForMenu.title}\n\n👁️ Views: ${selectedVideoForMenu.views}\n❤️ Likes: ${selectedVideoForMenu.likes}\n💬 Comments: ${selectedVideoForMenu.comments}\n📅 Bookings: ${selectedVideoForMenu.bookings}`,
      [{ text: 'OK' }]
    );
    setShowVideoMenu(false);
  };

  const handleEditVideo = () => {
    if (!selectedVideoForMenu) return;
    setVideoTitle(selectedVideoForMenu.title);
    setVideoDescription(selectedVideoForMenu.description || '');
    setShowVideoMenu(false);
    // Could open an edit modal here
    Alert.alert('Edit Video', 'Video editing coming soon!');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return '#10B981';
      case 'processing': return '#F59E0B';
      case 'uploading': return '#3B82F6';
      case 'failed': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Videos</Text>
        <TouchableOpacity>
          <Ionicons name="help-circle-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={(item, index) => item.id || `video-${index}`}
        ListHeaderComponent={() => (
          <>
            {renderAnalyticsOverview()}
            {renderUploadOptions()}
          </>
        )}
        ListFooterComponent={() => (
          <View style={styles.tipsFooter}>
            <Text style={styles.tipsTitle}>Video Tips</Text>
            <Text style={styles.tipsText}>
              • Keep videos 30-45 seconds max • Show before/after • Good lighting • Clear audio
            </Text>
            {/* Spacer to ensure content clears the floating nav */}
            <View style={{ height: NAV_CLEARANCE + insets.bottom }} />
          </View>
        )}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#F59E0B"
            colors={['#F59E0B']}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: NAV_CLEARANCE + insets.bottom },
        ]}
        // Performance optimizations
        {...getOptimalListProps(120)} // Estimated item height
        removeClippedSubviews={true}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          // Track scroll performance
          const endTiming = performanceMonitor.startTiming('video_list_scroll');
          setTimeout(endTiming, 100);
        }}
        onViewableItemsChanged={({ viewableItems }) => {
          // Cache visible items for better performance
          viewableItems.forEach(({ item, index }) => {
            if (item && !memoryManager.has(`video_${item.id}`)) {
              memoryManager.set(`video_${item.id}`, item);
            }
          });
        }}
        viewabilityConfig={{
          itemVisiblePercentThreshold: 50,
          minimumViewTime: 250,
        }}
      />

      {/* Floating Navigation */}
      <CleanerFloatingNavigation 
        navigation={navigation as any}
        currentScreen="Content"
      />

      {/* Video Actions Menu */}
      <Modal
        visible={showVideoMenu}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowVideoMenu(false)}
      >
        <TouchableOpacity 
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowVideoMenu(false)}
        >
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle} numberOfLines={1}>
                {selectedVideoForMenu?.title || 'Video'}
              </Text>
            </View>
            
            <TouchableOpacity style={styles.menuItem} onPress={handleViewVideoAnalytics}>
              <Ionicons name="stats-chart" size={22} color="#3B82F6" />
              <Text style={styles.menuItemText}>View Analytics</Text>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={handleEditVideo}>
              <Ionicons name="create-outline" size={22} color="#F59E0B" />
              <Text style={styles.menuItemText}>Edit Details</Text>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setShowVideoMenu(false);
              if (selectedVideoForMenu) {
                // Share functionality
                Alert.alert('Share', 'Share video coming soon!');
              }
            }}>
              <Ionicons name="share-social-outline" size={22} color="#10B981" />
              <Text style={styles.menuItemText}>Share Video</Text>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </TouchableOpacity>
            
            <View style={styles.menuDivider} />
            
            <TouchableOpacity style={styles.menuItemDanger} onPress={handleDeleteVideo}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
              <Text style={styles.menuItemTextDanger}>Delete Video</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuCancel}
              onPress={() => setShowVideoMenu(false)}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Service Type Picker Modal */}
      <Modal
        visible={showServiceTypePicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowServiceTypePicker(false)}
      >
        <TouchableOpacity 
          style={styles.serviceTypePickerOverlay}
          activeOpacity={1}
          onPress={() => setShowServiceTypePicker(false)}
        >
          <View style={styles.serviceTypePickerContainer}>
            <View style={styles.serviceTypePickerHeader}>
              <Text style={styles.serviceTypePickerTitle}>Select Service Type</Text>
              <TouchableOpacity onPress={() => setShowServiceTypePicker(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.serviceTypeList} showsVerticalScrollIndicator={false}>
              {SERVICE_TYPE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.serviceTypeOption,
                    videoServiceType === option.id && styles.serviceTypeOptionSelected
                  ]}
                  onPress={() => {
                    setVideoServiceType(option.id);
                    setShowServiceTypePicker(false);
                  }}
                >
                  <View style={[
                    styles.serviceTypeIconContainer,
                    videoServiceType === option.id && styles.serviceTypeIconContainerSelected
                  ]}>
                    <Ionicons 
                      name={option.icon as any} 
                      size={22} 
                      color={videoServiceType === option.id ? '#FFFFFF' : '#F59E0B'} 
                    />
                  </View>
                  <Text style={[
                    styles.serviceTypeOptionText,
                    videoServiceType === option.id && styles.serviceTypeOptionTextSelected
                  ]}>
                    {option.label}
                  </Text>
                  {videoServiceType === option.id && (
                    <Ionicons name="checkmark-circle" size={22} color="#F59E0B" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Video Details Modal - Social Media Style */}
      <Modal
        visible={showVideoDetailsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCancelVideoDetails}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCancelVideoDetails}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Post Your Video</Text>
              <TouchableOpacity 
                onPress={handleConfirmVideoDetails}
                style={[styles.postButton, (!videoTitle.trim() || !videoServiceType) && styles.postButtonDisabled]}
                disabled={!videoTitle.trim() || !videoServiceType}
              >
                <Text style={[styles.postButtonText, (!videoTitle.trim() || !videoServiceType) && styles.postButtonTextDisabled]}>
                  Post
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Video Preview with Thumbnail */}
              {pendingVideoUri && (
                <View style={styles.modalVideoPreviewContainer}>
                  <View style={styles.modalVideoPreview}>
                    <Video
                      source={{ uri: pendingVideoUri }}
                      style={styles.modalVideoPlayer}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={false}
                      useNativeControls
                    />
                  </View>
                  {/* Thumbnail Preview */}
                  {videoThumbnailUri && (
                    <View style={styles.thumbnailPreviewContainer}>
                      <Text style={styles.thumbnailPreviewLabel}>Thumbnail Preview</Text>
                      <Image 
                        source={{ uri: videoThumbnailUri }} 
                        style={styles.thumbnailPreviewImage}
                        resizeMode="cover"
                      />
                    </View>
                  )}
                </View>
              )}

              {/* Title Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput
                  style={styles.titleInput}
                  placeholder="Give your video a catchy title..."
                  placeholderTextColor="#9CA3AF"
                  value={videoTitle}
                  onChangeText={setVideoTitle}
                  maxLength={100}
                />
                <Text style={styles.charCount}>{videoTitle.length}/100</Text>
              </View>

              {/* Service Type Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Service Type *</Text>
                <TouchableOpacity 
                  style={styles.serviceTypeSelector}
                  onPress={() => setShowServiceTypePicker(true)}
                >
                  {videoServiceType ? (
                    <View style={styles.selectedServiceType}>
                      <Ionicons 
                        name={(SERVICE_TYPE_OPTIONS.find(o => o.id === videoServiceType)?.icon || 'home-outline') as any} 
                        size={20} 
                        color="#F59E0B" 
                      />
                      <Text style={styles.selectedServiceTypeText}>
                        {SERVICE_TYPE_OPTIONS.find(o => o.id === videoServiceType)?.label || 'Select service type'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.serviceTypePlaceholder}>Select what type of cleaning this is...</Text>
                  )}
                  <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              {/* Description Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={styles.descriptionInput}
                  placeholder="Tell customers about this cleaning job... What makes it special?"
                  placeholderTextColor="#9CA3AF"
                  value={videoDescription}
                  onChangeText={setVideoDescription}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{videoDescription.length}/500</Text>
              </View>

              {/* Tips */}
              <View style={styles.tipsCard}>
                <Ionicons name="bulb-outline" size={20} color="#F59E0B" />
                <View style={styles.tipsContent}>
                  <Text style={styles.tipsCardTitle}>Pro Tips</Text>
                  <Text style={styles.tipsCardText}>
                    • Describe the service type{'\n'}
                    • Mention before/after results{'\n'}
                    • Add your service area
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  listContent: {
    paddingBottom: 0, // dynamic via insets + nav clearance
  },
  uploadSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 26,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  previewContainer: {
    marginTop: 20,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 12,
  },
  videoPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  progressContainer: {
    marginTop: 20,
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },
  cancelButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  progressDetails: {
    marginTop: 8,
    alignItems: 'center',
  },
  progressDetailText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    textAlign: 'center',
  },
  // Modern Video Card Styles
  videoCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    position: 'relative',
    height: 200,
    backgroundColor: '#1F2937',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 3, // Optical centering for play icon
  },
  durationBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  durationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  videoInfo: {
    padding: 14,
  },
  videoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  moreButton: {
    padding: 4,
  },
  videoDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  videoStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
  },
  // Engagement styles
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
    marginBottom: 10,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  engagementText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  bookingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    marginTop: 4,
  },
  bookingsText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#059669',
  },
  // Video action menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 34,
  },
  menuHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  menuDivider: {
    height: 8,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  menuItemDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  menuItemTextDanger: {
    flex: 1,
    fontSize: 16,
    color: '#EF4444',
  },
  menuCancel: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  tipsFooter: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  // Loading styles
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  // Analytics Styles
  analyticsSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    marginTop: 8, // Add top spacing
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginTop: 12,
  },
  performanceCard: {
    width: CARD_WIDTH,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  postButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  postButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  postButtonTextDisabled: {
    color: '#9CA3AF',
  },
  modalBody: {
    padding: 16,
  },
  modalVideoPreviewContainer: {
    marginBottom: 20,
  },
  modalVideoPreview: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1F2937',
  },
  modalVideoPlayer: {
    width: '100%',
    height: '100%',
  },
  thumbnailPreviewContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  thumbnailPreviewLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginBottom: 8,
  },
  thumbnailPreviewImage: {
    width: 80,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  descriptionInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1F2937',
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  tipsCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    padding: 14,
    borderRadius: 12,
    gap: 12,
    marginTop: 8,
  },
  tipsContent: {
    flex: 1,
  },
  tipsCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  tipsCardText: {
    fontSize: 13,
    color: '#B45309',
    lineHeight: 20,
  },
  // Service Type Selector Styles
  serviceTypeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
  },
  selectedServiceType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectedServiceTypeText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  serviceTypePlaceholder: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  // Service Type Picker Modal Styles
  serviceTypePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  serviceTypePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 40,
  },
  serviceTypePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  serviceTypePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  serviceTypeList: {
    padding: 16,
  },
  serviceTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceTypeOptionSelected: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  serviceTypeIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  serviceTypeIconContainerSelected: {
    backgroundColor: '#F59E0B',
  },
  serviceTypeOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  serviceTypeOptionTextSelected: {
    color: '#92400E',
    fontWeight: '600',
  },
});

export default VideoUploadScreen; 