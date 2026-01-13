import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { EmptyState, EmptyStateConfigs } from '../../components/EmptyState';
import { SkeletonBlock, SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { COLORS } from '../../utils/constants';

import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { notificationService } from '../../services/notificationService';
import { jobService, type JobServiceResponse, type Job } from '../../services/jobService';
import NetworkStatusIndicator from '../../components/NetworkStatusIndicator';
import { supabase } from '../../services/supabase';
import { cleanerBookingService } from '../../services/cleanerBookingService';

const { width } = Dimensions.get('window');

type StackParamList = {
  CleanerDashboard: undefined;
  CleanerProfile: undefined;
  JobsScreen: undefined;
  EarningsScreen: undefined;
  ScheduleScreen: undefined;
  ActiveJob: { jobId: string };
  ChatScreen: { bookingId: string; otherParticipant: any };
  NewBookingFlow: { serviceId?: string; serviceName?: string; basePrice?: number; duration?: number };
  Profile: undefined;
  Content: undefined;
  CleanerProfileEdit: undefined;
  VideoUpload: undefined;
  NotificationsScreen: undefined;
  JobDetails: { jobId: string };
};

type CleanerDashboardProps = {
  navigation: StackNavigationProp<StackParamList, 'CleanerDashboard'>;
};

interface JobOpportunity {
  id: string;
  customer_name: string;
  customer_avatar: string;
  service_type: string;
  address: string;
  distance: number;
  estimated_duration: number;
  payment: number;
  scheduled_time: string;
  priority: 'high' | 'medium' | 'low';
  isAccepting?: boolean; // Loading state for job acceptance
}

interface ActiveJob {
  id: string;
  customer_name: string;
  customer_avatar: string;
  service_type: string;
  address: string;
  status: 'confirmed' | 'en_route' | 'arrived' | 'in_progress';
  scheduled_time: string;
  payment: number;
}

const CleanerDashboardScreen: React.FC<CleanerDashboardProps> = ({ navigation }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [completedJobs, setCompletedJobs] = useState(0);
  const [rating, setRating] = useState(0);
  const [jobOpportunities, setJobOpportunities] = useState<JobOpportunity[]>([]);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [useDemoData, setUseDemoData] = useState(false); // Always use real data
  const [notificationCount, setNotificationCount] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(400);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  
  // Animation refs for micro-interactions
  const notificationPulse = useRef(new Animated.Value(1)).current;
  const badgeShimmer = useRef(new Animated.Value(0)).current;
  const celebrationScale = useRef(new Animated.Value(0)).current;
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    loadDashboardData();
    loadNotificationCount();
    startNotificationAnimation();
  }, [useDemoData]);

  // Start notification pulse animation
  const startNotificationAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(notificationPulse, {
          toValue: 1.2,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(notificationPulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Badge shimmer animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(badgeShimmer, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(badgeShimmer, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const loadNotificationCount = async () => {
    if (user?.id) {
      const count = await notificationService.getUnreadCount(user.id);
      setNotificationCount(count);
    }
  };

  // Profile completion celebration
  const triggerProfileCelebration = async () => {
    setShowCelebration(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    Animated.sequence([
      Animated.timing(celebrationScale, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(celebrationScale, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowCelebration(false);
    });
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      if (!user?.id) {
        setTodayEarnings(0);
        setWeeklyEarnings(0);
        setCompletedJobs(0);
        setRating(0);
        setJobOpportunities([]);
        setActiveJob(null);
        return;
      }

      console.log('📊 Loading cleaner dashboard for:', user.id);

      // Get date ranges
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      // Fetch completed bookings for earnings
      const { data: completedBookings, error: earningsError } = await supabase
        .from('bookings')
        .select('id, total_amount, cleaner_earnings, scheduled_time, completed_at')
        .eq('cleaner_id', user.id)
        .eq('status', 'completed');

      if (earningsError) {
        console.error('❌ Error fetching earnings:', earningsError);
      }

      // Calculate earnings
      let todayTotal = 0;
      let weekTotal = 0;
      let totalJobs = completedBookings?.length || 0;

      (completedBookings || []).forEach(booking => {
        const earnings = booking.cleaner_earnings || (booking.total_amount * 0.81) || 0;
        const completedDate = new Date(booking.completed_at || booking.scheduled_time);
        
        if (completedDate >= startOfToday) {
          todayTotal += earnings;
        }
        if (completedDate >= startOfWeek) {
          weekTotal += earnings;
        }
      });

      setTodayEarnings(todayTotal);
      setWeeklyEarnings(weekTotal);
      setCompletedJobs(totalJobs);

      // Fetch cleaner profile for rating
      const { data: profile } = await supabase
        .from('cleaner_profiles')
        .select('rating_average')
        .eq('user_id', user.id)
        .single();

      setRating(profile?.rating_average || 0);

      // Fetch available jobs using the service
      const availableJobs = await cleanerBookingService.getAvailableBookings(user.id);
      
      // Transform to job opportunities format
      const opportunities = availableJobs.map(job => ({
        id: job.id,
        customer_name: job.customerName,
        customer_avatar: job.customerAvatarUrl || '',
        service_type: job.serviceType,
        address: job.addressLine1,
        distance: job.distanceMiles,
        estimated_duration: job.durationMinutes,
        payment: job.payoutToCleaner,
        scheduled_time: new Date(job.scheduledAt).toLocaleString([], { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        priority: job.isInstant ? 'high' : 'medium' as 'high' | 'medium' | 'low',
      }));

      setJobOpportunities(opportunities);

      // Fetch active job (in progress)
      const activeJobs = await cleanerBookingService.getActiveBookings(user.id);
      const inProgressJob = activeJobs.find(j => 
        ['in_progress', 'cleaner_arrived', 'cleaner_en_route'].includes(j.status)
      );

      if (inProgressJob) {
        setActiveJob({
          id: inProgressJob.id,
          customer_name: inProgressJob.customerName,
          customer_avatar: inProgressJob.customerAvatarUrl || '',
          service_type: inProgressJob.serviceType,
          address: inProgressJob.addressLine1,
          status: inProgressJob.status,
          scheduled_time: new Date(inProgressJob.scheduledAt).toLocaleString([], {
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit'
          }),
          payment: inProgressJob.payoutToCleaner,
        });
      } else {
        setActiveJob(null);
      }

      console.log('✅ Dashboard loaded:', {
        todayEarnings: todayTotal,
        weeklyEarnings: weekTotal,
        completedJobs: totalJobs,
        availableJobs: opportunities.length,
      });

    } catch (error) {
      console.error('❌ Dashboard load error:', error);
      try { (showToast as any) && showToast({ type: 'error', message: 'Failed to load dashboard data' }); } catch {}
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const toggleOnlineStatus = () => {
    setIsOnline(!isOnline);
    // TODO: Update online status in backend
  };

  const handleAcceptJob = async (jobId: string) => {
    const job = jobOpportunities.find(j => j.id === jobId);
    if (!job) return;

    Alert.alert(
      'Accept Job',
      `Accept ${job.service_type} for ${job.customer_name}?\n\nPay: $${job.payment.toFixed(2)}\nDistance: ${job.distance} mi away`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Accept', 
          onPress: () => performJobAcceptance(jobId)
        },
      ]
    );
  };

  const performJobAcceptance = async (jobId: string) => {
    if (!user?.id) return;

    try {
      // Show loading state
      setJobOpportunities(prev => 
        prev.map(job => 
          job.id === jobId 
            ? { ...job, isAccepting: true }
            : job
        )
      );

      const response = await jobService.acceptJob(jobId, user.id);

      if (response.success) {
        // Success - move to active jobs
        const acceptedJob = jobOpportunities.find(j => j.id === jobId);
        if (acceptedJob) {
          setActiveJob({
            id: acceptedJob.id,
            customer_name: acceptedJob.customer_name,
            customer_avatar: acceptedJob.customer_avatar,
            service_type: acceptedJob.service_type,
            address: acceptedJob.address,
            status: 'confirmed',
            scheduled_time: acceptedJob.scheduled_time,
            payment: acceptedJob.payment
          });
        }

        // Remove from opportunities
        setJobOpportunities(prev => prev.filter(job => job.id !== jobId));

        // Success feedback
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Job Accepted! 🎉',
          'The job has been added to your active jobs. You can now contact the customer.',
          [
            { text: 'View Active Jobs', onPress: () => navigation.navigate('JobsScreen') },
            { text: 'OK' }
          ]
        );

      } else {
        // Handle specific error cases
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        switch (response.errorCode) {
          case 'JOB_ALREADY_TAKEN':
            // Remove job from list since it's taken
            setJobOpportunities(prev => prev.filter(job => job.id !== jobId));
            Alert.alert(
              'Job Already Taken',
              'Another cleaner has already accepted this job. Don\'t worry, more opportunities are coming!',
              [{ text: 'OK' }]
            );
            break;

          case 'JOB_EXPIRED':
            // Remove expired job
            setJobOpportunities(prev => prev.filter(job => job.id !== jobId));
            Alert.alert(
              'Job No Longer Available',
              'This job has expired or been cancelled by the customer.',
              [{ text: 'OK' }]
            );
            break;

          case 'NETWORK_OFFLINE':
            Alert.alert(
              'No Internet Connection',
              'Your job acceptance will be processed when connection is restored. Keep the app open.',
              [
                { text: 'Retry', onPress: () => performJobAcceptance(jobId) },
                { text: 'OK' }
              ]
            );
            break;

          case 'RATE_LIMITED':
            Alert.alert(
              'Too Many Requests',
              `Please wait ${response.retryAfter || 60} seconds before trying again.`,
              [{ text: 'OK' }]
            );
            break;

          case 'TIMEOUT':
            Alert.alert(
              'Request Timed Out',
              'The request took too long. Please check your connection and try again.',
              [
                { text: 'Retry', onPress: () => performJobAcceptance(jobId) },
                { text: 'Cancel' }
              ]
            );
            break;

          default:
            Alert.alert(
              'Unable to Accept Job',
              response.error || 'Something went wrong. Please try again.',
              [
                { text: 'Retry', onPress: () => performJobAcceptance(jobId) },
                { text: 'Cancel' }
              ]
            );
        }
      }

    } catch (error) {
      console.error('Job acceptance error:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [
          { text: 'Retry', onPress: () => performJobAcceptance(jobId) },
          { text: 'Cancel' }
        ]
      );
    } finally {
      // Remove loading state
      setJobOpportunities(prev => 
        prev.map(job => 
          job.id === jobId 
            ? { ...job, isAccepting: false }
            : job
        )
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#3B82F6';
      case 'en_route': return '#F59E0B';
      case 'arrived': return '#10B981';
      case 'in_progress': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'en_route': return 'En Route';
      case 'arrived': return 'Arrived';
      case 'in_progress': return 'In Progress';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#6B7280';
    }
  };

  const renderProfileCompletion = () => {
    const completionItems = [
      { key: 'photo', label: 'Profile Photo', completed: !!user?.avatar_url },
      { key: 'bio', label: 'Bio Description', completed: false },
      { key: 'video', label: 'Intro Video', completed: false },
      { key: 'verification', label: 'ID Verification', completed: false },
      { key: 'background', label: 'Background Check', completed: true }
    ];
    
    const completedCount = completionItems.filter(item => item.completed).length;
    const completionPercentage = (completedCount / completionItems.length) * 100;
    
    // Show celebration when reaching 100% completion
    if (completionPercentage >= 100) {
      if (!showCelebration) {
        triggerProfileCelebration();
      }
      return null; // Hide when complete
    }
    
    return (
      <View style={styles.profileCompletionCard}>
        <View style={styles.completionHeader}>
          <View>
            <Text style={styles.completionTitle}>Complete Your Profile</Text>
            <Text style={styles.completionSubtitle}>
              {Math.round(completionPercentage)}% complete • {5 - completedCount} items remaining
            </Text>
          </View>
          <Ionicons name="close" size={20} color="#6B7280" />
        </View>
        
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${completionPercentage}%` }]} />
          </View>
        </View>
        
        <View style={styles.completionItems}>
          {completionItems
            .filter(item => !item.completed)
            .slice(0, 2)
            .map(item => (
              <View key={item.key} style={styles.completionItem}>
                <Ionicons name="ellipse-outline" size={16} color="#EF4444" />
                <Text style={styles.completionItemText}>{item.label}</Text>
              </View>
            ))}
        </View>
        
        <View style={styles.completionNote}>
          <Text style={styles.completionNoteText}>
            Complete your intro video and ID verification to unlock more jobs and higher earnings!
          </Text>
        </View>

        <View style={styles.completionActions}>
          <TouchableOpacity 
            style={styles.completeProfileButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person" size={16} color={COLORS.text.inverse} />
            <Text style={styles.completeProfileButtonText}>Complete Profile</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.uploadContentButton}
            onPress={() => navigation.navigate('Content')}
          >
            <Ionicons name="videocam" size={16} color={COLORS.primary} />
            <Text style={styles.uploadContentButtonText}>Upload Content</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderGoalsTracker = () => {
    const progressPercentage = Math.min((weeklyEarnings / weeklyGoal) * 100, 100);
    const remaining = Math.max(weeklyGoal - weeklyEarnings, 0);
    
    const handleGoalPress = async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsEditingGoal(true);
    };

    return (
      <View style={styles.goalsCard}>
        <View style={styles.goalsHeader}>
          <Ionicons name="trophy" size={20} color="#F59E0B" />
          <Text style={styles.goalsTitle}>This Week's Goal</Text>
          <TouchableOpacity onPress={handleGoalPress} style={styles.editGoalButton}>
            <Ionicons name="pencil" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.goalsContent}>
          {isEditingGoal ? (
            <View style={styles.goalEditContainer}>
              <Text style={styles.goalEditLabel}>Weekly Goal</Text>
              <TextInput
                style={styles.goalEditInput}
                value={weeklyGoal.toString()}
                onChangeText={(text) => {
                  const value = parseInt(text) || 0;
                  setWeeklyGoal(value);
                }}
                onBlur={() => setIsEditingGoal(false)}
                keyboardType="numeric"
                selectTextOnFocus
                autoFocus
              />
            </View>
          ) : (
            <TouchableOpacity onPress={handleGoalPress}>
              <Text style={styles.goalsAmount}>${weeklyGoal}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.goalsProgress}>
            <View style={styles.goalsProgressBar}>
              <Animated.View 
                style={[
                  styles.goalsProgressFill, 
                  { width: `${progressPercentage}%` }
                ]} 
              />
            </View>
            <Text style={styles.goalsProgressText}>
              {progressPercentage.toFixed(0)}% there! • ${remaining.toFixed(2)} remaining
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderStatsCard = () => (
    <View style={styles.statsContainer}>
      <LinearGradient
        colors={['#FFFFFF', '#FEF3C7']}
        style={styles.statsGradient}
      >
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>Today's Performance</Text>
          <TouchableOpacity onPress={() => navigation.navigate('EarningsScreen')}>
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.statsGrid}>
                <View style={styles.statItem}>
        <Ionicons name="cash" size={18} color={COLORS.success} style={styles.statIcon} />
        <Text style={styles.statValue}>${todayEarnings.toFixed(2)}</Text>
        <Text style={styles.statLabel}>Today</Text>
      </View>
      <View style={styles.statItem}>
        <Ionicons name="trending-up" size={18} color={COLORS.primary} style={styles.statIcon} />
        <Text style={styles.statValue}>${weeklyEarnings.toFixed(2)}</Text>
        <Text style={styles.statLabel}>This Week</Text>
      </View>
      <View style={styles.statItem}>
        <Ionicons name="checkmark-circle" size={18} color={COLORS.secondary} style={styles.statIcon} />
        <Text style={styles.statValue}>{completedJobs}</Text>
        <Text style={styles.statLabel}>Jobs Done</Text>
      </View>
      <View style={styles.statItem}>
        <Ionicons name="star" size={18} color={COLORS.primary} style={styles.statIcon} />
        <Text style={styles.statValue}>{rating.toFixed(1)}</Text>
        <Text style={styles.statLabel}>Rating</Text>
      </View>
        </View>
      </LinearGradient>
    </View>
  );

  const renderOnlineToggle = () => (
    <View style={styles.onlineToggleContainer}>
      <View style={styles.onlineToggleContent}>
        <View style={styles.onlineStatus}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]} />
          <Text style={styles.onlineStatusText}>
            {isOnline ? 'Available for Jobs' : 'Offline'}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.toggleButton, { backgroundColor: isOnline ? '#10B981' : '#EF4444' }]}
          onPress={toggleOnlineStatus}
        >
          <Text style={styles.toggleButtonText}>
            {isOnline ? 'Go Offline' : 'Go Online'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderActiveJob = () => {
    if (!activeJob) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Job</Text>
          <TouchableOpacity onPress={() => navigation.navigate('ActiveJob', { jobId: activeJob.id })}>
            <Text style={styles.viewAllText}>View Details</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activeJobCard}>
          <View style={styles.activeJobHeader}>
            <Image source={{ uri: activeJob.customer_avatar }} style={styles.customerAvatar} />
            <View style={styles.activeJobInfo}>
              <Text style={styles.customerName}>{activeJob.customer_name}</Text>
              <Text style={styles.serviceType}>{activeJob.service_type}</Text>
              <Text style={styles.jobAddress}>{activeJob.address}</Text>
            </View>
            <View style={styles.activeJobStatus}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(activeJob.status) }]}>
                <Text style={styles.statusText}>{getStatusText(activeJob.status)}</Text>
              </View>
              <Text style={styles.jobPayment}>${activeJob.payment.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.activeJobActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('IndividualChat', { 
                bookingId: activeJob.id,
                otherParticipant: {
                  id: 'customer-1',
                  name: activeJob.customer_name,
                  avatar_url: activeJob.customer_avatar,
                  role: 'customer'
                }
              })}
            >
              <Ionicons name="chatbubble" size={18} color={COLORS.primary} />
              <Text style={styles.actionButtonText}>Chat</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="navigate" size={18} color={COLORS.primary} />
              <Text style={styles.actionButtonText}>Navigate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderJobOpportunities = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>New Opportunities Near You</Text>
        <TouchableOpacity onPress={() => navigation.navigate('JobsScreen')}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {jobOpportunities.length > 0 ? (
        jobOpportunities.map((job) => (
          <TouchableOpacity 
            key={job.id} 
            style={[styles.jobCard, styles.jobCardElevated]}
            onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}
            activeOpacity={0.8}
          >
            <View style={styles.jobHeader}>
              <Image source={{ uri: job.customer_avatar }} style={styles.customerAvatar} />
              <View style={styles.jobInfo}>
                <View style={styles.jobTitleRow}>
                  <Text style={styles.customerName}>{job.customer_name}</Text>
                  <Animated.View 
                    style={[
                      styles.jobStatusContainer,
                      { transform: [{ scale: badgeShimmer.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [1, 1.1, 1],
                      })}] }
                    ]}
                  >
                    <Ionicons name="flash" size={14} color="#FFFFFF" />
                    <Text style={styles.jobStatusText}>
                      {job.priority === 'high' ? 'INSTANT' : 'NEW'}
                    </Text>
                  </Animated.View>
                </View>
                <Text style={styles.serviceType}>{job.service_type}</Text>
                <Text style={styles.jobAddress}>{job.address}</Text>
                <View style={styles.jobDetails}>
                  <Text style={styles.jobDetailText}>{job.distance} mi away</Text>
                  <Text style={styles.jobDetailText}>•</Text>
                  <Text style={styles.jobDetailText}>{job.estimated_duration} min</Text>
                  <Text style={styles.jobDetailText}>•</Text>
                  <Text style={styles.jobDetailText}>{job.scheduled_time}</Text>
                </View>
              </View>
            </View>

            <View style={styles.jobFooter}>
              <Text style={styles.jobPayment}>${job.payment.toFixed(2)}</Text>
              <TouchableOpacity 
                style={[
                  styles.acceptButton, 
                  job.isAccepting && styles.acceptButtonLoading
                ]}
                onPress={() => handleAcceptJob(job.id)}
                disabled={job.isAccepting}
              >
                {job.isAccepting ? (
                  <View style={styles.acceptButtonLoadingContent}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.acceptButtonText}>Accepting...</Text>
                  </View>
                ) : (
                  <Text style={styles.acceptButtonText}>Accept</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))
      ) : (
        <EmptyState
          {...EmptyStateConfigs.jobOpportunities}
          actions={[
            {
              label: 'Complete Profile',
              onPress: () => navigation.navigate('ProfileEdit'),
              icon: 'person'
            },
            {
              label: 'View All Jobs',
              onPress: () => navigation.navigate('JobsScreen'),
              icon: 'briefcase'
            }
          ]}
        />
      )}
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('ScheduleScreen')}
        >
          <Ionicons name="calendar" size={24} color={COLORS.primary} />
          <Text style={styles.quickActionText}>Schedule</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('EarningsScreen')}
        >
          <Ionicons name="card" size={24} color={COLORS.primary} />
          <Text style={styles.quickActionText}>Earnings</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('VideoUpload')}
        >
          <Ionicons name="videocam" size={24} color={COLORS.primary} />
          <Text style={styles.quickActionText}>Create Post</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => navigation.navigate('CleanerProfileEdit')}
        >
          <Ionicons name="person" size={24} color={COLORS.primary} />
          <Text style={styles.quickActionText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={{ gap: 16 }}>
            <SkeletonBlock height={64} />
            <SkeletonBlock height={120} />
            <SkeletonList rows={3} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <NetworkStatusIndicator onNetworkChange={(isConnected) => {
        console.log('Network status changed:', isConnected);
        // Optionally update dashboard state based on connection
      }} />
      
      {/* Enhanced Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text style={styles.userName}>{user?.name || 'Professional Cleaner'}! 👋</Text>
            
            {/* Online/Offline Toggle - Moved to header for better hierarchy */}
            <View style={styles.headerToggle}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? COLORS.success : COLORS.error }]} />
              <Text style={styles.onlineStatusTextSmall}>
                {isOnline ? 'Ready to Work' : 'Offline'}
              </Text>
                              <TouchableOpacity
                  style={[styles.toggleButtonSmall, { backgroundColor: isOnline ? COLORS.success : COLORS.error }]}
                  onPress={toggleOnlineStatus}
                  accessibilityLabel={isOnline ? "Go offline" : "Go online"}
                  accessibilityHint="Toggle your availability for receiving new jobs"
                >
                <Text style={styles.toggleButtonTextSmall}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.headerRight}>
            {/* Demo Toggle */}
            <TouchableOpacity 
              style={styles.demoToggleButton}
              onPress={() => setUseDemoData(!useDemoData)}
            >
              <Ionicons 
                name={useDemoData ? "eye" : "eye-off"} 
                size={20} 
                color={useDemoData ? COLORS.primary : COLORS.text.secondary} 
              />
            </TouchableOpacity>
            
            {/* Notifications */}
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => navigation.navigate('NotificationsScreen')}
              accessibilityLabel="View notifications"
              accessibilityHint="View your recent notifications and alerts"
            >
              <Animated.View style={{ transform: [{ scale: notificationCount > 0 ? notificationPulse : 1 }] }}>
                <Ionicons name="notifications" size={24} color={COLORS.text.primary} />
              </Animated.View>
              {(notificationCount > 0 || (useDemoData && notificationCount === 0)) && (
                <Animated.View 
                  style={[
                    styles.notificationBadge,
                    { transform: [{ scale: notificationPulse }] }
                  ]}
                >
                  <Text style={styles.notificationBadgeText}>
                    {useDemoData && notificationCount === 0 ? '3' : notificationCount}
                  </Text>
                </Animated.View>
              )}
            </TouchableOpacity>
            
            {/* Profile with Edit Button */}
            <View style={styles.profileContainer}>
              <TouchableOpacity style={styles.profileButton}>
                <Image 
                  source={{ uri: user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Cleaner')}&background=3ad3db&color=fff&size=120&font-size=0.4&format=png` }} 
                  style={styles.profileImage} 
                />
                <View style={styles.profileBadge}>
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.editProfileButton}
                onPress={() => navigation.navigate('CleanerProfileEdit')}
              >
                <Ionicons name="pencil" size={14} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {renderProfileCompletion()}
        
        {/* Development Mock Data Toggle - Only visible in dev mode */}
        {__DEV__ && (
          <View style={styles.devToggleContainer}>
            <View style={styles.devToggleHeader}>
              <Ionicons name="code" size={16} color={COLORS.text.secondary} />
              <Text style={styles.devToggleTitle}>Development Mode</Text>
            </View>
            <View style={styles.devToggleRow}>
              <Text style={styles.devToggleLabel}>Show Mock Data</Text>
              <TouchableOpacity
                style={[styles.devToggleButton, useDemoData && styles.devToggleButtonActive]}
                onPress={() => {
                  // Demo toggle disabled - always use real data
                }}
              >
                <View style={[styles.devToggleThumb, useDemoData && styles.devToggleThumbActive]} />
              </TouchableOpacity>
            </View>
            <Text style={styles.devToggleDescription}>
              Toggle to experience empty states and real user flows
            </Text>
          </View>
        )}
        
        {renderStatsCard()}
        {renderGoalsTracker()}
        {renderActiveJob()}
        {renderJobOpportunities()}
      </ScrollView>
      
      <CleanerFloatingNavigation 
        navigation={navigation as any}
        currentScreen="Home"
      />

      {/* Profile Completion Celebration */}
      {showCelebration && (
        <Animated.View 
          style={[
            styles.celebrationOverlay,
            { transform: [{ scale: celebrationScale }] }
          ]}
        >
          <View style={styles.celebrationContent}>
            <Text style={styles.celebrationEmoji}>🎉</Text>
            <Text style={styles.celebrationTitle}>Profile Complete!</Text>
            <Text style={styles.celebrationMessage}>
              Congratulations! Your profile is now 100% complete. 
              You'll receive more job opportunities and higher earnings!
            </Text>
            <View style={styles.celebrationConfetti}>
              <Text style={styles.confettiItem}>✨</Text>
              <Text style={styles.confettiItem}>🎊</Text>
              <Text style={styles.confettiItem}>⭐</Text>
              <Text style={styles.confettiItem}>🌟</Text>
              <Text style={styles.confettiItem}>💫</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Extra space for floating nav
    paddingTop: 8,
  },
  statsContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  statsGradient: {
    padding: 24,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  onlineToggleContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  onlineToggleContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  onlineStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  toggleButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  activeJobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activeJobHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  activeJobInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  serviceType: {
    fontSize: 14,
    color: '#00BFA6',
    fontWeight: '500',
    marginBottom: 4,
  },
  jobAddress: {
    fontSize: 12,
    color: '#6B7280',
  },
  activeJobStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  jobPayment: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  activeJobActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00BFA6',
    marginLeft: 8,
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  jobInfo: {
    flex: 1,
  },
  jobTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  jobDetails: {
    flexDirection: 'row',
    marginTop: 8,
  },
  jobDetailText: {
    fontSize: 12,
    color: '#6B7280',
    marginRight: 8,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#F59E0B',
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 22,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  acceptButtonLoading: {
    backgroundColor: '#6B7280',
    opacity: 0.8,
  },
  acceptButtonLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickActionsContainer: {
    margin: 20,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  quickActionButton: {
    backgroundColor: '#FFFFFF',
    width: (width - 60) / 4,
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
    marginTop: 8,
    textAlign: 'center',
  },
  // Enhanced Header Styles
  headerLeft: {
    flex: 1,
  },
  headerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  onlineStatusTextSmall: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  toggleButtonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 'auto',
  },
  toggleButtonTextSmall: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  profileBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  // Profile Completion Styles
  profileCompletionCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  completionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  completionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  progressBarContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00BFA6',
    borderRadius: 3,
  },
  completionItems: {
    gap: 8,
    marginBottom: 16,
  },
  completionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completionItemText: {
    fontSize: 14,
    color: '#374151',
  },
  completeProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  completeProfileButtonText: {
    fontSize: 14,
    color: '#00BFA6',
    fontWeight: '600',
  },
  // Goals Tracker Styles
  goalsCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  goalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  goalsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  editGoalButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: `${COLORS.primary}15`,
  },
  goalEditContainer: {
    alignItems: 'center',
  },
  goalEditLabel: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginBottom: 4,
  },
  goalEditInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    minWidth: 80,
  },
  goalsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalsAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
  },
  goalsProgress: {
    flex: 1,
    marginLeft: 16,
  },
  goalsProgressBar: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  goalsProgressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  goalsProgressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  // Enhanced Stats Styles
  statIcon: {
    marginBottom: 4,
  },
  // Profile Completion Enhancement
  completionNote: {
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  completionNoteText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Enhanced Header Styles
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  notificationBadgeText: {
    fontSize: 10,
    color: COLORS.text.inverse,
    fontWeight: '700',
  },
  profileContainer: {
    position: 'relative',
  },
  editProfileButton: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  // Enhanced Job Cards
  jobCardElevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    transform: [{ scale: 1 }],
  },
  jobStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  jobStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  // Empty Jobs State
  emptyJobsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyJobsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyJobsSubtitle: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  completeProfileButtonAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  completeProfileButtonAltText: {
    fontSize: 14,
    color: COLORS.text.inverse,
    fontWeight: '600',
  },
  // Enhanced Completion Actions
  completionActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },

  uploadContentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    justifyContent: 'center',
  },
  uploadContentButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  // Empty Jobs Actions
  emptyJobsActions: {
    gap: 12,
  },
  testBookingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    justifyContent: 'center',
  },
  testBookingButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  // Demo Toggle Styles
  demoToggleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  
  // Dev Toggle Styles
  devToggleContainer: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  devToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  devToggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.secondary,
    marginLeft: 6,
  },
  devToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  devToggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text.primary,
  },
  devToggleButton: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    padding: 2,
    justifyContent: 'center',
  },
  devToggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  devToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  devToggleThumbActive: {
    alignSelf: 'flex-end',
  },
  devToggleDescription: {
    fontSize: 12,
    color: COLORS.text.secondary,
    lineHeight: 16,
  },
  
  // Celebration Overlay Styles
  celebrationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  celebrationContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    margin: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  celebrationEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  celebrationTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  celebrationMessage: {
    fontSize: 16,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  celebrationConfetti: {
    flexDirection: 'row',
    gap: 16,
  },
  confettiItem: {
    fontSize: 20,
    opacity: 0.8,
  },
});

export default CleanerDashboardScreen; 