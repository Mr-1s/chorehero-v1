import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './shared/theme';

// Import the variations
import TrustFirstApp from './trust-first/App';
import SpeedFirstApp from './speed-first/App';
import SocialProofApp from './social-proof/App';

type VariationType = 'trust-first' | 'speed-first' | 'social-proof' | null;

const variations = [
  {
    id: 'trust-first' as VariationType,
    title: 'Trust-First Design',
    subtitle: 'Safety & Verification Focus',
    description: 'Emphasizes security, background checks, and building confidence through comprehensive verification',
    image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop',
    features: [
      'Prominent trust badges and verification status',
      'Background check indicators',
      'Insurance information visible',
      'Professional, conservative UI'
    ],
    color: theme.colors.success,
    icon: 'shield-checkmark'
  },
  {
    id: 'speed-first' as VariationType,
    title: 'Speed-First Design',
    subtitle: 'Minimal Friction Booking',
    description: 'Optimized for fastest path to booking with one-tap booking and express clean focus',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
    features: [
      'One-tap booking from swipe',
      'Pre-selected time slots',
      'Instant booking confirmation',
      'Express clean focus (30-45 min)'
    ],
    color: theme.colors.accent,
    icon: 'flash'
  },
  {
    id: 'social-proof' as VariationType,
    title: 'Social-Proof Design',
    subtitle: 'Community-Driven Experience',
    description: 'Heavy emphasis on video testimonials, customer reviews, and social sharing features',
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop',
    features: [
      'Customer video reviews prominent',
      'Before/after cleaning videos',
      'Social sharing features',
      'Instagram-style stories from cleaners'
    ],
    color: theme.colors.primary,
    icon: 'people'
  }
];

export default function VariationSelector() {
  const [selectedVariation, setSelectedVariation] = useState<VariationType>(null);

  if (selectedVariation) {
    switch (selectedVariation) {
      case 'trust-first':
        return <TrustFirstApp />;
      case 'speed-first':
        return <SpeedFirstApp />;
      case 'social-proof':
        return <SocialProofApp />;
      default:
        return null;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>ChoreHero MVP Variations</Text>
          <Text style={styles.subtitle}>
            Choose a design philosophy to explore the BiteSight-inspired cleaning marketplace
          </Text>
        </View>

        <View style={styles.variations}>
          {variations.map((variation) => (
            <TouchableOpacity
              key={variation.id}
              style={styles.variationCard}
              onPress={() => setSelectedVariation(variation.id)}
            >
              <Image source={{ uri: variation.image }} style={styles.variationImage} />
              
              <View style={styles.variationContent}>
                <View style={styles.variationHeader}>
                  <View style={[styles.variationIcon, { backgroundColor: variation.color }]}>
                    <Ionicons 
                      name={variation.icon as any} 
                      size={24} 
                      color={theme.colors.white} 
                    />
                  </View>
                  <View style={styles.variationTitleContainer}>
                    <Text style={styles.variationTitle}>{variation.title}</Text>
                    <Text style={styles.variationSubtitle}>{variation.subtitle}</Text>
                  </View>
                </View>
                
                <Text style={styles.variationDescription}>
                  {variation.description}
                </Text>
                
                <View style={styles.variationFeatures}>
                  {variation.features.map((feature, index) => (
                    <View key={index} style={styles.featureItem}>
                      <View style={[styles.featureDot, { backgroundColor: variation.color }]} />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
                
                <View style={styles.variationFooter}>
                  <Text style={[styles.exploreText, { color: variation.color }]}>
                    Explore this variation
                  </Text>
                  <Ionicons 
                    name="arrow-forward" 
                    size={16} 
                    color={variation.color} 
                  />
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Each variation maintains core functionality while showcasing different UX approaches
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray[50]
  },
  content: {
    padding: theme.spacing.md
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl
  },
  title: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: '700',
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginBottom: theme.spacing.sm
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.gray[600],
    textAlign: 'center',
    lineHeight: 22
  },
  variations: {
    gap: theme.spacing.lg
  },
  variationCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.md
  },
  variationImage: {
    width: '100%',
    height: 120
  },
  variationContent: {
    padding: theme.spacing.lg
  },
  variationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  variationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md
  },
  variationTitleContainer: {
    flex: 1
  },
  variationTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs
  },
  variationSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[600]
  },
  variationDescription: {
    fontSize: theme.fontSize.md,
    color: theme.colors.gray[700],
    lineHeight: 22,
    marginBottom: theme.spacing.md
  },
  variationFeatures: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  featureText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[700],
    flex: 1
  },
  variationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm
  },
  exploreText: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600'
  },
  footer: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md
  },
  footerText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[600],
    textAlign: 'center',
    lineHeight: 20
  }
});