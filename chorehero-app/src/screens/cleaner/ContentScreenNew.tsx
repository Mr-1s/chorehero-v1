/**
 * ContentScreen - Video content management for cleaners
 * 
 * Features:
 * - Video stats metrics (views, bookings, conversion, avg views)
 * - Record video / Choose from library CTAs
 * - Pro tip section
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import type { StackNavigationProp } from '@react-navigation/stack';

// Store
import { useCleanerStore } from '../../store/cleanerStore';
import { contentAnalyticsService, type VideoWithStats } from '../../services/contentAnalyticsService';
import { supabase } from '../../services/supabase';

// Components
import { MetricCard, PressableScale } from '../../components/cleaner';
import { SkeletonBlock } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';

// Theme
import { cleanerTheme } from '../../utils/theme';
import { COLORS } from '../../utils/constants';
import { wp, hp } from '../../utils/responsive';

const { colors, typography, spacing, radii, shadows } = cleanerTheme;

const PRO_HUB_TIPS: string[] = [
  'Clips are limited to 45s — hook viewers in the first few seconds.',
  'Post 2–3x per week so local customers keep seeing you.',
  'Steady phone + natural light read better than long, shaky takes.',
  'Show a clear before/after or your process — trust drives bookings.',
  'Say what you specialize in; the right customers will stop scrolling.',
];

type StackParamList = {
  Content: undefined;
  VideoUpload: {
    videoUri: string;
    durationMillis?: number;
    returnToContentHub?: boolean;
  };
};

type ContentScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'Content'>;
};

const ContentScreenNew: React.FC<ContentScreenProps> = ({ navigation }) => {
  const { showToast } = useToast();
  const [hubTipIndex, setHubTipIndex] = useState(0);
  const [uploadedVideos, setUploadedVideos] = useState<VideoWithStats[]>([]);

  // Store state
  const { videoStats, isLoading, fetchDashboard } = useCleanerStore();

  const loadVideos = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId || userId.startsWith('demo_')) {
        setUploadedVideos([]);
        return;
      }
      const videos = await contentAnalyticsService.getVideosWithStats(userId);
      setUploadedVideos(videos);
    } catch {
      setUploadedVideos([]);
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setHubTipIndex((i) => (i + 1) % PRO_HUB_TIPS.length);
    }, 7500);
    return () => clearInterval(t);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
      void loadVideos();
    }, [fetchDashboard, loadVideos])
  );

  // Format conversion rate as percentage
  const formatConversion = (rate: number): string => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Handle record video
  const handleRecordVideo = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in your settings to record videos.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        quality: 0.8,
        videoMaxDuration: 45,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        navigation.navigate('VideoUpload', {
          videoUri: asset.uri,
          durationMillis: asset.duration,
          returnToContentHub: true,
        });
      }
    } catch (error) {
      console.error('Error recording video:', error);
      showToast?.({ type: 'error', message: 'Failed to open camera' });
    }
  }, [navigation, showToast]);

  // Handle choose from library
  const handleChooseFromLibrary = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Please enable photo library access.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
        videoMaxDuration: 45,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        navigation.navigate('VideoUpload', {
          videoUri: asset.uri,
          durationMillis: asset.duration,
          returnToContentHub: true,
        });
      }
    } catch (error) {
      console.error('Error choosing video:', error);
      showToast?.({ type: 'error', message: 'Failed to open library' });
    }
  }, [navigation, showToast]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Text style={styles.headerTitle}>My Content</Text>
          <Text style={styles.headerSubtitle}>
            Create videos to attract more customers
          </Text>
        </Animated.View>

        {/* Stats Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Content Performance</Text>
          
          {isLoading ? (
            <View style={styles.statsGrid}>
              <SkeletonBlock height={110} style={styles.statSkeleton} />
              <SkeletonBlock height={110} style={styles.statSkeleton} />
              <SkeletonBlock height={110} style={styles.statSkeleton} />
              <SkeletonBlock height={110} style={styles.statSkeleton} />
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <MetricCard
                value={formatNumber(videoStats?.totalViews || 0)}
                label="Total views"
                icon="eye-outline"
                iconColor={colors.primary}
                delay={0}
                compact
                style={styles.statCard}
              />
              <MetricCard
                value={videoStats?.bookingsFromVideos || 0}
                label="Bookings"
                icon="calendar-outline"
                iconColor={colors.success}
                delay={100}
                compact
                style={styles.statCard}
              />
              <MetricCard
                value={formatConversion(videoStats?.conversionRate || 0)}
                label="Conversion"
                icon="trending-up-outline"
                iconColor={COLORS.info}
                delay={200}
                compact
                style={styles.statCard}
              />
              <MetricCard
                value={formatNumber(videoStats?.avgViewsPerVideo || 0)}
                label="Avg views"
                icon="analytics-outline"
                iconColor={COLORS.warning}
                delay={300}
                compact
                style={styles.statCard}
              />
            </View>
          )}
        </View>

        {/* Upload Section */}
        <Animated.View 
          entering={FadeInUp.delay(400).duration(400)} 
          style={styles.section}
        >
          <Text style={styles.sectionTitle}>Upload New Video</Text>
          
          <View style={styles.uploadCard}>
            <Text style={styles.uploadDescription}>
              Share your cleaning skills and attract more customers with before/after videos.
            </Text>
            
            <View style={styles.uploadButtons}>
              <PressableScale onPress={handleRecordVideo} style={styles.uploadButtonWrapper}>
                <View style={[styles.uploadButton, styles.primaryButton]}>
                  <Ionicons name="videocam" size={20} color={colors.textInverse} />
                  <Text style={styles.primaryButtonText}>Record Video</Text>
                </View>
              </PressableScale>
              
              <PressableScale onPress={handleChooseFromLibrary} style={styles.uploadButtonWrapper}>
                <View style={[styles.uploadButton, styles.outlineButton]}>
                  <Ionicons name="images-outline" size={20} color={colors.primary} />
                  <Text style={styles.outlineButtonText}>Choose from Library</Text>
                </View>
              </PressableScale>
            </View>
          </View>
        </Animated.View>

        {/* Pro Tip Section */}
        <Animated.View 
          entering={FadeInUp.delay(500).duration(400)} 
          style={styles.proTipContainer}
        >
          <View style={styles.proTipIcon}>
            <Ionicons name="bulb" size={22} color={colors.primary} />
          </View>
          <View style={styles.proTipTextWrap}>
            <Text style={styles.proTipLabel}>Tip</Text>
            <Text style={styles.proTipText} key={hubTipIndex}>
              {PRO_HUB_TIPS[hubTipIndex]}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(600).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Your Posts</Text>
          {uploadedVideos.length === 0 ? (
            <View style={styles.emptyPosts}>
              <Text style={styles.emptyPostsTitle}>No videos posted yet</Text>
              <Text style={styles.emptyPostsSubtitle}>Upload a clip and it will show here and in the feed.</Text>
            </View>
          ) : (
            uploadedVideos.slice(0, 6).map((video) => (
              <TouchableOpacity key={video.id} style={styles.postRow} activeOpacity={0.8}>
                <View style={styles.postRowText}>
                  <Text style={styles.postTitle} numberOfLines={1}>{video.title || 'Cleaning video'}</Text>
                  <Text style={styles.postMeta}>
                    {video.views} views · {video.bookings} bookings · {video.status}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Account for bottom nav
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerTitle: {
    fontSize: wp('7%'),
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  section: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    letterSpacing: -0.2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
  },
  statSkeleton: {
    flex: 1,
    minWidth: '45%',
    borderRadius: radii.card,
  },
  uploadCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: spacing.xl,
    ...shadows.card,
  },
  uploadDescription: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  uploadButtons: {
    gap: spacing.md,
  },
  uploadButtonWrapper: {
    width: '100%',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: radii.pill,
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    ...shadows.orange,
  },
  primaryButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
  outlineButton: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  outlineButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  proTipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    gap: spacing.md,
  },
  proTipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proTipTextWrap: {
    flex: 1,
  },
  proTipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  proTipText: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  emptyPosts: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
  },
  emptyPostsTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: typography.cardTitle.fontWeight,
    color: colors.textPrimary,
  },
  emptyPostsSubtitle: {
    marginTop: spacing.xs,
    fontSize: typography.label.fontSize,
    color: colors.textSecondary,
  },
  postRow: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  postRowText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  postTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  postMeta: {
    marginTop: 2,
    fontSize: typography.labelSmall.fontSize,
    color: colors.textMuted,
  },
});

export default ContentScreenNew;

