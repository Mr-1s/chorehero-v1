import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../shared/theme';
import { Cleaner, TimeSlot } from '../../shared/types';
import { mockTimeSlots } from '../../shared/mockData';

interface BookingScreenProps {
  route: {
    params: {
      cleaner: Cleaner;
    };
  };
  navigation: any;
}

export const BookingScreen: React.FC<BookingScreenProps> = ({ route, navigation }) => {
  const { cleaner } = route.params;
  const [selectedDate, setSelectedDate] = useState<string>('Today');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [address, setAddress] = useState('');
  const [instructions, setInstructions] = useState('');

  const dates = ['Today', 'Tomorrow', 'This Week'];

  const handleBook = () => {
    const bookingData = {
      cleanerId: cleaner.id,
      date: selectedDate,
      timeSlot: selectedTimeSlot,
      address,
      specialInstructions: instructions,
      estimatedDuration: 120,
      totalPrice: cleaner.price * 2
    };
    
    navigation.navigate('Confirmation', { cleaner, bookingData });
  };

  const canBook = selectedTimeSlot && address.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.gray[900]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Secure Booking</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Cleaner Summary */}
        <View style={styles.cleanerSummary}>
          <Text style={styles.cleanerName}>{cleaner.name}</Text>
          <View style={styles.verificationRow}>
            <Ionicons name="shield-checkmark" size={16} color={theme.colors.success} />
            <Text style={styles.verificationText}>Background Verified</Text>
            <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />
            <Text style={styles.verificationText}>Insured & Bonded</Text>
          </View>
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <View style={styles.dateOptions}>
            {dates.map((date) => (
              <TouchableOpacity
                key={date}
                style={[
                  styles.dateOption,
                  selectedDate === date && styles.selectedDateOption
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text style={[
                  styles.dateOptionText,
                  selectedDate === date && styles.selectedDateOptionText
                ]}>
                  {date}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Time Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Time</Text>
          <View style={styles.timeSlots}>
            {mockTimeSlots.filter(slot => slot.available).map((slot) => (
              <TouchableOpacity
                key={slot.id}
                style={[
                  styles.timeSlot,
                  selectedTimeSlot?.id === slot.id && styles.selectedTimeSlot
                ]}
                onPress={() => setSelectedTimeSlot(slot)}
              >
                <Text style={[
                  styles.timeSlotText,
                  selectedTimeSlot?.id === slot.id && styles.selectedTimeSlotText
                ]}>
                  {slot.time}
                </Text>
                {slot.isExpress && (
                  <View style={styles.expressLabel}>
                    <Text style={styles.expressText}>Express</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Address</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter your address"
            value={address}
            onChangeText={setAddress}
            multiline={false}
          />
          <View style={styles.securityNote}>
            <Ionicons name="lock-closed" size={16} color={theme.colors.success} />
            <Text style={styles.securityNoteText}>
              Your address is encrypted and only shared with your verified cleaner
            </Text>
          </View>
        </View>

        {/* Special Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Instructions (Optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Any specific cleaning requirements or instructions..."
            value={instructions}
            onChangeText={setInstructions}
            multiline={true}
            numberOfLines={3}
          />
        </View>

        {/* Security Guarantees */}
        <View style={styles.securitySection}>
          <Text style={styles.securitySectionTitle}>Your Security Guarantees</Text>
          <View style={styles.securityFeatures}>
            <View style={styles.securityFeature}>
              <Ionicons name="shield" size={20} color={theme.colors.success} />
              <Text style={styles.securityFeatureText}>$1M insurance coverage</Text>
            </View>
            <View style={styles.securityFeature}>
              <Ionicons name="document-text" size={20} color={theme.colors.primary} />
              <Text style={styles.securityFeatureText}>Background check verified</Text>
            </View>
            <View style={styles.securityFeature}>
              <Ionicons name="card" size={20} color={theme.colors.secondary} />
              <Text style={styles.securityFeatureText}>Secure payment processing</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomAction}>
        <View style={styles.priceInfo}>
          <Text style={styles.priceText}>Total: ${selectedTimeSlot ? cleaner.price * 2 : '--'}</Text>
          <Text style={styles.priceSubtext}>2 hour minimum • Fully insured</Text>
        </View>
        <TouchableOpacity
          style={[
            styles.bookButton,
            !canBook && styles.bookButtonDisabled
          ]}
          onPress={handleBook}
          disabled={!canBook}
        >
          <Ionicons name="shield-checkmark" size={20} color={theme.colors.white} />
          <Text style={styles.bookButtonText}>Secure Book</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200]
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.gray[900]
  },
  placeholder: {
    width: 24
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.md
  },
  cleanerSummary: {
    backgroundColor: theme.colors.gray[50],
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginVertical: theme.spacing.md
  },
  cleanerName: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  verificationText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[700],
    fontWeight: '500'
  },
  section: {
    marginVertical: theme.spacing.md
  },
  sectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.md
  },
  dateOptions: {
    flexDirection: 'row',
    gap: theme.spacing.md
  },
  dateOption: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    alignItems: 'center'
  },
  selectedDateOption: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  dateOptionText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.gray[700]
  },
  selectedDateOptionText: {
    color: theme.colors.white,
    fontWeight: '600'
  },
  timeSlots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md
  },
  timeSlot: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    minWidth: 100,
    alignItems: 'center'
  },
  selectedTimeSlot: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  timeSlotText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[700]
  },
  selectedTimeSlotText: {
    color: theme.colors.white,
    fontWeight: '600'
  },
  expressLabel: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.xs
  },
  expressText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.white,
    fontWeight: '600'
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.fontSize.md,
    color: theme.colors.gray[900]
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top'
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm
  },
  securityNoteText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[600],
    flex: 1
  },
  securitySection: {
    backgroundColor: theme.colors.success + '10',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginVertical: theme.spacing.md
  },
  securitySectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.md
  },
  securityFeatures: {
    gap: theme.spacing.md
  },
  securityFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md
  },
  securityFeatureText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[700],
    fontWeight: '500'
  },
  bottomAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
    backgroundColor: theme.colors.white
  },
  priceInfo: {
    flex: 1
  },
  priceText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.gray[900]
  },
  priceSubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[600]
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm
  },
  bookButtonDisabled: {
    backgroundColor: theme.colors.gray[400]
  },
  bookButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.white
  }
});