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
import { LinearGradient } from 'expo-linear-gradient';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { useCleanerStore } from '../../store/cleanerStore';

type StackParamList = {
  JobDetails: { jobId: string };
  Jobs: undefined;
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
  status: 'pending' | 'accepted' | 'on_the_way' | 'in_progress' | 'completed' | 'cancelled';
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
}

const JobDetailsScreen: React.FC<JobDetailsScreenProps> = ({ navigation, route }) => {
  const { jobId } = route.params;
  const { user } = useAuth();
  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
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
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
      if (isValidUUID) {
        const { data: bookingRow } = await supabase
          .from('bookings')
          .select('address_id, address:addresses(latitude, longitude)')
          .eq('id', jobId)
          .single();
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
          id: 'customer-1',
          name: storeBooking.customerName,
          avatar: storeBooking.customerAvatarUrl || 'https://images.unsplash.com/photo-1494790108755-2616b612b47c?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80',
          phone: '+1 (555) 123-4567',
          rating: storeBooking.customerRating || 4.8,
          totalBookings: storeBooking.customerTotalBookings || 0,
        },
        service: {
          type: storeBooking.serviceType,
          title: storeBooking.serviceType,
          addOns: storeBooking.addOns || [],
          specialInstructions: storeBooking.hasSpecialRequests ? storeBooking.specialRequestText : undefined,
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
  const { acceptBooking, declineBooking, startTraveling, markInProgress, markCompleted } = useCleanerStore();

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
      setJob(prev => prev ? { 
        ...prev, 
        status: 'completed', 
        completedAt: new Date().toISOString() 
      } : null);
      Alert.alert('Job Completed', 'You have marked this job as completed!');
      navigation.goBack(); // Return to jobs list
    } catch (error) {
      console.error('Error completing job:', error);
      Alert.alert('Error', 'Failed to complete job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleContactCustomer = () => {
    if (!job) return;
    
    Alert.alert(
      'Contact Customer',
      'How would you like to contact the customer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => Linking.openURL(`tel:${job.customer.phone}`),
        },
        {
          text: 'Message',
          onPress: () => navigation.navigate('IndividualChat', {
            bookingId: job.id,
            otherParticipant: {
              id: job.customer.id,
              name: job.customer.name,
              avatar: job.customer.avatar,
              role: 'customer',
            },
          }),
        },
      ]
    );
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
      case 'in_progress': return '#D97706';  // Amber 600 - darker orange
      case 'completed': return '#92400E';    // Amber 800 - deep brown
      case 'cancelled': return '#DC2626';    // Red 600
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending Acceptance';
      case 'accepted': return 'Accepted';
      case 'on_the_way': return 'En Route';
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
        <View style={styles.headerRight}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(job.status) }]}>
            <Text style={styles.statusBadgeText}>{getStatusText(job.status)}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
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
                  <Ionicons name="calendar" size={14} color="#6B7280" />
                  <Text style={styles.statText}>{job.customer.totalBookings} bookings</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={handleContactCustomer}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#F59E0B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Service Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Details</Text>
          <View style={styles.detailsCard}>
            <Text style={styles.serviceTitle}>{job?.service?.title || job?.service?.name || 'Service'}</Text>
            
            {job.service.addOns.length > 0 && (
              <View style={styles.addOnsContainer}>
                <Text style={styles.addOnsTitle}>Add-ons:</Text>
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
            <Text style={styles.sectionTitle}>Vibe & Access</Text>
            <View style={styles.vibeCard}>
              <View style={styles.vibeRow}>
                <Ionicons name="paw-outline" size={18} color="#14B8A6" />
                <Text style={styles.vibeText}>{vibeDetails.pets}</Text>
              </View>
              {vibeDetails.access && (
                <View style={styles.vibeRow}>
                  <Ionicons name="key-outline" size={18} color="#14B8A6" />
                  <Text style={styles.vibeText}>{vibeDetails.access}</Text>
                </View>
              )}
              {vibeDetails.notes && (
                <View style={styles.vibeRow}>
                  <Ionicons name="alert-circle-outline" size={18} color="#14B8A6" />
                  <Text style={styles.vibeText}>{vibeDetails.notes}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Schedule & Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule & Location</Text>
          
          <View style={styles.scheduleLocationCard}>
            <View style={styles.scheduleRow}>
              <View style={styles.scheduleItem}>
                <Ionicons name="calendar-outline" size={20} color="#F59E0B" />
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleLabel}>Date & Time</Text>
                  <Text style={styles.scheduleValue}>{job.schedule.date} at {job.schedule.time}</Text>
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
              <View style={styles.householdRow}>
                <View style={styles.householdItem}>
                  <Ionicons name="home-outline" size={18} color="#10B981" />
                  <View style={styles.householdInfo}>
                    <Text style={styles.householdLabel}>Rooms</Text>
                    <Text style={styles.householdValue}>{householdDetails.rooms}</Text>
                  </View>
                </View>
                <View style={styles.householdItem}>
                  <Ionicons name="expand-outline" size={18} color="#10B981" />
                  <View style={styles.householdInfo}>
                    <Text style={styles.householdLabel}>Sq Ft</Text>
                    <Text style={styles.householdValue}>{householdDetails.squareFeet}</Text>
                  </View>
                </View>
                <View style={styles.householdItem}>
                  <Ionicons name="paw-outline" size={18} color="#10B981" />
                  <View style={styles.householdInfo}>
                    <Text style={styles.householdLabel}>Pets</Text>
                    <Text style={styles.householdValue}>{householdDetails.pets}</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.locationContainer}>
              <View style={styles.locationHeader}>
                <Ionicons name="location-outline" size={20} color="#F59E0B" />
                <Text style={styles.locationTitle}>Location</Text>
                <TouchableOpacity
                  style={styles.directionsButton}
                  onPress={handleGetDirections}
                >
                  <Text style={styles.directionsButtonText}>Directions</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.locationAddress}>{job.location.address}</Text>
            </View>
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
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
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Action Buttons */}
      {job.status === 'pending' && (
        <View style={styles.actionButtons}>
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
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={handleRunningLate}
          >
            <Text style={styles.secondaryButtonText}>Running Late</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton]}
            onPress={handleStartTraveling}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="navigate" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.startButtonText}>Start Traveling</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {job.status === 'on_the_way' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={handleRunningLate}
          >
            <Text style={styles.secondaryButtonText}>Running Late</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton]}
            onPress={handleStartJob}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.startButtonText}>Start Job</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {job.status === 'in_progress' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={handleCompleteJob}
          >
            <Text style={styles.completeButtonText}>Mark Complete</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerBackButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    padding: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  loadingIndicator: {
    color: '#F59E0B',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    marginHorizontal: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  customerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
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
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  contactButton: {
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
  },
  detailsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  addOnsContainer: {
    marginBottom: 16,
  },
  addOnsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  addOnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addOnText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  vibeCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 16,
  },
  vibeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  vibeText: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  scheduleLocationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  scheduleRow: {
    flexDirection: 'row',
    marginBottom: 16,
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
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  scheduleValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  householdRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  householdItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  householdInfo: {
    marginLeft: 8,
  },
  householdLabel: {
    fontSize: 11,
    color: '#047857',
    marginBottom: 2,
    fontWeight: '600',
  },
  householdValue: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
  locationContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 8,
    flex: 1,
  },
  directionsButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  directionsButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  locationAddress: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  paymentCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 8,
    marginBottom: 12,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  paymentValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  paymentLabelTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  paymentValueTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F59E0B',
  },
  paymentMethod: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
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
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: '#F59E0B',
    marginLeft: 8,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#F59E0B',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  secondaryButtonText: {
    color: '#F59E0B',
    fontSize: 16,
    fontWeight: '600',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: '#92400E',  // Deep amber brown
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 20,
  },
});

export default JobDetailsScreen;