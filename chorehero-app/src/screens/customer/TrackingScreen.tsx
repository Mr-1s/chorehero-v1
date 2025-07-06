import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TrackingMap } from '../../components/TrackingMap';
import { useLocation } from '../../hooks/useLocation';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { Booking, BookingStatus } from '../../types/booking';
import { Cleaner, Address } from '../../types/user';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../utils/constants';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TrackingScreenProps {
  route: {
    params: {
      bookingId: string;
    };
  };
  navigation: any;
}

export const TrackingScreen: React.FC<TrackingScreenProps> = ({ route, navigation }) => {
  const { bookingId } = route.params;
  const { user } = useAuth();
  
  // State
  const [booking, setBooking] = useState<Booking | null>(null);
  const [cleaner, setCleaner] = useState<Cleaner | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  // Location tracking
  const location = useLocation(bookingId, user?.id, {
    trackingEnabled: true,
    backgroundTracking: false,
    updateInterval: 10000, // 10 seconds
  });

  // Animation values
  const detailsAnimation = useRef(new Animated.Value(0)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  // Load booking details
  const loadBookingDetails = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // Get booking with related data
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          cleaner:cleaner_id(
            *,
            cleaner_profiles(*)
          ),
          address:address_id(*)
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError) throw bookingError;

      if (!bookingData) {
        throw new Error('Booking not found');
      }

      setBooking(bookingData as Booking);
      setCleaner(bookingData.cleaner as Cleaner);
      setAddress(bookingData.address as Address);

    } catch (err) {
      console.error('Error loading booking details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load booking details');
      Alert.alert('Error', 'Failed to load booking details. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [bookingId]);

  // Subscribe to booking status updates
  useEffect(() => {
    const subscription = supabase
      .channel(`booking-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`,
        },
        (payload) => {
          const updatedBooking = payload.new as Booking;
          setBooking(updatedBooking);
          
          // Show status change notification
          if (booking && updatedBooking.status !== booking.status) {
            showStatusNotification(updatedBooking.status);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [bookingId, booking]);

  // Load booking details on mount
  useEffect(() => {
    loadBookingDetails();
  }, [loadBookingDetails]);

  // Animate details panel
  useEffect(() => {
    Animated.timing(detailsAnimation, {
      toValue: showDetails ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showDetails]);

  // Pulse animation for active tracking
  useEffect(() => {
    if (booking?.status === 'cleaner_en_route' || booking?.status === 'in_progress') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [booking?.status]);

  // Show status change notification
  const showStatusNotification = useCallback((status: BookingStatus) => {
    const messages = {
      pending: 'Your booking is pending confirmation',
      confirmed: 'Your booking has been confirmed!',
      cleaner_assigned: 'A cleaner has been assigned to your booking',
      cleaner_en_route: 'Your cleaner is on the way!',
      cleaner_arrived: 'Your cleaner has arrived',
      in_progress: 'Cleaning service has started',
      completed: 'Your cleaning service is complete!',
      cancelled: 'Your booking has been cancelled',
      payment_failed: 'Payment failed. Please update your payment method.',
    };

    const message = messages[status] || 'Booking status updated';
    
    Alert.alert('Status Update', message, [
      { text: 'OK' }
    ]);
  }, []);

  // Handle contact cleaner
  const handleContactCleaner = useCallback(() => {
    if (!cleaner) return;
    
    Alert.alert(
      'Contact Cleaner',
      `Would you like to call or message ${cleaner.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Message', 
          onPress: () => navigation.navigate('ChatScreen', { 
            bookingId,
            cleanerId: cleaner.id 
          })
        },
        { 
          text: 'Call', 
          onPress: () => {
            // In a real app, you'd use Linking.openURL(`tel:${cleaner.phone}`)
            Alert.alert('Call Feature', 'Calling functionality would be implemented here');
          }
        },
      ]
    );
  }, [cleaner, navigation, bookingId]);

  // Handle cancel booking
  const handleCancelBooking = useCallback(() => {
    if (!booking) return;
    
    const canCancel = ['pending', 'confirmed', 'cleaner_assigned'].includes(booking.status);
    
    if (!canCancel) {
      Alert.alert(
        'Cannot Cancel',
        'This booking cannot be cancelled at this time. Please contact support for assistance.'
      );
      return;
    }

    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bookings')
                .update({ status: 'cancelled' })
                .eq('id', bookingId);

              if (error) throw error;

              Alert.alert('Booking Cancelled', 'Your booking has been cancelled successfully.');
              navigation.goBack();
            } catch (err) {
              Alert.alert('Error', 'Failed to cancel booking. Please try again.');
            }
          },
        },
      ]
    );
  }, [booking, bookingId, navigation]);

  // Get status display info
  const getStatusInfo = useCallback(() => {
    if (!booking) return { text: 'Loading...', color: COLORS.text.secondary, icon: 'time' };

    const statusInfo = {
      pending: { text: 'Booking Pending', color: COLORS.warning, icon: 'hourglass' },
      confirmed: { text: 'Booking Confirmed', color: COLORS.success, icon: 'checkmark-circle' },
      cleaner_assigned: { text: 'Cleaner Assigned', color: COLORS.primary, icon: 'person-add' },
      cleaner_en_route: { text: 'Cleaner En Route', color: COLORS.primary, icon: 'car' },
      cleaner_arrived: { text: 'Cleaner Arrived', color: COLORS.success, icon: 'location' },
      in_progress: { text: 'Cleaning in Progress', color: COLORS.primary, icon: 'brush' },
      completed: { text: 'Service Complete', color: COLORS.success, icon: 'checkmark-done' },
      cancelled: { text: 'Booking Cancelled', color: COLORS.error, icon: 'close-circle' },
      payment_failed: { text: 'Payment Failed', color: COLORS.error, icon: 'warning' },
    };

    return statusInfo[booking.status] || statusInfo.pending;
  }, [booking]);

  // Get ETA display
  const getETADisplay = useCallback(() => {
    if (!location.eta) return null;
    
    const eta = new Date(location.eta.arrivalTime);
    const now = new Date();
    const diffMinutes = Math.ceil((eta.getTime() - now.getTime()) / (1000 * 60));
    
    if (diffMinutes <= 0) return 'Arriving now';
    if (diffMinutes < 60) return `${diffMinutes} min`;
    
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${minutes}m`;
  }, [location.eta]);

  const statusInfo = getStatusInfo();
  const cleanerLocation = location.getLatestUserLocation(cleaner?.id || '');
  const etaDisplay = getETADisplay();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Animated.View style={[styles.loadingIndicator, { transform: [{ scale: pulseAnimation }] }]}>
            <Ionicons name="location" size={48} color={COLORS.primary} />
          </Animated.View>
          <Text style={styles.loadingText}>Loading tracking information...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{error || 'Booking not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadBookingDetails()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text.primary} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Track Service</Text>
          <View style={styles.statusContainer}>
            <Ionicons name={statusInfo.icon as any} size={16} color={statusInfo.color} />
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.detailsToggle}
          onPress={() => setShowDetails(!showDetails)}
        >
          <Ionicons 
            name={showDetails ? 'chevron-up' : 'chevron-down'} 
            size={24} 
            color={COLORS.text.primary} 
          />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <TrackingMap
          customerLocation={location.currentLocation ? {
            id: 'customer',
            booking_id: bookingId,
            user_id: user?.id || '',
            latitude: location.currentLocation.coords.latitude,
            longitude: location.currentLocation.coords.longitude,
            accuracy: location.currentLocation.coords.accuracy || 0,
            timestamp: new Date().toISOString(),
          } : null}
          cleanerLocation={cleanerLocation}
          destinationAddress={address!}
          locationHistory={location.locationUpdates}
          showTrail={true}
          showETA={true}
          followUser={booking.status === 'cleaner_en_route'}
          style={styles.map}
        />
        
        {/* ETA Overlay */}
        {etaDisplay && booking.status === 'cleaner_en_route' && (
          <View style={styles.etaOverlay}>
            <LinearGradient
              colors={[COLORS.primary, `${COLORS.primary}DD`]}
              style={styles.etaGradient}
            >
              <Ionicons name="time" size={20} color={COLORS.text.inverse} />
              <Text style={styles.etaText}>ETA: {etaDisplay}</Text>
            </LinearGradient>
          </View>
        )}
      </View>

      {/* Details Panel */}
      <Animated.View
        style={[
          styles.detailsPanel,
          {
            transform: [
              {
                translateY: detailsAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [200, 0],
                }),
              },
            ],
            opacity: detailsAnimation,
          },
        ]}
      >
        <ScrollView
          style={styles.detailsContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadBookingDetails(true)}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Cleaner Info */}
          {cleaner && (
            <View style={styles.cleanerSection}>
              <Text style={styles.sectionTitle}>Your Cleaner</Text>
              <View style={styles.cleanerInfo}>
                <View style={styles.cleanerDetails}>
                  <Text style={styles.cleanerName}>{cleaner.name}</Text>
                  <View style={styles.cleanerRating}>
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text style={styles.ratingText}>
                      {cleaner.rating_average?.toFixed(1) || 'New'} • {cleaner.total_jobs || 0} jobs
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.contactButton} onPress={handleContactCleaner}>
                  <Ionicons name="chatbubble" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Service Details */}
          <View style={styles.serviceSection}>
            <Text style={styles.sectionTitle}>Service Details</Text>
            <View style={styles.serviceInfo}>
              <View style={styles.serviceRow}>
                <Text style={styles.serviceLabel}>Service:</Text>
                <Text style={styles.serviceValue}>{booking.service_type}</Text>
              </View>
              <View style={styles.serviceRow}>
                <Text style={styles.serviceLabel}>Scheduled:</Text>
                <Text style={styles.serviceValue}>
                  {new Date(booking.scheduled_time).toLocaleString()}
                </Text>
              </View>
              <View style={styles.serviceRow}>
                <Text style={styles.serviceLabel}>Duration:</Text>
                <Text style={styles.serviceValue}>{booking.estimated_duration} min</Text>
              </View>
              <View style={styles.serviceRow}>
                <Text style={styles.serviceLabel}>Total:</Text>
                <Text style={styles.servicePriceValue}>${booking.price_breakdown.total}</Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {booking.status !== 'completed' && booking.status !== 'cancelled' && (
              <>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleCancelBooking}>
                  <Text style={styles.secondaryButtonText}>Cancel Booking</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.primaryButton} onPress={handleContactCleaner}>
                  <Text style={styles.primaryButtonText}>Contact Cleaner</Text>
                </TouchableOpacity>
              </>
            )}
            
            {booking.status === 'completed' && (
              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={() => navigation.navigate('RatingScreen', { bookingId })}
              >
                <Text style={styles.primaryButtonText}>Rate Service</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.text.disabled,
  },
  backButton: {
    padding: SPACING.sm,
    marginRight: SPACING.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.text.primary,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: TYPOGRAPHY.weights.medium,
    marginLeft: SPACING.xs,
  },
  detailsToggle: {
    padding: SPACING.sm,
  },
  
  // Map
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  etaOverlay: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.lg,
    right: SPACING.lg,
  },
  etaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  etaText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginLeft: SPACING.sm,
  },
  
  // Details Panel
  detailsPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: screenHeight * 0.6,
    shadowColor: COLORS.text.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  detailsContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  
  // Cleaner Section
  cleanerSection: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  cleanerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  cleanerDetails: {
    flex: 1,
  },
  cleanerName: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  cleanerRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    marginLeft: SPACING.xs,
  },
  contactButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  
  // Service Section
  serviceSection: {
    marginBottom: SPACING.xl,
  },
  serviceInfo: {
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  serviceLabel: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
  },
  serviceValue: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  servicePriceValue: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.weights.bold,
  },
  
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.text.disabled,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
  secondaryButtonText: {
    color: COLORS.text.primary,
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  
  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  loadingIndicator: {
    marginBottom: SPACING.lg,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  
  // Error State
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  errorText: {
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  retryButtonText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
});