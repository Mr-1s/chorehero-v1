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
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
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

  // Get bookings from store to find the actual status
  const { availableBookings, activeBookings, pastBookings } = useCleanerStore();

  // Find the booking in any of the lists to get its current status
  const findBookingStatus = useMemo(() => {
    // Check active bookings first (accepted, on_the_way, in_progress)
    const activeBooking = activeBookings.find(b => b.id === jobId);
    if (activeBooking) {
      // Map booking status to job status
      switch (activeBooking.status) {
        case 'accepted': return 'accepted';
        case 'on_the_way': return 'accepted'; // Treat as accepted for display
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
          coordinates: {
            latitude: 37.7749,
            longitude: -122.4194,
          },
          accessInstructions: storeBooking.hasSpecialRequests ? storeBooking.specialRequestText : undefined,
        },
        schedule: {
          date: new Date(storeBooking.scheduledAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          time: new Date(storeBooking.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          duration: storeBooking.durationMinutes,
          estimatedCompletion: new Date(new Date(storeBooking.scheduledAt).getTime() + storeBooking.durationMinutes * 60000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
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
              Alert.alert('Error', 'Failed to accept job');
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

            {job.service.specialInstructions && (
              <View style={styles.instructionsContainer}>
                <Text style={styles.instructionsTitle}>Special Instructions:</Text>
                <Text style={styles.instructionsText}>{job.service.specialInstructions}</Text>
              </View>
            )}
          </View>
        </View>

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
              
              {job.location.accessInstructions && (
                <View style={styles.accessInstructions}>
                  <Text style={styles.accessTitle}>Access Instructions:</Text>
                  <Text style={styles.accessText}>{job.location.accessInstructions}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          <View style={styles.paymentCard}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Total Job Value</Text>
              <Text style={styles.paymentValue}>${job.payment.total.toFixed(2)}</Text>
            </View>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Platform Fee</Text>
              <Text style={styles.paymentValue}>-${job.payment.platformFee.toFixed(2)}</Text>
            </View>
            <View style={[styles.paymentRow, styles.paymentRowTotal]}>
              <Text style={styles.paymentLabelTotal}>Your Earnings</Text>
              <Text style={styles.paymentValueTotal}>${job.payment.cleanerEarnings.toFixed(2)}</Text>
            </View>
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
            style={[styles.actionButton, styles.startButton]}
            onPress={handleStartJob}
          >
            <Text style={styles.startButtonText}>Start Job</Text>
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
  instructionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
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
  accessInstructions: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
  },
  accessTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  accessText: {
    fontSize: 12,
    color: '#92400E',
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