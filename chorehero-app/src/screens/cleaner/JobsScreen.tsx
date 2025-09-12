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
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { jobStateManager } from '../../services/jobStateManager';
import { enhancedLocationService } from '../../services/enhancedLocationService';
import { bookingService } from '../../services/booking';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { SkeletonBlock, SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';

const { width, height } = Dimensions.get('window');

type StackParamList = {
  JobsScreen: undefined;
  CleanerDashboard: undefined;
  ActiveJob: { jobId: string };
  ChatScreen: { bookingId: string; otherParticipant: any };
  CleanerProfile: undefined;
};

type JobsScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'JobsScreen'>;
};

type JobStatus = 'available' | 'pending' | 'cleaner_assigned' | 'confirmed' | 'cleaner_en_route' | 'cleaner_arrived' | 'in_progress' | 'completed' | 'cancelled' | 'paid';
type JobType = 'express' | 'standard' | 'deep';

interface Job {
  id: string;
  customer: {
    id: string;
    name: string;
    avatar: string;
    rating: number;
    totalBookings: number;
  };
  service: {
    type: JobType;
    title: string;
    addOns: string[];
  };
  location: {
    address: string;
    distance: number;
    latitude: number;
    longitude: number;
  };
  schedule: {
    date: string;
    time: string;
    duration: number;
  };
  payment: {
    total: number;
    cleanerEarnings: number;
    tip?: number;
  };
  status: JobStatus;
  priority: 'high' | 'medium' | 'low';
  isInstantBook: boolean;
  specialRequests?: string;
  createdAt: string;
}

