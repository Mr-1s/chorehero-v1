import React, { useEffect, useRef, useState } from 'react';
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
  ScrollView,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { dummyWalletService } from '../../services/dummyWalletService';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, TYPOGRAPHY, SPACING } from '../../utils/constants';

type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  LiveTracking: { bookingId: string };
  IndividualChat: { cleanerId: string; bookingId: string };
};

type BookingConfirmationNavigationProp = BottomTabNavigationProp<TabParamList, any>;

interface BookingConfirmationRouteParams {
  bookingId: string;
  service: {
    title: string;
    duration: string;
    price: number;
  };
  cleaner: {
        id: string;
        name: string;
        avatar: string;
        rating: number;
        eta: string;
      };
      address: string;
      scheduledTime: string;
}

const { width, height } = Dimensions.get('window');

const BookingConfirmationScreen = (props: any) => {
  const { navigation, route } = props;
  const { bookingId, service, cleaner, address, scheduledTime } = route.params;
  const { user } = useAuth();
  
  // Animation refs
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0.8)).current;

  const slideUp = useRef(new Animated.Value(50)).current;
  
  // State
  const [estimatedArrival, setEstimatedArrival] = useState('');

  useEffect(() => {
    // Calculate estimated arrival time
    const now = new Date();
    const arrival = new Date(now.getTime() + 30 * 60000); // 30 minutes from now
    setEstimatedArrival(arrival.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    // Haptic feedback for success
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Process dummy payment automatically
    processBookingPayment();

    // Success animations sequence
    Animated.sequence([
      // Checkmark bounce in
      Animated.timing(checkmarkScale, {
        toValue: 1.3,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(checkmarkScale, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();



    // Content slide up and fade in
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 800,
        delay: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 800,
        delay: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Button scale animation
    Animated.timing(buttonScale, {
      toValue: 1,
      duration: 600,
      delay: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  const processBookingPayment = async () => {
    try {
      console.log('💳 Processing booking payment with dummy wallet...');
      
      // Simulate payment processing with dummy wallet
      const response = await dummyWalletService.processBookingPayment(
        user?.id || 'unknown-user',
        cleaner.id,
        bookingId,
        Math.round(service.price * 100), // Convert to cents
        0 // No tip for now
      );

      if (response.success) {
        console.log('✅ Payment processed successfully:', response.data.transaction_id);
        console.log('💰 Payment breakdown:', response.data.breakdown);
      } else {
        console.log('❌ Payment failed:', response.error);
        // Surface a friendly message and suggest adding funds
        try {
          // eslint-disable-next-line no-alert
          alert('Payment processing failed: ' + (response.error || 'Insufficient balance. Please add funds to your wallet.'));
        } catch {}
      }
    } catch (error) {
      console.error('Error processing booking payment:', error);
    }
  };

  const handleTrackService = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to bookings with active tab and tracking enabled
    navigation.navigate('MainTabs', { 
      screen: 'Bookings',
      params: { 
        activeTab: 'active',
        bookingId: bookingId,
        showTracking: true 
      }
    });
  };

  const handleMessageCleaner = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('IndividualChat', { cleanerId: cleaner.id, bookingId });
  };



  const handleShareBooking = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `I just booked a ${service.title} with ChoreHero! My cleaner ${cleaner.name} will arrive at ${estimatedArrival}. 🧹✨`,
        title: 'ChoreHero Booking Confirmed',
      });
    } catch (error) {
      console.error('Error sharing booking:', error);
    }
  };

  const handleViewBooking = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate back to MainTabs and then to Bookings
    navigation.navigate('MainTabs', { 
      screen: 'Bookings',
      params: { 
        activeTab: 'active',
        bookingId: bookingId 
      }
    });
  };

  const handleGoHome = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate back to MainTabs home
    navigation.navigate('MainTabs', { screen: 'Home' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      


      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Compact Success Header */}
        <View style={styles.compactSuccessContainer}>
          <Animated.View style={[styles.compactCheckmarkContainer, { transform: [{ scale: checkmarkScale }] }]}>
            <LinearGradient
              colors={['#059669', '#047857']}
              style={styles.compactCheckmarkBackground}
            >
              <Ionicons name="checkmark" size={40} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>
          
          <Animated.View style={[styles.compactContentContainer, { opacity: contentOpacity, transform: [{ translateY: slideUp }] }]}>
            <Text style={styles.compactSuccessTitle}>Booking Confirmed! 🎉</Text>
            <Text style={styles.compactSuccessSubtitle}>
              {cleaner.name} will take excellent care of your space.
            </Text>
            
            {/* Inline Quick Stats */}
            <View style={styles.compactQuickStats}>
              <View style={styles.compactStatItem}>
                <Ionicons name="time-outline" size={14} color="#059669" />
                <Text style={styles.compactStatText}>ETA: {estimatedArrival}</Text>
              </View>
              <View style={styles.compactStatItem}>
                <Ionicons name="star" size={14} color="#FFC93C" />
                <Text style={styles.compactStatText}>{cleaner.rating}</Text>
              </View>
              <View style={styles.compactStatItem}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={styles.compactStatText}>Verified</Text>
              </View>
            </View>
          </Animated.View>
        </View>



        {/* Modern Service Card */}
        <Animated.View style={[styles.modernCard, { opacity: contentOpacity, transform: [{ translateY: slideUp }] }]}>
          <View style={styles.cardHeader}>
            <View style={styles.serviceIconWrapper}>
              <Ionicons name="home" size={24} color="#3ad3db" />
                    </View>
            <View style={styles.serviceInfo}>
                    <Text style={styles.serviceTitle}>{service.title}</Text>
              <Text style={styles.bookingId}>ID: {bookingId.slice(-6).toUpperCase()}</Text>
                  </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Confirmed</Text>
                  </View>
                </View>
                
          {/* Modern Details Grid */}
          <View style={styles.modernDetailsGrid}>
            <View style={styles.modernDetailItem}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="calendar-outline" size={20} color="#3ad3db" />
                  </View>
              <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Scheduled</Text>
                    <Text style={styles.detailValue}>{scheduledTime}</Text>
              </View>
                  </View>
                  
            <View style={styles.modernDetailItem}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="location-outline" size={20} color="#3ad3db" />
              </View>
              <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Location</Text>
                    <Text style={styles.detailValue}>{address}</Text>
              </View>
                  </View>
                  
            <View style={styles.modernDetailItem}>
              <View style={styles.detailIconContainer}>
                <Ionicons name="time-outline" size={20} color="#059669" />
              </View>
              <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>ETA</Text>
                <Text style={[styles.detailValue, { color: '#059669' }]}>{estimatedArrival}</Text>
                  </View>
                </View>
              </View>

          {/* Modern Cleaner Card */}
          <View style={styles.modernCleanerCard}>
            <View style={styles.cleanerHeader}>
              <Image source={{ uri: cleaner.avatar }} style={styles.modernCleanerAvatar} />
              <View style={styles.cleanerDetails}>
                <Text style={styles.modernCleanerName}>{cleaner.name}</Text>
                <View style={styles.cleanerBadges}>
                  <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={14} color="#FFC93C" />
                    <Text style={styles.ratingText}>{cleaner.rating}</Text>
                      </View>
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.verifiedText}>Verified</Text>
                      </View>
                    </View>
                    <Text style={styles.cleanerExperience}>3+ years experience • 500+ happy customers</Text>
                   </View>
                </View>
              </View>

              {/* What to Expect Section */}
          <View style={styles.modernExpectationSection}>
            <Text style={styles.modernSectionTitle}>What to Expect</Text>
            <View style={styles.modernExpectationsList}>
              <View style={styles.modernExpectationItem}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.modernExpectationText}>Professional cleaning supplies included</Text>
                  </View>
              <View style={styles.modernExpectationItem}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.modernExpectationText}>Before & after photos documented</Text>
                  </View>
              <View style={styles.modernExpectationItem}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.modernExpectationText}>Quality guarantee & satisfaction promise</Text>
                  </View>
              <View style={styles.modernExpectationItem}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.modernExpectationText}>Real-time service updates</Text>
                  </View>
                </View>
              </View>

          {/* Modern Payment Summary */}
          <View style={styles.modernPaymentSection}>
            <Text style={styles.modernSectionTitle}>Payment Summary</Text>
            <View style={styles.modernPaymentBreakdown}>
              <View style={styles.modernPaymentRow}>
                <Text style={styles.modernPaymentLabel}>Professional Cleaning</Text>
                <Text style={styles.modernPaymentAmount}>$0.00</Text>
                  </View>
              <View style={styles.modernPaymentRow}>
                <Text style={styles.modernPaymentLabel}>Platform fee</Text>
                <Text style={styles.modernPaymentAmount}>$0.00</Text>
                  </View>
              <View style={styles.modernPaymentRow}>
                <Text style={styles.modernPaymentLabel}>Tax</Text>
                <Text style={styles.modernPaymentAmount}>$0.00</Text>
                  </View>
              <View style={[styles.modernPaymentRow, styles.modernTotalRow]}>
                <Text style={styles.modernTotalLabel}>Total Paid</Text>
                <Text style={styles.modernTotalAmount}>$0</Text>
                  </View>
                </View>
            <View style={styles.modernPaymentMethod}>
              <Ionicons name="card" size={16} color="#64748B" />
              <Text style={styles.modernPaymentText}>Paid with •••• 4242</Text>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
                </View>
              </View>
        </Animated.View>

        {/* Modern Action Buttons */}
        <Animated.View style={[styles.modernActionsContainer, { transform: [{ scale: buttonScale }] }]}>
          <TouchableOpacity style={styles.modernPrimaryButton} onPress={handleTrackService} activeOpacity={0.9}>
            <LinearGradient
              colors={['#3ad3db', '#2BC8D4']}
              style={styles.modernPrimaryGradient}
            >
              <Ionicons name="location" size={20} color="#FFFFFF" />
              <Text style={styles.modernPrimaryText}>Track Your Cleaner</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.modernSecondaryButtons}>
            <TouchableOpacity style={styles.modernSecondaryButton} onPress={handleViewBooking} activeOpacity={0.8}>
              <Ionicons name="list" size={18} color="#3ad3db" />
              <Text style={styles.modernSecondaryText}>View All Bookings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modernGhostButton} onPress={handleGoHome} activeOpacity={0.8}>
              <Ionicons name="home-outline" size={18} color="#6B7280" />
              <Text style={styles.modernGhostText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  celebrationContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 1000,
    pointerEvents: 'none',
  },
  confetti: {
    position: 'absolute',
    fontSize: 24,
    top: 20,
    left: 50,
  },
  compactSuccessContainer: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  compactCheckmarkContainer: {
    marginBottom: 12,
  },
  compactCheckmarkBackground: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  compactContentContainer: {
    alignItems: 'center',
  },
  compactSuccessTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  compactSuccessSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },
  compactQuickStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    borderRadius: 12,
  },
  compactStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactStatText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xl,
    gap: SPACING.lg,
  },
  quickActionButton: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  quickActionGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  modernCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  serviceIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(58, 211, 219, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  bookingId: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  statusBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modernDetailsGrid: {
    gap: 12,
    marginBottom: 16,
  },
  modernDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  detailIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  modernCleanerCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  cleanerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernCleanerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#3ad3db',
  },
  cleanerDetails: {
    flex: 1,
  },
  modernCleanerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  cleanerBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
  },
  cleanerExperience: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  modernExpectationSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  modernSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  modernExpectationsList: {
    gap: 12,
  },
  modernExpectationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modernExpectationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  modernPaymentSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  modernPaymentBreakdown: {
    gap: 8,
    marginBottom: 16,
  },
  modernPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  modernPaymentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  modernPaymentAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  modernTotalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  modernTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modernTotalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F59E0B',
  },
  modernPaymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  modernPaymentText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  cardBlur: {
    borderRadius: 20,
  },
  cardContent: {
    padding: SPACING.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  serviceSection: {
    marginBottom: SPACING.xl,
  },
  serviceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serviceIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  bookingIdContainer: {
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
  },
  bookingIdLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text.secondary,
    textTransform: 'uppercase',
  },
  bookingIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  detailItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  cleanerSection: {
    marginBottom: SPACING.xl,
  },
  cleanerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 16,
    gap: SPACING.md,
  },
  cleanerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  cleanerInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  cleanerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  cleanerStats: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text.secondary,
  },
  cleanerExperience: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },
  cleanerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  miniActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLORS.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expectationSection: {
    marginBottom: SPACING.xl,
  },
  expectationsList: {
    gap: SPACING.sm,
  },
  expectationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  expectationText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    flex: 1,
  },
  priceSection: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 16,
    marginTop: SPACING.md,
  },
  priceBreakdown: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  priceAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  totalRow: {
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.sm,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  paymentText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    flex: 1,
  },
  actionsContainer: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    gap: SPACING.sm,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.inverse,
  },
  secondaryButtons: {
    gap: SPACING.sm,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  ghostButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  ghostButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  modernActionsContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  modernPrimaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  modernPrimaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 10,
  },
  modernPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  modernSecondaryButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modernSecondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 8,
  },
  modernSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  modernGhostButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    borderRadius: 14,
    gap: 8,
  },
  modernGhostText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  bottomSpacing: {
    height: SPACING.xl,
  },
});

export default BookingConfirmationScreen; 