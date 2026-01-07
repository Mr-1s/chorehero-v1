import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useToast } from '../../components/Toast';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';

interface ScheduleScreenProps {
  navigation: StackNavigationProp<any>;
}

interface AvailabilitySlot {
  day: string;
  available: boolean;
  startTime: string;
  endTime: string;
}

interface Booking {
  id: string;
  customerName: string;
  address: string;
  serviceType: string;
  time: string;
  duration: string;
  amount: number;
  status: 'confirmed' | 'pending' | 'in_progress' | 'completed';
}

const ScheduleScreen: React.FC<ScheduleScreenProps> = ({ navigation }) => {
  const { showToast } = useToast();
  const [selectedTab, setSelectedTab] = useState<'availability' | 'bookings'>('bookings');
  
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([
    { day: 'Monday', available: true, startTime: '08:00', endTime: '18:00' },
    { day: 'Tuesday', available: true, startTime: '08:00', endTime: '18:00' },
    { day: 'Wednesday', available: true, startTime: '08:00', endTime: '18:00' },
    { day: 'Thursday', available: true, startTime: '08:00', endTime: '18:00' },
    { day: 'Friday', available: true, startTime: '08:00', endTime: '18:00' },
    { day: 'Saturday', available: false, startTime: '09:00', endTime: '15:00' },
    { day: 'Sunday', available: false, startTime: '09:00', endTime: '15:00' },
  ]);

  const upcomingBookings: Booking[] = [
    {
      id: '1',
      customerName: 'Sarah Chen',
      address: '123 Marina Bay, Singapore',
      serviceType: 'Deep Clean',
      time: 'Today, 2:00 PM',
      duration: '3 hours',
      amount: 150,
      status: 'confirmed',
    },
    {
      id: '2',
      customerName: 'David Lim',
      address: '456 Orchard Road, Singapore',
      serviceType: 'Standard Clean',
      time: 'Tomorrow, 10:00 AM',
      duration: '1.5 hours',
      amount: 75,
      status: 'confirmed',
    },
    {
      id: '3',
      customerName: 'Maria Santos',
      address: '789 Sentosa Cove, Singapore',
      serviceType: 'Express Clean',
      time: 'Wed, 4:00 PM',
      duration: '45 minutes',
      amount: 45,
      status: 'pending',
    },
  ];

  const toggleAvailability = (index: number) => {
    const updated = [...availability];
    updated[index].available = !updated[index].available;
    setAvailability(updated);
  };

  const handleBookingAction = (bookingId: string, action: 'accept' | 'decline') => {
    Alert.alert(
      action === 'accept' ? 'Accept Booking' : 'Decline Booking',
      `Are you sure you want to ${action} this booking?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: action === 'accept' ? 'Accept' : 'Decline',
          onPress: () => {
            // Handle booking action
            console.log(`${action} booking ${bookingId}`);
            try {
              (showToast as any) && showToast({ type: action === 'accept' ? 'success' : 'info', message: action === 'accept' ? 'Booking accepted' : 'Booking declined' });
            } catch {}
          }
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#F59E0B';
      case 'pending': return '#FFD93D';
      case 'in_progress': return '#F59E0B';
      case 'completed': return '#96CEB4';
      default: return '#718096';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'pending': return 'Pending';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      default: return 'Unknown';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Schedule</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Ionicons name="settings" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'bookings' && styles.activeTab]}
          onPress={() => setSelectedTab('bookings')}
        >
          <Text style={[styles.tabText, selectedTab === 'bookings' && styles.activeTabText]}>
            Upcoming Bookings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'availability' && styles.activeTab]}
          onPress={() => setSelectedTab('availability')}
        >
          <Text style={[styles.tabText, selectedTab === 'availability' && styles.activeTabText]}>
            Availability
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {selectedTab === 'bookings' ? (
          <View style={styles.bookingsContainer}>
            {/* Today's Summary */}
            <View style={styles.summaryCard}>
              <LinearGradient
                colors={['#F59E0B', '#F59E0B']}
                style={styles.summaryGradient}
              >
                <View style={styles.summaryHeader}>
                  <Text style={styles.summaryTitle}>Today's Schedule</Text>
                  <Ionicons name="calendar" size={24} color="#ffffff" />
                </View>
                <Text style={styles.summaryStats}>2 bookings • $225 potential</Text>
              </LinearGradient>
            </View>

            {/* Bookings List */}
            <View style={styles.bookingsSection}>
              <Text style={styles.sectionTitle}>Upcoming Jobs</Text>
              
              {upcomingBookings.map((booking) => (
                <View key={booking.id} style={styles.bookingCard}>
                  <View style={styles.bookingHeader}>
                    <View style={styles.bookingInfo}>
                      <Text style={styles.customerName}>{booking.customerName}</Text>
                      <Text style={styles.serviceType}>{booking.serviceType}</Text>
                    </View>
                    <View style={styles.bookingAmount}>
                      <Text style={styles.amountText}>${booking.amount}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
                        <Text style={styles.statusText}>{getStatusText(booking.status)}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.bookingDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="time" size={16} color="#718096" />
                      <Text style={styles.detailText}>{booking.time} • {booking.duration}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="location" size={16} color="#718096" />
                      <Text style={styles.detailText}>{booking.address}</Text>
                    </View>
                  </View>

                  {booking.status === 'pending' && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.declineButton]}
                        onPress={() => handleBookingAction(booking.id, 'decline')}
                      >
                        <Text style={styles.declineButtonText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.acceptButton]}
                        onPress={() => handleBookingAction(booking.id, 'accept')}
                      >
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {booking.status === 'confirmed' && (
                    <TouchableOpacity style={styles.navigateButton}>
                      <Ionicons name="navigation" size={16} color="#F59E0B" />
                      <Text style={styles.navigateText}>Start Navigation</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.availabilityContainer}>
            {/* Quick Toggle */}
            <View style={styles.quickToggleCard}>
              <Text style={styles.quickToggleTitle}>Quick Status</Text>
              <TouchableOpacity style={styles.availableToggle}>
                <View style={styles.toggleIndicator} />
                <Text style={styles.toggleText}>Available Now</Text>
              </TouchableOpacity>
            </View>

            {/* Weekly Schedule */}
            <View style={styles.scheduleSection}>
              <Text style={styles.sectionTitle}>Weekly Availability</Text>
              
              {availability.map((slot, index) => (
                <View key={slot.day} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayName}>{slot.day}</Text>
                    <TouchableOpacity
                      style={[styles.availabilityToggle, slot.available && styles.availabilityToggleActive]}
                      onPress={() => toggleAvailability(index)}
                    >
                      <View style={[styles.toggleKnob, slot.available && styles.toggleKnobActive]} />
                    </TouchableOpacity>
                  </View>
                  
                  {slot.available && (
                    <View style={styles.timeSlots}>
                      <View style={styles.timeSlot}>
                        <Text style={styles.timeLabel}>Start</Text>
                        <TouchableOpacity style={styles.timeButton}>
                          <Text style={styles.timeText}>{slot.startTime}</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.timeSlot}>
                        <Text style={styles.timeLabel}>End</Text>
                        <TouchableOpacity style={styles.timeButton}>
                          <Text style={styles.timeText}>{slot.endTime}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* Save Changes */}
            <TouchableOpacity style={styles.saveButton}>
              <LinearGradient
                colors={['#F59E0B', '#F59E0B']}
                style={styles.saveGradient}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#F59E0B',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#718096',
  },
  activeTabText: {
    color: '#ffffff',
  },
  bookingsContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  summaryCard: {
    marginBottom: 24,
  },
  summaryGradient: {
    borderRadius: 16,
    padding: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  summaryStats: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  bookingsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 16,
  },
  bookingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bookingInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
  },
  serviceType: {
    fontSize: 14,
    color: '#718096',
  },
  bookingAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4ECDC4',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  bookingDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#718096',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  declineButton: {
    backgroundColor: '#f1f5f9',
  },
  acceptButton: {
    backgroundColor: '#4ECDC4',
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#718096',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 8,
  },
  navigateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
    marginLeft: 8,
  },
  availabilityContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  quickToggleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  quickToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  availableToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ECDC4',
    marginRight: 8,
  },
  toggleText: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  scheduleSection: {
    marginBottom: 20,
  },
  dayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  availabilityToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  availabilityToggleActive: {
    backgroundColor: '#4ECDC4',
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  timeSlots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeSlot: {
    flex: 1,
    marginHorizontal: 6,
  },
  timeLabel: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 8,
  },
  timeButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
  },
  saveButton: {
    marginTop: 20,
    marginBottom: 20,
  },
  saveGradient: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  bottomSpacing: {
    height: 100,
  },
});

export default ScheduleScreen; 