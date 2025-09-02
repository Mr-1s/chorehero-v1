import React, { useState, useRef } from 'react';
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
} from 'react-native';
import { Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { uploadService, type UploadProgress, type UploadResponse } from '../../services/uploadService';
import { contentService } from '../../services/contentService';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../utils/constants';

import { EmptyState, EmptyStateConfigs } from '../../components/EmptyState';
import { getOptimalListProps, memoryManager, performanceMonitor, optimizeImageUri } from '../../utils/performance';

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
  duration: number;
  uploadDate: string;
  status: 'uploading' | 'processing' | 'live' | 'failed';
  views: number;
  bookings: number;
}

const VideoUploadScreen: React.FC<VideoUploadProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [uploadDetails, setUploadDetails] = useState<UploadProgress | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [videos, setVideos] = useState<UploadedVideo[]>([]);

  // Calculate analytics metrics
  const totalViews = videos.reduce((sum, video) => sum + video.views, 0);
  const totalBookings = videos.reduce((sum, video) => sum + video.bookings, 0);
  const conversionRate = totalViews > 0 ? ((totalBookings / totalViews) * 100).toFixed(1) : '0.0';
  const avgViewsPerVideo = videos.length > 0 ? Math.round(totalViews / videos.length) : 0;

  const videoRef = useRef<Video>(null);

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
      
      // Request permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('📷 Camera permission status:', status);
      
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required', 
          'ChoreHero needs camera access to record videos. Please enable camera permission in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Settings', onPress: () => console.log('Open settings - implement Linking.openSettings()') }
          ]
        );
        return;
      }

      console.log('🎬 Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: 60,
        quality: 0.8,
      });

      console.log('📹 Camera result:', result);

      if (!result.canceled && result.assets[0]) {
        console.log('✅ Video selected from camera:', result.assets[0].uri);
        setSelectedVideo(result.assets[0].uri);
        handleVideoUpload(result.assets[0].uri);
      } else {
        console.log('❌ Camera upload canceled or no video selected');
      }
    } catch (error) {
      console.error('🚨 Camera upload error:', error);
      Alert.alert(
        'Camera Error', 
        `Failed to record video: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or use the library option.`,
        [{ text: 'OK' }]
      );
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
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: 60,
        quality: 0.8,
      });

      console.log('📚 Library result:', result);

      if (!result.canceled && result.assets[0]) {
        console.log('✅ Video selected from library:', result.assets[0].uri);
        setSelectedVideo(result.assets[0].uri);
        handleVideoUpload(result.assets[0].uri);
      } else {
        console.log('❌ Library upload canceled or no video selected');
      }
    } catch (error) {
      console.error('🚨 Library upload error:', error);
      Alert.alert(
        'Library Error', 
        `Failed to select video: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your media library permissions.`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleVideoUpload = async (videoUri: string) => {
    // Clear previous errors
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      console.log('🎬 Starting video upload process for:', videoUri);
      
      // First validate the video
      const validation = await uploadService.validateFile(videoUri, {
        maxFileSize: 50 * 1024 * 1024, // 50MB for videos
        allowedTypes: ['video/mp4', 'video/mov', 'video/avi']
      });

      if (!validation.isValid) {
        console.error('❌ Video validation failed:', validation.error);
        setUploadError(validation.error || 'Invalid video file');
        Alert.alert('Upload Error', validation.error || 'Invalid video file');
        return;
      }

      console.log('✅ Video validation passed, starting upload...');

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
          maxFileSize: 50 * 1024 * 1024, // 50MB
          allowedTypes: ['video/mp4', 'video/mov', 'video/avi'],
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
            const contentResponse = await contentService.createPost(user.id, {
              title: 'New Cleaning Video',
              description: 'Check out my latest cleaning work!',
              content_type: 'video' as const,
              media_url: response.url,
              status: 'published' as const,
              tags: ['cleaning', 'professional']
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
          title: 'New Cleaning Video',
          duration: 45,
          uploadDate: new Date().toISOString().split('T')[0],
          status: 'live', // Set to live since we've published it
          views: 0,
          bookings: 0,
        };

        setVideos(prev => [newVideo, ...prev]);
        
        Alert.alert(
          'Upload Successful! 🎉',
          'Your video has been uploaded and will appear in the Feed and Discover tabs for customers to see.',
          [{ text: 'OK', onPress: () => setSelectedVideo(null) }]
        );

        // Clear upload state
        setUploadDetails(null);
        setActiveUploadId(null);

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

        const alertButtons = showRetry ? [
          { text: 'Cancel', style: 'cancel' as const },
          { text: 'Retry', onPress: () => handleVideoUpload(videoUri) }
        ] : [
          { text: 'OK' }
        ];

        Alert.alert(errorTitle, errorMessage, alertButtons);
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error.message || 'An unexpected error occurred';
      setUploadError(errorMessage);
      
      Alert.alert(
        'Upload Error',
        errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => handleVideoUpload(videoUri) }
        ]
      );
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
        Show your cleaning skills with a 30-60 second video
      </Text>

      <View style={styles.uploadButtons}>
        <TouchableOpacity style={styles.uploadButton} onPress={handleCameraUpload}>
          <Ionicons name="camera" size={24} color="#ffffff" />
          <Text style={styles.uploadButtonText}>Record Video</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadButton} onPress={handleLibraryUpload}>
          <Ionicons name="images" size={24} color="#ffffff" />
          <Text style={styles.uploadButtonText}>Choose from Library</Text>
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
            resizeMode="cover"
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
      
      <View style={styles.analyticsGrid}>
        <View style={styles.analyticsCard}>
          <Ionicons name="eye" size={24} color="#3B82F6" />
          <Text style={styles.analyticsValue}>{totalViews.toLocaleString()}</Text>
          <Text style={styles.analyticsLabel}>Total Views</Text>
        </View>
        
        <View style={styles.analyticsCard}>
          <Ionicons name="calendar" size={24} color="#10B981" />
          <Text style={styles.analyticsValue}>{totalBookings}</Text>
          <Text style={styles.analyticsLabel}>Bookings Generated</Text>
        </View>
        
        <View style={styles.analyticsCard}>
          <Ionicons name="trending-up" size={24} color="#F59E0B" />
          <Text style={styles.analyticsValue}>{conversionRate}%</Text>
          <Text style={styles.analyticsLabel}>Conversion Rate</Text>
        </View>
        
        <View style={styles.analyticsCard}>
          <Ionicons name="stats-chart" size={24} color="#8B5CF6" />
          <Text style={styles.analyticsValue}>{avgViewsPerVideo}</Text>
          <Text style={styles.analyticsLabel}>Avg Views/Video</Text>
        </View>
      </View>
    </View>
  );

  const renderVideoItem = ({ item }: { item: UploadedVideo }) => (
    <View style={styles.videoItem}>
      <Video
        source={{ uri: item.uri }}
        style={styles.videoThumbnail}
        resizeMode="cover"
        shouldPlay={false}
      />
      
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle}>{item.title}</Text>
        <Text style={styles.videoDate}>Uploaded {item.uploadDate}</Text>
        
        <View style={styles.videoStats}>
          <View style={styles.statItem}>
            <Ionicons name="eye" size={14} color="#6B7280" />
            <Text style={styles.statText}>{item.views} views</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="calendar" size={14} color="#6B7280" />
            <Text style={styles.statText}>{item.bookings} bookings</Text>
          </View>
        </View>
      </View>

      <View style={styles.videoActions}>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
        
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="ellipsis-vertical" size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </View>
  );

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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
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

      {/* Tips */}
      <View style={styles.tipsContainer}>
        <Text style={styles.tipsTitle}>Video Tips</Text>
        <Text style={styles.tipsText}>
          • Keep videos 30-60 seconds • Show before/after • Good lighting • Clear audio
        </Text>
      </View>
      
      <CleanerFloatingNavigation 
        navigation={navigation as any}
        currentScreen="Content"
        unreadCount={3}
      />
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
    fontWeight: '700',
    color: '#1F2937',
  },
  listContent: {
    paddingBottom: 100,
  },
  uploadSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
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
    backgroundColor: '#3ad3db',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  previewContainer: {
    marginTop: 20,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
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
    borderRadius: 12,
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
  videoItem: {
    flexDirection: 'row',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  videoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  videoInfo: {
    flex: 1,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  videoDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  videoStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
  },
  videoActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionButton: {
    padding: 4,
  },
  tipsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  tipsText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  // Analytics Styles
  analyticsSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  analyticsCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  analyticsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default VideoUploadScreen; 