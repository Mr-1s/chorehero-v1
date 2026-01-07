/**
 * ContentScreen - Video content management for cleaners
 * 
 * Features:
 * - Video stats metrics (views, bookings, conversion, avg views)
 * - Record video / Choose from library CTAs
 * - Pro tip section
 */

import React, { useEffect, useCallback } from 'react';
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

// Components
import { MetricCard, PressableScale } from '../../components/cleaner';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { SkeletonBlock } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';

// Theme
import { cleanerTheme } from '../../utils/theme';

const { colors, typography, spacing, radii, shadows } = cleanerTheme;

type StackParamList = {
  Content: undefined;
  VideoUpload: { videoUri: string };
};

type ContentScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'Content'>;
};

const ContentScreenNew: React.FC<ContentScreenProps> = ({ navigation }) => {
  const { showToast } = useToast();
  
  // Store state
  const { videoStats, isLoading, fetchDashboard } = useCleanerStore();

  useEffect(() => {
    fetchDashboard();
  }, []);

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
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'Please enable camera access in your settings to record videos.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets[0]) {
        navigation.navigate('VideoUpload', { videoUri: result.assets[0].uri });
      }
    } catch (error) {
      console.error('Error recording video:', error);
      showToast?.({ type: 'error', message: 'Failed to open camera' });
    }
  }, [navigation, showToast]);

  // Handle choose from library
  const handleChooseFromLibrary = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Library Permission Required',
          'Please enable photo library access in your settings to select videos.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        navigation.navigate('VideoUpload', { videoUri: result.assets[0].uri });
      }
    } catch (error) {
      console.error('Error selecting video:', error);
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
                iconColor="#10B981"
                delay={100}
                compact
                style={styles.statCard}
              />
              <MetricCard
                value={formatConversion(videoStats?.conversionRate || 0)}
                label="Conversion"
                icon="trending-up-outline"
                iconColor="#8B5CF6"
                delay={200}
                compact
                style={styles.statCard}
              />
              <MetricCard
                value={formatNumber(videoStats?.avgViewsPerVideo || 0)}
                label="Avg views"
                icon="analytics-outline"
                iconColor="#F59E0B"
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
            <Text style={styles.proTipEmoji}>💡</Text>
          </View>
          <Text style={styles.proTipText}>
            Top ChoreHeroes post 30–45s before/after videos 2–3x per week.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Bottom Navigation */}
      <CleanerFloatingNavigation
        navigation={navigation as any}
        currentScreen="Content"
      />
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
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },
  section: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: typography.sectionHeading.fontSize,
    fontWeight: typography.sectionHeading.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
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
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    lineHeight: typography.body.lineHeight,
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
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textInverse,
  },
  outlineButton: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  outlineButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.primary,
  },
  proTipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    gap: spacing.md,
  },
  proTipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proTipEmoji: {
    fontSize: 18,
  },
  proTipText: {
    flex: 1,
    fontSize: typography.label.fontSize,
    color: colors.textPrimary,
    lineHeight: 18,
  },
});

export default ContentScreenNew;

