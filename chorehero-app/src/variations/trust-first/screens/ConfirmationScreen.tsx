import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../shared/theme';
import { Cleaner } from '../../shared/types';

interface ConfirmationScreenProps {
  route: {
    params: {
      cleaner: Cleaner;
      bookingDetails: {
        date: string;
        time: string;
        address: string;
        serviceType: string;
        price: number;
      };
    };
  };
  navigation: any;
}

export default function ConfirmationScreen({ route, navigation }: ConfirmationScreenProps) {
  const { cleaner, bookingDetails } = route.params;

  const handleGoHome = () => {
    navigation.navigate('Swipe');
  };

  const handleViewProfile = () => {
    navigation.navigate('Profile');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={80} color={theme.colors.success} />
          </View>
          <Text style={styles.title}>Booking Confirmed!</Text>
          <Text style={styles.subtitle}>
            Your cleaning service has been successfully booked with {cleaner.name}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Booking Details</Text>
          
          <View style={styles.detailRow}>
            <Ionicons name="person" size={20} color={theme.colors.secondary} />
            <Text style={styles.detailLabel}>Cleaner</Text>
            <Text style={styles.detailValue}>{cleaner.name}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={20} color={theme.colors.secondary} />
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{bookingDetails.date}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time" size={20} color={theme.colors.secondary} />
            <Text style={styles.detailLabel}>Time</Text>
            <Text style={styles.detailValue}>{bookingDetails.time}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="location" size={20} color={theme.colors.secondary} />
            <Text style={styles.detailLabel}>Address</Text>
            <Text style={styles.detailValue}>{bookingDetails.address}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="star" size={20} color={theme.colors.secondary} />
            <Text style={styles.detailLabel}>Service</Text>
            <Text style={styles.detailValue}>{bookingDetails.serviceType}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="card" size={20} color={theme.colors.secondary} />
            <Text style={styles.detailLabel}>Total</Text>
            <Text style={styles.detailValue}>${bookingDetails.price}</Text>
          </View>
        </View>

        <View style={styles.trustSection}>
          <Text style={styles.trustTitle}>Security Assured</Text>
          <View style={styles.trustBadges}>
            {cleaner.verified && (
              <View style={styles.trustBadge}>
                <Ionicons name="shield-checkmark" size={16} color={theme.colors.success} />
                <Text style={styles.trustBadgeText}>Verified</Text>
              </View>
            )}
            {cleaner.backgroundCheck && (
              <View style={styles.trustBadge}>
                <Ionicons name="document-text" size={16} color={theme.colors.success} />
                <Text style={styles.trustBadgeText}>Background Check</Text>
              </View>
            )}
            {cleaner.insured && (
              <View style={styles.trustBadge}>
                <Ionicons name="shield" size={16} color={theme.colors.success} />
                <Text style={styles.trustBadgeText}>Insured</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.nextSteps}>
          <Text style={styles.nextStepsTitle}>What's Next?</Text>
          <View style={styles.stepItem}>
            <Ionicons name="call" size={20} color={theme.colors.primary} />
            <Text style={styles.stepText}>
              {cleaner.name} will contact you 30 minutes before arrival
            </Text>
          </View>
          <View style={styles.stepItem}>
            <Ionicons name="location" size={20} color={theme.colors.primary} />
            <Text style={styles.stepText}>
              You'll receive live tracking updates
            </Text>
          </View>
          <View style={styles.stepItem}>
            <Ionicons name="card" size={20} color={theme.colors.primary} />
            <Text style={styles.stepText}>
              Payment will be processed after service completion
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleViewProfile}>
          <Text style={styles.secondaryButtonText}>View Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={handleGoHome}>
          <Text style={styles.primaryButtonText}>Book Another Clean</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  card: {
    backgroundColor: theme.colors.white,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginLeft: 12,
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'right',
  },
  trustSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  trustTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 12,
  },
  trustBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.success + '40',
  },
  trustBadgeText: {
    fontSize: 14,
    color: theme.colors.success,
    marginLeft: 4,
    fontWeight: '600',
  },
  nextSteps: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  nextStepsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: theme.colors.white,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    color: theme.colors.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
}); 