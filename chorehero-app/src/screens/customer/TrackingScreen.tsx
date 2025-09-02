import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { EmptyState, EmptyStateConfigs } from '../../components/EmptyState';
import { COLORS } from '../../utils/constants';


interface TrackingData {
  id: string;
  cleaner_name: string;
  service_type: string;
  status: 'scheduled' | 'en_route' | 'arrived' | 'in_progress' | 'completed';
  scheduled_time: string;
  estimated_completion: string;
  location: string;
}

const TrackingScreen: React.FC = () => {
  const { user } = useAuth();
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrackingData();
  }, []);

  const loadTrackingData = async () => {
    try {
      setIsLoading(true);

      // Use mock data toggle to determine if we should show tracking data
      const mockTrackingData: TrackingData = {
        id: 'tracking-1',
        cleaner_name: 'Sarah Johnson',
        service_type: 'Deep Clean',
        status: 'in_progress',
        scheduled_time: 'Today 2:00 PM',
        estimated_completion: 'Today 5:00 PM',
        location: '123 Main St, San Francisco'
      };

      const trackingInfo = MockDataToggle.getFeatureData(
        'CUSTOMER',
        'TRACKING',
        mockTrackingData,
        null
      );

      setTrackingData(trackingInfo);
    } catch (error) {
      console.error('Tracking load error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return COLORS.warning;
      case 'en_route': return COLORS.info;
      case 'arrived': return COLORS.primary;
      case 'in_progress': return COLORS.success;
      case 'completed': return COLORS.success;
      default: return COLORS.text.secondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Scheduled';
      case 'en_route': return 'Cleaner En Route';
      case 'arrived': return 'Cleaner Arrived';
      case 'in_progress': return 'Cleaning In Progress';
      case 'completed': return 'Completed';
      default: return 'Unknown';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return 'calendar-outline';
      case 'en_route': return 'car-outline';
      case 'arrived': return 'location-outline';
      case 'in_progress': return 'checkmark-circle-outline';
      case 'completed': return 'checkmark-done-outline';
      default: return 'help-outline';
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading tracking information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Track Service</Text>
        <TouchableOpacity>
          <Ionicons name="refresh" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {trackingData ? (
          <View style={styles.content}>
            {/* Status Card */}
            <View style={styles.statusCard}>
              <LinearGradient
                colors={[getStatusColor(trackingData.status), getStatusColor(trackingData.status) + '80']}
                style={styles.statusGradient}
              >
                <View style={styles.statusHeader}>
                  <Ionicons 
                    name={getStatusIcon(trackingData.status) as any} 
                    size={32} 
                    color={COLORS.text.inverse} 
                  />
                  <Text style={styles.statusText}>{getStatusText(trackingData.status)}</Text>
                </View>
              </LinearGradient>
            </View>

            {/* Service Details */}
            <View style={styles.detailsCard}>
              <Text style={styles.cardTitle}>Service Details</Text>
              
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={20} color={COLORS.text.secondary} />
                <Text style={styles.detailLabel}>Cleaner</Text>
                <Text style={styles.detailValue}>{trackingData.cleaner_name}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="build-outline" size={20} color={COLORS.text.secondary} />
                <Text style={styles.detailLabel}>Service</Text>
                <Text style={styles.detailValue}>{trackingData.service_type}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={20} color={COLORS.text.secondary} />
                <Text style={styles.detailLabel}>Location</Text>
                <Text style={styles.detailValue}>{trackingData.location}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={20} color={COLORS.text.secondary} />
                <Text style={styles.detailLabel}>Scheduled</Text>
                <Text style={styles.detailValue}>{trackingData.scheduled_time}</Text>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="alarm-outline" size={20} color={COLORS.text.secondary} />
                <Text style={styles.detailLabel}>Estimated Completion</Text>
                <Text style={styles.detailValue}>{trackingData.estimated_completion}</Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsCard}>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="call-outline" size={20} color={COLORS.primary} />
                <Text style={styles.actionButtonText}>Call Cleaner</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="chatbubble-outline" size={20} color={COLORS.primary} />
                <Text style={styles.actionButtonText}>Message</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="map-outline" size={20} color={COLORS.primary} />
                <Text style={styles.actionButtonText}>View Map</Text>
              </TouchableOpacity>
            </View>

            {/* Progress Timeline */}
            <View style={styles.timelineCard}>
              <Text style={styles.cardTitle}>Progress</Text>
              
              {[
                { key: 'scheduled', label: 'Service Scheduled', time: trackingData.scheduled_time },
                { key: 'en_route', label: 'Cleaner En Route', time: '2:15 PM' },
                { key: 'arrived', label: 'Cleaner Arrived', time: '2:30 PM' },
                { key: 'in_progress', label: 'Cleaning Started', time: '2:35 PM' },
                { key: 'completed', label: 'Service Completed', time: 'Estimated 5:00 PM' }
              ].map((step, index) => {
                const isCompleted = ['scheduled', 'en_route', 'arrived'].includes(step.key) && 
                                   ['arrived', 'in_progress', 'completed'].includes(trackingData.status);
                const isCurrent = step.key === trackingData.status;
                
                return (
                  <View key={step.key} style={styles.timelineStep}>
                    <View style={[
                      styles.timelineMarker,
                      isCompleted && styles.timelineMarkerCompleted,
                      isCurrent && styles.timelineMarkerCurrent
                    ]}>
                      <Ionicons 
                        name={isCompleted ? "checkmark" : "ellipse-outline"} 
                        size={16} 
                        color={isCompleted || isCurrent ? COLORS.text.inverse : COLORS.text.secondary} 
                      />
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={[
                        styles.timelineLabel,
                        (isCompleted || isCurrent) && styles.timelineLabelActive
                      ]}>
                        {step.label}
                      </Text>
                      <Text style={styles.timelineTime}>{step.time}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <EmptyState
              {...EmptyStateConfigs.customerBookings}
              title="No Active Service"
              subtitle="You don't have any active cleaning services to track. Book a service to see real-time tracking."
              actions={[
                { 
                  label: 'Find Cleaners', 
                  onPress: () => {}, 
                  icon: 'search' 
                }
              ]}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  
  // Status Card
  statusCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  statusGradient: {
    padding: 20,
    alignItems: 'center',
  },
  statusHeader: {
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.inverse,
    textAlign: 'center',
  },

  // Details Card
  detailsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.primary,
    flex: 2,
    textAlign: 'right',
  },

  // Actions Card
  actionsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
  },

  // Timeline Card
  timelineCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  timelineMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineMarkerCompleted: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  timelineMarkerCurrent: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  timelineLabelActive: {
    color: COLORS.text.primary,
    fontWeight: '600',
  },
  timelineTime: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },

  // Loading and Empty States
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 40,
  },
});

export default TrackingScreen;