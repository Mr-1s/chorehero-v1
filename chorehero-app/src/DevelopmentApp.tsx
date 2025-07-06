import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { COLORS, SPACING, TYPOGRAPHY } from './utils/constants';

export default function DevelopmentApp() {
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null);

  const demoScreens = [
    {
      id: 'video-discovery',
      title: '📹 Video Discovery',
      description: 'TikTok-style cleaner videos',
      status: 'built'
    },
    {
      id: 'booking-flow',
      title: '⚡ Express Booking',
      description: '60-second booking process',
      status: 'built'
    },
    {
      id: 'live-tracking',
      title: '📍 Live Tracking',
      description: 'Real-time location updates',
      status: 'built'
    },
    {
      id: 'chat-interface',
      title: '💬 Chat Interface',
      description: 'Customer-cleaner messaging',
      status: 'built'
    },
    {
      id: 'payments',
      title: '💳 Stripe Payments',
      description: 'Marketplace payments system',
      status: 'built'
    },
    {
      id: 'ratings',
      title: '⭐ Rating System',
      description: 'Two-way rating system',
      status: 'built'
    }
  ];

  const handleDemoPress = (demoId: string, title: string) => {
    Alert.alert(
      title,
      'This feature is fully implemented! To test with real data, you need to:\n\n1. Set up a Supabase database\n2. Configure your .env file with real credentials\n3. Set EXPO_PUBLIC_DEV_MODE=false',
      [{ text: 'Got it!', style: 'default' }]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.logo}>🎉 ChoreHero</Text>
          <Text style={styles.tagline}>Video-First Cleaning Marketplace</Text>
          <View style={styles.devBadge}>
            <Text style={styles.devBadgeText}>🔧 DEVELOPMENT MODE</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>📱 App Status</Text>
            <View style={styles.statusCard}>
              <Text style={styles.statusTitle}>✅ All Features Built & Ready</Text>
              <Text style={styles.statusText}>
                The app is running in development mode with mock data.
                All core features are implemented and ready for backend integration.
              </Text>
            </View>
          </View>

          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>🚀 Available Features</Text>
            {demoScreens.map((demo) => (
              <TouchableOpacity
                key={demo.id}
                style={styles.demoCard}
                onPress={() => handleDemoPress(demo.id, demo.title)}
              >
                <View style={styles.demoHeader}>
                  <Text style={styles.demoTitle}>{demo.title}</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>✅ BUILT</Text>
                  </View>
                </View>
                <Text style={styles.demoDescription}>{demo.description}</Text>
                <Text style={styles.tapToTest}>Tap to learn more →</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.setupSection}>
            <Text style={styles.sectionTitle}>⚙️ Backend Setup</Text>
            <View style={styles.setupCard}>
              <Text style={styles.setupTitle}>Ready for Production</Text>
              <Text style={styles.setupText}>
                To connect to a real backend:
              </Text>
              <View style={styles.setupSteps}>
                <Text style={styles.setupStep}>1. Create a Supabase project</Text>
                <Text style={styles.setupStep}>2. Run the database setup script</Text>
                <Text style={styles.setupStep}>3. Update .env with your credentials</Text>
                <Text style={styles.setupStep}>4. Set EXPO_PUBLIC_DEV_MODE=false</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 60,
    paddingBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
  },
  logo: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.text.inverse,
    marginBottom: SPACING.sm,
  },
  tagline: {
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.text.inverse,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  devBadge: {
    backgroundColor: COLORS.warning,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
  },
  devBadgeText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
    color: COLORS.text.primary,
  },
  content: {
    padding: SPACING.lg,
  },
  statusSection: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.lg,
  },
  statusCard: {
    backgroundColor: COLORS.success,
    padding: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.inverse,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  statusText: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.inverse,
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresSection: {
    marginBottom: SPACING.xl,
  },
  demoCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  demoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  demoTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    flex: 1,
  },
  statusBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: '600',
    color: COLORS.text.inverse,
  },
  demoDescription: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING.sm,
  },
  tapToTest: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  setupSection: {
    marginBottom: SPACING.xl,
  },
  setupCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  setupTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  setupText: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    marginBottom: SPACING.md,
  },
  setupSteps: {
    marginLeft: SPACING.md,
  },
  setupStep: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
    lineHeight: 22,
  },
});