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

  const currentCleaner = mockCleaners[currentIndex];

  const handleSwipeLeft = () => {
    if (currentIndex < mockCleaners.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSwipeRight = () => {
    if (currentIndex < mockCleaners.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleCardTap = () => {
    if (currentCleaner) {
      onVideoPress(currentCleaner);
    }
  };

  const handleQuickBook = () => {
    if (currentCleaner) {
      // Skip to instant booking for express cleaners
      if (currentCleaner.expressClean) {
        confirmExpressBooking();
      } else {
        onCleanerSelected(currentCleaner);
      }
    }
  };

  const confirmExpressBooking = () => {
    Alert.alert(
      'Express Clean',
      `Book ${currentCleaner.name} for a 30-45 minute express clean at $${currentCleaner.price}/hr?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Book Now', 
          onPress: () => onCleanerSelected(currentCleaner)
        }
      ]
    );
  };

  if (!currentCleaner) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="flash" size={80} color={theme.colors.accent} />
          <Text style={styles.emptyTitle}>All booked!</Text>
          <Text style={styles.emptyDescription}>
            No more cleaners available right now. Check back later!
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header - Minimal */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quick Clean</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.expressButton}>
            <Ionicons name="flash" size={16} color={theme.colors.accent} />
            <Text style={styles.expressText}>Express</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Swipe Cards */}
      <View style={styles.cardContainer}>
        <SwipeCard
          cleaner={currentCleaner}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          onTap={handleCardTap}
          onQuickBook={handleQuickBook}
        />
      </View>

      {/* Minimal Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSwipeLeft}>
          <Ionicons name="close" size={28} color={theme.colors.gray[600]} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.bookButton} onPress={handleQuickBook}>
          <Ionicons name="flash" size={32} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {/* Speed Indicators */}
      <View style={styles.speedIndicators}>
        <View style={styles.speedItem}>
          <Text style={styles.speedNumber}>2</Text>
          <Text style={styles.speedLabel}>Min booking</Text>
        </View>
        <View style={styles.speedItem}>
          <Text style={styles.speedNumber}>30</Text>
          <Text style={styles.speedLabel}>Min clean</Text>
        </View>
        <View style={styles.speedItem}>
          <Text style={styles.speedNumber}>1</Text>
          <Text style={styles.speedLabel}>Tap book</Text>
        </View>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  expressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accent + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.xs
  },
  expressText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.accent,
    fontWeight: '600'
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
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.gray[100]
  },
  bookButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.accent
  },
  speedIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: theme.colors.gray[50],
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md
  },
  speedItem: {
    alignItems: 'center'
  },
  speedNumber: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.accent
  },
  speedLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.xs
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
    textAlign: 'center'
  }
});