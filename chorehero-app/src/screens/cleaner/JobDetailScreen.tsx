/**
 * Job Detail — Pro views job with My Content–style cards, info rows, video quote CTA.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Video } from 'expo-av';
import { ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { jobQuoteService, Job } from '../../services/jobQuoteService';
import { wp, hp } from '../../utils/responsive';
import { cleanerTheme } from '../../utils/theme';

const { width } = Dimensions.get('window');
const { colors, radii, shadows, spacing } = cleanerTheme;

type StackParamList = {
  QuoteJobDetail: { jobId: string };
  RecordQuote: { jobId: string };
};

type JobDetailNavigationProp = StackNavigationProp<StackParamList, 'JobDetail'>;

const JobDetailScreen: React.FC<{
  navigation: JobDetailNavigationProp;
  route: { params: { jobId: string } };
}> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { jobId } = route.params || {};
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!jobId) return;
      const res = await jobQuoteService.getJob(jobId);
      if (res.success && res.data) setJob(res.data);
      setLoading(false);
    })();
  }, [jobId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accentTeal} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Job not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.link}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const budgetText =
    job.budget_min_cents != null || job.budget_max_cents != null
      ? `$${job.budget_min_cents ? job.budget_min_cents / 100 : '?'} – $${job.budget_max_cents ? job.budget_max_cents / 100 : '?'}`
      : null;
  const locationParts = [job.street, job.city, job.state, job.zip_code].filter(Boolean);
  const locationText = locationParts.length ? locationParts.join(', ') : 'Location not specified';

  const footerPad = Math.max(insets.bottom, 12) + 8;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text style={styles.headerTitle}>Job details</Text>
          <Text style={styles.headerSubtitle}>Review & send a video quote</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: footerPad + 72 }]}
        showsVerticalScrollIndicator={false}
      >
        {job.media && job.media.length > 0 && (
          <View style={styles.mediaCard}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.gallery}
              contentContainerStyle={styles.galleryContent}
            >
              {job.media.map((m) =>
                m.media_type === 'video' ? (
                  <Video
                    key={m.id}
                    source={{ uri: m.media_url }}
                    style={styles.mediaItem}
                    useNativeControls
                    resizeMode={ResizeMode.COVER}
                  />
                ) : (
                  <Image key={m.id} source={{ uri: m.media_url }} style={styles.mediaItem} resizeMode="cover" />
                )
              )}
            </ScrollView>
          </View>
        )}

        <View style={styles.sheet}>
          <Text style={styles.headline}>{jobQuoteService.getJobDisplayTitle(job)}</Text>

          <View style={styles.badges}>
            <View style={[styles.badge, styles.badgeNeutral]}>
              <Text style={styles.badgeText}>{jobQuoteService.getCategoryLabel(job.category)}</Text>
            </View>
            <View style={[styles.badge, styles.badgeUrgent]}>
              <Text style={styles.badgeTextUrgent}>{jobQuoteService.getUrgencyLabel(job.urgency)}</Text>
            </View>
          </View>

          {job.description ? <Text style={styles.description}>{job.description}</Text> : null}

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIconWrap, { backgroundColor: `${colors.accentTeal}18` }]}>
                <Ionicons name="location" size={20} color={colors.accentTeal} />
              </View>
              <View style={styles.infoCopy}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{locationText}</Text>
              </View>
            </View>

            {budgetText ? (
              <View style={[styles.infoRow, styles.infoRowDivider]}>
                <View style={[styles.infoIconWrap, { backgroundColor: colors.successLight }]}>
                  <Ionicons name="cash" size={20} color="#059669" />
                </View>
                <View style={styles.infoCopy}>
                  <Text style={styles.infoLabel}>Customer budget</Text>
                  <Text style={styles.budget}>{budgetText}</Text>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.quoteHint}>
            <View style={styles.quoteHintIcon}>
              <Ionicons name="videocam" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.quoteHintTitle}>Next: video quote</Text>
              <Text style={styles.quoteHintBody}>
                Record or upload up to 60 seconds, then add your price and when you can do the job.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerPad }]}>
        <TouchableOpacity
          style={styles.ctaOuter}
          onPress={() => navigation.navigate('RecordQuote', { jobId: job.id })}
          activeOpacity={0.92}
        >
          <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaGradient}>
            <Ionicons name="videocam" size={22} color={colors.textInverse} />
            <Text style={styles.ctaText}>Send video quote</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg },
  errorText: { fontSize: wp('4%'), color: colors.textSecondary },
  link: { marginTop: hp('1%'), fontSize: wp('4%'), color: colors.accentTeal, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backBtn: { padding: 4, marginRight: 4 },
  headerTextBlock: { flex: 1 },
  headerTitle: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  mediaCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    overflow: 'hidden',
    ...shadows.card,
    marginBottom: spacing.lg,
  },
  gallery: { maxHeight: hp('32%') },
  galleryContent: { paddingHorizontal: 4 },
  mediaItem: {
    width: width - spacing.xl * 2 - 8,
    height: hp('32%'),
    borderRadius: radii.lg,
    marginHorizontal: 4,
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.soft,
  },
  headline: {
    fontSize: wp('5.2%'),
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: spacing.md,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  badgeNeutral: {
    backgroundColor: colors.metaBg,
  },
  badgeUrgent: {
    backgroundColor: colors.specialRequestBg,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  badgeTextUrgent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  infoCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 4,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  infoRowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  infoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: { flex: 1, minWidth: 0 },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 19,
  },
  budget: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: -0.2,
  },
  quoteHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  quoteHintIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quoteHintTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  quoteHintBody: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 17,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    ...shadows.soft,
  },
  ctaOuter: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    ...shadows.orange,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: hp('2%'),
  },
  ctaText: {
    fontSize: wp('4.25%'),
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
});

export default JobDetailScreen;
