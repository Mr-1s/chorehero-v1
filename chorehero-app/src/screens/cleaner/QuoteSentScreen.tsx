/**
 * Quote Sent - Success screen after pro submits a video quote.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { cleanerTheme } from '../../utils/theme';

const { colors, typography, radii, shadows, spacing } = cleanerTheme;

type StackParamList = {
  QuoteSent: { jobId: string; customerName?: string };
  Jobs: { initialTab?: string };
};

type QuoteSentNavigationProp = StackNavigationProp<StackParamList, 'QuoteSent'>;

const QuoteSentScreen: React.FC<{
  navigation: QuoteSentNavigationProp;
  route: { params: { jobId: string; customerName?: string } };
}> = ({ navigation, route }) => {
  const customerName = route.params?.customerName ?? 'Customer';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.content}>
        <View style={styles.successCard}>
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark" size={36} color={colors.textInverse} />
            </View>
          </View>
          <Text style={styles.title}>Quote sent to {customerName}</Text>
          <Text style={styles.subtitle}>They have 24 hours to respond.</Text>
          <Text style={styles.detail}>{"You'll be notified if they book or message."}</Text>
          <View style={styles.metaPill}>
            <Ionicons name="time-outline" size={14} color="#B45309" />
            <Text style={styles.metaPillText}>You can send more quotes while you wait.</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate('Jobs', { initialTab: 'available' })}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={[colors.accentTeal, '#E8941A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>Browse more jobs</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxl,
  },
  successCard: {
    width: '100%',
    borderRadius: radii.card,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.soft,
  },
  iconWrap: { marginBottom: spacing.xl },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  title: {
    ...typography.sectionHeading,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.2,
  },
  subtitle: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  detail: {
    ...typography.labelSmall,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  cta: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radii.pill,
    overflow: 'hidden',
    shadowColor: colors.accentTeal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaGradient: { paddingVertical: spacing.lg, alignItems: 'center' },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
});

export default QuoteSentScreen;
