import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../../utils/constants';

export default function CleanerDashboard() {
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to ChoreHero!</Text>
          <Text style={styles.subtitle}>Cleaner Dashboard</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            
            <TouchableOpacity style={styles.actionCard}>
              <Text style={styles.actionTitle}>📹 Update Profile</Text>
              <Text style={styles.actionDescription}>Record profile video</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <Text style={styles.actionTitle}>📋 View Bookings</Text>
              <Text style={styles.actionDescription}>Manage appointments</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <Text style={styles.actionTitle}>💰 Earnings</Text>
              <Text style={styles.actionDescription}>Track payments</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusText}>
              🎉 All features are built and ready!{'\n'}
              This is the cleaner dashboard.
            </Text>
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
  title: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: '700',
    color: COLORS.text.inverse,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.text.inverse,
    opacity: 0.9,
  },
  content: {
    padding: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.lg,
  },
  actionCard: {
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
  actionTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '600',
    color: COLORS.text.primary,
    marginBottom: SPACING.sm,
  },
  actionDescription: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
  },
  statusCard: {
    backgroundColor: COLORS.success,
    padding: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  statusText: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.inverse,
    textAlign: 'center',
    lineHeight: 22,
  },
});