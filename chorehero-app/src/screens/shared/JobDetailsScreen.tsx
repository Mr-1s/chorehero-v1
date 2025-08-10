import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadJobDetails();
  }, [jobId]);

  const loadJobDetails = async () => {
    try {
      // In a real app, this would fetch from the database
      // For now, we'll use mock data
      const mockJob: JobDetails = {
        id: jobId,
        status: 'pending',
        customer: {
          id: 'customer-1',
          name: 'Sarah Johnson',
          avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b47c?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80',
          phone: '+1 (555) 123-4567',
          rating: 4.8,
          totalBookings: 23,
        },
        service: {
          type: 'standard',
          title: 'Standard Clean',
          addOns: ['Inside Fridge', 'Laundry'],
          specialInstructions: 'Please focus on the kitchen and bathrooms. The living room just needs light dusting.',
        },
        location: {
          address: '456 Oak Ave, San Francisco, CA 94102',
          coordinates: {
            latitude: 37.7749,
            longitude: -122.4194,
          },
          accessInstructions: 'Apartment 4B. Buzzer code is 1234. Key is under the mat.',
        },
        schedule: {
          date: 'Today',
          time: '2:00 PM',
          duration: 120,
          estimatedCompletion: '4:00 PM',
        },
        payment: {
          total: 102.00,
          cleanerEarnings: 71.40,
          platformFee: 10.20,
          paymentMethod: 'Credit Card ending in 4242',
        },
        createdAt: '2024-01-20T10:30:00Z',
      };

      setJob(mockJob);
    } catch (error) {
      console.error('Error loading job details:', error);
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setLoading(false);
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
              // In a real app, this would call the booking service
              await new Promise(resolve => setTimeout(resolve, 1000));
              
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
              // In a real app, this would call the booking service
              await new Promise(resolve => setTimeout(resolve, 1000));
              
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

  const handleStartJob = () => {
    if (!job) return;
    
    setJob(prev => prev ? { ...prev, status: 'in_progress' } : null);
    Alert.alert('Job Started', 'You have marked this job as in progress.');
  };

  const handleCompleteJob = () => {
    if (!job) return;
    
    setJob(prev => prev ? { 
      ...prev, 
      status: 'completed', 
      completedAt: new Date().toISOString() 
    } : null);
    Alert.alert('Job Completed', 'You have marked this job as completed!');
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
          onPress: () => navigation.navigate('ChatScreen', {
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
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'accepted': return '#3B82F6';
      case 'in_progress': return '#8B5CF6';
      case 'completed': return '#10B981';
      case 'cancelled': return '#EF4444';
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
          <ActivityIndicator size="large" color="#3ad3db" />
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
        <Text style={styles.headerTitle}>Job #{job.id.slice(-6)}</Text>
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
              <Ionicons name="chatbubble-outline" size={20} color="#3ad3db" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Service Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Details</Text>
          <View style={styles.detailsCard}>
            <Text style={styles.serviceTitle}>{job.service.title}</Text>
            
            {job.service.addOns.length > 0 && (
              <View style={styles.addOnsContainer}>
                <Text style={styles.addOnsTitle}>Add-ons:</Text>
                {job.service.addOns.map((addOn, index) => (
                  <View key={index} style={styles.addOnItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
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
                <Ionicons name="calendar-outline" size={20} color="#3ad3db" />
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleLabel}>Date & Time</Text>
                  <Text style={styles.scheduleValue}>{job.schedule.date} at {job.schedule.time}</Text>
                </View>
              </View>
              
              <View style={styles.scheduleItem}>
                <Ionicons name="time-outline" size={20} color="#3ad3db" />
                <View style={styles.scheduleInfo}>
                  <Text style={styles.scheduleLabel}>Duration</Text>
                  <Text style={styles.scheduleValue}>{job.schedule.duration} min</Text>
                </View>
              </View>
            </View>

            <View style={styles.locationContainer}>
              <View style={styles.locationHeader}>
                <Ionicons name="location-outline" size={20} color="#3ad3db" />
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
    borderBottomColor: '#E5E7EB',
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
    backgroundColor: '#3ad3db',
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
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
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
    backgroundColor: '#F0F9FF',
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
    backgroundColor: '#3ad3db',
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
    color: '#10B981',
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
    backgroundColor: '#3ad3db',
    marginLeft: 8,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: '#3B82F6',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  completeButton: {
    backgroundColor: '#10B981',
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