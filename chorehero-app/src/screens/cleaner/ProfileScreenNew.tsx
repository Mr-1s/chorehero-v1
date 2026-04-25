/**
 * ProfileScreen - Cleaner profile with quick actions grid
 * 
 * Features:
 * - Hero section with greeting and status
 * - Profile completion progress
 * - Verification status
 * - Today's performance metrics
 * - Quick actions grid (2 columns)
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  Switch,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// spacing.xl = 20px padding each side (40px total), spacing.md = 12px gap
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 12) / 2;
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';

// Store
import { useCleanerStore } from '../../store/cleanerStore';

// Components
import { MetricCard, PressableScale } from '../../components/cleaner';
import { SkeletonBlock } from '../../components/Skeleton';

// Theme
import { cleanerTheme } from '../../utils/theme';
import { wp, hp } from '../../utils/responsive';

const { colors, typography, spacing, radii, shadows } = cleanerTheme;

type StackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Schedule: undefined;
  Jobs: undefined;
  Content: undefined;
  VideoUpload: undefined;
  CameraView: undefined;
  HeroStats: undefined;
  CalendarSettings: undefined;
  RateManager: undefined;
  ProServices: undefined;
  CreateService: undefined;
  SettingsScreen: undefined;
  BookingCustomization: undefined;
  CleanerProfileEdit: undefined;
  EditProfileScreen: undefined;
};

type ProfileScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'Profile'>;
};

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const ProfileScreenNew: React.FC<ProfileScreenProps> = ({ navigation }) => {
  // Store state
  const {
    currentCleaner,
    isLoading,
    isRefreshing,
    fetchDashboard,
    toggleOnlineStatus,
    refreshData,
  } = useCleanerStore();
  const [detailsVisible, setDetailsVisible] = React.useState(false);
  useEffect(() => {
    if (currentCleaner?.profileCompletion !== undefined && currentCleaner.profileCompletion < 1 && currentCleaner.isOnline) {
      void toggleOnlineStatus();
    }
  }, [currentCleaner?.profileCompletion, currentCleaner?.isOnline, toggleOnlineStatus]);

  useFocusEffect(
    useCallback(() => {
      void fetchDashboard();
    }, [fetchDashboard])
  );

  // Handle quick action navigation
  const handleQuickAction = useCallback((action: string) => {
    switch (action) {
      case 'quickUpload':
        navigation.navigate('CameraView');
        break;
      case 'viewJobs':
        navigation.navigate('Jobs');
        break;
      case 'schedule':
        navigation.navigate('CalendarSettings');
        break;
      case 'bookingCustomization':
        navigation.navigate('RateManager');
        break;
      case 'manageServices':
        (navigation as any).navigate('ProServices');
        break;
    }
  }, [navigation]);

  if (isLoading && !currentCleaner) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <View style={styles.loadingContainer}>
          <SkeletonBlock height={120} style={{ borderRadius: radii.card, marginBottom: spacing.lg }} />
          <SkeletonBlock height={80} style={{ borderRadius: radii.card, marginBottom: spacing.lg }} />
          <SkeletonBlock height={200} style={{ borderRadius: radii.card }} />
        </View>
      </SafeAreaView>
    );
  }

  const cleaner = currentCleaner!;
  const canGoOnline = cleaner.profileCompletion >= 1;
  const isOnline = canGoOnline && cleaner.isOnline;
  const showPendingReview = cleaner.onboardingState === 'STAGING' && cleaner.verificationStatus !== 'verified';
  const showVerificationCard = showPendingReview || cleaner.verificationStatus === 'verified';
  const backgroundCheckLabel = cleaner.backgroundCheckStatus || 'pending';
  const auditionLabel = cleaner.videoProfileUrl ? 'Submitted' : 'Not submitted';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={async () => {
              await refreshData();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Hero Section */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.heroSection}>
          <View style={styles.heroHeader}>
            {/* Avatar */}
            <PressableScale onPress={() => navigation.navigate('CleanerProfileEdit')}>
              <View style={styles.avatarContainer}>
                {cleaner.avatarUrl ? (
                  <Image source={{ uri: cleaner.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={32} color={colors.textMuted} />
                  </View>
                )}
                {/* Online ring */}
                <View
                  style={[
                    styles.onlineRing,
                    { borderColor: cleaner.isOnline ? colors.online : colors.offline },
                  ]}
                />
              </View>
            </PressableScale>

            {/* Info */}
            <View style={styles.heroInfo}>
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.name}>{cleaner.name}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={styles.metaText}>{cleaner.rating.toFixed(1)}</Text>
                <View style={styles.metaDot} />
                <Text style={styles.metaText}>{cleaner.totalJobs} jobs</Text>
                <View style={styles.metaDot} />
                <Text style={[
                  styles.metaStatus,
                  isOnline && styles.metaStatusOnline,
                ]}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>

            {/* Settings */}
            <PressableScale onPress={() => navigation.navigate('SettingsScreen')}>
              <View style={styles.settingsButton}>
                <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
              </View>
            </PressableScale>
          </View>

          {/* Online toggle */}
          <View style={styles.onlineToggle}>
            <Text style={styles.onlineToggleLabel}>Available for jobs</Text>
            <Switch
              value={isOnline}
              onValueChange={() => {
                if (!canGoOnline) return;
                void toggleOnlineStatus();
              }}
              disabled={!canGoOnline}
              trackColor={{ false: colors.borderSubtle, true: colors.primaryLight }}
              thumbColor={cleaner.isOnline ? colors.primary : colors.textMuted}
            />
          </View>
          {!canGoOnline && (
            <Text style={styles.toggleHelper}>Complete your profile to go Online.</Text>
          )}
        </Animated.View>

        {/* Profile Completion */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.section}>
          <View style={styles.completionCard}>
            <View style={styles.completionHeader}>
              <Text style={styles.completionTitle}>
                {Math.round(cleaner.profileCompletion * 100)}% · Pro profile
              </Text>
              {cleaner.profileCompletion < 0.999 ? <View /> : null}
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${cleaner.profileCompletion * 100}%` }
                ]} 
              />
            </View>
            {!['cleared', 'verified'].includes(String(backgroundCheckLabel).toLowerCase()) && (
              <Text style={styles.completionPending}>
                Background check pending — score reaches 100% when verified.
              </Text>
            )}
          </View>
        </Animated.View>

        {/* Verification */}
        {showVerificationCard && (
          <Animated.View entering={FadeInUp.delay(150).duration(400)} style={styles.section}>
            <View style={styles.verificationCard}>
              <View style={styles.verificationRow}>
                <View style={[
                  styles.verificationBadge,
                  cleaner.verificationStatus === 'verified' && styles.verificationBadgeVerified,
                ]}>
                  <Ionicons
                    name={cleaner.verificationStatus === 'verified' ? 'checkmark-circle' : 'time'}
                    size={14}
                    color={cleaner.verificationStatus === 'verified' ? '#B45309' : '#9CA3AF'}
                  />
                  <Text style={[
                    styles.verificationBadgeText,
                    cleaner.verificationStatus === 'verified' && styles.verificationBadgeTextVerified,
                  ]}>
                    {cleaner.verificationStatus === 'verified' ? 'Verified' : 'Pending Review'}
                  </Text>
                </View>
                <PressableScale onPress={() => setDetailsVisible(true)}>
                  <Text style={styles.verificationLink}>View details</Text>
                </PressableScale>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Shortcuts — single-column list (cleaner on small screens) */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Shortcuts
          </Text>
          <View style={styles.shortcutsList}>
            <TouchableOpacity
              style={styles.shortcutRow}
              onPress={() => navigation.navigate('CleanerProfileEdit')}
              activeOpacity={0.75}
            >
              <View style={styles.shortcutIconWrap}>
                <Ionicons name="create-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.shortcutTextBlock}>
                <Text style={styles.shortcutLabel}>Edit profile</Text>
                <Text style={styles.shortcutSub}>Bio, services, trust & booking template</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shortcutRow}
              onPress={() => handleQuickAction('quickUpload')}
              activeOpacity={0.75}
            >
              <View style={styles.shortcutIconWrap}>
                <Ionicons name="videocam-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.shortcutTextBlock}>
                <Text style={styles.shortcutLabel}>New video for profile</Text>
                <Text style={styles.shortcutSub}>Record or upload from your library</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shortcutRow}
              onPress={() => handleQuickAction('viewJobs')}
              activeOpacity={0.75}
            >
              <View style={styles.shortcutIconWrap}>
                <Ionicons name="briefcase-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.shortcutTextBlock}>
                <Text style={styles.shortcutLabel}>Open job board</Text>
                <Text style={styles.shortcutSub}>See requests and new work near you</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shortcutRow}
              onPress={() => handleQuickAction('schedule')}
              activeOpacity={0.75}
            >
              <View style={[styles.shortcutIconWrap, styles.shortcutIconMuted]}>
                <Ionicons name="calendar-outline" size={22} color={colors.textSecondary} />
              </View>
              <View style={styles.shortcutTextBlock}>
                <Text style={styles.shortcutLabel}>Availability</Text>
                <Text style={styles.shortcutSub}>When you can take new jobs</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shortcutRow}
              onPress={() => handleQuickAction('bookingCustomization')}
              activeOpacity={0.75}
            >
              <View style={[styles.shortcutIconWrap, styles.shortcutIconMuted]}>
                <Ionicons name="pricetags-outline" size={22} color={colors.textSecondary} />
              </View>
              <View style={styles.shortcutTextBlock}>
                <Text style={styles.shortcutLabel}>Default rates & fees</Text>
                <Text style={styles.shortcutSub}>Base pricing and booking options</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.shortcutRow, styles.shortcutRowLast]}
              onPress={() => handleQuickAction('manageServices')}
              activeOpacity={0.75}
            >
              <View style={[styles.shortcutIconWrap, styles.shortcutIconMuted]}>
                <Ionicons name="construct-outline" size={22} color={colors.textSecondary} />
              </View>
              <View style={styles.shortcutTextBlock}>
                <Text style={styles.shortcutLabel}>Services you offer</Text>
                <Text style={styles.shortcutSub}>Turn services on, prices, and pre-job questions</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Specialties */}
        {cleaner.specialties.length > 0 && (
          <Animated.View entering={FadeInUp.delay(350).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Specialties</Text>
            <View style={styles.specialtiesRow}>
              {cleaner.specialties.map((specialty, index) => (
                <View key={index} style={styles.specialtyTag}>
                  <Text style={styles.specialtyTagText}>{specialty}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <Modal
        visible={detailsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsVisible(false)}
      >
        <View style={styles.detailsBackdrop}>
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>Review Summary</Text>
              <TouchableOpacity onPress={() => setDetailsVisible(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.detailsRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#FFA52F" />
              <Text style={styles.detailsText}>Background Check: {backgroundCheckLabel}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Ionicons name="videocam-outline" size={18} color="#FFA52F" />
              <Text style={styles.detailsText}>Hero Audition: {auditionLabel}</Text>
            </View>
            <Text style={styles.detailsNote}>This summary is read-only.</Text>
          </View>
        </View>
      </Modal>
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
  loadingContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },

  // Hero Section
  heroSection: {
    backgroundColor: colors.cardBg,
    marginHorizontal: wp('5%'),
    marginTop: hp('1.5%'),
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: wp('9%'),
    backgroundColor: colors.metaBg,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 39,
    borderWidth: 3,
  },
  heroInfo: {
    flex: 1,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('1.5%'),
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('3%'),
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  verificationBadgeVerified: {
    backgroundColor: 'rgba(255, 165, 47, 0.15)',
  },
  verificationBadgeText: {
    fontSize: wp('3%'),
    fontWeight: '700',
    color: '#6B7280',
  },
  verificationBadgeTextVerified: {
    color: '#B45309',
  },
  greeting: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  name: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: wp('1.5%'),
  },
  metaText: {
    fontSize: typography.label.fontSize,
    color: colors.textSecondary,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textMuted,
  },
  metaStatus: {
    fontSize: typography.label.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  metaStatusOnline: {
    color: '#FFA52F',
    fontWeight: '700',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: wp('5%'),
    backgroundColor: colors.metaBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  onlineToggleLabel: {
    fontSize: typography.body.fontSize,
    color: colors.textPrimary,
  },
  toggleHelper: {
    marginTop: spacing.sm,
    fontSize: wp('3%'),
    color: colors.textMuted,
  },

  // Sections
  flex1: { flex: 1 },
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sectionHeading.fontSize,
    fontWeight: typography.sectionHeading.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  packagesBlockTitle: {
    fontSize: typography.sectionHeading.fontSize,
    fontWeight: typography.sectionHeading.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },

  // My Packages
  packagesSection: {},
  packagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: spacing.md,
  },
  packagesManageText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    maxWidth: 120,
    textAlign: 'right',
  },
  packagesPlaceholder: {
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  packagesPlaceholderText: {
    fontSize: wp('3.5%'),
    color: colors.textMuted,
  },
  packagesEmptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  packagesEmptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  packagesEmptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: hp('0.5%'),
  },
  packagesScroll: {
    marginHorizontal: -spacing.xl,
  },
  packageCard: {
    width: 140,
    marginLeft: spacing.xl,
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  packageThumb: {
    width: '100%',
    height: 90,
    backgroundColor: colors.metaBg,
  },
  packageThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  packagePrice: {
    fontSize: wp('3.5%'),
    fontWeight: '700',
    color: colors.primary,
    paddingHorizontal: spacing.md,
    paddingTop: 2,
  },
  packageBookings: {
    fontSize: wp('3%'),
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: 2,
  },

  // Completion Card
  completionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  completionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  completionTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: typography.cardTitle.fontWeight,
    color: colors.textPrimary,
  },
  completionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('1%'),
  },
  completionLinkText: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    color: colors.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: wp('1%'),
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: wp('1%'),
  },
  completionPending: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },

  // Verification Card
  verificationCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verificationLink: {
    fontSize: typography.label.fontSize,
    color: colors.primary,
    fontWeight: '500',
  },

  // Performance Grid
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  performanceCard: {
    width: CARD_WIDTH,
  },

  // Combined Earnings Card
  combinedEarningsCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    shadowColor: '#D97706',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  combinedEarningsGradient: {
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  combinedEarningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  combinedEarningsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: wp('5%'),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  combinedEarningsTitle: {
    flex: 1,
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  combinedEarningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  combinedEarningsItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    minHeight: 88,
    justifyContent: 'center',
  },
  combinedEarningsDivider: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginHorizontal: spacing.md,
    alignSelf: 'center',
  },
  combinedEarningsValue: {
    fontSize: wp('7%'),
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: hp('0.5%'),
  },
  combinedEarningsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // Combined Performance Card
  combinedPerformanceCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 10,
  },
  combinedPerformanceGradient: {
    padding: spacing.lg,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  combinedPerformanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  combinedPerformanceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: wp('5%'),
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  combinedPerformanceTitle: {
    flex: 1,
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  combinedPerformanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  combinedPerformanceItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 12,
    minHeight: 88,
    justifyContent: 'center',
  },
  combinedPerformanceDivider: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: spacing.md,
    alignSelf: 'center',
  },
  combinedPerformanceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('1.5%'),
    marginBottom: hp('0.4%'),
  },
  combinedPerformanceValue: {
    fontSize: wp('7%'),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  combinedPerformanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  cardLocked: { opacity: 0.72 },
  lockHint: {
    marginTop: spacing.md,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.86)',
    textAlign: 'center',
  },

  shortcutsList: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  shortcutIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 165, 47, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  shortcutIconMuted: {
    backgroundColor: colors.metaBg,
  },
  shortcutTextBlock: {
    flex: 1,
  },
  shortcutLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  shortcutSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  shortcutRowLast: {
    borderBottomWidth: 0,
  },
  // Specialties
  specialtiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  specialtyTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.7%'),
    borderRadius: 999,
  },
  specialtyTagText: {
    fontSize: wp('3%'),
    fontWeight: '600',
    color: '#FFA52F',
  },
  detailsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  detailsCard: {
    width: '100%',
    borderRadius: wp('4%'),
    backgroundColor: '#FFFFFF',
    padding: spacing.lg,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  detailsTitle: {
    fontSize: wp('4%'),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2.5%'),
    marginBottom: spacing.sm,
  },
  detailsText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  detailsNote: {
    marginTop: spacing.sm,
    fontSize: wp('3%'),
    color: colors.textMuted,
  },
});

export default ProfileScreenNew;

