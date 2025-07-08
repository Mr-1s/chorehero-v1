import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SwipeCard } from '../components/SwipeCard';
import { mockCleaners } from '../../shared/mockData';
import { theme } from '../../shared/theme';
import { Cleaner } from '../../shared/types';

interface SwipeScreenProps {
  onCleanerSelected: (cleaner: Cleaner) => void;
  onVideoPress: (cleaner: Cleaner) => void;
}

export const SwipeScreen: React.FC<SwipeScreenProps> = ({ onCleanerSelected, onVideoPress }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedCleaners, setSavedCleaners] = useState<Cleaner[]>([]);

  const currentCleaner = mockCleaners[currentIndex];

  const handleSwipeLeft = () => {
    // Skip cleaner
    if (currentIndex < mockCleaners.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Show no more cleaners message
      Alert.alert('No more cleaners', 'You\'ve seen all available cleaners in your area.');
    }
  };

  const handleSwipeRight = () => {
    // Save cleaner
    if (currentCleaner) {
      setSavedCleaners([...savedCleaners, currentCleaner]);
      if (currentIndex < mockCleaners.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  const handleCardTap = () => {
    if (currentCleaner) {
      onVideoPress(currentCleaner);
    }
  };

  const handleBookNow = () => {
    if (currentCleaner) {
      onCleanerSelected(currentCleaner);
    }
  };

  const showVerificationDetails = () => {
    Alert.alert(
      'Verification Details',
      `${currentCleaner.name} has completed:\n\n• Background check verification\n• Identity confirmation\n• Insurance verification\n• Professional references\n\nAll cleaners must pass our comprehensive vetting process before joining the platform.`,
      [{ text: 'OK' }]
    );
  };

  if (!currentCleaner) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={80} color={theme.colors.success} />
          <Text style={styles.emptyTitle}>All done!</Text>
          <Text style={styles.emptyDescription}>
            You've seen all available cleaners in your area.
          </Text>
          <TouchableOpacity style={styles.savedCleanersButton}>
            <Text style={styles.savedCleanersText}>
              View Saved Cleaners ({savedCleaners.length})
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trusted Cleaners</Text>
        <TouchableOpacity style={styles.savedButton}>
          <Ionicons name="bookmark" size={24} color={theme.colors.primary} />
          <Text style={styles.savedCount}>{savedCleaners.length}</Text>
        </TouchableOpacity>
      </View>

      {/* Trust Banner */}
      <View style={styles.trustBanner}>
        <Ionicons name="shield-checkmark" size={20} color={theme.colors.success} />
        <Text style={styles.trustText}>All cleaners are verified & background checked</Text>
        <TouchableOpacity onPress={showVerificationDetails}>
          <Ionicons name="information-circle" size={20} color={theme.colors.gray[600]} />
        </TouchableOpacity>
      </View>

      {/* Swipe Cards */}
      <View style={styles.cardContainer}>
        <SwipeCard
          cleaner={currentCleaner}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          onTap={handleCardTap}
        />
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSwipeLeft}>
          <Ionicons name="close" size={24} color={theme.colors.gray[600]} />
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.bookButton} onPress={handleBookNow}>
          <Ionicons name="calendar" size={24} color={theme.colors.white} />
          <Text style={styles.bookText}>Book Now</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.saveButton} onPress={handleSwipeRight}>
          <Ionicons name="bookmark" size={24} color={theme.colors.primary} />
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Security Footer */}
      <View style={styles.securityFooter}>
        <View style={styles.securityItem}>
          <Ionicons name="shield" size={16} color={theme.colors.success} />
          <Text style={styles.securityItemText}>Insured</Text>
        </View>
        <View style={styles.securityItem}>
          <Ionicons name="document-text" size={16} color={theme.colors.primary} />
          <Text style={styles.securityItemText}>Background Check</Text>
        </View>
        <View style={styles.securityItem}>
          <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
          <Text style={styles.securityItemText}>ID Verified</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray[50]
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.gray[900]
  },
  savedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  savedCount: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.primary
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.success + '20',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    gap: theme.spacing.sm
  },
  trustText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[700],
    fontWeight: '500',
    flex: 1
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: theme.spacing.md
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md
  },
  skipButton: {
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray[100],
    width: 70,
    height: 70
  },
  skipText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.xs
  },
  bookButton: {
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    width: 80,
    height: 80
  },
  bookText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.white,
    marginTop: theme.spacing.xs,
    fontWeight: '600'
  },
  saveButton: {
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.white,
    width: 70,
    height: 70,
    borderWidth: 2,
    borderColor: theme.colors.primary
  },
  saveText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    marginTop: theme.spacing.xs,
    fontWeight: '600'
  },
  securityFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200]
  },
  securityItem: {
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  securityItemText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.gray[600]
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl
  },
  emptyTitle: {
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    color: theme.colors.gray[900],
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm
  },
  emptyDescription: {
    fontSize: theme.fontSize.md,
    color: theme.colors.gray[600],
    textAlign: 'center',
    marginBottom: theme.spacing.xl
  },
  savedCleanersButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg
  },
  savedCleanersText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.white,
    fontWeight: '600'
  }
});