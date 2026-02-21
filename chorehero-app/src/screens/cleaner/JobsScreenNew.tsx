/**
 * JobsScreen - Refactored with Zustand store and shared components
 * 
 * Features:
 * - Available / Active / History tabs
 * - Filter pills (All Jobs / Today / Tomorrow / This Week)
 * - JobCard component for consistent styling
 * - Pull-to-refresh
 * - Real-time updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { cleanerBookingService } from '../../services/cleanerBookingService';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';

// Store
import { useCleanerStore, selectFilteredBookings } from '../../store/cleanerStore';

// Components
import { Chip, JobCard } from '../../components/cleaner';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';

// Theme
import { cleanerTheme } from '../../utils/theme';

// Types
import type { Booking, JobFilter, JobTab } from '../../types/cleaner';

const { colors, typography, spacing, radii, shadows } = cleanerTheme;
const BRAND_TEAL = '#26B7C9';

type StackParamList = {
  JobsScreen: undefined;
  JobDetails: { jobId: string };
  ChatScreen: { bookingId: string; otherParticipant: any };
};

type JobsScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'JobsScreen'>;
};

const TABS: { key: JobTab; label: string }[] = [
  { key: 'available', label: 'New Requests' },
  { key: 'active', label: 'Upcoming' },
  { key: 'history', label: 'History' },
];

const JobsScreenNew: React.FC<JobsScreenProps> = ({ navigation }) => {
  const { showToast } = useToast();
  const { user } = useAuth();

  // Store state
  const {
    availableBookings,
    activeBookings,
    pastBookings,
    isLoading,
    isRefreshing,
    fetchDashboard,
    acceptBooking,
    declineBooking,
    startTraveling,
    markInProgress,
    refreshData,
  } = useCleanerStore();

  // Local state
  const [activeTab, setActiveTab] = useState<JobTab>('available');
  const [selectedFilter] = useState<JobFilter>('all');
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    fetchDashboard();
  }, []);

  // Real-time subscription for new marketplace jobs
  useEffect(() => {
    const cleanerId = user?.id;
    if (!cleanerId || cleanerId.startsWith('demo_')) return;

    const unsubscribe = cleanerBookingService.subscribeToNewBookings(
      cleanerId,
      () => {
        fetchDashboard();
        showToast?.({ type: 'info', message: 'New job available!' });
      }
    );

    return unsubscribe;
  }, [user?.id]);

  // Get bookings based on active tab
  const getBookingsForTab = useCallback((): Booking[] => {
    switch (activeTab) {
      case 'available':
        return selectFilteredBookings(availableBookings, selectedFilter);
      case 'active':
        return activeBookings;
      case 'history':
        return pastBookings;
      default:
        return [];
    }
  }, [activeTab, availableBookings, activeBookings, pastBookings, selectedFilter]);

  const bookings = getBookingsForTab();
  const todayActive = activeBookings.find((booking) => {
    const date = new Date(booking.scheduledAt);
    const now = new Date();
    return date.toDateString() === now.toDateString();
  });

  // Handlers
  const handleAcceptJob = async (bookingId: string) => {
    setAcceptingJobId(bookingId);
    try {
      await acceptBooking(bookingId);
      showToast?.({ 
        type: 'success', 
        message: 'Job accepted! It\'s now in Active jobs.' 
      });
      setActiveTab('active'); // Switch to active tab
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to accept job';
      showToast?.({ type: 'error', message: msg });
    } finally {
      setAcceptingJobId(null);
    }
  };

  const handleDeclineJob = (bookingId: string) => {
    Alert.alert(
      'Decline Job',
      'Are you sure you want to decline this job opportunity?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await declineBooking(bookingId);
              showToast?.({ type: 'info', message: 'Job declined' });
            } catch (error) {
              showToast?.({ type: 'error', message: 'Failed to decline job' });
            }
          },
        },
      ]
    );
  };

  const handleStartTraveling = async (bookingId: string) => {
    try {
      await startTraveling(bookingId);
      showToast?.({ type: 'success', message: 'Tracking started' });
    } catch (error) {
      showToast?.({ type: 'error', message: 'Failed to start traveling' });
    }
  };

  const handleJobPress = (booking: Booking) => {
    navigation.navigate('JobDetails', { jobId: booking.id });
  };

  // Render tab bar
  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const count = tab.key === 'available' 
          ? availableBookings.length 
          : tab.key === 'active' 
            ? activeBookings.length 
            : pastBookings.length;
        
        return (
          <View key={tab.key} style={styles.tabItemContainer}>
            <Chip
              label={tab.label}
              variant={isActive ? 'filled' : 'outline'}
              color="teal"
              isActive={isActive}
              onPress={() => setActiveTab(tab.key)}
              style={styles.tabChip}
            />
            {isActive && <View style={styles.tabIndicator} />}
          </View>
        );
      })}
    </View>
  );

  // Render filter bar (only for available tab)
  const renderFilterBar = () => null;

  // Render job card
  const renderJobCard = ({ item, index }: { item: Booking; index: number }) => {
    const showEmergencyTag =
      activeTab === 'available' &&
      (item.isInstant || item.serviceType.toLowerCase().includes('emergency'));
    return (
      <View style={styles.jobCardWrapper}>
        {showEmergencyTag && (
          <View style={styles.emergencyTag}>
            <Ionicons name="flash" size={12} color="#FFFFFF" />
            <Text style={styles.emergencyTagText}>Emergency Clean</Text>
          </View>
        )}
        <JobCard
          booking={item}
          variant={activeTab}
          onPress={() => handleJobPress(item)}
          onAccept={() => handleAcceptJob(item.id)}
          onDecline={() => handleDeclineJob(item.id)}
          onStartTraveling={() => handleStartTraveling(item.id)}
          isAccepting={acceptingJobId === item.id}
          delay={index * 50}
        />
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons 
          name={activeTab === 'available' ? 'briefcase-outline' : 
                activeTab === 'active' ? 'time-outline' : 'checkmark-done-outline'} 
          size={48} 
          color={colors.textMuted} 
        />
      </View>
      <Text style={styles.emptyTitle}>
        {activeTab === 'available' 
          ? 'No jobs available' 
          : activeTab === 'active' 
            ? 'No active jobs' 
            : 'No completed jobs'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'available' 
          ? 'New job opportunities will appear here' 
          : activeTab === 'active' 
            ? 'Accept a job to see it here' 
            : 'Your completed jobs will appear here'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jobs</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{availableBookings.length} new</Text>
        </View>
      </View>

      {/* Tab Bar */}
      {renderTabBar()}

      {/* Filter Bar */}
      {renderFilterBar()}

      {todayActive && (
        <View style={styles.activeJobCard}>
          <Text style={styles.activeJobTitle}>Today’s Job</Text>
          <Text style={styles.activeJobName}>{todayActive.customerName}</Text>
          <Text style={styles.activeJobMeta}>Access Instructions</Text>
          <Text style={styles.activeJobInstructions}>
            {todayActive.specialRequestText || 'Check the lockbox by the front door.'}
          </Text>
          <TouchableOpacity style={styles.slideButton} onPress={() => handleStartTraveling(todayActive.id)}>
            <Ionicons name="car" size={18} color="#FFFFFF" />
            <Text style={styles.slideButtonText}>Slide to Start Heading</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Job List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <SkeletonList count={3} />
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderJobCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refreshData}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      {/* Bottom Navigation */}
      <CleanerFloatingNavigation
        navigation={navigation as any}
        currentScreen="Jobs"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.textPrimary,
  },
  headerBadge: {
    backgroundColor: 'rgba(38, 183, 201, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  headerBadgeText: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: typography.label.fontWeight,
    color: BRAND_TEAL,
  },
  activeJobCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(38, 183, 201, 0.35)',
    ...shadows.soft,
  },
  activeJobTitle: {
    fontSize: typography.label.fontSize,
    fontWeight: '700',
    color: BRAND_TEAL,
    marginBottom: 6,
  },
  activeJobName: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  activeJobMeta: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: '600',
    color: colors.textMuted,
  },
  activeJobInstructions: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    marginTop: 6,
    marginBottom: 12,
  },
  slideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND_TEAL,
    paddingVertical: 12,
    borderRadius: radii.pill,
  },
  slideButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: typography.label.fontSize,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  tabItemContainer: {
    alignItems: 'center',
  },
  tabChip: {
    paddingHorizontal: spacing.lg,
  },
  tabIndicator: {
    height: 3,
    width: '80%',
    backgroundColor: BRAND_TEAL,
    borderRadius: 2,
    marginTop: spacing.xs,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120, // Account for bottom nav
  },
  jobCardWrapper: {
    marginBottom: spacing.md,
  },
  emergencyTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F97316',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
  },
  emergencyTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl * 2,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.metaBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: typography.sectionHeading.fontSize,
    fontWeight: typography.sectionHeading.fontWeight,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xxxl,
  },
});

export default JobsScreenNew;

