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
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
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

type StackParamList = {
  JobsScreen: undefined;
  JobDetails: { jobId: string };
  ChatScreen: { bookingId: string; otherParticipant: any };
};

type JobsScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'JobsScreen'>;
};

const TABS: { key: JobTab; label: string }[] = [
  { key: 'available', label: 'Available' },
  { key: 'active', label: 'Active' },
  { key: 'history', label: 'History' },
];

const FILTERS: { key: JobFilter; label: string }[] = [
  { key: 'all', label: 'All Jobs' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'This Week' },
];

const JobsScreenNew: React.FC<JobsScreenProps> = ({ navigation }) => {
  const { showToast } = useToast();
  
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
  const [selectedFilter, setSelectedFilter] = useState<JobFilter>('all');
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    fetchDashboard();
  }, []);

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
      showToast?.({ type: 'error', message: 'Failed to accept job' });
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
          <Chip
            key={tab.key}
            label={tab.label}
            variant="outline"
            color="primary"
            isActive={isActive}
            onPress={() => setActiveTab(tab.key)}
            style={styles.tabChip}
          />
        );
      })}
    </View>
  );

  // Render filter bar (only for available tab)
  const renderFilterBar = () => {
    if (activeTab !== 'available') return null;
    
    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.filterBar}>
        {FILTERS.map((filter) => (
          <Chip
            key={filter.key}
            label={filter.label}
            variant="outline"
            color="primary"
            size="sm"
            isActive={selectedFilter === filter.key}
            onPress={() => setSelectedFilter(filter.key)}
          />
        ))}
      </Animated.View>
    );
  };

  // Render job card
  const renderJobCard = ({ item, index }: { item: Booking; index: number }) => (
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
  );

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
          <Text style={styles.headerBadgeText}>{availableBookings.length} available</Text>
        </View>
      </View>

      {/* Tab Bar */}
      {renderTabBar()}

      {/* Filter Bar */}
      {renderFilterBar()}

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
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  headerBadgeText: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: typography.label.fontWeight,
    color: colors.primary,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  tabChip: {
    flex: 1,
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

