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
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// spacing.xl = 20px padding each side (40px total), spacing.md = 12px gap
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 12) / 2;
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import type { StackNavigationProp } from '@react-navigation/stack';

// Store
import { useCleanerStore } from '../../store/cleanerStore';

// Components
import { MetricCard, QuickActionTile, Chip, PressableScale } from '../../components/cleaner';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { SkeletonBlock } from '../../components/Skeleton';

// Theme
import { cleanerTheme } from '../../utils/theme';

const { colors, typography, spacing, radii, shadows } = cleanerTheme;

type StackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Earnings: undefined;
  Schedule: undefined;
  Jobs: undefined;
  Content: undefined;
  CreateService: undefined;
  Settings: undefined;
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
      case 'createService':
        navigation.navigate('CreateService');
        break;
      case 'quickUpload':
        navigation.navigate('Content');
        break;
      case 'viewJobs':
        navigation.navigate('Jobs');
        break;
      case 'schedule':
        navigation.navigate('Schedule');
        break;
      case 'earnings':
        navigation.navigate('Earnings');
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
            onRefresh={refreshData}
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
                <Chip
                  label={cleaner.isOnline ? 'Online' : 'Offline'}
                  variant="filled"
                  color={cleaner.isOnline ? 'success' : 'grey'}
                  size="sm"
                />
              </View>
            </View>

            {/* Settings */}
            <PressableScale onPress={() => navigation.navigate('Settings')}>
              <View style={styles.settingsButton}>
                <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
              </View>
            </PressableScale>
          </View>

          {/* Online toggle */}
          <View style={styles.onlineToggle}>
            <Text style={styles.onlineToggleLabel}>Available for jobs</Text>
            <Switch
              value={cleaner.isOnline}
              onValueChange={toggleOnlineStatus}
              trackColor={{ false: colors.borderSubtle, true: colors.primaryLight }}
              thumbColor={cleaner.isOnline ? colors.primary : colors.textMuted}
            />
          </View>
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
        <Animated.View entering={FadeInUp.delay(150).duration(400)} style={styles.section}>
          <View style={styles.verificationCard}>
            <View style={styles.verificationRow}>
              <Chip
                label="Verified"
                variant="filled"
                color="teal"
                icon="checkmark-circle"
                size="sm"
              />
              <PressableScale>
                <Text style={styles.verificationLink}>View details</Text>
              </PressableScale>
            </View>
          </View>
        </Animated.View>

        {/* Today's Performance */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Performance</Text>
          <View style={styles.performanceGrid}>
            <MetricCard
              value={formatCurrency(cleaner.todayEarnings)}
              label="Today"
              icon="cash-outline"
              iconColor={colors.primary}
              delay={0}
              compact
              style={styles.performanceCard}
            />
            <MetricCard
              value={formatCurrency(cleaner.weeklyEarnings)}
              label="This week"
              icon="wallet-outline"
              iconColor="#10B981"
              delay={50}
              compact
              style={styles.performanceCard}
            />
            <MetricCard
              value={cleaner.totalJobs}
              label="Jobs done"
              icon="briefcase-outline"
              iconColor="#8B5CF6"
              delay={100}
              compact
              style={styles.performanceCard}
            />
            <MetricCard
              value={cleaner.rating.toFixed(1)}
              label="Rating"
              icon="star-outline"
              iconColor="#F59E0B"
              delay={150}
              compact
              style={styles.performanceCard}
            />
          </View>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickActionTile
              icon="add-circle-outline"
              label="Create Service"
              onPress={() => handleQuickAction('createService')}
            />
            <QuickActionTile
              icon="videocam-outline"
              label="Quick Upload"
              onPress={() => handleQuickAction('quickUpload')}
            />
            <QuickActionTile
              icon="briefcase-outline"
              label="View Jobs"
              onPress={() => handleQuickAction('viewJobs')}
            />
            <QuickActionTile
              icon="calendar-outline"
              label="Schedule"
              onPress={() => handleQuickAction('schedule')}
            />
          </View>
          {/* Earnings - Full Width */}
          <View style={styles.earningsFullRow}>
            <QuickActionTile
              icon="cash-outline"
              label="Earnings"
              onPress={() => handleQuickAction('earnings')}
              style={styles.earningsTile}
            />
          </View>
        </Animated.View>

        {/* Specialties */}
        {cleaner.specialties.length > 0 && (
          <Animated.View entering={FadeInUp.delay(350).duration(400)} style={styles.section}>
            <Text style={styles.sectionTitle}>Specialties</Text>
            <View style={styles.specialtiesRow}>
              {cleaner.specialties.map((specialty, index) => (
                <Chip
                  key={index}
                  label={specialty}
                  variant="muted"
                  color="primary"
                  size="sm"
                />
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

  // Quick Actions Grid
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  earningsFullRow: {
    marginTop: spacing.md,
  },
  earningsTile: {
    width: SCREEN_WIDTH - 40, // Full width minus 20px padding each side
  },

  // Specialties
  specialtiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});

export default ProfileScreenNew;

