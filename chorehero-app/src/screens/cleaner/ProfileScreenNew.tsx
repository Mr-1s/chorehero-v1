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

import React, { useEffect, useCallback, useState } from 'react';
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

// Store
import { useCleanerStore } from '../../store/cleanerStore';
import { supabase } from '../../services/supabase';

// Components
import { MetricCard, QuickActionTile, PressableScale } from '../../components/cleaner';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { SkeletonBlock } from '../../components/Skeleton';

// Theme
import { cleanerTheme } from '../../utils/theme';

const { colors, typography, spacing, radii, shadows } = cleanerTheme;

type StackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Earnings: undefined;
  EarningsBreakdown: undefined;
  Schedule: undefined;
  Jobs: undefined;
  Content: undefined;
  VideoUpload: undefined;
  CameraView: undefined;
  HeroStats: undefined;
  CalendarSettings: undefined;
  RateManager: undefined;
  CreateService: undefined;
  SettingsScreen: undefined;
  BookingCustomization: undefined;
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
  const [packages, setPackages] = useState<{ id: string; title: string; base_price_cents: number | null; package_type: string | null; thumbnail_url: string | null; bookings_count: number }[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);

  const loadPackages = useCallback(async () => {
    const userId = currentCleaner?.id;
    if (!userId) return;
    setPackagesLoading(true);
    try {
      // Use package_analytics view via RPC (single query, no N+1)
      const { data: stats, error } = await supabase.rpc('get_my_package_stats');

      if (error) {
        // Fallback to N+1 if RPC not yet deployed
        const { data: posts } = await supabase
          .from('content_posts')
          .select('id, title, base_price_cents, package_type, thumbnail_url')
          .eq('user_id', userId)
          .eq('is_bookable', true)
          .eq('status', 'published')
          .order('created_at', { ascending: false });

        const withCounts = await Promise.all(
          (posts || []).map(async (p) => {
            const { count } = await supabase
              .from('bookings')
              .select('*', { count: 'exact', head: true })
              .eq('package_id', p.id);
            return { ...p, bookings_count: count ?? 0 };
          })
        );
        setPackages(withCounts);
        return;
      }

      setPackages(
        (stats || []).map((s: { package_id: string; title: string; base_price_cents: number | null; package_type: string | null; thumbnail_url: string | null; bookings_count: number }) => ({
          id: s.package_id,
          title: s.title || 'Package',
          base_price_cents: s.base_price_cents,
          package_type: s.package_type,
          thumbnail_url: s.thumbnail_url,
          bookings_count: s.bookings_count ?? 0,
        }))
      );
    } catch (err) {
      console.warn('Failed to load packages:', err);
      setPackages([]);
    } finally {
      setPackagesLoading(false);
    }
  }, [currentCleaner?.id]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    if (currentCleaner?.profileCompletion !== undefined && currentCleaner.profileCompletion < 1 && currentCleaner.isOnline) {
      toggleOnlineStatus();
    }
  }, [currentCleaner?.profileCompletion, currentCleaner?.isOnline, toggleOnlineStatus]);

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return `$${amount.toFixed(2)}`;
  };

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
      case 'earnings':
        navigation.navigate('EarningsBreakdown');
        break;
      case 'bookingCustomization':
        navigation.navigate('RateManager');
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
              loadPackages();
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
            <View style={styles.avatarContainer}>
              {cleaner.avatarUrl ? (
                <Image source={{ uri: cleaner.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={32} color={colors.textMuted} />
                </View>
              )}
              {/* Online ring */}
              <View style={[
                styles.onlineRing, 
                { borderColor: cleaner.isOnline ? colors.online : colors.offline }
              ]} />
            </View>

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
                toggleOnlineStatus();
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
                Profile {Math.round(cleaner.profileCompletion * 100)}% complete
              </Text>
              <PressableScale onPress={() => navigation.navigate('EditProfile')}>
                <View style={styles.completionLink}>
                  <Text style={styles.completionLinkText}>Complete profile</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </View>
              </PressableScale>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${cleaner.profileCompletion * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.completionHelper}>
              Complete your profile to get more bookings and increase earnings.
            </Text>
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
                    color={cleaner.verificationStatus === 'verified' ? '#0F766E' : '#9CA3AF'}
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

        {/* Combined Earnings Card */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.section}>
          <TouchableOpacity 
            style={styles.combinedEarningsCard}
            onPress={() => navigation.navigate('EarningsBreakdown')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FF8C00', '#F97316']}
              style={styles.combinedEarningsGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.combinedEarningsHeader}>
                <View style={styles.combinedEarningsIconContainer}>
                  <Ionicons name="wallet" size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.combinedEarningsTitle}>Earnings</Text>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
              </View>
              
              <View style={styles.combinedEarningsRow}>
                <View style={styles.combinedEarningsItem}>
                  <Text style={styles.combinedEarningsValue}>{formatCurrency(cleaner.todayEarnings)}</Text>
                  <Text style={styles.combinedEarningsLabel}>Today</Text>
                </View>
                <View style={styles.combinedEarningsDivider} />
                <View style={styles.combinedEarningsItem}>
                  <Text style={styles.combinedEarningsValue}>{formatCurrency(cleaner.weeklyEarnings)}</Text>
                  <Text style={styles.combinedEarningsLabel}>This Week</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Performance Card */}
        <Animated.View entering={FadeInUp.delay(250).duration(400)} style={styles.section}>
          <TouchableOpacity 
            style={styles.combinedPerformanceCard}
            onPress={() => navigation.navigate('HeroStats')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#1A2B48', '#1A2B48']}
              style={styles.combinedPerformanceGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.combinedPerformanceHeader}>
                <View style={styles.combinedPerformanceIconContainer}>
                  <Ionicons name="stats-chart" size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.combinedPerformanceTitle}>Performance</Text>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
              </View>
              
              <View style={styles.combinedPerformanceRow}>
                <View style={styles.combinedPerformanceItem}>
                  <View style={styles.combinedPerformanceValueRow}>
                    <Ionicons name="briefcase" size={18} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.combinedPerformanceValue}>{cleaner.totalJobs}</Text>
                  </View>
                  <Text style={styles.combinedPerformanceLabel}>Jobs Done</Text>
                </View>
                <View style={styles.combinedPerformanceDivider} />
                <View style={styles.combinedPerformanceItem}>
                  <View style={styles.combinedPerformanceValueRow}>
                    <Ionicons name="star" size={18} color="#FBBF24" />
                    <Text style={styles.combinedPerformanceValue}>{cleaner.rating.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.combinedPerformanceLabel}>Rating</Text>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* My Packages */}
        <Animated.View entering={FadeInUp.delay(250).duration(400)} style={styles.section}>
          <View style={styles.packagesSection}>
            <View style={styles.packagesHeader}>
              <Text style={styles.sectionTitle}>My Packages</Text>
              <TouchableOpacity onPress={() => navigation.navigate('VideoUpload')}>
                <Text style={styles.packagesManageText}>Manage</Text>
              </TouchableOpacity>
            </View>
            {packagesLoading ? (
              <View style={styles.packagesPlaceholder}>
                <Text style={styles.packagesPlaceholderText}>Loading...</Text>
              </View>
            ) : packages.length === 0 ? (
              <TouchableOpacity
                style={styles.packagesEmptyCard}
                onPress={() => navigation.navigate('VideoUpload')}
              >
                <Ionicons name="add-circle-outline" size={32} color={colors.textMuted} />
                <Text style={styles.packagesEmptyTitle}>Create your first package</Text>
                <Text style={styles.packagesEmptySubtext}>Upload a video and set a price to get booked</Text>
              </TouchableOpacity>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.packagesScroll}>
                {packages.map((pkg) => (
                  <TouchableOpacity
                    key={pkg.id}
                    style={styles.packageCard}
                    onPress={() => navigation.navigate('VideoUpload')}
                  >
                    {pkg.thumbnail_url ? (
                      <Image source={{ uri: pkg.thumbnail_url }} style={styles.packageThumb} />
                    ) : (
                      <View style={[styles.packageThumb, styles.packageThumbPlaceholder]}>
                        <Ionicons name="videocam-outline" size={24} color={colors.textMuted} />
                      </View>
                    )}
                    <Text style={styles.packageTitle} numberOfLines={1}>{pkg.title || 'Package'}</Text>
                    <Text style={styles.packagePrice}>
                      {pkg.base_price_cents != null
                        ? pkg.package_type === 'fixed'
                          ? `$${pkg.base_price_cents / 100}`
                          : `$${pkg.base_price_cents / 100}/hr`
                        : 'Contact'}
                    </Text>
                    <Text style={styles.packageBookings}>{pkg.bookings_count} bookings</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickActionTile
              icon="videocam-outline"
              label="Post a Chore"
              gradientColors={['#26B7C9', '#26B7C9']}
              onPress={() => handleQuickAction('quickUpload')}
            />
            <QuickActionTile
              icon="briefcase-outline"
              label="Find Work"
              gradientColors={['#26B7C9', '#26B7C9']}
              onPress={() => handleQuickAction('viewJobs')}
            />
            <QuickActionTile
              icon="calendar-outline"
              label="My Availability"
              style={styles.quickActionMuted}
              labelColor="#444444"
              onPress={() => handleQuickAction('schedule')}
            />
            <QuickActionTile
              icon="options-outline"
              label="Service Rates"
              style={styles.quickActionMuted}
              labelColor="#444444"
              onPress={() => handleQuickAction('bookingCustomization')}
            />
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

      {/* Bottom Navigation */}
      <CleanerFloatingNavigation
        navigation={navigation as any}
        currentScreen="Profile"
      />
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
              <Ionicons name="shield-checkmark-outline" size={18} color="#26B7C9" />
              <Text style={styles.detailsText}>Background Check: {backgroundCheckLabel}</Text>
            </View>
            <View style={styles.detailsRow}>
              <Ionicons name="videocam-outline" size={18} color="#26B7C9" />
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
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: radii.card,
    padding: spacing.xl,
    ...shadows.card,
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
    borderRadius: 36,
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
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  verificationBadgeVerified: {
    backgroundColor: 'rgba(38, 183, 201, 0.16)',
  },
  verificationBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  verificationBadgeTextVerified: {
    color: '#0F766E',
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
    gap: 6,
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
    color: '#26B7C9',
    fontWeight: '700',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 12,
    color: colors.textMuted,
  },

  // Sections
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

  // My Packages
  packagesSection: {},
  packagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  packagesManageText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  packagesPlaceholder: {
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    ...shadows.soft,
  },
  packagesPlaceholderText: {
    fontSize: 14,
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
    marginTop: 4,
  },
  packagesScroll: {
    marginHorizontal: -spacing.xl,
  },
  packageCard: {
    width: 140,
    marginLeft: spacing.xl,
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    overflow: 'hidden',
    ...shadows.soft,
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
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    paddingHorizontal: spacing.md,
    paddingTop: 2,
  },
  packageBookings: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    paddingTop: 2,
  },

  // Completion Card
  completionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.soft,
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
    gap: 4,
  },
  completionLinkText: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    color: colors.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  completionHelper: {
    fontSize: typography.label.fontSize,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Verification Card
  verificationCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.soft,
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
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  combinedEarningsGradient: {
    padding: spacing.lg,
    borderRadius: radii.xl,
  },
  combinedEarningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  combinedEarningsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  combinedEarningsTitle: {
    flex: 1,
    fontSize: 18,
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
  },
  combinedEarningsDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: spacing.md,
  },
  combinedEarningsValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  combinedEarningsLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },

  // Combined Performance Card
  combinedPerformanceCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    shadowColor: '#1A2B48',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  combinedPerformanceGradient: {
    padding: spacing.lg,
    borderRadius: radii.xl,
  },
  combinedPerformanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  combinedPerformanceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  combinedPerformanceTitle: {
    flex: 1,
    fontSize: 18,
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
  },
  combinedPerformanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: spacing.md,
  },
  combinedPerformanceValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  combinedPerformanceValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  combinedPerformanceLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },

  // Quick Actions Grid
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  quickActionMuted: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  // Specialties
  specialtiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  specialtyTag: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  specialtyTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#26B7C9',
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
    borderRadius: 16,
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
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: spacing.sm,
  },
  detailsText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  detailsNote: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textMuted,
  },
});

export default ProfileScreenNew;