const JobsScreen: React.FC<JobsScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'history'>('available');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'today' | 'tomorrow' | 'week'>('all');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const { showToast } = useToast();

  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadJobs();
    
    // Set up real-time subscription for new bookings
    if (user?.id && !user.id.startsWith('demo_')) {
      console.log('🔔 Setting up real-time job notifications for cleaner:', user.id);
      
      const subscription = supabase
        .channel('cleaner_jobs')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'bookings',
            filter: 'cleaner_id=is.null', // Listen for available jobs
          },
          (payload: any) => {
            console.log('🆕 New booking available!', payload.new);
            // Show notification
            Alert.alert(
              '🆕 New Job Available!',
              'A new cleaning job has been posted in your area. Check it out!',
              [
                { text: 'View Jobs', onPress: () => loadJobs() },
                { text: 'Dismiss', style: 'cancel' }
              ]
            );
            // Reload jobs when a new booking is created
            loadJobs();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'bookings',
            filter: `cleaner_id=eq.${user.id}`, // Listen for updates to my jobs
          },
          (payload: any) => {
            console.log('📝 Job updated!', payload.new);
            // Reload jobs when my job is updated
            loadJobs();
          }
        )
        .subscribe();

      return () => {
        console.log('🔌 Cleaning up job subscription');
        subscription.unsubscribe();
      };
    }
  }, [user?.id]);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      // Check if user is authenticated and get real data or demo data
      const isRealUser = user?.id && !user.id.startsWith('demo_');
      
      if (isRealUser) {
        console.log('✅ REAL CLEANER - loading actual jobs for:', user.email, user.name, 'ID:', user.id);
        
        // Fetch real bookings from database
        const response = await bookingService.getCleanerJobs(user.id);
        
        if (response.success && response.data) {
          // Transform booking data to job format
          const transformedJobs = response.data.map(booking => ({
            id: booking.id,
            customer: {
              id: booking.customer?.id || '',
              name: booking.customer?.name || 'Unknown Customer',
              avatar: booking.customer?.avatar_url || 'https://via.placeholder.com/60x60',
              rating: 4.5, // Default rating until we implement customer ratings
              totalBookings: 0, // Default until we fetch this separately
            },
            service: {
              type: booking.service_type,
              title: booking.service_type === 'express' ? 'Express Clean' : 
                     booking.service_type === 'deep' ? 'Deep Clean' : 'Standard Clean',
              addOns: booking.booking_add_ons?.map(addon => addon.add_ons?.name) || [],
            },
            location: {
              address: booking.service_address_line1 ? 
                `${booking.service_address_line1}, ${booking.service_city}, ${booking.service_state}` :
                'Address not available',
              distance: 0, // Calculate if needed
              latitude: booking.service_latitude || 0,
              longitude: booking.service_longitude || 0,
            },
            schedule: {
              date: new Date(booking.scheduled_time).toLocaleDateString(),
              time: new Date(booking.scheduled_time).toLocaleTimeString(),
              duration: booking.estimated_duration,
            },
            payment: {
              total: booking.total_amount,
              cleanerEarnings: booking.cleaner_earnings || booking.total_amount * 0.7,
            },
            status: booking.cleaner_id === user.id ? 'cleaner_assigned' : 'available',
            priority: 'medium',
            isInstantBook: true,
            createdAt: booking.created_at,
          }));
          
          console.log(`Loaded ${transformedJobs.length} real jobs for cleaner`);
          setJobs(transformedJobs);
        } else {
          console.log('No real jobs found, showing empty state');
          setJobs([]);
        }
      } else {
        // Demo user - show mock data
        console.log('Demo cleaner - showing mock jobs');
        setJobs([
        {
          id: '1',
          customer: {
            id: 'cust1',
            name: 'Sarah Johnson',
            avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
            rating: 4.9,
            totalBookings: 23,
          },
          service: {
            type: 'standard',
            title: 'Standard Clean',
            addOns: ['Inside Fridge', 'Laundry'],
          },
          location: {
            address: '456 Oak Ave, San Francisco, CA',
            distance: 1.2,
            latitude: 37.7749,
            longitude: -122.4194,
          },
          schedule: {
            date: 'Today',
            time: '2:00 PM',
            duration: 120,
          },
          payment: {
            total: 102.00,
            cleanerEarnings: 71.40,
          },
          status: 'available',
          priority: 'high',
          isInstantBook: true,
          createdAt: '2024-01-20T10:30:00Z',
        },
        {
          id: '2',
          customer: {
            id: 'cust2',
            name: 'Mike Chen',
            avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
            rating: 4.7,
            totalBookings: 15,
          },
          service: {
            type: 'express',
            title: 'Express Clean',
            addOns: [],
          },
          location: {
            address: '789 Pine St, San Francisco, CA',
            distance: 2.1,
            latitude: 37.7849,
            longitude: -122.4094,
          },
          schedule: {
            date: 'Today',
            time: '4:30 PM',
            duration: 45,
          },
          payment: {
            total: 45.00,
            cleanerEarnings: 31.50,
          },
          status: 'available',
          priority: 'medium',
          isInstantBook: false,
          createdAt: '2024-01-20T11:15:00Z',
        },
        {
          id: '3',
          customer: {
            id: 'cust3',
            name: 'Emma Davis',
            avatar: 'https://randomuser.me/api/portraits/women/28.jpg',
            rating: 4.8,
            totalBookings: 31,
          },
          service: {
            type: 'deep',
            title: 'Deep Clean',
            addOns: ['Inside Oven', 'Window Cleaning'],
          },
          location: {
            address: '123 Main St, San Francisco, CA',
            distance: 0.8,
            latitude: 37.7649,
            longitude: -122.4294,
          },
          schedule: {
            date: 'Tomorrow',
            time: '10:00 AM',
            duration: 210,
          },
          payment: {
            total: 205.00,
            cleanerEarnings: 143.50,
          },
          status: 'confirmed',
          priority: 'high',
          isInstantBook: true,
          specialRequests: 'Please use eco-friendly products only. Cat is friendly but may be curious.',
          createdAt: '2024-01-19T16:45:00Z',
        },
        {
          id: '4',
          customer: {
            id: 'cust4',
            name: 'Alex Rodriguez',
            avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
            rating: 4.6,
            totalBookings: 8,
          },
          service: {
            type: 'standard',
            title: 'Standard Clean',
            addOns: ['Pet Area Cleanup'],
          },
          location: {
            address: '321 Elm St, San Francisco, CA',
            distance: 3.2,
            latitude: 37.7549,
            longitude: -122.4394,
          },
          schedule: {
            date: 'Dec 18',
            time: '1:00 PM',
            duration: 105,
          },
          payment: {
            total: 93.00,
            cleanerEarnings: 65.10,
            tip: 12.00,
          },
          status: 'completed',
          priority: 'medium',
          isInstantBook: false,
          createdAt: '2024-12-18T09:30:00Z',
        },
      ]);
        }
    } catch (error) {
      console.error('Error loading jobs:', error);
      Alert.alert('Error', 'Failed to load jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
  };

  const handleAcceptJob = async (jobId: string) => {
    if (!user?.id) return;
    
    setAcceptingJobId(jobId);
    
    try {
      // Check if real user
      const isRealUser = user?.id && !user.id.startsWith('demo_');
      
      if (isRealUser) {
        // Use booking service for real users
        const result = await bookingService.acceptJob(jobId, user.id);
        
        if (result.success) {
          // Update local job status
          setJobs(prev => prev.map(job => 
            job.id === jobId 
              ? { ...job, status: 'cleaner_assigned' as JobStatus }
              : job
          ));
          // Toast instead of alert for smoother UX
          try { (showToast as any) && showToast({ type: 'success', message: 'Job accepted' }); } catch {}
          
          // Refresh jobs to get updated data
          await loadJobs();
        } else {
          try { (showToast as any) && showToast({ type: 'error', message: result.error || 'Failed to accept job' }); } catch {}
        }
      } else {
        // Demo mode - simulate acceptance
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, status: 'confirmed' as JobStatus }
            : job
        ));
        try { (showToast as any) && showToast({ type: 'success', message: 'Job accepted (demo)' }); } catch {}
      }
    } catch (error) {
      console.error('Error accepting job:', error);
      try { (showToast as any) && showToast({ type: 'error', message: 'Network error' }); } catch {}
    } finally {
      setAcceptingJobId(null);
    }
  };

  const handleDeclineJob = (jobId: string) => {
    Alert.alert(
      'Decline Job',
      'Are you sure you want to decline this job opportunity?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Decline', 
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            
            try {
              // Ignore job locally without cancelling it globally
              setJobs(prev => prev.filter(job => job.id !== jobId));
            } catch (error) {
              console.error('Error declining job:', error);
              Alert.alert('Error', 'Failed to decline job.');
            }
          }
        },
      ]
    );
  };

  const handleStartTraveling = async (jobId: string) => {
    if (!user?.id) return;
    
    try {
      const result = await jobStateManager.startTraveling(jobId, user.id);
      if (result.success) {
        // Start location tracking
        await enhancedLocationService.startJobTracking(jobId, user.id);
        
        // Update local state
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, status: 'cleaner_en_route' as JobStatus }
            : job
        ));
        
        Alert.alert('Success!', 'Started tracking your location. Customer will be notified.');
      } else {
        Alert.alert('Error', result.error || 'Failed to start traveling.');
      }
    } catch (error) {
      console.error('Error starting travel:', error);
      Alert.alert('Error', 'Failed to start traveling.');
    }
  };

  const handleArrived = async (jobId: string) => {
    if (!user?.id) return;
    
    try {
      const result = await jobStateManager.arriveAtLocation(jobId, user.id);
      if (result.success) {
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, status: 'cleaner_arrived' as JobStatus }
            : job
        ));
        
        Alert.alert('Success!', 'Marked as arrived. Customer has been notified.');
      } else {
        Alert.alert('Error', result.error || 'Failed to mark as arrived.');
      }
    } catch (error) {
      console.error('Error marking arrived:', error);
      Alert.alert('Error', 'Failed to mark as arrived.');
    }
  };

  const handleStartJob = async (jobId: string) => {
    if (!user?.id) return;
    
    try {
      const result = await jobStateManager.startJob(jobId, user.id);
      if (result.success) {
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, status: 'in_progress' as JobStatus }
            : job
        ));
        
        Alert.alert('Success!', 'Job started. Timer is now running.');
      } else {
        Alert.alert('Error', result.error || 'Failed to start job.');
      }
    } catch (error) {
      console.error('Error starting job:', error);
      Alert.alert('Error', 'Failed to start job.');
    }
  };

  const handleCompleteJob = async (jobId: string) => {
    if (!user?.id) return;
    
    try {
      const result = await jobStateManager.completeJob(jobId, user.id);
      if (result.success) {
        // Stop location tracking
        await enhancedLocationService.stopTracking();
        
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, status: 'completed' as JobStatus }
            : job
        ));
        
        Alert.alert('Success!', 'Job completed! Payment processing will begin automatically.');
      } else {
        Alert.alert('Error', result.error || 'Failed to complete job.');
      }
    } catch (error) {
      console.error('Error completing job:', error);
      Alert.alert('Error', 'Failed to complete job.');
    }
  };

  const renderJobStatusActions = (job: any) => {
    const commonActions = (
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={() => navigation.navigate('ChatScreen', {
          bookingId: job.id,
          otherParticipant: {
            id: job.customer.id,
            name: job.customer.name,
            avatar_url: job.customer.avatar,
            role: 'customer'
          }
        })}
      >
        <Ionicons name="chatbubble" size={16} color="#00BFA6" />
        <Text style={styles.actionButtonText}>Chat</Text>
      </TouchableOpacity>
    );

    switch (job.status) {
      case 'confirmed':
      case 'cleaner_assigned':
        return (
          <View style={styles.activeJobActions}>
            {commonActions}
            <TouchableOpacity 
              style={[styles.actionButton, styles.primaryAction]}
              onPress={() => handleStartTraveling(job.id)}
            >
              <Ionicons name="car" size={16} color="#FFFFFF" />
              <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>Start Traveling</Text>
            </TouchableOpacity>
          </View>
        );

      case 'cleaner_en_route':
        return (
          <View style={styles.activeJobActions}>
            {commonActions}
            <TouchableOpacity 
              style={[styles.actionButton, styles.primaryAction]}
              onPress={() => handleArrived(job.id)}
            >
              <Ionicons name="location" size={16} color="#FFFFFF" />
              <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>I've Arrived</Text>
            </TouchableOpacity>
          </View>
        );

      case 'cleaner_arrived':
        return (
          <View style={styles.activeJobActions}>
            {commonActions}
            <TouchableOpacity 
              style={[styles.actionButton, styles.primaryAction]}
              onPress={() => handleStartJob(job.id)}
            >
              <Ionicons name="play" size={16} color="#FFFFFF" />
              <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>Start Job</Text>
            </TouchableOpacity>
          </View>
        );

      case 'in_progress':
        return (
          <View style={styles.activeJobActions}>
            {commonActions}
            <TouchableOpacity 
              style={[styles.actionButton, styles.completeAction]}
              onPress={() => handleCompleteJob(job.id)}
            >
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>Complete Job</Text>
            </TouchableOpacity>
          </View>
        );

      case 'completed':
      case 'paid':
        return (
          <View style={styles.activeJobActions}>
            {commonActions}
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => navigation.navigate('ActiveJob', { jobId: job.id })}
            >
              <Ionicons name="receipt" size={16} color="#00BFA6" />
              <Text style={styles.actionButtonText}>View Receipt</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  const getFilteredJobs = () => {
    let filtered = jobs.filter(job => {
      switch (activeTab) {
        case 'available':
          return job.status === 'available';
        case 'active':
          return ['cleaner_assigned', 'confirmed', 'cleaner_en_route', 'cleaner_arrived', 'in_progress', 'paid'].includes(job.status as any);
        case 'history':
          return ['completed', 'cancelled'].includes(job.status);
        default:
          return true;
      }
    });

    if (selectedFilter !== 'all') {
      const today = new Date();
      filtered = filtered.filter(job => {
        switch (selectedFilter) {
          case 'today':
            return job.schedule.date === 'Today';
          case 'tomorrow':
            return job.schedule.date === 'Tomorrow';
          case 'week':
            // Simple check for this week (could be more sophisticated)
            return !['Today', 'Tomorrow'].includes(job.schedule.date);
          default:
            return true;
        }
      });
    }

    return filtered.sort((a, b) => {
      // Sort by priority, then by distance
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return a.location.distance - b.location.distance;
    });
  };

  const getServiceTypeColor = (type: JobType) => {
    switch (type) {
      case 'express': return '#3B82F6';
      case 'standard': return '#00BFA6';
      case 'deep': return '#8B5CF6';
      default: return '#6B7280';
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

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'available': return '#10B981';
      case 'confirmed': return '#3B82F6';
      case 'in_progress': return '#8B5CF6';
      case 'completed': return '#059669';
      case 'cancelled': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: JobStatus) => {
    switch (status) {
      case 'available': return 'Available';
      case 'confirmed': return 'Confirmed';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      {[
        { id: 'available', label: 'Available', count: jobs.filter(j => j.status === 'available').length },
        { id: 'active', label: 'Active', count: jobs.filter(j => ['confirmed', 'in_progress'].includes(j.status)).length },
        { id: 'history', label: 'History', count: jobs.filter(j => ['completed', 'cancelled'].includes(j.status)).length },
      ].map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.activeTab]}
          onPress={() => setActiveTab(tab.id as any)}
        >
          <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>
            {tab.label}
          </Text>
          {tab.count > 0 && (
            <View style={[styles.tabBadge, activeTab === tab.id && styles.activeTabBadge]}>
              <Text style={[styles.tabBadgeText, activeTab === tab.id && styles.activeTabBadgeText]}>
                {tab.count}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderFilterBar = () => (
    <View style={styles.filterBar}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScrollContent}
      >
        {[
          { id: 'all', label: 'All Jobs' },
          { id: 'today', label: 'Today' },
          { id: 'tomorrow', label: 'Tomorrow' },
          { id: 'week', label: 'This Week' },
        ].map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterChip,
              selectedFilter === filter.id && styles.activeFilterChip
            ]}
            onPress={() => setSelectedFilter(filter.id as any)}
          >
            <Text style={[
              styles.filterChipText,
              selectedFilter === filter.id && styles.activeFilterChipText
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderJobCard = ({ item: job }: { item: Job }) => (
    <Animated.View style={[styles.jobCard, { opacity: fadeAnim }]}>
      <View style={styles.jobHeader}>
        <View style={styles.jobHeaderLeft}>
          <Image source={{ uri: job.customer.avatar }} style={styles.customerAvatar} />
          <View style={styles.customerInfo}>
            <Text style={styles.customerName}>{job.customer.name}</Text>
            <View style={styles.customerStats}>
              <View style={styles.statItem}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.statText}>{job.customer.rating}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="briefcase" size={12} color="#6B7280" />
                <Text style={styles.statText}>{job.customer.totalBookings} jobs</Text>
              </View>
            </View>
          </View>
        </View>
        
        <View style={styles.jobHeaderRight}>
          <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(job.priority) }]} />
          {job.isInstantBook && (
            <View style={styles.instantBookBadge}>
              <Ionicons name="flash" size={12} color="#FFFFFF" />
              <Text style={styles.instantBookText}>Instant</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.serviceInfo}>
        <View style={styles.serviceHeader}>
          <View style={[styles.serviceTypeBadge, { backgroundColor: getServiceTypeColor(job.service.type) }]}>
            <Text style={styles.serviceTypeText}>{job.service.title}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) }]}>
            <Text style={styles.statusText}>{getStatusText(job.status)}</Text>
          </View>
        </View>
        
        {job.service.addOns.length > 0 && (
          <View style={styles.addOnsContainer}>
            <Text style={styles.addOnsLabel}>Add-ons:</Text>
            <Text style={styles.addOnsText}>{job.service.addOns.join(', ')}</Text>
          </View>
        )}
      </View>

      <View style={styles.scheduleInfo}>
        <View style={styles.scheduleItem}>
          <Ionicons name="calendar-outline" size={16} color="#6B7280" />
          <Text style={styles.scheduleText}>{job.schedule.date} at {job.schedule.time}</Text>
        </View>
        <View style={styles.scheduleItem}>
          <Ionicons name="time-outline" size={16} color="#6B7280" />
          <Text style={styles.scheduleText}>{job.schedule.duration} minutes</Text>
        </View>
        <View style={styles.scheduleItem}>
          <Ionicons name="location-outline" size={16} color="#6B7280" />
          <Text style={styles.scheduleText}>{job.location.distance} mi away</Text>
        </View>
      </View>

      <View style={styles.locationInfo}>
        <Text style={styles.addressText}>{job.location.address}</Text>
      </View>

      {job.specialRequests && (
        <View style={styles.specialRequestsContainer}>
          <View style={styles.specialRequestsHeader}>
            <Ionicons name="chatbubble-outline" size={14} color="#F59E0B" />
            <Text style={styles.specialRequestsLabel}>Special Requests:</Text>
          </View>
          <Text style={styles.specialRequestsText}>{job.specialRequests}</Text>
        </View>
      )}

      <View style={styles.paymentInfo}>
        <View style={styles.paymentLeft}>
          <Text style={styles.totalAmount}>${job.payment.total.toFixed(2)}</Text>
          <Text style={styles.earningsAmount}>You earn: ${job.payment.cleanerEarnings.toFixed(2)}</Text>
          {job.payment.tip && (
            <Text style={styles.tipAmount}>Tip: +${job.payment.tip.toFixed(2)}</Text>
          )}
        </View>
        
        {job.status === 'available' && (
          <View style={styles.jobActions}>
            <TouchableOpacity 
              style={styles.declineButton}
              onPress={() => handleDeclineJob(job.id)}
            >
              <Ionicons name="close" size={16} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.acceptButton}
              onPress={() => handleAcceptJob(job.id)}
              disabled={acceptingJobId === job.id}
            >
              {acceptingJobId === job.id ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
        
        {renderJobStatusActions(job)}
      </View>
    </Animated.View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons 
        name={
          activeTab === 'available' ? 'briefcase-outline' :
          activeTab === 'active' ? 'time-outline' : 'checkmark-circle-outline'
        } 
        size={64} 
        color="#D1D5DB" 
      />
      <Text style={styles.emptyStateTitle}>
        {activeTab === 'available' ? 'No Available Jobs' :
         activeTab === 'active' ? 'No Active Jobs' : 'No Job History'}
      </Text>
      <Text style={styles.emptyStateSubtitle}>
        {activeTab === 'available' 
          ? 'New job opportunities will appear here when customers book services in your area.'
          : activeTab === 'active'
          ? 'Jobs you accept will appear here. Check the Available tab for new opportunities.'
          : 'Completed and cancelled jobs will appear here after you finish them.'
        }
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00BFA6" />
          <Text style={styles.loadingText}>Loading jobs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredJobs = getFilteredJobs();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Jobs</Text>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => navigation.navigate('CleanerProfile', { cleanerId: 'demo_cleaner_1' })}
        >
          <Ionicons name="person-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {renderTabBar()}
      {renderFilterBar()}

      <FlatList
        data={filteredJobs}
        renderItem={renderJobCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        ListHeaderComponent={
          isLoading ? (
            <View style={{ padding: 16, gap: 16 }}>
              <SkeletonBlock height={48} />
              <SkeletonList rows={3} />
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      />
      
      <CleanerFloatingNavigation 
        navigation={navigation as any}
        currentScreen="Jobs"
        unreadCount={3}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#00BFA6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#00BFA6',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  activeTabBadge: {
    backgroundColor: '#00BFA6',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabBadgeText: {
    color: '#FFFFFF',
  },
  filterBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterScrollContent: {
    paddingHorizontal: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    marginRight: 12,
  },
  activeFilterChip: {
    backgroundColor: '#00BFA6',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeFilterChipText: {
    color: '#FFFFFF',
  },
  listContent: {
    padding: 20,
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  jobHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  customerStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  jobHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  instantBookBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  instantBookText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  serviceInfo: {
    marginBottom: 16,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceTypeBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  serviceTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  addOnsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addOnsLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginRight: 8,
  },
  addOnsText: {
    fontSize: 12,
    color: '#374151',
    flex: 1,
  },
  scheduleInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scheduleText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
  },
  locationInfo: {
    marginBottom: 16,
  },
  addressText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  specialRequestsContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  specialRequestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  specialRequestsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginLeft: 6,
  },
  specialRequestsText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  paymentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLeft: {
    flex: 1,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  earningsAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00BFA6',
    marginBottom: 2,
  },
  tipAmount: {
    fontSize: 12,
    color: '#F59E0B',
  },
  jobActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  declineButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00BFA6',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activeJobActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00BFA6',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryAction: {
    backgroundColor: '#FF6B6B',
  },
  completeAction: {
    backgroundColor: '#4ECDC4',
  },
});

export default JobsScreen; 