import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { COLORS, TYPOGRAPHY, SPACING } from '../../utils/constants';
import { supabase } from '../../services/supabase';

type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  IndividualChat: { cleanerId: string; bookingId: string };
};

type LiveTrackingNavigationProp = BottomTabNavigationProp<TabParamList, any>;

interface LiveTrackingProps {
  navigation: LiveTrackingNavigationProp;
  route: {
    params: {
      bookingId: string;
    };
  };
}

const { width, height } = Dimensions.get('window');

const LiveTrackingScreen: React.FC<LiveTrackingProps> = ({ navigation, route }) => {
  const { bookingId } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [cleaner, setCleaner] = useState<any>(null);
  const [eta, setETA] = useState(18); // minutes
  const [cleanerLocation, setCleanerLocation] = useState({
    latitude: 37.7849,
    longitude: -122.4094,
  });
  const [customerLocation, setCustomerLocation] = useState({
    latitude: 37.7949,
    longitude: -122.4194,
  });
  const [bookingStatus, setBookingStatus] = useState<string>('confirmed');

  const cardSlideAnim = useRef(new Animated.Value(300)).current;
  const etaUpdateAnim = useRef(new Animated.Value(1)).current;

  // Fetch real booking and cleaner data
  useEffect(() => {
    const loadBookingData = async () => {
      try {
        setLoading(true);
        console.log('📍 Loading booking data for:', bookingId);

        // Fetch booking with cleaner data
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .select(`
            *,
            cleaner:users!bookings_cleaner_id_fkey(
              id,
              name,
              avatar_url,
              phone
            )
          `)
          .eq('id', bookingId)
          .single();

        if (bookingError) {
          console.error('❌ Error fetching booking:', bookingError);
          setBooking(null);
          setCleaner(null);
        } else if (bookingData) {
          setBooking(bookingData);
          setBookingStatus(bookingData.status);
          
          // Fetch cleaner profile separately
          const { data: profileData } = await supabase
            .from('cleaner_profiles')
            .select('rating_average')
            .eq('user_id', bookingData.cleaner_id)
            .maybeSingle();
          
          setCleaner({
            id: bookingData.cleaner?.id,
            name: bookingData.cleaner?.name || 'Your Cleaner',
            avatar: bookingData.cleaner?.avatar_url,
            rating: profileData?.rating_average || 0,
            status: getStatusLabel(bookingData.status),
            phone: bookingData.cleaner?.phone,
          });
        }
      } catch (error) {
        console.error('❌ Error loading booking:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBookingData();

    // Subscribe to booking status updates
    const subscription = supabase
      .channel(`booking-${bookingId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `id=eq.${bookingId}`,
      }, (payload) => {
        console.log('📍 Booking updated:', payload.new);
        setBookingStatus(payload.new.status);
        setCleaner(prev => prev ? { ...prev, status: getStatusLabel(payload.new.status) } : null);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [bookingId]);

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'cleaner_en_route': return 'On the way';
      case 'cleaner_arrived': return 'Arrived';
      case 'in_progress': return 'Cleaning';
      case 'completed': return 'Completed';
      default: return 'Pending';
    }
  };

  useEffect(() => {
    if (loading) return;

    // Slide in the floating card
    Animated.timing(cardSlideAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // ETA updates (in production, this would come from real location data)
    const etaInterval = setInterval(() => {
      setETA(prev => {
        if (prev > 1 && bookingStatus === 'cleaner_en_route') {
          Animated.sequence([
            Animated.timing(etaUpdateAnim, {
              toValue: 1.1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(etaUpdateAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start();
          return prev - 1;
        }
        return prev;
      });
    }, 60000);

    // Note: In production, cleaner location would come from real-time GPS tracking
    // For now, simulate movement when en route
    const locationInterval = setInterval(() => {
      if (bookingStatus === 'cleaner_en_route') {
        setCleanerLocation(prev => ({
          latitude: prev.latitude + (customerLocation.latitude - prev.latitude) * 0.02,
          longitude: prev.longitude + (customerLocation.longitude - prev.longitude) * 0.02,
        }));
      }
    }, 5000);

    return () => {
      clearInterval(etaInterval);
      clearInterval(locationInterval);
    };
  }, [loading, bookingStatus]);

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleMessageCleaner = () => {
    if (cleaner?.id) {
      navigation.navigate('IndividualChat', { 
        cleanerId: cleaner.id, 
        bookingId 
      });
    }
  };

  const handleCallCleaner = () => {
    if (cleaner?.phone) {
      Linking.openURL(`tel:${cleaner.phone}`);
    } else {
      console.log('No phone number available');
    }
  };

  const mapRegion = {
    latitude: (cleanerLocation.latitude + customerLocation.latitude) / 2,
    longitude: (cleanerLocation.longitude + customerLocation.longitude) / 2,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  // Show loading state
  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 16, color: COLORS.textGray }}>Loading tracking info...</Text>
      </View>
    );
  }

  // Show error if no cleaner data
  if (!cleaner) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 20 }]}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.textGray} />
        <Text style={{ marginTop: 16, color: COLORS.textGray, fontSize: 18, textAlign: 'center' }}>
          Unable to load booking details
        </Text>
        <TouchableOpacity onPress={handleBackPress} style={{ marginTop: 20, padding: 16, backgroundColor: COLORS.primary, borderRadius: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Full-screen Map */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={mapRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        mapType="standard"
      >
        {/* Cleaner Marker */}
        <Marker
          coordinate={cleanerLocation}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.cleanerMarker}>
            <LinearGradient
              colors={[COLORS.primary, '#E97E0B']}
              style={styles.markerGradient}
            >
              <Ionicons name="car" size={20} color={COLORS.text.inverse} />
            </LinearGradient>
          </View>
        </Marker>

        {/* Customer Location Marker */}
        <Marker
          coordinate={customerLocation}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.customerMarker}>
            <Ionicons name="home" size={24} color={COLORS.success} />
          </View>
        </Marker>
      </MapView>

      {/* ETA Header */}
      <SafeAreaView style={styles.headerContainer}>
        <BlurView intensity={80} style={styles.headerBlur}>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text.primary} />
            </TouchableOpacity>
            
            <View style={styles.etaContainer}>
              <Animated.Text style={[styles.etaText, { transform: [{ scale: etaUpdateAnim }] }]}>
                {eta} min
              </Animated.Text>
              <Text style={styles.etaLabel}>ETA</Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>
        </BlurView>
      </SafeAreaView>

      {/* Floating Cleaner Info Card */}
      <Animated.View 
        style={[
          styles.cleanerCard, 
          { transform: [{ translateY: cardSlideAnim }] }
        ]}
      >
        <BlurView intensity={90} style={styles.cardBlur}>
          <View style={styles.cardContent}>
            {/* Cleaner Info */}
            <View style={styles.cleanerInfo}>
              <Image source={{ uri: cleaner.avatar }} style={styles.cleanerAvatar} />
              <View style={styles.cleanerDetails}>
                <Text style={styles.cleanerName}>{cleaner.name}</Text>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#FFC93C" />
                  <Text style={styles.ratingText}>{cleaner.rating}</Text>
                </View>
                <Text style={styles.vehicleText}>{cleaner.vehicle}</Text>
              </View>
              <View style={styles.statusContainer}>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>{cleaner.status}</Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.messageAction} onPress={handleMessageCleaner}>
                <LinearGradient
                  colors={['#F0FDFA', '#E6FFFA']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="chatbubble" size={20} color={COLORS.primary} />
                </LinearGradient>
                <Text style={styles.actionLabel}>Message</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.callAction} onPress={handleCallCleaner}>
                <LinearGradient
                  colors={[COLORS.primary, '#E97E0B']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="call" size={20} color={COLORS.text.inverse} />
                </LinearGradient>
                <Text style={styles.actionLabel}>Call</Text>
              </TouchableOpacity>
            </View>

            {/* Service Progress */}
            <View style={styles.progressContainer}>
              <View style={styles.progressStep}>
                <View style={[styles.progressDot, styles.completedDot]} />
                <Text style={styles.progressLabel}>Confirmed</Text>
              </View>
              <View style={styles.progressLine} />
              <View style={styles.progressStep}>
                <View style={[styles.progressDot, styles.activeDot]} />
                <Text style={[styles.progressLabel, styles.activeLabel]}>En Route</Text>
              </View>
              <View style={styles.progressLine} />
              <View style={styles.progressStep}>
                <View style={styles.progressDot} />
                <Text style={styles.progressLabel}>Arrived</Text>
              </View>
              <View style={styles.progressLine} />
              <View style={styles.progressStep}>
                <View style={styles.progressDot} />
                <Text style={styles.progressLabel}>Complete</Text>
              </View>
            </View>
          </View>
        </BlurView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    flex: 1,
  },
  cleanerMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  customerMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingTop: SPACING.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  etaContainer: {
    flex: 1,
    alignItems: 'center',
  },
  etaText: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.primary,
  },
  etaLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  headerSpacer: {
    width: 40,
  },
  cleanerCard: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: SPACING.lg,
    right: SPACING.lg,
    borderRadius: 20,
    overflow: 'hidden',
    zIndex: 5,
  },
  cardBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cardContent: {
    padding: SPACING.lg,
  },
  cleanerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  cleanerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: SPACING.md,
  },
  cleanerDetails: {
    flex: 1,
  },
  cleanerName: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  ratingText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    marginLeft: 4,
  },
  vehicleText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.disabled,
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: SPACING.xs,
  },
  statusText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.success,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    gap: SPACING.xl,
  },
  messageAction: {
    alignItems: 'center',
  },
  callAction: {
    alignItems: 'center',
  },
  actionGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionLabel: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressStep: {
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.xs,
  },
  completedDot: {
    backgroundColor: COLORS.success,
  },
  activeDot: {
    backgroundColor: COLORS.primary,
    transform: [{ scale: 1.2 }],
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.sm,
  },
  progressLabel: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.text.disabled,
    fontWeight: TYPOGRAPHY.weights.medium,
  },
  activeLabel: {
    color: COLORS.primary,
    fontWeight: TYPOGRAPHY.weights.semibold,
  },
});

export default LiveTrackingScreen; 