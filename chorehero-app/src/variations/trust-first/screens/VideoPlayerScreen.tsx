import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VideoPlayer } from '../../shared/components/VideoPlayer';
import { theme } from '../../shared/theme';
import { Cleaner } from '../../shared/types';

interface VideoPlayerScreenProps {
  route: {
    params: {
      cleaner: Cleaner;
    };
  };
  navigation: any;
}

// Generate cleaning-specific video content
const getCleaningVideoContent = (cleaner: Cleaner) => {
  const specialtyVideos: Record<string, { title: string; description: string }> = {
    'Deep Cleaning': {
      title: 'Deep Cleaning Demonstration',
      description: 'See how I transform spaces with thorough deep cleaning techniques'
    },
    'Eco-Friendly': {
      title: 'Eco-Friendly Cleaning Methods',
      description: 'Safe, green cleaning products that protect your family and pets'
    },
    'Kitchen Deep Clean': {
      title: 'Professional Kitchen Cleaning',
      description: 'Complete kitchen sanitization and deep cleaning process'
    },
    'Bathroom Sanitization': {
      title: 'Bathroom Deep Clean & Sanitization',
      description: 'Comprehensive bathroom cleaning with hospital-grade sanitization'
    },
    'Luxury Homes': {
      title: 'Premium Home Cleaning Service',
      description: 'White-glove cleaning service for luxury properties'
    },
    'Same-Day Service': {
      title: 'Rapid Response Cleaning',
      description: 'Professional same-day cleaning service demonstration'
    }
  };

  const primarySpecialty = cleaner.specialties[0];
  return specialtyVideos[primarySpecialty] || {
    title: `${cleaner.name}'s Cleaning Service`,
    description: 'Professional cleaning demonstration and service overview'
  };
};

export const VideoPlayerScreen: React.FC<VideoPlayerScreenProps> = ({ route, navigation }) => {
  const { cleaner } = route.params;
  const videoContent = getCleaningVideoContent(cleaner);

  const handleBook = () => {
    navigation.navigate('Booking', { cleaner });
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
          <Ionicons name="close" size={24} color={theme.colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{cleaner.name}</Text>
        <View style={styles.verificationBadge}>
          <Ionicons name="shield-checkmark" size={16} color={theme.colors.success} />
          <Text style={styles.verificationText}>Verified</Text>
        </View>
      </View>

      <View style={styles.videoContainer}>
        <VideoPlayer
          source={cleaner.videoUrl}
          autoPlay={true}
          muted={false}
          style={styles.video}
          title={videoContent.title}
          description={videoContent.description}
        />
      </View>

      <ScrollView style={styles.footer}>
        <View style={styles.cleanerInfo}>
          <Text style={styles.cleanerName}>{cleaner.name}</Text>
          <View style={styles.rating}>
            <Ionicons name="star" size={16} color={theme.colors.warning} />
            <Text style={styles.ratingText}>{cleaner.rating} ({cleaner.reviews} reviews)</Text>
          </View>
          <Text style={styles.bio}>{cleaner.bio}</Text>
        </View>

        {/* Trust & Security Section */}
        <View style={styles.trustSection}>
          <Text style={styles.trustTitle}>Trust & Security</Text>
          <View style={styles.trustGrid}>
            {cleaner.verified && (
              <View style={styles.trustItem}>
                <Ionicons name="shield-checkmark" size={20} color={theme.colors.success} />
                <Text style={styles.trustText}>ID Verified</Text>
              </View>
            )}
            {cleaner.backgroundCheck && (
              <View style={styles.trustItem}>
                <Ionicons name="document-text" size={20} color={theme.colors.primary} />
                <Text style={styles.trustText}>Background Check</Text>
              </View>
            )}
            {cleaner.insured && (
              <View style={styles.trustItem}>
                <Ionicons name="umbrella" size={20} color={theme.colors.secondary} />
                <Text style={styles.trustText}>Insured & Bonded</Text>
              </View>
            )}
            <View style={styles.trustItem}>
              <Ionicons name="time" size={20} color={theme.colors.warning} />
              <Text style={styles.trustText}>{cleaner.yearsExperience} Years Experience</Text>
            </View>
          </View>
        </View>

        {/* Service Details */}
        <View style={styles.serviceSection}>
          <Text style={styles.sectionTitle}>Service Details</Text>
          <View style={styles.serviceDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="briefcase" size={16} color={theme.colors.gray[600]} />
              <Text style={styles.detailText}>{cleaner.completedJobs} jobs completed</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="time" size={16} color={theme.colors.primary} />
              <Text style={styles.detailText}>Responds in {cleaner.responseTime}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="location" size={16} color={theme.colors.secondary} />
              <Text style={styles.detailText}>{cleaner.distance} away</Text>
            </View>
          </View>
        </View>

        {/* Specialties */}
        <View style={styles.specialtiesSection}>
          <Text style={styles.sectionTitle}>Specialties</Text>
          <View style={styles.specialties}>
            {cleaner.specialties.map((specialty, index) => (
              <View key={index} style={styles.specialtyTag}>
                <Text style={styles.specialtyText}>{specialty}</Text>
              </View>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.bookButton} onPress={handleBook}>
          <Ionicons name="shield-checkmark" size={20} color={theme.colors.white} />
          <Text style={styles.bookButtonText}>Book Secure Clean - ${cleaner.price}/hr</Text>
        </TouchableOpacity>
        
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.black
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.7)'
  },
  closeButton: {
    padding: theme.spacing.sm
  },
  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white,
    flex: 1,
    textAlign: 'center'
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.xs
  },
  verificationText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.success,
    fontWeight: '600'
  },
  videoContainer: {
    flex: 1
  },
  video: {
    flex: 1
  },
  footer: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl
  },
  cleanerInfo: {
    marginBottom: theme.spacing.md
  },
  cleanerName: {
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm
  },
  ratingText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[700]
  },
  bio: {
    fontSize: theme.fontSize.md,
    color: theme.colors.gray[700],
    lineHeight: 22
  },
  bookButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center'
  },
  bookButtonText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white
  },
  trustSection: {
    marginBottom: theme.spacing.md
  },
  trustTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm
  },
  trustGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  trustText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[700]
  },
  serviceSection: {
    marginBottom: theme.spacing.md
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm
  },
  serviceDetails: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs
  },
  detailText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[700]
  },
  specialtiesSection: {
    marginBottom: theme.spacing.md
  },
  specialties: {
    flexDirection: 'row',
    gap: theme.spacing.sm
  },
  specialtyTag: {
    backgroundColor: theme.colors.gray[200],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full
  },
  specialtyText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[700]
  },
  bottomPadding: {
    height: theme.spacing.xl
  }
});