import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Switch,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useRoute, RouteProp } from '@react-navigation/native';
import { uploadService, type UploadProgress, type UploadResponse } from '../../services/uploadService';
import { contentService } from '../../services/contentService';
import { contentAnalyticsService, type VideoWithStats, type ContentPerformanceSummary } from '../../services/contentAnalyticsService';
import { useAuth } from '../../hooks/useAuth';
import { useCleanerStore } from '../../store/cleanerStore';
import { COLORS } from '../../utils/constants';
import { cleanerTheme } from '../../utils/theme';
import { supabase } from '../../services/supabase';
import { useToast } from '../../components/Toast';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, EmptyStateConfigs } from '../../components/EmptyState';
import { getOptimalListProps, memoryManager, performanceMonitor, optimizeImageUri } from '../../utils/performance';
import MetricCard from '../../components/cleaner/MetricCard';
import { Dimensions } from 'react-native';
import { wp, hp } from '../../utils/responsive';

const PRO_COLORS = cleanerTheme.colors;

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 12) / 2; // 20px padding each side, 12px gap
const UI = {
  bg: COLORS.background,
  surface: COLORS.surface,
  surfaceAlt: COLORS.surfaceAlt,
  border: COLORS.border,
  borderSoft: COLORS.borderSoft,
  borderHard: COLORS.borderHard,
  textPrimary: COLORS.text.primary,
  textSecondary: COLORS.text.secondary,
  textMuted: COLORS.text.muted,
  textInverse: COLORS.text.inverse,
  primary: PRO_COLORS.primary,
  success: COLORS.success,
  warning: COLORS.warning,
  error: COLORS.error,
  info: COLORS.info,
};

// Video upload limits
const VIDEO_LIMITS = {
  maxDurationSeconds: 45,
  minDurationSeconds: 5,
  maxFileSizeMB: 35,
  allowedFormats: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime'],
};

const IOS_VIDEO_COMPRESSION_OPTIONS =
  Platform.OS === 'ios'
    ? {
        // Use iOS export presets to avoid huge HEVC/4K originals from Photos.
        videoQuality: (ImagePicker as any).UIImagePickerControllerQualityType?.Low,
        videoExportPreset: (ImagePicker as any).VideoExportPreset?.LowQuality,
      }
    : {};
const TARGET_VIDEO_SIZE_BYTES = VIDEO_LIMITS.maxFileSizeMB * 1024 * 1024;
const COMPRESS_WHEN_OVER_BYTES = 12 * 1024 * 1024;

const ANALYTICS_FETCH_TIMEOUT_MS = 45000;

const EMPTY_PERFORMANCE_SUMMARY: ContentPerformanceSummary = {
  totalViews: 0,
  totalBookings: 0,
  totalRevenue: 0,
  conversionRate: 0,
  avgViewsPerVideo: 0,
  videoCount: 0,
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

/** Run analytics fetch; on timeout or error return fallback so the screen never hangs. */
async function loadAnalyticsWithFallback<T>(
  promise: Promise<T>,
  ms: number,
  name: string,
  fallback: T
): Promise<T> {
  try {
    return await withTimeout(promise, ms, name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('timed out')) {
      console.warn(`⚠️ ${name} timed out — using fallback`);
    } else {
      console.warn(`⚠️ ${name} failed:`, e);
    }
    return fallback;
  }
}

const SERVICE_TYPE_OPTIONS = [
  { id: 'standard_clean', label: 'Standard Cleaning', icon: 'home-outline' },
  { id: 'deep_clean', label: 'Deep Cleaning', icon: 'sparkles-outline' },
  { id: 'express_clean', label: 'Express Clean', icon: 'flash-outline' },
  { id: 'kitchen', label: 'Kitchen Cleaning', icon: 'restaurant-outline' },
  { id: 'bathroom', label: 'Bathroom Cleaning', icon: 'water-outline' },
  { id: 'bedroom', label: 'Bedroom Cleaning', icon: 'bed-outline' },
  { id: 'living_room', label: 'Living Room', icon: 'tv-outline' },
  { id: 'move_out', label: 'Move Out Clean', icon: 'car-outline' },
  { id: 'move_in', label: 'Move In Clean', icon: 'key-outline' },
  { id: 'post_construction', label: 'Post-Construction', icon: 'hammer-outline' },
  { id: 'airbnb_turnover', label: 'Airbnb Turnover', icon: 'calendar-outline' },
  { id: 'office', label: 'Office Cleaning', icon: 'briefcase-outline' },
  { id: 'carpet', label: 'Carpet Cleaning', icon: 'layers-outline' },
  { id: 'floor', label: 'Floor Care', icon: 'grid-outline' },
  { id: 'window', label: 'Window Cleaning', icon: 'grid-outline' },
  { id: 'laundry', label: 'Laundry Service', icon: 'shirt-outline' },
  { id: 'organizing', label: 'Home Organizing', icon: 'albums-outline' },
  { id: 'appliance', label: 'Appliance Cleaning', icon: 'cube-outline' },
  { id: 'pet', label: 'Pet-Friendly Clean', icon: 'paw-outline' },
  { id: 'eco', label: 'Eco-Friendly Clean', icon: 'leaf-outline' },
  { id: 'other', label: 'Other Service', icon: 'ellipsis-horizontal-outline' },
] as const;

function mapServiceNameToTypeId(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('deep')) return 'deep_clean';
  if (n.includes('express')) return 'express_clean';
  if (n.includes('move out') || n.includes('move-out')) return 'move_out';
  if (n.includes('move in') || n.includes('move-in')) return 'move_in';
  if (n.includes('standard')) return 'standard_clean';
  if (n.includes('kitchen')) return 'kitchen';
  if (n.includes('bathroom')) return 'bathroom';
  if (n.includes('bedroom')) return 'bedroom';
  if (n.includes('living')) return 'living_room';
  if (n.includes('airbnb') || n.includes('turnover')) return 'airbnb_turnover';
  if (n.includes('office')) return 'office';
  if (n.includes('carpet')) return 'carpet';
  if (n.includes('window')) return 'window';
  if (n.includes('laundry')) return 'laundry';
  if (n.includes('organiz')) return 'organizing';
  if (n.includes('eco') || n.includes('green')) return 'eco';
  if (n.includes('pet')) return 'pet';
  if (n.includes('post') && n.includes('construction')) return 'post_construction';
  if (n.includes('floor')) return 'floor';
  if (n.includes('appliance')) return 'appliance';
  return 'other';
}

function normalizeRequestCategoryToTypeId(raw: string): string {
  const t = (raw || '').trim();
  if (!t) return 'other';
  if (SERVICE_TYPE_OPTIONS.some((o) => o.id === t)) return t;
  return mapServiceNameToTypeId(t);
}

type VideoUploadRouteParams = {
  videoUri?: string;
  durationMillis?: number;
  returnToContentHub?: boolean;
};

type StackParamList = {
  VideoUpload: VideoUploadRouteParams | undefined;
  CleanerProfile: undefined;
};

type VideoUploadNavigationProp = StackNavigationProp<StackParamList, 'VideoUpload'>;
type VideoUploadRoute = RouteProp<StackParamList, 'VideoUpload'>;

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

interface ActiveProService {
  id: string;
  service_id: string;
  service_name: string;
}

