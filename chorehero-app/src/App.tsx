import React from 'react';
import DevelopmentApp from './DevelopmentApp';
import MainApp from './MainApp';

const isDevelopmentMode = process.env.EXPO_PUBLIC_DEV_MODE === 'true';

export default function App() {
  // In development mode, show the development app
  // In production mode, show the full app with navigation
  return isDevelopmentMode ? <DevelopmentApp /> : <MainApp />;
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
  },
  content: {
    padding: SPACING.lg,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  heroTitle: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: '600',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  heroDescription: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresSection: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.lg,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: SPACING.sm,
  },
  featureTitle: {
    fontSize: TYPOGRAPHY.sizes.base,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  featureText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  statusSection: {
    marginBottom: SPACING.xl,
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
  },
  instructionsSection: {
    marginBottom: SPACING.xl,
  },
  instructionCard: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  instructionStep: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
    lineHeight: 24,
  },
});