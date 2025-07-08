import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../shared/theme';

interface VideoTestimonialProps {
  customerName: string;
  rating: number;
  text: string;
  videoUrl: string;
  beforeImage?: string;
  afterImage?: string;
  onPlay: () => void;
}

export const VideoTestimonial: React.FC<VideoTestimonialProps> = ({
  customerName,
  rating,
  text,
  videoUrl,
  beforeImage,
  afterImage,
  onPlay
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{customerName}</Text>
          <View style={styles.ratingContainer}>
            {[...Array(5)].map((_, index) => (
              <Ionicons
                key={index}
                name="star"
                size={12}
                color={index < rating ? theme.colors.warning : theme.colors.gray[300]}
              />
            ))}
          </View>
        </View>
        <TouchableOpacity style={styles.videoButton} onPress={onPlay}>
          <Ionicons name="play-circle" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.testimonialText}>{text}</Text>
      
      {beforeImage && afterImage && (
        <View style={styles.beforeAfterContainer}>
          <View style={styles.beforeAfterItem}>
            <Image source={{ uri: beforeImage }} style={styles.beforeAfterImage} />
            <Text style={styles.beforeAfterLabel}>Before</Text>
          </View>
          <View style={styles.beforeAfterItem}>
            <Image source={{ uri: afterImage }} style={styles.beforeAfterImage} />
            <Text style={styles.beforeAfterLabel}>After</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    ...theme.shadows.sm
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm
  },
  customerInfo: {
    flex: 1
  },
  customerName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs
  },
  ratingContainer: {
    flexDirection: 'row',
    gap: 2
  },
  videoButton: {
    padding: theme.spacing.sm
  },
  testimonialText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[700],
    lineHeight: 20,
    marginBottom: theme.spacing.md
  },
  beforeAfterContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md
  },
  beforeAfterItem: {
    flex: 1,
    alignItems: 'center'
  },
  beforeAfterImage: {
    width: '100%',
    height: 80,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs
  },
  beforeAfterLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.gray[600],
    fontWeight: '500'
  }
});