const VideoUploadScreen: React.FC<VideoUploadProps> = ({ navigation }) => {
  const route = useRoute<VideoUploadRoute>();
  const insets = useSafeAreaInsets();
  const NAV_CLEARANCE = 110; // CleanerFloatingNavigation: height ~80 + bottom offset ~30
  const { user, isCleaner, refreshSession } = useAuth();
  const { showToast } = useToast();
  /** Auth embeds can be missing/stale; DB row is source of truth for pro upload */
  const [hasCleanerProfileRow, setHasCleanerProfileRow] = useState(false);
  const canActAsPro = isCleaner || hasCleanerProfileRow;
  const [isUploading, setIsUploading] = useState(false);
  const [isOptimizingVideo, setIsOptimizingVideo] = useState(false);
  /**
   * Status text shown while we're compressing the source video. Kept separate
   * from `uploadError` so the modal doesn't paint a progress message in the
   * red error slot (which previously confused users into thinking the upload
   * had failed when it was actually still working).
   */
  const [optimizingMessage, setOptimizingMessage] = useState<string | null>(null);
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
  const [activeProServices, setActiveProServices] = useState<ActiveProService[]>([]);
  const [selectedProServiceId, setSelectedProServiceId] = useState<string>('');
  const [showRequestServiceModal, setShowRequestServiceModal] = useState(false);
  const [requestedServiceName, setRequestedServiceName] = useState('');
  const [requestedServiceCategory, setRequestedServiceCategory] = useState('other');
  const [requestedServiceDescription, setRequestedServiceDescription] = useState('');
  const [showVideoDetailsModal, setShowVideoDetailsModal] = useState(false);
  const [pendingVideoUri, setPendingVideoUri] = useState<string | null>(null);
  const [videoThumbnailUri, setVideoThumbnailUri] = useState<string | null>(null);
  const [showServiceTypePicker, setShowServiceTypePicker] = useState(false);

  // Package fields for bookable content
  const [isBookable, setIsBookable] = useState(true);
  const [packageType, setPackageType] = useState<'fixed' | 'hourly'>('hourly');
  const [basePrice, setBasePrice] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('2');

  // Video action menu
  const [showVideoMenu, setShowVideoMenu] = useState(false);
  const [selectedVideoForMenu, setSelectedVideoForMenu] = useState<UploadedVideo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Video player modal
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<UploadedVideo | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const playerRef = useRef<Video>(null);
  const [performanceSummary, setPerformanceSummary] = useState<ContentPerformanceSummary>({
    totalViews: 0,
    totalBookings: 0,
    totalRevenue: 0,
    conversionRate: 0,
    avgViewsPerVideo: 0,
    videoCount: 0,
  });

  const videoRef = useRef<Video>(null);
  const lastPreparedUriFromRoute = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id || user.id.startsWith('demo_')) {
      setHasCleanerProfileRow(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('cleaner_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) setHasCleanerProfileRow(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  /** Re-check DB on tap (avoids race before useEffect; fixes wrong users.role) */
  const ensureProForUpload = useCallback(async (): Promise<boolean> => {
    if (isCleaner || hasCleanerProfileRow) return true;
    if (!user?.id) return false;
    const { data } = await supabase
      .from('cleaner_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setHasCleanerProfileRow(true);
      return true;
    }
    return false;
  }, [user?.id, isCleaner, hasCleanerProfileRow]);

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

  /** Clears the staged local clip and form so the user is not stuck after cancel, timeout, or error. */
  const clearVideoDraft = useCallback(() => {
    setShowVideoDetailsModal(false);
    setShowServiceTypePicker(false);
    setPendingVideoUri(null);
    setSelectedVideo(null);
    setVideoTitle('');
    setVideoDescription('');
    setVideoServiceType('');
    setVideoThumbnailUri(null);
    setIsBookable(true);
    setPackageType('hourly');
    setBasePrice('');
    setEstimatedHours('2');
    setUploadError(null);
    lastPreparedUriFromRoute.current = null;
  }, []);

  /**
   * Compress the video before upload when it's large.
   *
   * `react-native-compressor`'s `Video.compress` has no built-in timeout and
   * can hang indefinitely on certain HEVC inputs in TestFlight builds — that
   * was the root cause of the "stuck on Optimizing..." reports. Wrap it in a
   * Promise.race so we always proceed within 90s. Worst case we upload the
   * source video, which the storage layer can still accept up to 35MB.
   */
  const COMPRESS_TIMEOUT_MS = 90 * 1000;
  const optimizeVideoForUpload = async (uri: string): Promise<string> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      const originalSize = (fileInfo as any)?.size || 0;
      if (!originalSize || originalSize < COMPRESS_WHEN_OVER_BYTES) {
        return uri;
      }

      setOptimizingMessage('Optimizing video for upload…');
      const compressor = await import('react-native-compressor');
      const videoCompressor = (compressor as any)?.Video;
      if (!videoCompressor?.compress) {
        setOptimizingMessage(null);
        return uri;
      }

      const compressPromise: Promise<string | null> = videoCompressor.compress(uri, {
        compressionMethod: 'manual',
        maxSize: 540,
        bitrate: 900000,
        minimumFileSizeForCompress: 0,
      });

      let timedOut = false;
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => {
          timedOut = true;
          resolve(null);
        }, COMPRESS_TIMEOUT_MS)
      );

      const compressedUri = await Promise.race([compressPromise, timeoutPromise]);
      if (timedOut) {
        console.warn('⚠️ Video compression timed out — falling back to source');
        // Best-effort: tell the compressor to abort if it exposes an API.
        try {
          (videoCompressor as any).cancelCompression?.();
        } catch {
          // ignore
        }
        return uri;
      }
      if (!compressedUri) return uri;

      const compressedInfo = await FileSystem.getInfoAsync(compressedUri, { size: true });
      const compressedSize = (compressedInfo as any)?.size || 0;
      if (compressedSize > 0 && compressedSize < originalSize) {
        console.log(
          `✅ Video optimized: ${(originalSize / 1048576).toFixed(1)}MB -> ${(compressedSize / 1048576).toFixed(1)}MB`
        );
        return compressedUri;
      }
      return uri;
    } catch (error) {
      console.warn('⚠️ Video optimization skipped:', error);
      return uri;
    } finally {
      setOptimizingMessage(null);
    }
  };

  // Fetch real data from database
  const loadContentData = useCallback(async () => {
    if (!user?.id || user.id.startsWith('demo_')) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log('📊 Loading content analytics for user:', user.id);

      const [summary, videosWithStats] = await Promise.all([
        loadAnalyticsWithFallback(
          contentAnalyticsService.getPerformanceSummary(user.id),
          ANALYTICS_FETCH_TIMEOUT_MS,
          'getPerformanceSummary',
          EMPTY_PERFORMANCE_SUMMARY
        ),
        loadAnalyticsWithFallback(
          contentAnalyticsService.getVideosWithStats(user.id),
          ANALYTICS_FETCH_TIMEOUT_MS,
          'getVideosWithStats',
          [] as VideoWithStats[]
        ),
      ]);

      setPerformanceSummary(summary);

      const formattedVideos: UploadedVideo[] = videosWithStats.map((v) => ({
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
      setPerformanceSummary(EMPTY_PERFORMANCE_SUMMARY);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id]);

  // Load data on mount
  useEffect(() => {
    loadContentData();
  }, [loadContentData]);

  useEffect(() => {
    const loadActiveProServices = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('pro_services')
        .select('id, service_id, services(name)')
        .eq('pro_id', user.id)
        .eq('is_active', true);
      const mapped: ActiveProService[] = (data || []).map((row: any) => ({
        id: row.id,
        service_id: row.service_id,
        service_name: row.services?.name || 'Service',
      }));
      setActiveProServices(mapped);
      if (mapped[0] && !selectedProServiceId) {
        setSelectedProServiceId(mapped[0].id);
        setVideoServiceType((v) => v || mapServiceNameToTypeId(mapped[0].service_name));
      }
    };
    loadActiveProServices();
  }, [user?.id]);

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

      if (!(canActAsPro || (await ensureProForUpload()))) {
        Alert.alert(
          'Cleaner account required',
          'We could not confirm a pro profile for this account. Sign in as a pro or complete cleaner onboarding, then try again.',
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
              onPress: () => navigation.navigate('EditProfile' as any)
            }
          ]
        );
        return;
      }
      
      // Request camera + microphone (needed for video on iOS)
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (!camPerm.granted) {
        try { (showToast as any) && showToast({ type: 'warning', message: 'Camera permission required' }); } catch {}
        return;
      }

      console.log('🎬 Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        allowsEditing: false, // Editing can cause iOS to close camera; trim after if needed
        videoMaxDuration: VIDEO_LIMITS.maxDurationSeconds,
        quality: 0.25,
        ...(IOS_VIDEO_COMPRESSION_OPTIONS as any),
      });

      console.log('📹 Camera result:', result);

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('✅ Video selected from camera:', asset.uri);
        
        // Check file size FIRST
        const MAX_FILE_SIZE_MB = VIDEO_LIMITS.maxFileSizeMB;
        const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
        
        try {
          const fileInfo = await FileSystem.getInfoAsync(asset.uri, { size: true });
          const fileSize = (fileInfo as any).size || 0;
          const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
          console.log(`📦 File size: ${fileSizeMB}MB`);
          
          if (fileSize > MAX_FILE_SIZE_BYTES) {
            Alert.alert(
              'Large Video Detected',
              `This video is ${fileSizeMB}MB. We'll auto-optimize before upload to target ${MAX_FILE_SIZE_MB}MB.`,
              [{ text: 'OK', style: 'default' }]
            );
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

      if (!(canActAsPro || (await ensureProForUpload()))) {
        Alert.alert(
          'Cleaner account required',
          'We could not confirm a pro profile for this account. Sign in as a pro or complete cleaner onboarding, then try again.',
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
              onPress: () => navigation.navigate('EditProfile' as any)
            }
          ]
        );
        return;
      }
      
      const libPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!libPerm.granted) {
        try { (showToast as any) && showToast({ type: 'warning', message: 'Photo library permission required' }); } catch {}
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        videoMaxDuration: VIDEO_LIMITS.maxDurationSeconds,
        quality: 0.25,
        ...(IOS_VIDEO_COMPRESSION_OPTIONS as any),
      });

      console.log('📚 Library result:', result);

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        console.log('✅ Video selected from library:', asset.uri);
        
        // Check file size FIRST (before anything else)
        const MAX_FILE_SIZE_MB = VIDEO_LIMITS.maxFileSizeMB;
        const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
        
        try {
          const fileInfo = await FileSystem.getInfoAsync(asset.uri, { size: true });
          const fileSize = (fileInfo as any).size || 0;
          const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
          console.log(`📦 File size: ${fileSizeMB}MB`);
          
          if (fileSize > MAX_FILE_SIZE_BYTES) {
            Alert.alert(
              'Large Video Detected',
              `This video is ${fileSizeMB}MB. We'll auto-optimize before upload to target ${MAX_FILE_SIZE_MB}MB.`,
              [{ text: 'OK', style: 'default' }]
            );
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
    if (videoTitle.trim().length === 0 || !videoServiceType) {
      Alert.alert('Missing details', 'Add a title and pick a service type before posting.');
      return;
    }
    if (activeProServices.length > 0) {
      if (!selectedProServiceId && !requestedServiceName.trim()) {
        Alert.alert('Service Required', 'Select one of your active services or request a new one first.');
        return;
      }
    }
    setShowVideoDetailsModal(false);
    if (pendingVideoUri) {
      handleVideoUpload(pendingVideoUri);
      setPendingVideoUri(null);
    }
  };

  const handleSubmitServiceRequest = async () => {
    if (!user?.id || !requestedServiceName.trim()) {
      Alert.alert('Missing fields', 'Service name is required.');
      return;
    }
    const { error } = await supabase.from('service_requests').insert({
      requester_id: user.id,
      service_name: requestedServiceName.trim(),
      category: requestedServiceCategory,
      description: requestedServiceDescription || null,
    });
    if (error) {
      Alert.alert('Request failed', error.message);
      return;
    }
    console.log('SERVICE_REQUEST_CREATED', requestedServiceName.trim(), requestedServiceCategory);
    setShowRequestServiceModal(false);
    setSelectedProServiceId('');
    setVideoServiceType(normalizeRequestCategoryToTypeId(requestedServiceCategory));
    showToast({ type: 'success', message: 'Service request saved. You can post this video with it now.' });
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

  // Cancel video upload (details modal)
  const handleCancelVideoDetails = () => {
    clearVideoDraft();
  };

  // Pre-selected clip from Content tab (record / library): run checks and open the same details modal as in-app pickers
  useEffect(() => {
    const uri = route.params?.videoUri;
    const durationMillis = route.params?.durationMillis;
    if (!uri || !user?.id) return;
    if (lastPreparedUriFromRoute.current === uri) return;

    void (async () => {
      if (user.id.startsWith('demo_')) {
        lastPreparedUriFromRoute.current = uri;
        Alert.alert(
          'Account Required',
          'You need to create a real account to upload videos. Demo accounts cannot post content.',
          [{ text: 'OK' }]
        );
        return;
      }

      if (!(canActAsPro || (await ensureProForUpload()))) {
        lastPreparedUriFromRoute.current = uri;
        Alert.alert(
          'Cleaner account required',
          'We could not confirm a pro profile for this account. Sign in as a pro or complete cleaner onboarding, then try again.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      const profileCheck = await checkProfileComplete();
      if (!profileCheck.isComplete) {
        lastPreparedUriFromRoute.current = uri;
        Alert.alert(
          '⚠️ Complete Your Profile First',
          `Before uploading videos, please complete your profile:\n\n• ${profileCheck.missingFields.join('\n• ')}\n\nThis helps customers understand your services and pricing.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Edit Profile',
              onPress: () => navigation.navigate('EditProfile' as any),
            },
          ]
        );
        return;
      }

      const MAX_FILE_SIZE_BYTES = VIDEO_LIMITS.maxFileSizeMB * 1024 * 1024;
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
        const fileSize = (fileInfo as any).size || 0;
        if (fileSize > MAX_FILE_SIZE_BYTES) {
          lastPreparedUriFromRoute.current = uri;
          const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(1);
          Alert.alert(
            'Large Video Detected',
            `This video is ${fileSizeMB}MB. We'll auto-optimize before upload to target ${VIDEO_LIMITS.maxFileSizeMB}MB.`,
            [{ text: 'OK', style: 'default' }]
          );
        }
      } catch (sizeError) {
        console.warn('Could not check file size:', sizeError);
      }

      const durationSeconds = durationMillis != null ? durationMillis / 1000 : -1;
      if (durationSeconds >= 0) {
        if (durationSeconds > VIDEO_LIMITS.maxDurationSeconds) {
          lastPreparedUriFromRoute.current = uri;
          Alert.alert(
            'Video Too Long',
            `Please select a video that's ${VIDEO_LIMITS.maxDurationSeconds} seconds or less. Your video is ${Math.round(durationSeconds)} seconds.\n\nTip: Use the built-in editor to trim your video!`,
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
        if (durationSeconds > 0 && durationSeconds < VIDEO_LIMITS.minDurationSeconds) {
          lastPreparedUriFromRoute.current = uri;
          Alert.alert(
            'Video Too Short',
            `Videos should be at least ${VIDEO_LIMITS.minDurationSeconds} seconds long to showcase your work.`,
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
      }

      lastPreparedUriFromRoute.current = uri;
      setSelectedVideo(uri);
      const thumbnail = await generateThumbnail(uri);
      setVideoThumbnailUri(thumbnail);
      setPendingVideoUri(uri);
      setVideoTitle('');
      setVideoDescription('');
      setShowVideoDetailsModal(true);
    })();
  }, [
    route.params?.videoUri,
    route.params?.durationMillis,
    user,
    canActAsPro,
    ensureProForUpload,
    navigation,
  ]);

  const handleVideoUpload = async (videoUri: string) => {
    setUploadError(null);
    setIsUploading(true);
    setIsOptimizingVideo(true);
    setUploadProgress(5);

    const uploadSessionId = uploadService.createUploadSession();
    setActiveUploadId(uploadSessionId);

    let uploadSucceeded = false;

    try {
      console.log('🎬 Starting video upload process for:', videoUri);
      await refreshSession();

      const uploadUri = await optimizeVideoForUpload(videoUri);
      setUploadError(null);

      if (!uploadService.isUploadActive(uploadSessionId)) {
        return;
      }

      setIsOptimizingVideo(false);

      // Validate the video (soft validation - don't block on errors)
      try {
        const validation = await uploadService.validateFile(uploadUri, {
          maxFileSize: VIDEO_LIMITS.maxFileSizeMB * 1024 * 1024,
          allowedTypes: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime'],
        });

        if (!validation.isValid) {
          console.warn('⚠️ Video validation warning:', validation.error);
        } else {
          console.log('✅ Video validation passed');
        }
      } catch (validationError) {
        console.warn('⚠️ Validation check failed, proceeding anyway:', validationError);
      }

      console.log('📤 Starting upload to Supabase...');

      const response = await uploadService.uploadFile(
        uploadUri,
        'video',
        (progress: UploadProgress) => {
          console.log(
            `📊 Upload progress: ${progress.progress}%, ${progress.bytesTransferred}/${progress.totalBytes} bytes`
          );
          setUploadDetails(progress);
          setUploadProgress(progress.progress);

          if (progress.error) {
            console.error('❌ Upload progress error:', progress.error);
            setUploadError(progress.error);
          }
        },
        {
          uploadId: uploadSessionId,
          maxFileSize: VIDEO_LIMITS.maxFileSizeMB * 1024 * 1024,
          allowedTypes: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime'],
          maxRetries: 3,
          retryDelay: 2000,
        }
      );

      if (response.errorCode === 'CANCELLED') {
        clearVideoDraft();
        return;
      }

      if (response.success) {
        uploadSucceeded = true;
        console.log('✅ Video upload completed successfully:', response.url);

        // Create content post in database so it appears in Feed and Discover.
        // Tracked here so the success toast/feedback can reflect whether the
        // post row was actually created (storage success alone isn't enough).
        let postCreated = false;
        let postCreationError: string | null = null;
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
            
            const postData: Parameters<typeof contentService.createPost>[1] = {
              title: videoTitle || 'New Cleaning Video',
              description: videoDescription || 'Check out my latest cleaning work!',
              content_type: 'video' as const,
              media_url: response.url,
              thumbnail_url: thumbnailUrl,
              status: 'published' as const,
              tags: tags,
              metadata: {
                service_type: videoServiceType || null,
                pro_service_id: selectedProServiceId || null,
                requested_service_name: requestedServiceName || null,
              },
            };

            if (selectedProServiceId) {
              const selectedService = activeProServices.find((s) => s.id === selectedProServiceId);
              if (selectedService) {
                postData.metadata = {
                  ...(postData.metadata || {}),
                  service_id: selectedService.service_id,
                  service_name: selectedService.service_name,
                  pro_id: user.id,
                };
                (postData as any).service_id = selectedService.service_id;
                (postData as any).pro_service_id = selectedProServiceId;
              }
            }

            if (isBookable) {
              const priceCents = basePrice ? Math.round(parseFloat(basePrice) * 100) : undefined;
              const hours = estimatedHours ? parseFloat(estimatedHours) : undefined;
              postData.is_bookable = true;
              postData.package_type = packageType;
              if (priceCents && priceCents > 0) postData.base_price_cents = priceCents;
              if (hours && hours > 0) postData.estimated_hours = hours;
              postData.service_radius_miles = 25;
            }

            const contentResponse = await contentService.createPost(user.id, postData);

            if (contentResponse.success) {
              postCreated = true;
              console.log('✅ Content post created successfully');
            } else {
              postCreationError = contentResponse.error || 'Database insert failed';
              console.error('❌ Failed to create content post:', postCreationError);
            }
          } catch (error) {
            postCreationError = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ Error creating content post:', error);
          }
        }

        // Only optimistically display the new video as "live" when the post
        // row actually exists in the database. Otherwise the cleaner would see
        // a green confirmation while customers see nothing in the feed.
        if (postCreated) {
          const newVideo: UploadedVideo = {
            id: response.uploadId || Date.now().toString(),
            uri: response.url || videoUri,
            title: videoTitle || 'New Cleaning Video',
            description: videoDescription || '',
            duration: 45,
            uploadDate: new Date().toISOString().split('T')[0],
            status: 'live',
            views: 0,
            bookings: 0,
            likes: 0,
            comments: 0,
          };
          setVideos(prev => [newVideo, ...prev]);
          try {
            (showToast as any) && showToast({
              type: 'success',
              message: '🎬 Video is now live! Customers can discover your work.',
            });
          } catch { /* no-op */ }
          // Refresh the cleaner store so the dashboard's profile-completion
          // checklist reflects the new "intro video" task as filled.
          try {
            void useCleanerStore.getState().refreshData();
          } catch { /* no-op */ }
        } else {
          try {
            (showToast as any) && showToast({
              type: 'error',
              message:
                postCreationError
                  ? `Upload finished but we couldn't post it: ${postCreationError}`
                  : 'Upload finished but the post could not be saved. Please try again.',
            });
          } catch { /* no-op */ }
        }
        setSelectedVideo(null);

        // Clear upload state
        setUploadDetails(null);
        setActiveUploadId(null);

        // Refresh analytics data to include new video
        setTimeout(() => loadContentData(), 1000);

        if (route.params?.returnToContentHub && navigation.canGoBack()) {
          setTimeout(() => {
            navigation.goBack();
          }, 450);
        }
      } else {
        let errorMessage = response.error || 'Please try again';

        switch (response.errorCode) {
          case 'VALIDATION_FAILED':
            break;
          case 'FILE_TOO_LARGE':
            errorMessage = `Please choose a video under ${VIDEO_LIMITS.maxFileSizeMB}MB`;
            break;
          case 'UNSUPPORTED_TYPE':
            errorMessage = 'Please use MP4, MOV, or AVI format';
            break;
          case 'NETWORK_OFFLINE':
            errorMessage = 'Check your connection and try again';
            break;
          case 'RATE_LIMITED':
            errorMessage = 'Please wait before uploading again';
            break;
        }

        setUploadError(errorMessage);

        try { (showToast as any) && showToast({ type: 'error', message: errorMessage }); } catch {}
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error.message || 'An unexpected error occurred';
      setUploadError(errorMessage);
      
      try { (showToast as any) && showToast({ type: 'error', message: errorMessage }); } catch {}
    } finally {
      setIsUploading(false);
      setIsOptimizingVideo(false);
      if (uploadService.isUploadActive(uploadSessionId)) {
        uploadService.endUploadSession(uploadSessionId);
      }
      setActiveUploadId(null);
      if (uploadSucceeded) {
        setTimeout(() => {
          setUploadProgress(0);
          setUploadDetails(null);
        }, 2000);
      } else {
        setUploadProgress(0);
        setUploadDetails(null);
      }
    }
  };

  // Cancel upload in progress (stops transfer and clears the staged draft / preview)
  const handleCancelUpload = () => {
    if (activeUploadId) {
      uploadService.cancelUpload(activeUploadId);
    }
    setIsUploading(false);
    setIsOptimizingVideo(false);
    setUploadProgress(0);
    setUploadDetails(null);
    setActiveUploadId(null);
    clearVideoDraft();
    Alert.alert(
      'Upload stopped',
      'This upload was cancelled. If a transfer already started, a small amount of data may still complete in the background.',
      [{ text: 'OK' }]
    );
  };

  const renderUploadOptions = () => (
    <View style={styles.uploadSection}>
      <Text style={styles.sectionTitle}>Upload New Video</Text>
      <Text style={styles.sectionSubtitle}>
        {`Show your skills in up to ${VIDEO_LIMITS.maxDurationSeconds} seconds — short clips upload reliably and look great in the feed.`}
      </Text>

      <View style={styles.uploadButtons}>
        <TouchableOpacity style={styles.uploadButton} onPress={handleCameraUpload}>
          <Ionicons name="videocam" size={24} color={UI.textInverse} />
          <Text style={styles.uploadButtonText}>Record Video</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadButton} onPress={handleLibraryUpload}>
          <Ionicons name="images" size={24} color={UI.textInverse} />
          <Text style={styles.uploadButtonText}>Library</Text>
        </TouchableOpacity>
      </View>

      {selectedVideo && (
        <View style={styles.previewContainer}>
          <View style={styles.previewHeaderRow}>
            <Text style={styles.previewTitle}>Video Preview</Text>
            {!isUploading ? (
              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={styles.previewActionButton}
                  onPress={() => {
                    void handleLibraryUpload();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Choose a different video from library"
                >
                  <Ionicons name="images-outline" size={18} color={UI.primary} />
                  <Text style={styles.previewActionText}>Library</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.previewActionButton}
                  onPress={() => {
                    void handleCameraUpload();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Record a different video"
                >
                  <Ionicons name="videocam-outline" size={18} color={UI.primary} />
                  <Text style={styles.previewActionText}>Record</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.previewActionRemove}
                  onPress={clearVideoDraft}
                  accessibilityRole="button"
                  accessibilityLabel="Remove video from upload"
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  <Text style={styles.previewActionRemoveText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
          {uploadError && !isUploading ? (
            <View style={styles.uploadErrorBanner}>
              <Text style={styles.errorText} numberOfLines={4}>
                {uploadError}
              </Text>
              <TouchableOpacity onPress={() => setUploadError(null)} hitSlop={12}>
                <Text style={styles.uploadErrorDismiss}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          ) : null}
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
              {isOptimizingVideo
                ? optimizingMessage || 'Optimizing video…'
                : uploadProgress < 100
                  ? `Uploading… ${uploadProgress}%`
                  : 'Finishing…'}
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
          <ActivityIndicator size="small" color={UI.warning} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      ) : (
      <View style={styles.analyticsGrid}>
          <MetricCard
            value={totalViews.toLocaleString()}
            label="Total Views"
            icon="eye-outline"
            iconColor={UI.info}
            delay={0}
            compact
            style={styles.performanceCard}
          />
          <MetricCard
            value={totalBookings}
            label="Bookings Generated"
            icon="calendar-outline"
            iconColor={UI.success}
            delay={50}
            compact
            style={styles.performanceCard}
          />
          <MetricCard
            value={`${conversionRate}%`}
            label="Conversion Rate"
            icon="trending-up-outline"
            iconColor={UI.warning}
            delay={100}
            compact
            style={styles.performanceCard}
          />
          <MetricCard
            value={avgViewsPerVideo}
            label="Avg Views/Video"
            icon="analytics-outline"
            iconColor={UI.primary}
            delay={150}
            compact
            style={styles.performanceCard}
          />
        </View>
      )}
    </View>
  );

  const renderVideoItem = ({ item, index }: { item: UploadedVideo; index: number }) => (
    <TouchableOpacity 
      style={styles.videoCard}
      activeOpacity={0.9}
      onPress={() => handlePlayVideo(item)}
    >
      <View style={styles.videoCardInner}>
        {/* Video Thumbnail */}
        <View style={styles.thumbnailContainer}>
          <Video
            source={{ uri: item.uri }}
            style={styles.videoThumbnail}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
          />
      
          {/* Bottom gradient for text readability */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)']}
            style={styles.thumbnailGradient}
          />
          
          {/* Play Button Overlay */}
          <View style={styles.playButtonOverlay}>
            <View style={styles.playButtonGlow}>
              <View style={styles.playButton}>
                <Ionicons name="play" size={20} color={UI.textInverse} />
              </View>
            </View>
          </View>
          
          {/* Duration Badge */}
          <View style={styles.durationBadge}>
            <Ionicons name="time-outline" size={10} color={UI.textInverse} />
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
              onPress={(e) => {
                e.stopPropagation();
                handleOpenVideoMenu(item);
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={UI.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.videoDate}>
            <Ionicons name="calendar-outline" size={11} color={UI.textMuted} /> {item.uploadDate}
          </Text>
          
          {/* Engagement Stats Row - matching performance card style */}
          <View style={styles.engagementRow}>
            <View style={styles.engagementItem}>
              <View style={[styles.engagementIconWrapper, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <Ionicons name="heart" size={16} color={UI.error} />
              </View>
              <Text style={styles.engagementText}>{item.likes || 0}</Text>
            </View>
            <View style={styles.engagementItem}>
              <View style={[styles.engagementIconWrapper, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="chatbubble" size={15} color={UI.info} />
              </View>
              <Text style={styles.engagementText}>{item.comments || 0}</Text>
            </View>
            <View style={styles.engagementItem}>
              <View style={[styles.engagementIconWrapper, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                <Ionicons name="eye" size={16} color={UI.warning} />
              </View>
              <Text style={styles.engagementText}>{item.views}</Text>
            </View>
          </View>
          
          {/* Bookings Badge - matching performance card style */}
          <View style={[styles.bookingsBadge, { backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
            <Ionicons name="calendar-outline" size={14} color={UI.success} />
            <Text style={styles.bookingsText}>{item.bookings} bookings from this video</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Open video player
  const handlePlayVideo = (video: UploadedVideo) => {
    setPlayingVideo(video);
    setShowVideoPlayer(true);
    setIsVideoPlaying(true);
  };

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
              if (!user?.id) {
                showToast({ type: 'error', message: 'Please log in again.' });
                return;
              }

              const videoId = selectedVideoForMenu.id;
              const deleteResponse = await contentService.deletePost(user.id, videoId);

              if (!deleteResponse.success) {
                throw new Error(deleteResponse.error || 'Failed to delete video');
              }

              // Remove from local state
              setVideos(prev => prev.filter(v => v.id !== videoId));
              showToast({ type: 'success', message: 'Video deleted' });
              setShowVideoMenu(false);
              setSelectedVideoForMenu(null);

              // Refresh analytics/feed data
              setTimeout(() => loadContentData(), 300);
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
      case 'live': return UI.success;
      case 'processing': return UI.warning;
      case 'uploading': return UI.info;
      case 'failed': return UI.error;
      default: return UI.textSecondary;
    }
  };

  const canPostVideo = useMemo(() => {
    if (videoTitle.trim().length === 0 || !videoServiceType) {
      return false;
    }
    if (activeProServices.length > 0) {
      return Boolean(selectedProServiceId) || requestedServiceName.trim().length > 0;
    }
    return true;
  }, [videoTitle, videoServiceType, activeProServices.length, selectedProServiceId, requestedServiceName]);

  const handleBackPress = useCallback(() => {
    if (isUploading) {
      Alert.alert(
        'Upload in Progress',
        'Please keep this screen open while your video uploads so you can track progress.',
        [{ text: 'OK' }]
      );
      return;
    }
    navigation.goBack();
  }, [isUploading, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={UI.surface} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress}>
          <Ionicons name="arrow-back" size={24} color={UI.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Content</Text>
        <TouchableOpacity>
          <Ionicons name="help-circle-outline" size={24} color={UI.textSecondary} />
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
              {`• Max ${VIDEO_LIMITS.maxDurationSeconds}s per clip (app limit) • Before/after • Good light • Clear audio`}
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
            tintColor={UI.warning}
            colors={[UI.warning]}
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

      {/* Full Screen Video Player Modal */}
      <Modal
        visible={showVideoPlayer}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setShowVideoPlayer(false);
          setPlayingVideo(null);
          setIsVideoPlaying(false);
        }}
      >
        <View style={styles.videoPlayerModal}>
          <StatusBar barStyle="light-content" />
          
          {/* Header */}
          <View style={styles.videoPlayerHeader}>
            <TouchableOpacity 
              style={styles.videoPlayerCloseButton}
              onPress={() => {
                setShowVideoPlayer(false);
                setPlayingVideo(null);
                setIsVideoPlaying(false);
              }}
            >
              <Ionicons name="close" size={28} color={UI.textInverse} />
            </TouchableOpacity>
            <Text style={styles.videoPlayerTitle} numberOfLines={1}>
              {playingVideo?.title || 'Video'}
            </Text>
            <TouchableOpacity 
              style={styles.videoPlayerShareButton}
              onPress={() => Alert.alert('Share', 'Share functionality coming soon!')}
            >
              <Ionicons name="share-outline" size={24} color={UI.textInverse} />
            </TouchableOpacity>
          </View>
          
          {/* Video Player */}
          <View style={styles.videoPlayerContainer}>
            {playingVideo && (
              <Video
                ref={playerRef}
                source={{ uri: playingVideo.uri }}
                style={styles.fullScreenVideo}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={isVideoPlaying}
                isLooping
                useNativeControls
                onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
                  if (status.isLoaded) {
                    setIsVideoPlaying(status.isPlaying);
                  }
                }}
              />
            )}
          </View>
          
          {/* Video Stats & Info */}
          <ScrollView style={styles.videoPlayerInfo} showsVerticalScrollIndicator={false}>
            {/* Video Title & Date */}
            <View style={styles.videoPlayerTitleSection}>
              <Text style={styles.videoPlayerVideoTitle}>{playingVideo?.title}</Text>
              <Text style={styles.videoPlayerDate}>
                Uploaded {playingVideo?.uploadDate}
              </Text>
            </View>
            
            {/* Stats Row */}
            <View style={styles.videoPlayerStatsRow}>
              <View style={styles.videoPlayerStatItem}>
                <View style={[styles.videoPlayerStatIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Ionicons name="eye" size={20} color={UI.warning} />
                </View>
                <Text style={styles.videoPlayerStatValue}>{playingVideo?.views || 0}</Text>
                <Text style={styles.videoPlayerStatLabel}>Views</Text>
              </View>
              
              <View style={styles.videoPlayerStatItem}>
                <View style={[styles.videoPlayerStatIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Ionicons name="heart" size={20} color={UI.error} />
                </View>
                <Text style={styles.videoPlayerStatValue}>{playingVideo?.likes || 0}</Text>
                <Text style={styles.videoPlayerStatLabel}>Likes</Text>
              </View>
              
              <View style={styles.videoPlayerStatItem}>
                <View style={[styles.videoPlayerStatIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Ionicons name="chatbubble" size={20} color={UI.info} />
                </View>
                <Text style={styles.videoPlayerStatValue}>{playingVideo?.comments || 0}</Text>
                <Text style={styles.videoPlayerStatLabel}>Comments</Text>
              </View>
              
              <View style={styles.videoPlayerStatItem}>
                <View style={[styles.videoPlayerStatIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Ionicons name="calendar" size={20} color={UI.success} />
                </View>
                <Text style={styles.videoPlayerStatValue}>{playingVideo?.bookings || 0}</Text>
                <Text style={styles.videoPlayerStatLabel}>Bookings</Text>
              </View>
            </View>
            
            {/* Description */}
            {playingVideo?.description && (
              <View style={styles.videoPlayerDescriptionSection}>
                <Text style={styles.videoPlayerSectionTitle}>Description</Text>
                <Text style={styles.videoPlayerDescription}>{playingVideo.description}</Text>
              </View>
            )}
            
            {/* Reviews Section Placeholder */}
            <View style={styles.videoPlayerReviewsSection}>
              <View style={styles.videoPlayerReviewsHeader}>
                <Text style={styles.videoPlayerSectionTitle}>Reviews & Feedback</Text>
                <View style={styles.videoPlayerReviewsBadge}>
                  <Ionicons name="star" size={14} color={UI.warning} />
                  <Text style={styles.videoPlayerReviewsCount}>{playingVideo?.comments || 0}</Text>
                </View>
              </View>
              
              {(playingVideo?.comments || 0) > 0 ? (
                <View style={styles.videoPlayerReviewsList}>
                  {/* Placeholder reviews - in production, fetch real reviews */}
                  <View style={styles.videoPlayerReviewItem}>
                    <View style={styles.videoPlayerReviewAvatar}>
                      <Ionicons name="person" size={20} color={UI.textMuted} />
                    </View>
                    <View style={styles.videoPlayerReviewContent}>
                      <View style={styles.videoPlayerReviewHeader}>
                        <Text style={styles.videoPlayerReviewerName}>Customer</Text>
                        <View style={styles.videoPlayerReviewStars}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Ionicons key={star} name="star" size={12} color={UI.warning} />
                          ))}
                        </View>
                      </View>
                      <Text style={styles.videoPlayerReviewText}>Great cleaning video! Very helpful tips.</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.videoPlayerNoReviews}>
                  <Ionicons name="chatbubble-outline" size={40} color={UI.borderHard} />
                  <Text style={styles.videoPlayerNoReviewsText}>No reviews yet</Text>
                  <Text style={styles.videoPlayerNoReviewsSubtext}>
                    Reviews from customers will appear here
                  </Text>
                </View>
              )}
            </View>
            
            {/* Bottom padding for safe area */}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

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
            <View style={styles.menuHandle} />
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle} numberOfLines={1}>
                {selectedVideoForMenu?.title || 'Video'}
              </Text>
            </View>
            
            <TouchableOpacity style={styles.menuItem} onPress={handleViewVideoAnalytics}>
              <View style={styles.menuItemIcon}>
                <Ionicons name="stats-chart" size={20} color={UI.info} />
              </View>
              <Text style={styles.menuItemText}>View Analytics</Text>
              <Ionicons name="chevron-forward" size={18} color={UI.borderHard} style={styles.menuItemChevron} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={handleEditVideo}>
              <View style={styles.menuItemIcon}>
                <Ionicons name="create-outline" size={20} color={UI.warning} />
              </View>
              <Text style={styles.menuItemText}>Edit Details</Text>
              <Ionicons name="chevron-forward" size={18} color={UI.borderHard} style={styles.menuItemChevron} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setShowVideoMenu(false);
              if (selectedVideoForMenu) {
                // Share functionality
                Alert.alert('Share', 'Share video coming soon!');
              }
            }}>
              <View style={styles.menuItemIcon}>
                <Ionicons name="share-social-outline" size={20} color={UI.success} />
              </View>
              <Text style={styles.menuItemText}>Share Video</Text>
              <Ionicons name="chevron-forward" size={18} color={UI.borderHard} style={styles.menuItemChevron} />
            </TouchableOpacity>
            
            <View style={styles.menuDivider} />
            
            <TouchableOpacity style={styles.menuItemDanger} onPress={handleDeleteVideo}>
              <View style={styles.menuItemDangerIcon}>
                <Ionicons name="trash-outline" size={20} color={UI.error} />
              </View>
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
                <Ionicons name="close" size={24} color={UI.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Post Your Video</Text>
              <TouchableOpacity 
                onPress={handleConfirmVideoDetails}
                style={[styles.postButton, !canPostVideo && styles.postButtonDisabled]}
                disabled={!canPostVideo}
              >
                <Text style={[styles.postButtonText, !canPostVideo && styles.postButtonTextDisabled]}>
                  Post
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.profileAreaCallout}>
                <Ionicons name="location-outline" size={18} color={UI.info} />
                <Text style={styles.profileAreaCalloutText}>
                  Your <Text style={styles.profileAreaBold}>service area / location</Text> on your pro profile is how customers know where you work. If you have not set it yet, add it under{' '}
                  <Text style={styles.profileAreaBold}>Edit Profile</Text> before promoting this post.
                </Text>
              </View>

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
                  placeholderTextColor={UI.textMuted}
                  value={videoTitle}
                  onChangeText={setVideoTitle}
                  maxLength={100}
                />
                <Text style={styles.charCount}>{videoTitle.length}/100</Text>
              </View>

              {/* Service Type Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Service Type *</Text>
                <Text style={styles.inputSubLabel}>
                  We pre-fill this when you pick a service you offer—tap below to change the category.
                </Text>
                <TouchableOpacity 
                  style={styles.serviceTypeSelector}
                  onPress={() => setShowServiceTypePicker(true)}
                >
                  {videoServiceType ? (
                    <View style={styles.selectedServiceType}>
                      <Ionicons 
                        name={(SERVICE_TYPE_OPTIONS.find(o => o.id === videoServiceType)?.icon || 'home-outline') as any} 
                        size={20} 
                        color={UI.warning} 
                      />
                      <Text style={styles.selectedServiceTypeText}>
                        {SERVICE_TYPE_OPTIONS.find(o => o.id === videoServiceType)?.label || 'Select service type'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.serviceTypePlaceholder}>Select what type of cleaning this is...</Text>
                  )}
                  <Ionicons name="chevron-down" size={20} color={UI.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Active Service Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Service Offered *</Text>
                <Text style={styles.inputHelper}>
                  Choose the service this video belongs to so customers can find and book it from your feed.
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {activeProServices.map((svc) => (
                    <TouchableOpacity
                      key={svc.id}
                      style={[styles.packageTypeChip, selectedProServiceId === svc.id && styles.packageTypeChipActive]}
                      onPress={() => {
                        setSelectedProServiceId(svc.id);
                        setRequestedServiceName('');
                        setVideoServiceType(mapServiceNameToTypeId(svc.service_name));
                      }}
                    >
                      <Text style={[styles.packageTypeText, selectedProServiceId === svc.id && styles.packageTypeTextActive]}>
                        {svc.service_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.packageTypeChip} onPress={() => setShowRequestServiceModal(true)}>
                    <Text style={styles.packageTypeText}>+ Request New Service</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>

              {/* Description Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={styles.descriptionInput}
                  placeholder="Tell customers about this cleaning job... What makes it special?"
                  placeholderTextColor={UI.textMuted}
                  value={videoDescription}
                  onChangeText={setVideoDescription}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{videoDescription.length}/500</Text>
              </View>

              {/* Make Bookable Section */}
              <View style={styles.inputGroup}>
                <View style={styles.bookableRow}>
                  <Text style={styles.inputLabel}>Make this bookable</Text>
                  <Switch
                    value={isBookable}
                    onValueChange={setIsBookable}
                    trackColor={{ false: UI.border, true: PRO_COLORS.primarySoft }}
                    thumbColor={isBookable ? UI.primary : UI.textMuted}
                  />
                </View>
                {isBookable && (
                  <View style={styles.packageFields}>
                    <View style={styles.packageRow}>
                      <Text style={styles.packageLabel}>Price type</Text>
                      <View style={styles.packageTypeRow}>
                        {(['hourly', 'fixed'] as const).map((t) => (
                          <TouchableOpacity
                            key={t}
                            style={[styles.priceModeChip, packageType === t && styles.priceModeChipActive]}
                            onPress={() => setPackageType(t)}
                          >
                            <Text style={[styles.priceModeText, packageType === t && styles.priceModeTextActive]}>
                              {t === 'hourly' ? 'Hourly' : 'Fixed'}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={styles.packageRow}>
                      <Text style={styles.packageLabel}>
                        {packageType === 'hourly' ? 'Rate ($/hr)' : 'Base price ($)'}
                      </Text>
                      <TextInput
                        style={styles.priceInput}
                        placeholder={packageType === 'hourly' ? 'e.g. 45' : 'e.g. 120'}
                        placeholderTextColor={UI.textMuted}
                        value={basePrice}
                        onChangeText={setBasePrice}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    {packageType === 'hourly' && (
                      <View style={styles.packageRow}>
                        <Text style={styles.packageLabel}>Est. hours</Text>
                        <TextInput
                          style={styles.priceInput}
                          placeholder="e.g. 2"
                          placeholderTextColor={UI.textMuted}
                          value={estimatedHours}
                          onChangeText={setEstimatedHours}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Tips */}
              <View style={styles.tipsCard}>
                <Ionicons name="bulb-outline" size={20} color={UI.warning} />
                <View style={styles.tipsContent}>
                  <Text style={styles.tipsCardTitle}>Pro Tips</Text>
                  <Text style={styles.tipsCardText}>
                    • Use a clear title and description{'\n'}
                    • Show before/after in the clip{'\n'}
                    • Keep your profile service area up to date for local discovery
                  </Text>
                </View>
              </View>
            </ScrollView>

            {showRequestServiceModal && (
              <View
                style={[styles.nestedRequestShell, { paddingBottom: insets.bottom + 8 }]}
                pointerEvents="box-none"
              >
                <TouchableOpacity
                  style={styles.nestedRequestBackdrop}
                  activeOpacity={1}
                  onPress={() => setShowRequestServiceModal(false)}
                />
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  style={styles.nestedRequestKav}
                  keyboardVerticalOffset={insets.top + 56}
                >
                  <View style={styles.nestedRequestCard}>
                    <ScrollView
                      style={styles.nestedRequestScroll}
                      contentContainerStyle={styles.nestedRequestScrollContent}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      <Text style={styles.nestedRequestTitle}>Request a new service</Text>
                      <Text style={styles.nestedRequestSub}>
                        This tells our team to add a catalog option. You can use it for this post right after you save.
                      </Text>
                      <Text style={styles.nestedRequestLabel}>Service name *</Text>
                      <TextInput
                        style={styles.titleInput}
                        placeholder="e.g. Garage deep clean"
                        placeholderTextColor={UI.textMuted}
                        value={requestedServiceName}
                        onChangeText={setRequestedServiceName}
                      />
                      <Text style={styles.nestedRequestLabel}>Category keyword</Text>
                      <TextInput
                        style={styles.titleInput}
                        placeholder="e.g. standard_clean, garage, or outdoor"
                        placeholderTextColor={UI.textMuted}
                        value={requestedServiceCategory}
                        onChangeText={setRequestedServiceCategory}
                        autoCapitalize="none"
                      />
                      <Text style={styles.nestedRequestLabel}>Notes (optional)</Text>
                      <TextInput
                        style={styles.descriptionInput}
                        placeholder="Any details for the team"
                        value={requestedServiceDescription}
                        onChangeText={setRequestedServiceDescription}
                        multiline
                      />
                    </ScrollView>
                    <View style={styles.nestedRequestActions}>
                      <TouchableOpacity
                        style={styles.nestedRequestCancel}
                        onPress={() => setShowRequestServiceModal(false)}
                      >
                        <Text style={styles.nestedRequestCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.nestedRequestSave}
                        onPress={() => void handleSubmitServiceRequest()}
                      >
                        <Text style={styles.nestedRequestSaveText}>Save & use</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </KeyboardAvoidingView>
              </View>
            )}
          </View>

          {showServiceTypePicker && (
            <View style={styles.serviceTypePickerInlineWrap} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.serviceTypePickerInlineBackdrop}
                activeOpacity={1}
                onPress={() => setShowServiceTypePicker(false)}
              />
              <View style={styles.serviceTypeSheetCard}>
                <View style={styles.serviceTypeSheetHeader}>
                  <Text style={styles.serviceTypeSheetTitle}>Service type</Text>
                  <TouchableOpacity
                    onPress={() => setShowServiceTypePicker(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={20} color={UI.textSecondary} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={SERVICE_TYPE_OPTIONS}
                  keyExtractor={(item) => item.id}
                  style={styles.serviceTypeSheetList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  ItemSeparatorComponent={() => <View style={styles.serviceTypeSheetDivider} />}
                  renderItem={({ item: option }) => {
                    const selected = videoServiceType === option.id;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.serviceTypeSheetRow,
                          selected && styles.serviceTypeSheetRowSelected,
                        ]}
                        onPress={() => {
                          setVideoServiceType(option.id);
                          setShowServiceTypePicker(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={option.icon as any}
                          size={20}
                          color={selected ? UI.warning : UI.textMuted}
                          style={styles.serviceTypeSheetRowIcon}
                        />
                        <Text
                          style={[
                            styles.serviceTypeSheetRowText,
                            selected && styles.serviceTypeSheetRowTextSelected,
                          ]}
                          numberOfLines={2}
                        >
                          {option.label}
                        </Text>
                        {selected && (
                          <Ionicons name="checkmark" size={20} color={UI.warning} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
  },
  headerTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: UI.textPrimary,
  },
  listContent: {
    paddingBottom: 0, // dynamic via insets + nav clearance
  },
  uploadSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
  },
  sectionTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: UI.textPrimary,
    marginBottom: hp('0.7%'),
  },
  sectionSubtitle: {
    fontSize: wp('3.5%'),
    color: UI.textSecondary,
    marginBottom: hp('2.5%'),
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: wp('3%'),
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.warning,
    height: 52,
    paddingHorizontal: wp('5%'),
    borderRadius: 26,
    gap: wp('2.5%'),
    shadowColor: UI.textPrimary,
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
    color: UI.textInverse,
  },
  previewContainer: {
    marginTop: hp('2.5%'),
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('1%'),
    flexWrap: 'wrap',
    gap: 8,
  },
  previewTitle: {
    fontSize: wp('4%'),
    fontWeight: '500',
    color: UI.textPrimary,
    flexShrink: 0,
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  previewActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 165, 47, 0.1)',
  },
  previewActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.primary,
  },
  previewActionRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  previewActionRemoveText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.error,
  },
  uploadErrorBanner: {
    marginBottom: hp('1%'),
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  uploadErrorDismiss: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.primary,
  },
  videoPreview: {
    width: '100%',
    height: 200,
    borderRadius: wp('3%'),
  },
  progressContainer: {
    marginTop: hp('2.5%'),
    backgroundColor: UI.surfaceAlt,
    padding: 16,
    borderRadius: wp('4%'),
    borderWidth: 1,
    borderColor: UI.border,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  progressText: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: PRO_COLORS.primary,
  },
  cancelButton: {
    padding: 4,
    borderRadius: wp('3%'),
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  progressBar: {
    height: 6,
    backgroundColor: UI.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: PRO_COLORS.primary,
    borderRadius: 3,
  },
  progressDetails: {
    marginTop: hp('1%'),
    alignItems: 'center',
  },
  progressDetailText: {
    fontSize: wp('3%'),
    color: COLORS.textSecondary,
    marginBottom: hp('0.5%'),
  },
  errorText: {
    fontSize: wp('3%'),
    color: COLORS.error,
    textAlign: 'center',
  },
  // Modern Video Card Styles
  videoCard: {
    marginHorizontal: wp('4%'),
    marginBottom: hp('2.5%'),
    backgroundColor: UI.surface,
    borderRadius: wp('4%'),
    borderWidth: 0,
    borderColor: 'transparent',
    shadowColor: UI.textPrimary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'visible',
  },
  videoCardInner: {
    borderRadius: wp('4%'),
    overflow: 'hidden',
    backgroundColor: UI.surface,
  },
  thumbnailContainer: {
    position: 'relative',
    height: 200,
    backgroundColor: UI.textPrimary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  thumbnailInnerShadow: {
    display: 'none',
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
    zIndex: 10,
  },
  playButtonGlow: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: wp('5.5%'),
    backgroundColor: UI.warning,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 2,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('1.5%'),
    gap: wp('1%'),
  },
  durationText: {
    fontSize: 11,
    fontWeight: '600',
    color: UI.textInverse,
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('2.5%'),
    paddingVertical: 5,
    borderRadius: wp('4%'),
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: UI.textInverse,
  },
  statusText: {
    fontSize: wp('2.5%'),
    fontWeight: '700',
    color: UI.textInverse,
    letterSpacing: 0.5,
  },
  videoInfo: {
    padding: 14,
    backgroundColor: UI.surface,
  },
  videoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  videoTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: UI.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  moreButton: {
    padding: 4,
  },
  videoDate: {
    fontSize: wp('3%'),
    color: UI.textMuted,
    marginBottom: hp('1.5%'),
  },
  videoStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: UI.surfaceAlt,
    borderRadius: wp('2.5%'),
    padding: 10,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('1.5%'),
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: UI.textPrimary,
  },
  statLabel: {
    fontSize: wp('3%'),
    color: UI.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: UI.border,
  },
  // Engagement styles
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('4%'),
    marginTop: hp('1.2%'),
    marginBottom: hp('1.2%'),
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  engagementIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: wp('4%'),
    justifyContent: 'center',
    alignItems: 'center',
  },
  engagementText: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: UI.textSecondary,
  },
  bookingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1%'),
    borderRadius: wp('2.5%'),
    gap: wp('1.5%'),
    marginTop: hp('0.5%'),
  },
  bookingsText: {
    fontSize: 13,
    fontWeight: '500',
    color: UI.success,
  },
  // Video action menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: UI.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: hp('1.2%'),
    paddingBottom: 26,
    shadowColor: UI.textPrimary,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  menuHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: UI.border,
    marginBottom: hp('0.7%'),
  },
  menuHeader: {
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    borderBottomWidth: 1,
    borderBottomColor: UI.borderSoft,
  },
  menuTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: UI.textPrimary,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.7%'),
    gap: wp('3.5%'),
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: wp('4.5%'),
    backgroundColor: UI.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    flex: 1,
    fontSize: wp('4%'),
    color: UI.textSecondary,
  },
  menuItemChevron: {
    marginLeft: 6,
  },
  menuDivider: {
    height: 10,
    backgroundColor: UI.surfaceAlt,
    marginVertical: 6,
  },
  menuItemDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.7%'),
    gap: wp('3.5%'),
  },
  menuItemDangerIcon: {
    width: 36,
    height: 36,
    borderRadius: wp('4.5%'),
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemTextDanger: {
    flex: 1,
    fontSize: wp('4%'),
    color: UI.error,
  },
  menuCancel: {
    marginHorizontal: wp('5%'),
    marginTop: hp('1%'),
    backgroundColor: UI.surfaceAlt,
    paddingVertical: hp('1.7%'),
    borderRadius: wp('3.5%'),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: UI.border,
  },
  menuCancelText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: UI.textSecondary,
  },
  tipsFooter: {
    backgroundColor: UI.surfaceAlt,
    paddingHorizontal: wp('4%'),
    paddingTop: hp('2%'),
    borderTopWidth: 1,
    borderTopColor: UI.border,
  },
  tipsTitle: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: UI.textPrimary,
    marginBottom: hp('0.5%'),
  },
  tipsText: {
    fontSize: wp('3%'),
    color: UI.textSecondary,
    lineHeight: 16,
  },
  // Loading styles
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('5%'),
    gap: wp('3%'),
  },
  loadingText: {
    fontSize: wp('3.5%'),
    color: UI.textSecondary,
  },
  // Analytics Styles
  analyticsSection: {
    marginHorizontal: wp('5%'),
    marginBottom: hp('3%'),
    marginTop: hp('1%'), // Add top spacing
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginTop: hp('1.5%'),
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
    backgroundColor: UI.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: hp('5%'),
    position: 'relative',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
  },
  modalTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: UI.textPrimary,
  },
  postButton: {
    backgroundColor: UI.warning,
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1%'),
    borderRadius: wp('5%'),
  },
  postButtonDisabled: {
    backgroundColor: UI.border,
  },
  postButtonText: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: UI.textInverse,
  },
  postButtonTextDisabled: {
    color: UI.textMuted,
  },
  modalBody: {
    padding: 16,
  },
  modalVideoPreviewContainer: {
    marginBottom: hp('2.5%'),
  },
  modalVideoPreview: {
    height: 200,
    borderRadius: wp('3%'),
    overflow: 'hidden',
    backgroundColor: UI.textPrimary,
  },
  modalVideoPlayer: {
    width: '100%',
    height: '100%',
  },
  thumbnailPreviewContainer: {
    marginTop: hp('1.5%'),
    alignItems: 'center',
  },
  thumbnailPreviewLabel: {
    fontSize: wp('3%'),
    fontWeight: '500',
    color: UI.textSecondary,
    marginBottom: hp('1%'),
  },
  thumbnailPreviewImage: {
    width: 80,
    height: 120,
    borderRadius: wp('2%'),
    backgroundColor: UI.border,
  },
  inputGroup: {
    marginBottom: hp('2.5%'),
  },
  inputSubLabel: {
    fontSize: 12,
    color: UI.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  profileAreaCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: PRO_COLORS.primarySoft,
    borderWidth: 1,
    borderColor: PRO_COLORS.primary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  profileAreaCalloutText: {
    flex: 1,
    fontSize: 13,
    color: UI.primary,
    lineHeight: 20,
    marginLeft: 8,
  },
  profileAreaBold: {
    fontWeight: '700',
    color: UI.primary,
  },
  inputLabel: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: UI.textSecondary,
    marginBottom: hp('1%'),
  },
  inputHelper: {
    fontSize: 12,
    lineHeight: 17,
    color: UI.textSecondary,
    marginTop: -4,
    marginBottom: hp('1%'),
  },
  titleInput: {
    backgroundColor: UI.surfaceAlt,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: wp('3%'),
    padding: 14,
    fontSize: wp('4%'),
    color: UI.textPrimary,
  },
  descriptionInput: {
    backgroundColor: UI.surfaceAlt,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: wp('3%'),
    padding: 14,
    fontSize: 15,
    color: UI.textPrimary,
    minHeight: 100,
  },
  charCount: {
    fontSize: wp('3%'),
    color: UI.textMuted,
    textAlign: 'right',
    marginTop: hp('0.5%'),
  },
  bookableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageFields: {
    marginTop: hp('1.5%'),
    paddingTop: hp('1.5%'),
    borderTopWidth: 1,
    borderTopColor: UI.border,
  },
  packageRow: {
    marginBottom: hp('1.5%'),
  },
  packageLabel: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: UI.textSecondary,
    marginBottom: hp('0.7%'),
  },
  packageTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  packageTypeChip: {
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1%'),
    borderRadius: wp('2%'),
    backgroundColor: UI.borderSoft,
    marginRight: 8,
    marginBottom: hp('1%'),
  },
  packageTypeChipActive: {
    backgroundColor: COLORS.accentSoft,
  },
  packageTypeText: {
    fontSize: wp('3.5%'),
    color: UI.textSecondary,
  },
  packageTypeTextActive: {
    color: UI.warning,
    fontWeight: '600',
  },
  priceModeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: UI.bg,
    borderWidth: 1.5,
    borderColor: UI.borderSoft,
    marginRight: 8,
    marginBottom: hp('1%'),
  },
  priceModeChipActive: {
    backgroundColor: UI.surface,
    borderColor: UI.primary,
    borderWidth: 2,
  },
  priceModeText: {
    fontSize: wp('3.5%'),
    color: UI.textSecondary,
    fontWeight: '500',
  },
  priceModeTextActive: {
    color: UI.primary,
    fontWeight: '700',
  },
  nestedRequestShell: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  nestedRequestBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  nestedRequestKav: {
    width: '100%',
    maxWidth: 440,
  },
  nestedRequestCard: {
    backgroundColor: UI.surface,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    maxHeight: '88%',
    width: '100%',
  },
  nestedRequestScroll: {
    maxHeight: hp('52%'),
  },
  nestedRequestScrollContent: {
    paddingBottom: 4,
  },
  nestedRequestTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: UI.textPrimary,
    marginBottom: 6,
  },
  nestedRequestSub: {
    fontSize: 13,
    color: UI.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  nestedRequestLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: UI.textSecondary,
    marginBottom: 6,
  },
  nestedRequestActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    minHeight: 50,
    marginTop: 12,
    paddingTop: 4,
  },
  nestedRequestCancel: {
    flex: 1,
    minHeight: 48,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.border,
    backgroundColor: UI.surface,
  },
  nestedRequestCancelText: {
    color: UI.textPrimary,
    fontWeight: '600',
  },
  nestedRequestSave: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.warning,
    borderRadius: 12,
  },
  nestedRequestSaveText: {
    color: UI.textInverse,
    fontWeight: '700',
  },
  priceInput: {
    backgroundColor: UI.surfaceAlt,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: wp('3%'),
    padding: 12,
    fontSize: wp('4%'),
  },
  tipsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.accentSoft,
    padding: 14,
    borderRadius: wp('3%'),
    gap: wp('3%'),
    marginTop: hp('1%'),
  },
  tipsContent: {
    flex: 1,
  },
  tipsCardTitle: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: UI.warning,
    marginBottom: hp('0.5%'),
  },
  tipsCardText: {
    fontSize: 13,
    color: UI.warning,
    lineHeight: 20,
  },
  // Service Type Selector Styles
  serviceTypeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: UI.surfaceAlt,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: wp('3%'),
    padding: 14,
  },
  selectedServiceType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2.5%'),
  },
  selectedServiceTypeText: {
    fontSize: 15,
    fontWeight: '500',
    color: UI.textPrimary,
  },
  serviceTypePlaceholder: {
    fontSize: 15,
    color: UI.textMuted,
  },
  // Service type sheet inside post modal (avoids nested Modal — iOS touch issues)
  serviceTypePickerInlineWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    justifyContent: 'flex-end',
  },
  serviceTypePickerInlineBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.35)',
  },
  // Align with RecordQuoteScreen / in-app “sheet” pickers: compact rows + dividers
  serviceTypeSheetCard: {
    backgroundColor: UI.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: wp('4%'),
    paddingTop: hp('1.5%'),
    paddingBottom: hp('3.5%'),
    maxHeight: hp('58%'),
  },
  serviceTypeSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('1%'),
  },
  serviceTypeSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: UI.textPrimary,
    letterSpacing: -0.2,
  },
  serviceTypeSheetList: {
    maxHeight: hp('48%'),
  },
  serviceTypeSheetRow: {
    minHeight: 50,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: wp('2%'),
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceTypeSheetRowIcon: {
    width: 30,
  },
  serviceTypeSheetRowSelected: {
    backgroundColor: COLORS.accentSoft,
  },
  serviceTypeSheetRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: UI.textSecondary,
  },
  serviceTypeSheetRowTextSelected: {
    color: UI.warning,
  },
  serviceTypeSheetDivider: {
    height: 1,
    backgroundColor: UI.borderSoft,
  },
  
  // Video Player Modal Styles
  videoPlayerModal: {
    flex: 1,
    backgroundColor: 'black',
  },
  videoPlayerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: wp('4%'),
    paddingBottom: hp('1.5%'),
    backgroundColor: 'rgba(0,0,0,0.8)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  videoPlayerCloseButton: {
    width: 44,
    height: 44,
    borderRadius: wp('5.5%'),
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayerTitle: {
    flex: 1,
    fontSize: wp('4%'),
    fontWeight: '600',
    color: UI.textInverse,
    textAlign: 'center',
    marginHorizontal: wp('3%'),
  },
  videoPlayerShareButton: {
    width: 44,
    height: 44,
    borderRadius: wp('5.5%'),
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayerContainer: {
    height: 350,
    marginTop: 100,
    backgroundColor: 'black',
  },
  fullScreenVideo: {
    width: '100%',
    height: '100%',
  },
  videoPlayerInfo: {
    flex: 1,
    backgroundColor: UI.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: hp('3%'),
    paddingHorizontal: wp('5%'),
  },
  videoPlayerTitleSection: {
    marginBottom: hp('2.5%'),
  },
  videoPlayerVideoTitle: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: UI.textPrimary,
    marginBottom: hp('0.7%'),
  },
  videoPlayerDate: {
    fontSize: wp('3.5%'),
    color: UI.textSecondary,
  },
  videoPlayerStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: hp('2.5%'),
    backgroundColor: UI.surfaceAlt,
    borderRadius: wp('4%'),
    marginBottom: hp('3%'),
  },
  videoPlayerStatItem: {
    alignItems: 'center',
  },
  videoPlayerStatIcon: {
    width: 44,
    height: 44,
    borderRadius: wp('5.5%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('1%'),
  },
  videoPlayerStatValue: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: UI.textPrimary,
  },
  videoPlayerStatLabel: {
    fontSize: wp('3%'),
    color: UI.textSecondary,
    marginTop: 2,
  },
  videoPlayerDescriptionSection: {
    marginBottom: hp('3%'),
  },
  videoPlayerSectionTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: UI.textPrimary,
    marginBottom: hp('1.2%'),
  },
  videoPlayerDescription: {
    fontSize: wp('3.5%'),
    color: UI.textSecondary,
    lineHeight: 22,
  },
  videoPlayerReviewsSection: {
    marginBottom: hp('2.5%'),
  },
  videoPlayerReviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('2%'),
  },
  videoPlayerReviewsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accentSoft,
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('3%'),
    gap: wp('1%'),
  },
  videoPlayerReviewsCount: {
    fontSize: 13,
    fontWeight: '600',
    color: UI.warning,
  },
  videoPlayerReviewsList: {
    gap: wp('3%'),
  },
  videoPlayerReviewItem: {
    flexDirection: 'row',
    backgroundColor: UI.surfaceAlt,
    padding: 14,
    borderRadius: wp('3%'),
  },
  videoPlayerReviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: wp('5%'),
    backgroundColor: UI.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  videoPlayerReviewContent: {
    flex: 1,
  },
  videoPlayerReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('0.7%'),
  },
  videoPlayerReviewerName: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: UI.textPrimary,
  },
  videoPlayerReviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  videoPlayerReviewText: {
    fontSize: 13,
    color: UI.textSecondary,
    lineHeight: 20,
  },
  videoPlayerNoReviews: {
    alignItems: 'center',
    paddingVertical: hp('4%'),
    backgroundColor: UI.surfaceAlt,
    borderRadius: wp('3%'),
  },
  videoPlayerNoReviewsText: {
    fontSize: 15,
    fontWeight: '600',
    color: UI.textSecondary,
    marginTop: hp('1.5%'),
  },
  videoPlayerNoReviewsSubtext: {
    fontSize: 13,
    color: UI.textMuted,
    marginTop: hp('0.5%'),
  },
});

export default VideoUploadScreen; 