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
  Alert,
  ActivityIndicator,
  Linking,
  Animated,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useRoute, RouteProp } from '@react-navigation/native';

const { width } = Dimensions.get('window');

type StackParamList = {
  ActiveJob: { jobId: string };
  ChatScreen: { bookingId: string; otherParticipant: any };
  TrackingScreen: { jobId: string };
  RatingsScreen: { jobId: string; type: 'complete' };
  MainTabs: undefined;
};

type ActiveJobScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'ActiveJob'>;
  route: RouteProp<StackParamList, 'ActiveJob'>;
};

type JobStatus = 'confirmed' | 'on_the_way' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';

interface JobData {
  id: string;
  status: JobStatus;
  customer: {
    id: string;
    name: string;
    avatar: string;
    phone: string;
    rating: number;
    totalBookings: number;
  };
  cleaner: {
    id: string;
    name: string;
    avatar: string;
    phone: string;
    rating: number;
    eta?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  service: {
    type: string;
    title: string;
    duration: number;
    addOns: string[];
  };
  location: {
    address: string;
    instructions?: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  schedule: {
    date: string;
    time: string;
    endTime?: string;
  };
  payment: {
    total: number;
    method: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
  };
  timeline: Array<{
    id: string;
    status: JobStatus;
    timestamp: string;
    description: string;
    completed: boolean;
  }>;
  notes?: string;
  beforePhotos?: string[];
  afterPhotos?: string[];
}

const ActiveJobScreen: React.FC<ActiveJobScreenProps> = ({ navigation, route }) => {
  const { jobId } = route.params;
  
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [userRole, setUserRole] = useState<'customer' | 'cleaner'>('customer');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadJobData();
    
    // Start pulse animation for active status
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, []);

  useEffect(() => {
    if (jobData) {
      const progress = getJobProgress(jobData.status);
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 500,
        useNativeDriver: false,
      }).start();
    }
  }, [jobData?.status]);

  const loadJobData = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockJobData: JobData = {
        id: jobId,
        status: 'in_progress',
        customer: {
          id: 'cust1',
          name: 'Sarah Johnson',
          avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
          phone: '+1 (555) 123-4567',
          rating: 4.9,
          totalBookings: 23,
        },
        cleaner: {
          id: 'clean1',
          name: 'Maria Garcia',
          avatar: 'https://randomuser.me/api/portraits/women/32.jpg',
          phone: '+1 (555) 987-6543',
          rating: 4.8,
          eta: '2:30 PM',
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
          },
        },
        service: {
          type: 'standard',
          title: 'Standard Clean',
          duration: 120,
          addOns: ['Inside Fridge', 'Laundry Service'],
        },
        location: {
          address: '456 Oak Ave, San Francisco, CA 94102',
          instructions: 'Blue door, ring doorbell twice. Dog is friendly.',
          coordinates: {
            latitude: 37.7849,
            longitude: -122.4094,
          },
        },
        schedule: {
          date: 'Today',
          time: '2:00 PM',
          endTime: '4:00 PM',
        },
        payment: {
          total: 102.00,
          method: 'Visa •••• 4242',
          status: 'pending',
        },
        timeline: [
          {
            id: '1',
            status: 'confirmed',
            timestamp: '1:45 PM',
            description: 'Booking confirmed',
            completed: true,
          },
          {
            id: '2',
            status: 'on_the_way',
            timestamp: '2:00 PM',
            description: 'Cleaner is on the way',
            completed: true,
          },
          {
            id: '3',
            status: 'arrived',
            timestamp: '2:15 PM',
            description: 'Cleaner has arrived',
            completed: true,
          },
          {
            id: '4',
            status: 'in_progress',
            timestamp: '2:20 PM',
            description: 'Cleaning in progress',
            completed: true,
          },
          {
            id: '5',
            status: 'completed',
            timestamp: '',
            description: 'Service completed',
            completed: false,
          },
        ],
        notes: 'Customer requested extra attention to kitchen area.',
      };

      setJobData(mockJobData);
      // Determine user role (would come from auth context in real app)
      setUserRole('customer');
    } catch (error) {
      Alert.alert('Error', 'Failed to load job details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadJobData();
    setRefreshing(false);
  };

  const getJobProgress = (status: JobStatus): number => {
    switch (status) {
      case 'confirmed': return 0.2;
      case 'on_the_way': return 0.4;
      case 'arrived': return 0.6;
      case 'in_progress': return 0.8;
      case 'completed': return 1.0;
      default: return 0;
    }
  };

  const getStatusColor = (status: JobStatus): string => {
    switch (status) {
      case 'confirmed': return '#3B82F6';
      case 'on_the_way': return '#F59E0B';
      case 'arrived': return '#8B5CF6';
      case 'in_progress': return '#00BFA6';
      case 'completed': return '#059669';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: JobStatus): string => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'on_the_way': return 'On the Way';
      case 'arrived': return 'Arrived';
      case 'in_progress': return 'Cleaning in Progress';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  const handleStatusUpdate = async (newStatus: JobStatus) => {
    if (!jobData) return;
    
    setActionLoading(newStatus);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const updatedTimeline = jobData.timeline.map(item => 
        item.status === newStatus ? { ...item, completed: true, timestamp: new Date().toLocaleTimeString() } : item
      );
      
      setJobData({
        ...jobData,
        status: newStatus,
        timeline: updatedTimeline,
      });
      
      Alert.alert('Status Updated', `Job status updated to: ${getStatusText(newStatus)}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteJob = () => {
    Alert.alert(
      'Complete Job',
      'Are you sure you want to mark this job as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () => {
            handleStatusUpdate('completed');
            setTimeout(() => {
              navigation.navigate('RatingsScreen', { jobId, type: 'complete' });
            }, 2000);
          },
        },
      ]
    );
  };

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleChat = () => {
    if (!jobData) return;
    
    const otherParticipant = userRole === 'customer' ? jobData.cleaner : jobData.customer;
    navigation.navigate('ChatScreen', {
      bookingId: jobId,
      otherParticipant: {
        id: otherParticipant.id,
        name: otherParticipant.name,
        avatar_url: otherParticipant.avatar,
        role: userRole === 'customer' ? 'cleaner' : 'customer',
      },
    });
  };

  const handleTrackLocation = () => {
    navigation.navigate('TrackingScreen', { jobId });
  };

  const renderProgressBar = () => {
    if (!jobData) return null;

    const progress = getJobProgress(jobData.status);
    
    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View 
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: getStatusColor(jobData.status),
              }
            ]}
          />
        </View>
        <View style={styles.progressSteps}>
          {jobData.timeline.map((step, index) => (
            <View
              key={step.id}
              style={[
                styles.progressStep,
                {
                  backgroundColor: step.completed ? getStatusColor(step.status) : '#E5E7EB',
                }
              ]}
            >
              <Ionicons 
                name={step.completed ? 'checkmark' : 'ellipse'} 
                size={12} 
                color="#FFFFFF" 
              />
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderStatusCard = () => {
    if (!jobData) return null;

    return (
      <View style={styles.statusCard}>
        <LinearGradient
          colors={[getStatusColor(jobData.status), `${getStatusColor(jobData.status)}CC`]}
          style={styles.statusGradient}
        >
          <Animated.View style={[styles.statusContent, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons 
              name={
                jobData.status === 'confirmed' ? 'checkmark-circle' :
                jobData.status === 'on_the_way' ? 'car' :
                jobData.status === 'arrived' ? 'location' :
                jobData.status === 'in_progress' ? 'time' :
                'checkmark-done-circle'
              } 
              size={32} 
              color="#FFFFFF" 
            />
            <Text style={styles.statusTitle}>{getStatusText(jobData.status)}</Text>
            {jobData.status === 'in_progress' && (
              <Text style={styles.statusSubtitle}>Estimated completion: {jobData.schedule.endTime}</Text>
            )}
          </Animated.View>
        </LinearGradient>
      </View>
    );
  };

  const renderParticipantCard = (participant: any, role: string) => (
    <View style={styles.participantCard}>
      <Image source={{ uri: participant.avatar }} style={styles.participantAvatar} />
      <View style={styles.participantInfo}>
        <Text style={styles.participantName}>{participant.name}</Text>
        <Text style={styles.participantRole}>{role}</Text>
        <View style={styles.participantStats}>
          <Ionicons name="star" size={12} color="#F59E0B" />
          <Text style={styles.participantRating}>{participant.rating}</Text>
          <Text style={styles.participantBookings}>• {participant.totalBookings} jobs</Text>
        </View>
      </View>
      <View style={styles.participantActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleCall(participant.phone)}
        >
          <Ionicons name="call" size={16} color="#00BFA6" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleChat}
        >
          <Ionicons name="chatbubble" size={16} color="#00BFA6" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTimeline = () => {
    if (!jobData) return null;

    return (
      <View style={styles.timelineContainer}>
        <Text style={styles.sectionTitle}>Timeline</Text>
        {jobData.timeline.map((item, index) => (
          <View key={item.id} style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
              <View style={[
                styles.timelineIcon,
                { backgroundColor: item.completed ? getStatusColor(item.status) : '#E5E7EB' }
              ]}>
                <Ionicons 
                  name={item.completed ? 'checkmark' : 'ellipse'} 
                  size={12} 
                  color="#FFFFFF" 
                />
              </View>
              {index < jobData.timeline.length - 1 && (
                <View style={[
                  styles.timelineLine,
                  { backgroundColor: item.completed ? getStatusColor(item.status) : '#E5E7EB' }
                ]} />
              )}
            </View>
            <View style={styles.timelineContent}>
              <Text style={[
                styles.timelineDescription,
                { color: item.completed ? '#1F2937' : '#9CA3AF' }
              ]}>
                {item.description}
              </Text>
              {item.timestamp && (
                <Text style={styles.timelineTimestamp}>{item.timestamp}</Text>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderJobDetails = () => {
    if (!jobData) return null;

    return (
      <View style={styles.detailsContainer}>
        <Text style={styles.sectionTitle}>Job Details</Text>
        
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Service</Text>
            <Text style={styles.detailValue}>{jobData.service.title}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Duration</Text>
            <Text style={styles.detailValue}>{jobData.service.duration} minutes</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Add-ons</Text>
            <Text style={styles.detailValue}>
              {jobData.service.addOns.length > 0 ? jobData.service.addOns.join(', ') : 'None'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Address</Text>
            <Text style={styles.detailValue}>{jobData.location.address}</Text>
          </View>
          {jobData.location.instructions && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Instructions</Text>
              <Text style={styles.detailValue}>{jobData.location.instructions}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment</Text>
            <Text style={styles.detailValue}>${jobData.payment.total.toFixed(2)} • {jobData.payment.method}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderActionButtons = () => {
    if (!jobData) return null;

    const isCustomer = userRole === 'customer';
    const isCleaner = userRole === 'cleaner';

    return (
      <View style={styles.actionButtonsContainer}>
        {jobData.status !== 'completed' && (
          <TouchableOpacity 
            style={styles.primaryAction}
            onPress={handleTrackLocation}
          >
            <Ionicons name="location" size={20} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>
              {isCustomer ? 'Track Cleaner' : 'Open Maps'}
            </Text>
          </TouchableOpacity>
        )}

        {isCleaner && jobData.status === 'confirmed' && (
          <TouchableOpacity 
            style={styles.secondaryAction}
            onPress={() => handleStatusUpdate('on_the_way')}
            disabled={actionLoading === 'on_the_way'}
          >
            {actionLoading === 'on_the_way' ? (
              <ActivityIndicator color="#00BFA6" />
            ) : (
              <>
                <Ionicons name="car" size={16} color="#00BFA6" />
                <Text style={styles.secondaryActionText}>Start Journey</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isCleaner && jobData.status === 'on_the_way' && (
          <TouchableOpacity 
            style={styles.secondaryAction}
            onPress={() => handleStatusUpdate('arrived')}
            disabled={actionLoading === 'arrived'}
          >
            {actionLoading === 'arrived' ? (
              <ActivityIndicator color="#00BFA6" />
            ) : (
              <>
                <Ionicons name="location" size={16} color="#00BFA6" />
                <Text style={styles.secondaryActionText}>Mark Arrived</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isCleaner && jobData.status === 'arrived' && (
          <TouchableOpacity 
            style={styles.secondaryAction}
            onPress={() => handleStatusUpdate('in_progress')}
            disabled={actionLoading === 'in_progress'}
          >
            {actionLoading === 'in_progress' ? (
              <ActivityIndicator color="#00BFA6" />
            ) : (
              <>
                <Ionicons name="play" size={16} color="#00BFA6" />
                <Text style={styles.secondaryActionText}>Start Cleaning</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isCleaner && jobData.status === 'in_progress' && (
          <TouchableOpacity 
            style={styles.primaryAction}
            onPress={handleCompleteJob}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.primaryActionText}>Complete Job</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00BFA6" />
          <Text style={styles.loadingText}>Loading job details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!jobData) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.errorText}>Job not found</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>Job #{jobId.slice(-6)}</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('MainTabs')}>
          <Ionicons name="home-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderProgressBar()}
        {renderStatusCard()}

        {/* Participants */}
        <View style={styles.participantsContainer}>
          {renderParticipantCard(jobData.customer, 'Customer')}
          {renderParticipantCard(jobData.cleaner, 'Cleaner')}
        </View>

        {renderTimeline()}
        {renderJobDetails()}
        {renderActionButtons()}
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#00BFA6',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  progressContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressStep: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  statusGradient: {
    padding: 24,
    alignItems: 'center',
  },
  statusContent: {
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  participantsContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  participantAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  participantRole: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  participantStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantRating: {
    fontSize: 12,
    color: '#F59E0B',
    marginLeft: 4,
  },
  participantBookings: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  participantActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  timelineContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    height: 32,
    marginTop: 8,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 2,
  },
  timelineDescription: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  timelineTimestamp: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  detailsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    flex: 2,
    textAlign: 'right',
  },
  actionButtonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00BFA6',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    shadowColor: '#00BFA6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#00BFA6',
  },
  secondaryActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00BFA6',
  },
});

export default ActiveJobScreen; 