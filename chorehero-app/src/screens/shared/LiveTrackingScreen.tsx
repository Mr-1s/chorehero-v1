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
import { trackingWorkflowService } from '../../services/trackingWorkflowService';
import { navigateRoot } from '../../navigation/navigationRef';
import { wp, hp } from '../../utils/responsive';

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
  /** Always set from `bookings.cleaner_id` — never rely on broken PostgREST embeds for navigation. */
  const [cleanerUserId, setCleanerUserId] = useState<string | null>(null);
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
  const [destinationLocation, setDestinationLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const cardSlideAnim = useRef(new Animated.Value(300)).current;
  const etaUpdateAnim = useRef(new Animated.Value(1)).current;
  const mapRef = useRef<MapView | null>(null);

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'cleaner_assigned': return 'Scheduled';
      case 'cleaner_en_route': return 'On the way';
      case 'cleaner_arrived': return 'Arrived';
      case 'in_progress': return 'Cleaning';
      case 'completed': return 'Completed';
      default: return 'Pending';
    }
  };

  // Fetch real booking and cleaner data
  useEffect(() => {
    const loadBookingData = async () => {
      try {
        setLoading(true);
        console.log('📍 Loading booking data for:', bookingId);

        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .select(`
            *,
            address:addresses!address_id(
              street,
              city,
              state,
              zip_code,
              latitude,
              longitude
            )
          `)
          .eq('id', bookingId)
          .single();

        if (bookingError || !bookingData) {
          console.error('❌ Error fetching booking:', bookingError);
          setBooking(null);
          setCleanerUserId(null);
          setCleaner(null);
        } else {
          setBooking(bookingData);
          setBookingStatus(bookingData.status);

          if (bookingData.address?.latitude && bookingData.address?.longitude) {
            const dest = {
              latitude: Number(bookingData.address.latitude),
              longitude: Number(bookingData.address.longitude),
            };
            setDestinationLocation(dest);
            setCustomerLocation(dest);
          }

          const proId = bookingData.cleaner_id as string | null;
          setCleanerUserId(proId);

          let cleanerUser: { id: string; name: string | null; avatar_url: string | null; phone: string | null } | null =
            null;
          if (proId) {
            const { data: u } = await supabase
              .from('users')
              .select('id, name, avatar_url, phone')
              .eq('id', proId)
              .maybeSingle();
            cleanerUser = u;
          }

          const { data: profileData } = proId
            ? await supabase
                .from('cleaner_profiles')
                .select('rating_average')
                .eq('user_id', proId)
                .maybeSingle()
            : { data: null };

          setCleaner({
            id: proId,
            name: cleanerUser?.name || 'Your pro',
            avatar: cleanerUser?.avatar_url,
            rating: profileData?.rating_average ?? 0,
            status: getStatusLabel(bookingData.status),
            phone: cleanerUser?.phone,
            vehicle: null,
          });
        }
        
        const latestLocation = await trackingWorkflowService.getLatestLocation(bookingId);
        if (latestLocation) {
          setCleanerLocation({
            latitude: latestLocation.latitude,
            longitude: latestLocation.longitude,
          });
          if (latestLocation.eta) {
            setETA(Math.max(1, Math.round(latestLocation.eta)));
          }
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

  const getActiveProgressStep = (status: string): number => {
    switch (status) {
      case 'confirmed':
      case 'cleaner_assigned':
        return 0;
      case 'cleaner_en_route':
        return 1;
      case 'cleaner_arrived':
      case 'in_progress':
        return 2;
      case 'completed':
        return 3;
      default:
        return 0;
    }
  };

  const calculateDistanceMiles = (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 3958.8;
    const dLat = toRad(to.latitude - from.latitude);
    const dLng = toRad(to.longitude - from.longitude);
    const lat1 = toRad(from.latitude);
    const lat2 = toRad(to.latitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateEtaMinutes = (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
    const miles = calculateDistanceMiles(from, to);
    const speedMph = 22;
    return Math.max(1, Math.round((miles / speedMph) * 60));
  };

  useEffect(() => {
    if (loading) return;

    Animated.timing(cardSlideAnim, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start();

    if (!destinationLocation) return;
    if (bookingStatus !== 'cleaner_en_route') return;

    const unsubscribe = trackingWorkflowService.subscribeToCleanerLocation(bookingId, (location) => {
      setCleanerLocation({
        latitude: location.latitude,
        longitude: location.longitude,
      });

      const nextEta = location.eta
        ? Math.max(1, Math.round(location.eta))
        : calculateEtaMinutes({ latitude: location.latitude, longitude: location.longitude }, destinationLocation);

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
      setETA(nextEta);
    });

    return () => {
      unsubscribe?.();
    };
  }, [loading, bookingStatus, destinationLocation, bookingId]);

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleViewProProfile = () => {
    const id = cleanerUserId || cleaner?.id;
    if (!id) {
      return;
    }
    navigateRoot('CleanerProfile', { cleanerId: id });
  };

  const handleOpenBookings = () => {
    (navigation as any).navigate('Bookings', {
      bookingId,
      activeTab: 'upcoming',
    });
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

  const mapRegion = destinationLocation
    ? {
        latitude: (cleanerLocation.latitude + destinationLocation.latitude) / 2,
        longitude: (cleanerLocation.longitude + destinationLocation.longitude) / 2,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      }
    : {
        latitude: cleanerLocation.latitude,
        longitude: cleanerLocation.longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };

  const showProMarker =
    bookingStatus === 'cleaner_en_route' ||
    bookingStatus === 'cleaner_assigned' ||
    bookingStatus === 'cleaner_arrived' ||
    bookingStatus === 'in_progress' ||
    bookingStatus === 'confirmed';

  const progressStep = getActiveProgressStep(bookingStatus);

  useEffect(() => {
    if (loading) return;
    if (!mapRef.current) return;
    const coords: { latitude: number; longitude: number }[] = [];
    if (destinationLocation) {
      coords.push(destinationLocation);
    }
    if (showProMarker) {
      coords.push(cleanerLocation);
    }
    if (coords.length === 0) {
      return;
    }
    setTimeout(() => {
      if (mapRef.current && coords.length > 0) {
        if (coords.length === 1) {
          mapRef.current.animateToRegion(
            { ...coords[0], latitudeDelta: 0.04, longitudeDelta: 0.04 },
            300
          );
        } else {
          mapRef.current.fitToCoordinates(coords, {
            edgePadding: { top: 100, right: 48, bottom: 280, left: 48 },
            animated: true,
          });
        }
      }
    }, 400);
  }, [loading, destinationLocation, cleanerLocation.latitude, cleanerLocation.longitude, showProMarker]);

  // Show loading state
  if (loading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: hp('2%'), color: COLORS.text.muted }}>Loading tracking info...</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', padding: 20 }]}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.text.muted} />
        <Text style={{ marginTop: hp('2%'), color: COLORS.text.muted, fontSize: wp('4.5%'), textAlign: 'center' }}>
          Unable to load booking details
        </Text>
        <TouchableOpacity
          onPress={handleBackPress}
          style={{ marginTop: hp('2.5%'), padding: 16, backgroundColor: COLORS.primary, borderRadius: wp('3%') }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const silverMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e6e6e6' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e9ecef' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#efefef' }] },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Full-screen Map */}
      <MapView
        ref={(r) => {
          mapRef.current = r;
        }}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={mapRegion}
        customMapStyle={silverMapStyle}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        mapType="standard"
      >
        {showProMarker && (
          <Marker coordinate={cleanerLocation} anchor={{ x: 0.5, y: 0.5 }} identifier="pro">
            <View style={styles.cleanerMarker}>
              <LinearGradient
                colors={[COLORS.primary, '#26B7C9']}
                style={styles.markerGradient}
              >
                <Ionicons name="car" size={20} color={COLORS.text.inverse} />
              </LinearGradient>
            </View>
          </Marker>
        )}

        {destinationLocation && (
          <Marker
            coordinate={destinationLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            identifier="job"
          >
            <View style={styles.customerMarker}>
              <Ionicons name="home" size={24} color={COLORS.success} />
            </View>
          </Marker>
        )}
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
            <TouchableOpacity
              style={styles.cleanerInfo}
              onPress={handleViewProProfile}
              activeOpacity={0.85}
              disabled={!cleanerUserId && !cleaner?.id}
            >
              <Image
                source={{
                  uri:
                    cleaner.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(cleaner.name || 'Pro')}&size=120&background=0ea5e9&color=fff`,
                }}
                style={styles.cleanerAvatar}
              />
              <View style={styles.cleanerDetails}>
                <View style={styles.nameRow}>
                  <Text style={styles.cleanerName}>{cleaner.name}</Text>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.text.secondary} style={{ marginLeft: 4 }} />
                </View>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#FFC93C" />
                  <Text style={styles.ratingText}>
                    {Number(cleaner.rating) > 0 ? Number(cleaner.rating).toFixed(1) : '—'}
                  </Text>
                </View>
                <Text style={styles.viewProfileHint}>Tap to view full profile</Text>
                {!!cleaner.vehicle && <Text style={styles.vehicleText}>{cleaner.vehicle}</Text>}
              </View>
              <View style={styles.statusContainer}>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>{cleaner.status}</Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.bookingDetailsLink} onPress={handleOpenBookings} activeOpacity={0.8}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
              <Text style={styles.bookingDetailsLinkText}>Open this booking in Bookings</Text>
            </TouchableOpacity>

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
                  colors={[COLORS.primary, '#26B7C9']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="call" size={20} color={COLORS.text.inverse} />
                </LinearGradient>
                <Text style={styles.actionLabel}>Call</Text>
              </TouchableOpacity>
            </View>

            {/* Service Progress — driven by `bookingStatus` from Supabase */}
            <View style={styles.progressContainer}>
              <View style={styles.progressStep}>
                <View
                  style={[
                    styles.progressDot,
                    progressStep > 0 && styles.completedDot,
                    progressStep === 0 && styles.activeDot,
                  ]}
                />
                <Text style={[styles.progressLabel, progressStep === 0 && styles.activeLabel]}>Confirmed</Text>
              </View>
              <View style={styles.progressLine} />
              <View style={styles.progressStep}>
                <View
                  style={[
                    styles.progressDot,
                    progressStep > 1 && styles.completedDot,
                    progressStep === 1 && styles.activeDot,
                  ]}
                />
                <Text style={[styles.progressLabel, progressStep === 1 && styles.activeLabel]}>En route</Text>
              </View>
              <View style={styles.progressLine} />
              <View style={styles.progressStep}>
                <View
                  style={[
                    styles.progressDot,
                    progressStep > 2 && styles.completedDot,
                    progressStep === 2 && styles.activeDot,
                  ]}
                />
                <Text style={[styles.progressLabel, progressStep === 2 && styles.activeLabel]}>Arrived</Text>
              </View>
              <View style={styles.progressLine} />
              <View style={styles.progressStep}>
                <View
                  style={[
                    styles.progressDot,
                    progressStep >= 3 && styles.completedDot,
                    progressStep === 3 && styles.activeDot,
                  ]}
                />
                <Text style={[styles.progressLabel, progressStep === 3 && styles.activeLabel]}>Complete</Text>
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
    borderRadius: wp('5%'),
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
    borderRadius: wp('5%'),
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
    borderRadius: wp('7.5%'),
    marginRight: SPACING.md,
  },
  cleanerDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cleanerName: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  viewProfileHint: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  bookingDetailsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  bookingDetailsLinkText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.primary,
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
    borderRadius: wp('3%'),
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: wp('1%'),
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
    borderRadius: wp('7.5%'),
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
    borderRadius: wp('1.5%'),
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