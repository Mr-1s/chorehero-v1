import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { bookingService } from '../../services/booking';
import { cleanerBookingService } from '../../services/cleanerBookingService';
import { LinearGradient } from 'expo-linear-gradient';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { useCleanerStore } from '../../store/cleanerStore';
import { wp, hp } from '../../utils/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FOOTER_GUTTER = 12;

function humanizeJobNotes(text: string | undefined | null): string | undefined {
  if (!text?.trim()) return undefined;
  const t = text.trim();
  if (/job\s*from\s*quote/i.test(t)) {
    return 'This job was booked from your accepted video quote.';
  }
  return t;
}

type StackParamList = {
  JobDetails: { jobId: string };
  Jobs: undefined;
  IndividualChat: { bookingId: string; cleanerId: string; otherParticipant: any };
  ChatScreen: { bookingId: string; otherParticipant: any };
  TrackingScreen: { jobId: string };
};

type JobDetailsScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'JobDetails'>;
  route: {
    params: {
      jobId: string;
    };
  };
};

interface JobDetails {
  id: string;
  status: 'pending' | 'accepted' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  customer: {
    id: string;
    name: string;
    avatar: string;
    phone: string;
    rating: number;
    totalBookings: number;
  };
  service: {
    type: string;
    title: string;
    addOns: string[];
    specialInstructions?: string;
  };
  location: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
    accessInstructions?: string;
  };
  schedule: {
    date: string;
    time: string;
    duration: number;
    estimatedCompletion: string;
  };
  household: {
    bedrooms?: number;
    bathrooms?: number;
    squareFeet?: number;
    hasPets?: boolean | null;
    petDetails?: string | null;
  };
  payment: {
    total: number;
    cleanerEarnings: number;
    platformFee: number;
    paymentMethod: string;
  };
  createdAt: string;
  acceptedAt?: string;
  completedAt?: string;
  messagingEnabled?: boolean;
  quoteId?: string;
}

const JobDetailsScreen: React.FC<JobDetailsScreenProps> = ({ navigation, route }) => {
  const { jobId } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const payoutDetails = useMemo(() => {
    if (!job) return null;
    const hours = Math.max(job.schedule.duration / 60, 0.5);
    const net = job.payment.cleanerEarnings || 0;
    const gross = net > 0 ? net / 0.8 : 0;
    const rate = gross > 0 ? gross / hours : 0;
    const platformFee = gross * 0.2;
    const payout = net;
    return { hours, rate, gross, platformFee, payout };
  }, [job]);
  const householdDetails = useMemo(() => {
    if (!job) return null;
    const rooms =
      job.household.bedrooms || job.household.bathrooms
        ? `${job.household.bedrooms ?? 0} bed · ${job.household.bathrooms ?? 0} bath`
        : 'Not provided';
    const squareFeet = job.household.squareFeet
      ? `${job.household.squareFeet} sq ft`
      : 'Sq ft not set';
    const pets =
      job.household.hasPets === null || job.household.hasPets === undefined
        ? 'Pets: Unknown'
        : job.household.hasPets
          ? 'Pets: Yes'
          : 'Pets: No';
    return { rooms, squareFeet, pets };
  }, [job]);
  const vibeDetails = useMemo(() => {
    if (!job) return null;
    const petsNote = job.household.petDetails?.trim();
    const pets = job.household.hasPets
      ? petsNote || 'Pets: Yes'
      : job.household.hasPets === false
        ? 'Pets: No'
        : 'Pets: Unknown';
    const access = job.location.accessInstructions?.trim();
    const notes = job.service.specialInstructions?.trim();
    if (!petsNote && !access && !notes && job.household.hasPets === undefined) {
      return null;
    }
    return {
      pets,
      access,
      notes,
    };
  }, [job]);

  // Get bookings from store to find the actual status
  const { availableBookings, activeBookings, pastBookings } = useCleanerStore();

  // Find the booking in any of the lists to get its current status
  const findBookingStatus = useMemo(() => {
    // Check active bookings first (accepted, on_the_way, in_progress)
    const activeBooking = activeBookings.find(b => b.id === jobId);
    if (activeBooking) {
      // Map booking status to job status (preserve on_the_way for Start Job button)
      switch (activeBooking.status) {
        case 'accepted': return 'accepted';
        case 'on_the_way': return 'on_the_way';
        case 'arrived': return 'arrived';
        case 'in_progress': return 'in_progress';
        default: return 'accepted';
      }
    }
    
    // Check past bookings (completed)
    const pastBooking = pastBookings.find(b => b.id === jobId);
    if (pastBooking) {
      return 'completed';
    }
    
    // Check available bookings (pending/offered)
    const availableBooking = availableBookings.find(b => b.id === jobId);
    if (availableBooking) {
      return 'pending';
    }
    
    return 'pending'; // Default
  }, [jobId, availableBookings, activeBookings, pastBookings]);

  useEffect(() => {
    loadJobDetails();
  }, [jobId, findBookingStatus]);

  const loadJobDetails = async () => {
    try {
      // Find the booking in the store to get actual data
      const allBookings = [...availableBookings, ...activeBookings, ...pastBookings];
      const storeBooking = allBookings.find(b => b.id === jobId);

      // Fetch real coordinates from DB (addresses table)
      let lat = 37.7749;
      let lng = -122.4194;
      let bookingRow: { address?: { latitude?: number; longitude?: number }; quote_id?: string; customer_id?: string } | null = null;
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
      let customerPhone: string | null = null;
      if (isValidUUID) {
        const { data } = await supabase
          .from('bookings')
          .select('address_id, quote_id, customer_id, address:addresses(latitude, longitude)')
          .eq('id', jobId)
          .single();
        bookingRow = data;
        if (bookingRow?.customer_id) {
          const { data: userRow } = await supabase
            .from('users')
            .select('phone')
            .eq('id', bookingRow.customer_id)
            .single();
          customerPhone = userRow?.phone ?? null;
        }
        if (bookingRow?.address && (bookingRow.address as { latitude?: number; longitude?: number }).latitude != null) {
          lat = Number((bookingRow.address as { latitude: number }).latitude);
          lng = Number((bookingRow.address as { longitude: number }).longitude);
        }
      }

      // Build job details from store booking using correct Booking field names
      if (!storeBooking) {
        // No booking found - show error
        setLoading(false);
        return;
      }

      const jobDetails: JobDetails = {
        id: jobId,
        status: findBookingStatus,
        customer: {
          id: storeBooking.customerId || 'customer-1',
          name: storeBooking.customerName,
          avatar: storeBooking.customerAvatarUrl || 'https://images.unsplash.com/photo-1494790108755-2616b612b47c?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80',
          phone: customerPhone || '+1 (555) 123-4567',
          rating: storeBooking.customerRating || 4.8,
          totalBookings: storeBooking.customerTotalBookings || 0,
        },
        service: {
          type: storeBooking.serviceType,
          title: storeBooking.serviceType,
          addOns: storeBooking.addOns || [],
          specialInstructions: humanizeJobNotes(
            storeBooking.hasSpecialRequests ? storeBooking.specialRequestText : undefined
          ),
        },
        location: {
          address: storeBooking.addressLine1,
          coordinates: { latitude: lat, longitude: lng },
          accessInstructions: storeBooking.accessInstructions || undefined,
        },
        schedule: {
          date: new Date(storeBooking.scheduledAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          time: new Date(storeBooking.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          duration: storeBooking.durationMinutes,
          estimatedCompletion: new Date(new Date(storeBooking.scheduledAt).getTime() + storeBooking.durationMinutes * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        },
        household: {
          bedrooms: storeBooking.bedrooms,
          bathrooms: storeBooking.bathrooms,
          squareFeet: storeBooking.squareFeet,
          hasPets: storeBooking.hasPets,
          petDetails: storeBooking.petDetails || null,
        },
        payment: {
          total: storeBooking.totalPrice,
          cleanerEarnings: storeBooking.payoutToCleaner,
          platformFee: storeBooking.totalPrice - storeBooking.payoutToCleaner,
          paymentMethod: 'Credit Card',
        },
        createdAt: storeBooking.scheduledAt,
        messagingEnabled: storeBooking.messagingEnabled,
        quoteId: bookingRow?.quote_id ?? undefined,
      };

      setJob(jobDetails);
    } catch (error) {
      console.error('Error loading job details:', error);
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  // Get store actions
  const { acceptBooking, declineBooking, startTraveling, markInProgress, markCompleted, refreshData } = useCleanerStore();

  const handleRunningLate = async () => {
    if (!job) return;
    Alert.alert(
      'Running Late',
      'Notify the customer how many minutes you\'ll be late:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '15 min',
          onPress: () => notifyCustomerDelay(15),
        },
        {
          text: '30 min',
          onPress: () => notifyCustomerDelay(30),
        },
      ]
    );
  };

  const notifyCustomerDelay = async (delayMinutes: number) => {
    if (!job) return;
    try {
      const { error } = await supabase.rpc('notify_customer_delay', {
        p_booking_id: job.id,
        p_delay_minutes: delayMinutes,
      });
      if (error) throw error;
      Alert.alert('Customer Notified', `Customer has been notified you're running ~${delayMinutes} min late.`);
    } catch (e) {
      console.error('notify_customer_delay failed:', e);
      Alert.alert('Error', 'Could not send delay notification.');
    }
  };

  const handleStartTraveling = async () => {
    if (!job) return;

    setActionLoading(true);
    try {
      await startTraveling(job.id);
      setJob(prev => prev ? { ...prev, status: 'on_the_way' } : null);

      // Open maps for directions
      const { latitude, longitude } = job.location.coordinates;
      const url = `maps://app?daddr=${latitude},${longitude}`;
      Linking.openURL(url).catch(() => {
        const webUrl = `https://maps.google.com/?daddr=${latitude},${longitude}`;
        Linking.openURL(webUrl);
      });

      Alert.alert('On Your Way', 'You\'re now en route. The customer has been notified.');
    } catch (error) {
      console.error('Error starting travel:', error);
      Alert.alert('Error', 'Failed to start traveling. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptJob = async () => {
    if (!job) return;

    Alert.alert(
      'Accept Job',
      'Are you sure you want to accept this job?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setActionLoading(true);
            try {
              await acceptBooking(job.id);
              setJob(prev => prev ? { ...prev, status: 'accepted', acceptedAt: new Date().toISOString() } : null);
              Alert.alert('Job Accepted', 'You have successfully accepted this job. The customer has been notified.');
            } catch (error) {
              console.error('Error accepting job:', error);
              const msg = error instanceof Error ? error.message : 'Failed to accept job';
              Alert.alert('Error', msg);
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeclineJob = async () => {
    Alert.alert(
      'Decline Job',
      'Are you sure you want to decline this job? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await declineBooking(job!.id);
              navigation.goBack();
              Alert.alert('Job Declined', 'You have declined this job.');
            } catch (error) {
              console.error('Error declining job:', error);
              Alert.alert('Error', 'Failed to decline job');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkArrived = async () => {
    if (!job) return;
    setActionLoading(true);
    try {
      const ok = await cleanerBookingService.updateBookingStatus(job.id, 'cleaner_arrived');
      if (ok) {
        setJob(prev => prev ? { ...prev, status: 'arrived' } : null);
        await refreshData();
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      console.error('Error marking arrived:', error);
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessageCustomer = () => {
    if (!job || !job.messagingEnabled || !user?.id) return;
    navigation.navigate('IndividualChat', {
      bookingId: job.id,
      cleanerId: user.id,
      otherParticipant: {
        id: job.customer.id,
        name: job.customer.name,
        avatar_url: job.customer.avatar || '',
        role: 'customer',
      },
    });
  };

  const handleStartJob = async () => {
    if (!job) return;
    
    setActionLoading(true);
    try {
      await markInProgress(job.id);
      setJob(prev => prev ? { ...prev, status: 'in_progress' } : null);
      Alert.alert('Job Started', 'You have marked this job as in progress.');
    } catch (error) {
      console.error('Error starting job:', error);
      Alert.alert('Error', 'Failed to start job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!job) return;

    setActionLoading(true);
    try {
      await markCompleted(job.id);
      setJob(prev => prev ? { ...prev, status: 'completed', completedAt: new Date().toISOString() } : null);
      Alert.alert('Job Completed', 'You have marked this job as completed!');
      navigation.goBack();
    } catch (error) {
      console.error('Error completing job:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to complete job');
    } finally {
      setActionLoading(false);
    }
  };

  /** Quick Complete: for quote-originated bookings, skip Start Traveling/Start Job and mark complete directly. */
  const handleQuickComplete = async () => {
    if (!job || !job.quoteId || !user?.id) return;
    setActionLoading(true);
    try {
      const updated = await cleanerBookingService.updateBookingStatus(job.id, 'in_progress');
      if (!updated) throw new Error('Failed to update status');
      const result = await cleanerBookingService.markJobComplete(job.id, user.id);
      if (!result.success) throw new Error(result.error);
      setJob(prev => prev ? { ...prev, status: 'completed', completedAt: new Date().toISOString() } : null);
      await refreshData();
      Alert.alert('Job Completed', 'You have marked this job as completed!');
      navigation.goBack();
    } catch (error) {
      console.error('Error in quick complete:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to complete job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleContactCustomer = () => {
    if (!job) return;
    
    const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call',
        onPress: () => Linking.openURL(`tel:${job.customer.phone}`),
      },
    ];
    if (job.messagingEnabled) {
      buttons.push({
        text: 'Message',
        onPress: () => navigation.navigate('IndividualChat', {
          bookingId: job.id,
          cleanerId: job.customer.id,
          otherParticipant: {
            id: job.customer.id,
            name: job.customer.name,
            avatar: job.customer.avatar,
            role: 'customer',
          },
        }),
      });
    }
    Alert.alert(
      'Contact Customer',
      'How would you like to contact the customer?',
      buttons
    );
  };

  const handleProEmergencyCancel = () => {
    if (!job || !user?.id) return;
    const reasons = [
      { text: 'Cancel', style: 'cancel' as const },
      { text: 'Medical emergency', onPress: () => runProEmergencyCancel('Medical emergency') },
      { text: 'Family emergency', onPress: () => runProEmergencyCancel('Family emergency') },
      { text: 'Vehicle/transport issue', onPress: () => runProEmergencyCancel('Vehicle/transport issue') },
      { text: 'Other', onPress: () => runProEmergencyCancel('Other') },
    ];
    Alert.alert(
      'Cancel Job (Emergency)',
      'This will cancel the job. You may incur a $25 fee. Customer receives full refund + $25 credit.\n\nSelect a reason:',
      reasons
    );
  };

  const runProEmergencyCancel = async (reason: string) => {
    if (!job || !user?.id) return;
    setActionLoading(true);
    try {
      const result = await bookingService.proEmergencyCancel(job.id, user.id, reason);
      if (!result.success) throw new Error(result.error);
      Alert.alert('Job Cancelled', 'The job has been cancelled. Customer will receive a full refund plus $25 credit.');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to cancel job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGetDirections = () => {
    if (!job) return;
    
    const url = `maps://app?daddr=${job.location.coordinates.latitude},${job.location.coordinates.longitude}`;
    Linking.openURL(url).catch(() => {
      // Fallback to Google Maps web
      const webUrl = `https://maps.google.com/?daddr=${job.location.coordinates.latitude},${job.location.coordinates.longitude}`;
      Linking.openURL(webUrl);
    });
  };

  const getStatusColor = (status: string) => {
    // Orange gradient theme
    switch (status) {
      case 'pending': return '#FBBF24';      // Amber 400 - light yellow-orange
      case 'accepted': return '#F59E0B';     // Amber 500 - main orange
      case 'on_the_way': return '#D97706';   // Amber 600 - en route
      case 'arrived': return '#D97706';     // Amber 600 - arrived
      case 'in_progress': return '#D97706';  // Amber 600 - darker orange
      case 'completed': return '#92400E';    // Amber 800 - deep brown
      case 'cancelled': return '#DC2626';    // Red 600
      default: return '#6B7280';
    }
  };

  const maskPhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '***-***-****';
    return `***-***-${digits.slice(-4)}`;
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending Acceptance';
      case 'accepted': return 'Accepted';
    case 'on_the_way': return 'En Route';
    case 'arrived': return 'Arrived';
    case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9F9F9" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <Text style={styles.loadingText}>Loading job details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9F9F9" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>Job not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9F9F9" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 280 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.statusStrip,
            { backgroundColor: `${getStatusColor(job.status)}18` },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(job.status) }]} />
          <Text style={styles.statusStripText}>{getStatusText(job.status)}</Text>
        </View>

        {/* Schedule & Location — first: what matters on the way */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>When & where</Text>

          <View style={styles.scheduleLocationCard}>
            <View style={styles.scheduleRow}>
              <View style={styles.scheduleItem}>
                <Ionicons name="calendar-outline" size={20} color="#F59E0B" />
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleLabel}>Date & time</Text>
                  <Text style={styles.scheduleValue}>
                    {job.schedule.date} at {job.schedule.time}
                  </Text>
                </View>
              </View>

              <View style={styles.scheduleItem}>
                <Ionicons name="time-outline" size={20} color="#F59E0B" />
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleLabel}>Duration</Text>
                  <Text style={styles.scheduleValue}>{job.schedule.duration} min</Text>
                </View>
              </View>
            </View>

            {householdDetails && (
              <View style={styles.householdList}>
                <View style={styles.householdListRow}>
                  <Ionicons name="home-outline" size={16} color="#047857" />
                  <Text style={styles.householdListText}>
                    <Text style={styles.householdListLabel}>Home · </Text>
                    {householdDetails.rooms}
                  </Text>
                </View>
                <View style={styles.householdListRow}>
                  <Ionicons name="expand-outline" size={16} color="#047857" />
                  <Text style={styles.householdListText}>
                    <Text style={styles.householdListLabel}>Size · </Text>
                    {householdDetails.squareFeet}
                  </Text>
                </View>
                <View style={styles.householdListRow}>
                  <Ionicons name="paw-outline" size={16} color="#047857" />
                  <Text style={styles.householdListText}>
                    <Text style={styles.householdListLabel}>Pets · </Text>
                    {householdDetails.pets}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.locationBlock}>
              <View style={styles.locationTitleRow}>
                <Ionicons name="location-outline" size={20} color="#F59E0B" />
                <Text style={styles.locationTitleLarge}>Address</Text>
              </View>
              <Text style={styles.locationAddressLarge}>{job.location.address}</Text>
              <TouchableOpacity
                style={styles.directionsButtonFull}
                onPress={handleGetDirections}
                activeOpacity={0.9}
              >
                <Ionicons name="navigate" size={18} color="#B45309" />
                <Text style={styles.directionsButtonFullText}>Open in Maps</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer</Text>
          <View style={styles.customerCard}>
            <Image source={{ uri: job.customer.avatar }} style={styles.customerAvatar} />
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{job.customer.name}</Text>
              <View style={styles.customerStats}>
                <View style={styles.statItem}>
                  <Ionicons name="star" size={14} color="#FFA500" />
                  <Text style={styles.statText}>{job.customer.rating}</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="briefcase-outline" size={14} color="#6B7280" />
                  <Text style={styles.statText}>
                    {job.customer.totalBookings} past booking
                    {job.customer.totalBookings === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
              {job.customer.phone && (
                <Text style={styles.customerPhone}>
                  {job.status === 'in_progress' || job.status === 'on_the_way' || job.status === 'arrived'
                    ? job.customer.phone
                    : maskPhone(job.customer.phone)}
                </Text>
              )}
            </View>
            <TouchableOpacity style={styles.contactButton} onPress={handleContactCustomer} activeOpacity={0.85}>
              <Ionicons name="chatbubbles-outline" size={20} color="#D97706" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Service Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service</Text>
          <View style={styles.detailsCard}>
            <Text style={styles.serviceTitle}>{job.service.title || job.service.type || 'Service'}</Text>

            {job.service.addOns.length > 0 && (
              <View style={styles.addOnsContainer}>
                <Text style={styles.addOnsTitle}>Add-ons</Text>
                {job.service.addOns.map((addOn, index) => (
                  <View key={index} style={styles.addOnItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#F59E0B" />
                    <Text style={styles.addOnText}>{addOn}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {vibeDetails && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Access & notes</Text>
            <View style={styles.vibeCard}>
              <View style={styles.vibeRow}>
                <Ionicons name="paw-outline" size={18} color="#0D9488" />
                <Text style={styles.vibeText}>{vibeDetails.pets}</Text>
              </View>
              {vibeDetails.access && (
                <View style={styles.vibeRow}>
                  <Ionicons name="key-outline" size={18} color="#0D9488" />
                  <Text style={styles.vibeText}>{vibeDetails.access}</Text>
                </View>
              )}
              {vibeDetails.notes && (
                <View style={styles.vibeRow}>
                  <Ionicons name="document-text-outline" size={18} color="#0D9488" />
                  <Text style={styles.vibeText}>{vibeDetails.notes}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Payment Details - Collapsible */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.paymentHeader}
            onPress={() => setPaymentExpanded(!paymentExpanded)}
            activeOpacity={0.7}
          >
            <Text style={styles.sectionTitle}>Payment Details</Text>
            <Ionicons
              name={paymentExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#6B7280"
            />
          </TouchableOpacity>
          {paymentExpanded && (
            <View style={styles.paymentCard}>
              {payoutDetails && (
                <>
                  <View style={[styles.paymentRow, styles.paymentRowTotal]}>
                    <Text style={styles.paymentLabelTotal}>Total Payout</Text>
                    <Text style={styles.paymentValueTotal}>${payoutDetails.payout.toFixed(2)}</Text>
                  </View>
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Rate x Hours</Text>
                    <Text style={styles.paymentValue}>
                      ${payoutDetails.rate.toFixed(2)}/hr x {payoutDetails.hours.toFixed(1)}h
                    </Text>
                  </View>
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Platform Fee (20%)</Text>
                    <Text style={styles.paymentValue}>-${payoutDetails.platformFee.toFixed(2)}</Text>
                  </View>
                </>
              )}
              <Text style={styles.paymentMethod}>Payment: {job.payment.paymentMethod}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      {job.status === 'pending' && (
        <View
          style={[
            styles.footerBar,
            { paddingBottom: insets.bottom + FOOTER_GUTTER },
            { flexDirection: 'row' },
          ]}
        >
          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={handleDeclineJob}
            disabled={actionLoading}
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={handleAcceptJob}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.acceptButtonText}>Accept Job</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {job.status === 'accepted' && (
        <View style={[styles.footerBar, { paddingBottom: insets.bottom + FOOTER_GUTTER }]}>
          <TouchableOpacity
            style={styles.actionPrimary}
            onPress={handleStartTraveling}
            disabled={actionLoading}
            activeOpacity={0.9}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.actionPrimaryInner}>
                <Ionicons name="navigate" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.actionPrimaryText}>Start traveling</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.actionRowEqual}>
            <TouchableOpacity
              style={[
                styles.actionSecondaryOutline,
                styles.actionFlex,
                job.messagingEnabled && styles.actionColGap,
              ]}
              onPress={handleRunningLate}
              activeOpacity={0.85}
            >
              <Ionicons name="time-outline" size={18} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={styles.actionSecondaryLabel}>Running late</Text>
            </TouchableOpacity>
            {job.messagingEnabled && (
              <TouchableOpacity
                style={[styles.actionSecondaryOutline, styles.actionFlex]}
                onPress={handleMessageCustomer}
                activeOpacity={0.85}
              >
                <Ionicons name="chatbubbles-outline" size={18} color="#D97706" style={{ marginRight: 6 }} />
                <Text style={styles.actionSecondaryLabel} numberOfLines={1}>
                  Message
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {job.quoteId && (
            <TouchableOpacity
              style={styles.quickCompleteLink}
              onPress={handleQuickComplete}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-done-outline" size={18} color="#64748B" />
              <Text style={styles.quickCompleteLinkText}>Complete now (short path for quote jobs)</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.dangerBar}
            onPress={handleProEmergencyCancel}
            disabled={actionLoading}
            activeOpacity={0.85}
          >
            <Ionicons name="warning-outline" size={18} color="#B91C1C" style={{ marginRight: 8 }} />
            <Text style={styles.dangerBarText}>Cancel job (emergency)</Text>
          </TouchableOpacity>
        </View>
      )}

      {job.status === 'on_the_way' && (
        <View style={[styles.footerBar, { paddingBottom: insets.bottom + FOOTER_GUTTER }]}>
          <TouchableOpacity
            style={styles.actionPrimary}
            onPress={handleMarkArrived}
            disabled={actionLoading}
            activeOpacity={0.9}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.actionPrimaryText}>{"I've arrived"}</Text>
            )}
          </TouchableOpacity>
          <View style={styles.actionRowEqual}>
            <TouchableOpacity
              style={[
                styles.actionSecondaryOutline,
                styles.actionFlex,
                job.messagingEnabled && styles.actionColGap,
              ]}
              onPress={handleRunningLate}
            >
              <Ionicons name="time-outline" size={18} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={styles.actionSecondaryLabel}>Running late</Text>
            </TouchableOpacity>
            {job.messagingEnabled && (
              <TouchableOpacity
                style={[styles.actionSecondaryOutline, styles.actionFlex]}
                onPress={handleMessageCustomer}
              >
                <Ionicons name="chatbubbles-outline" size={18} color="#D97706" style={{ marginRight: 6 }} />
                <Text style={styles.actionSecondaryLabel} numberOfLines={1}>
                  Message
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {job.status === 'arrived' && (
        <View style={[styles.footerBar, { paddingBottom: insets.bottom + FOOTER_GUTTER }]}>
          <TouchableOpacity
            style={styles.actionPrimary}
            onPress={handleStartJob}
            disabled={actionLoading}
            activeOpacity={0.9}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.actionPrimaryInner}>
                <Ionicons name="play" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.actionPrimaryText}>Start job</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.actionRowEqual}>
            <TouchableOpacity
              style={[
                styles.actionSecondaryOutline,
                styles.actionFlex,
                job.messagingEnabled && styles.actionColGap,
              ]}
              onPress={handleRunningLate}
            >
              <Ionicons name="time-outline" size={18} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={styles.actionSecondaryLabel}>Running late</Text>
            </TouchableOpacity>
            {job.messagingEnabled && (
              <TouchableOpacity
                style={[styles.actionSecondaryOutline, styles.actionFlex]}
                onPress={handleMessageCustomer}
              >
                <Ionicons name="chatbubbles-outline" size={18} color="#D97706" style={{ marginRight: 6 }} />
                <Text style={styles.actionSecondaryLabel} numberOfLines={1}>
                  Message
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {job.status === 'in_progress' && (
        <View style={[styles.footerBar, { paddingBottom: insets.bottom + FOOTER_GUTTER }]}>
          <TouchableOpacity
            style={[styles.actionPrimary, styles.actionPrimaryComplete]}
            onPress={handleCompleteJob}
            activeOpacity={0.9}
          >
            <Text style={styles.actionPrimaryText}>Mark complete</Text>
          </TouchableOpacity>
          {job.messagingEnabled && (
            <TouchableOpacity
              style={[styles.actionSecondaryOutline, { width: '100%', justifyContent: 'center' }]}
              onPress={handleMessageCustomer}
            >
              <Ionicons name="chatbubbles-outline" size={18} color="#D97706" style={{ marginRight: 6 }} />
              <Text style={styles.actionSecondaryLabel}>Message customer</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.4%'),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  headerBackButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    padding: 8,
  },
  statusBadge: {
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.7%'),
    borderRadius: wp('3%'),
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: wp('3%'),
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: wp('4%'),
    color: '#6B7280',
  },
  loadingIndicator: {
    color: '#F59E0B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('10%'),
  },
  errorText: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#374151',
    marginTop: hp('2%'),
    marginBottom: hp('3%'),
  },
  backButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('1.5%'),
    borderRadius: wp('3%'),
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: wp('4%'),
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: hp('0.5%'),
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: wp('4%'),
    marginBottom: hp('0.5%'),
    marginTop: hp('0.5%'),
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  statusStripText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: hp('1%'),
    marginHorizontal: wp('4%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.8%'),
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: hp('1.2%'),
    letterSpacing: -0.2,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: 60,
    height: 60,
    borderRadius: wp('7.5%'),
  },
  customerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  customerName: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: hp('1%'),
  },
  customerStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginLeft: 4,
  },
  customerPhone: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginTop: 4,
  },
  contactButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFBF5',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  detailsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  addOnsContainer: {
    marginBottom: hp('2%'),
  },
  addOnsTitle: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#374151',
    marginBottom: hp('1%'),
  },
  addOnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  addOnText: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginLeft: 8,
  },
  vibeCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  vibeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  vibeText: {
    flex: 1,
    fontSize: 14,
    color: '#134E4A',
    lineHeight: 20,
    marginLeft: 10,
    fontWeight: '500',
  },
  scheduleLocationCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  scheduleRow: {
    flexDirection: 'row',
    marginBottom: hp('1.2%'),
  },
  scheduleItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleInfo: {
    marginLeft: 12,
  },
  scheduleLabel: {
    fontSize: wp('3%'),
    color: '#6B7280',
    marginBottom: 2,
  },
  scheduleValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  householdList: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginBottom: 12,
  },
  householdListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  householdListText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  householdListLabel: {
    color: '#6B7280',
    fontWeight: '500',
  },
  locationBlock: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 14,
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationTitleLarge: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  locationAddressLarge: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    marginBottom: 12,
  },
  directionsButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFBF5',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 12,
  },
  directionsButtonFullText: {
    color: '#B45309',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  paymentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: wp('3%'),
    padding: 16,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('1%'),
  },
  paymentRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: hp('1.5%'),
    marginTop: hp('1%'),
    marginBottom: hp('1.5%'),
  },
  paymentLabel: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
  },
  paymentValue: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: '#1F2937',
  },
  paymentLabelTotal: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#1F2937',
  },
  paymentValueTotal: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#F59E0B',
  },
  paymentMethod: {
    fontSize: wp('3%'),
    color: '#6B7280',
    fontStyle: 'italic',
  },
  footerBar: {
    paddingHorizontal: wp('4%'),
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 12,
  },
  actionPrimary: {
    width: '100%',
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionPrimaryComplete: {
    backgroundColor: '#B45309',
  },
  actionPrimaryInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  actionRowEqual: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 4,
  },
  actionFlex: {
    flex: 1,
  },
  actionSecondaryOutline: {
    minHeight: 48,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionColGap: {
    marginEnd: 8,
  },
  actionSecondaryLabel: {
    color: '#B45309',
    fontSize: 14,
    fontWeight: '600',
  },
  quickCompleteLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginBottom: 4,
  },
  quickCompleteLinkText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 6,
  },
  dangerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  dangerBarText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButton: {
    flex: 1,
    paddingVertical: hp('2%'),
    borderRadius: wp('3%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginRight: 8,
  },
  declineButtonText: {
    color: '#DC2626',
    fontSize: wp('4%'),
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: '#F59E0B',
    marginLeft: 8,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: wp('4%'),
    fontWeight: '600',
  },
});

export default JobDetailsScreen;