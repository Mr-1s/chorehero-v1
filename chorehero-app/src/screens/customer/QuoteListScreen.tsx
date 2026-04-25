/**
 * Quote List - Customer sees job details + incoming video quotes.
 * Minimal replacement for QuoteFeed. Each quote has "Accept & Pay" → QuoteAccept.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { jobQuoteService, Job, Quote } from '../../services/jobQuoteService';
import { useAuth } from '../../hooks/useAuth';
import QuoteCard from '../../components/QuoteCard';
import { colors, typography, radii, spacing, cleanerTheme } from '../../utils/theme';

/** Customer flow uses teal; pro (cleaner) flow uses the same screen with orange only — keep tokens separate. */
const CUSTOMER_ACCENT = colors.primaryTeal;
const THUMB_W = Math.floor((Dimensions.get('window').width - 32 - 24) / 4);

type StackParamList = {
  QuoteList: { jobId: string; viewerRole?: 'customer' | 'pro' };
  QuoteAccept: { jobId: string; quoteId: string };
  MyJobs: undefined;
  PostJob: { editJob?: Job } | undefined;
  CleanerProfile: { cleanerId: string };
};

type QuoteListNavigationProp = StackNavigationProp<StackParamList, 'QuoteList'>;

function formatBudgetLine(job: Job): string {
  const minC = job.budget_min_cents;
  const maxC = job.budget_max_cents;
  if (minC == null && maxC == null) return 'Budget: flexible / not set';
  const a = minC != null ? minC / 100 : null;
  const b = maxC != null ? maxC / 100 : null;
  if (a != null && b != null) return `Budget: $${a} – $${b}`;
  if (a != null) return `Budget: from $${a}`;
  if (b != null) return `Budget: up to $${b}`;
  return 'Budget: flexible / not set';
}

function lineAddress(job: Job): string {
  const parts = [job.street, job.city, job.state, job.zip_code].filter(
    (p): p is string => typeof p === 'string' && p.length > 0
  );
  return parts.length ? parts.join(', ') : 'Add location in your posting';
}

function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

const QuoteListScreen: React.FC<{
  navigation: QuoteListNavigationProp;
  route: { params: { jobId: string; viewerRole?: 'customer' | 'pro' } };
}> = ({ navigation, route }) => {
  const { jobId, viewerRole } = route.params || {};
  const { user } = useAuth();
  const isPro = viewerRole === 'pro';
  const brand = isPro ? cleanerTheme.colors.primary : CUSTOMER_ACCENT;
  const [job, setJob] = useState<Job | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quoteInfoOpen, setQuoteInfoOpen] = useState(false);

  const load = useCallback(async () => {
    if (!jobId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const mergePro =
        isPro && user?.id && user.role === 'cleaner' ? { mergeProQuoteId: user.id } : undefined;
      const res = await jobQuoteService.getJobWithQuotes(jobId, mergePro);
      if (res.success && res.data) {
        setJob(res.data.job);
        setQuotes(res.data.quotes);
      } else {
        setJob(null);
        setQuotes([]);
      }
    } catch {
      setJob(null);
      setQuotes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [jobId, isPro, user?.id, user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const goProProfile = (proId: string) => {
    navigation.navigate('CleanerProfile', { cleanerId: proId });
  };

  const isExpired = job ? new Date(job.expires_at) < new Date() : false;
  const statusLabel =
    !job
      ? ''
      : job.status === 'booked'
        ? 'Booked'
        : job.status === 'cancelled'
          ? 'Cancelled'
          : job.status === 'expired' || isExpired
            ? 'Expired'
            : job.status === 'quotes_received' || quotes.length > 0
              ? 'Quotes received'
              : 'Waiting for quotes';

  const canEditPosting =
    !isPro &&
    !!job &&
    quotes.length === 0 &&
    job.status === 'open' &&
    !isExpired;

  const handleAcceptAndPay = (quote: Quote) => {
    navigation.navigate('QuoteAccept', { jobId, quoteId: quote.id });
  };

  const handleDecline = async (quote: Quote) => {
    const res = await jobQuoteService.declineQuote(quote.id);
    if (res.success) {
      setQuotes((prev) => prev.filter((q) => q.id !== quote.id));
    } else {
      Alert.alert('Error', res.error || 'Failed to decline');
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const goEditPosting = () => {
    if (!job || !canEditPosting) return;
    navigation.navigate('PostJob', { editJob: job });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, isPro && styles.proContainer]}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={brand} />
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={[styles.container, isPro && styles.proContainer]}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Job</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Job not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const categoryLabel = jobQuoteService.getCategoryLabel(job.category);
  const media = job.media ?? [];

  return (
    <SafeAreaView style={[styles.container, isPro && styles.proContainer]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={[styles.header, isPro && styles.proHeader]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {job.headline}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={brand} />
        }
      >
        <View style={[styles.summaryCard, isPro && styles.proSummaryCard]}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryTextBlock}>
              <Text style={[styles.summaryKicker, isPro && { color: brand }]}>{isPro ? 'Job request' : 'Posted job'}</Text>
              <Text style={styles.summaryHeadline}>{job.headline}</Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                isExpired
                  ? styles.statusExpired
                  : { backgroundColor: isPro ? brand : colors.primaryTeal },
              ]}
            >
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="pricetag-outline" size={18} color={brand} />
            <Text style={styles.metaText}>{categoryLabel}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="wallet-outline" size={18} color={isPro ? brand : colors.textSecondary} />
            <Text style={styles.metaText}>{formatBudgetLine(job)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={18} color={isPro ? brand : colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={2}>
              {lineAddress(job)}
            </Text>
          </View>
          {job.expires_at ? (
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={18} color={isPro ? brand : colors.textSecondary} />
              <Text style={styles.metaText}>
                {isExpired ? 'Expired' : 'Expires'} {shortDate(job.expires_at)}
              </Text>
            </View>
          ) : null}
          {canEditPosting ? (
            <TouchableOpacity
              style={[styles.editPostingBtn, { borderColor: brand }]}
              onPress={goEditPosting}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={18} color={brand} />
              <Text style={[styles.editPostingText, { color: brand }]}>Edit posting</Text>
            </TouchableOpacity>
          ) : !isPro && !isExpired && job.status !== 'cancelled' && job.status !== 'booked' ? (
            <TouchableOpacity
              style={styles.infoHint}
              onPress={() => setQuoteInfoOpen(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
              <Text style={styles.infoHintText}>Why can’t I edit? Tap for details</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {media.length > 0 ? (
          <View style={styles.mediaRow}>
            {media.slice(0, 4).map((m) => (
              <Image
                key={m.id}
                source={{ uri: m.media_url }}
                style={[styles.thumb, isPro && styles.proThumb]}
                resizeMode="cover"
              />
            ))}
          </View>
        ) : null}

        <View style={styles.incomingHeader}>
          <View style={styles.incomingHeaderLeft}>
            <Text style={styles.incomingTitle}>
              {isPro ? 'Quotes on this job' : 'Incoming quotes'}
            </Text>
            <TouchableOpacity
              onPress={() => setQuoteInfoOpen(true)}
              style={styles.infoIconBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="About quotes"
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={isPro ? brand : colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.quoteCountPill, isPro && styles.proQuoteCountPill]}>
            <Text style={[styles.quoteCountPillText, isPro && styles.proQuoteCountPillText]}>
              {quotes.length} video quote{quotes.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {job.description ? <Text style={styles.description}>{job.description}</Text> : null}

        {quotes.length === 0 ? (
          <View style={[styles.emptyBlock, isPro && styles.proEmptyBlock]}>
            <Ionicons name="videocam-outline" size={48} color={isPro ? brand : '#9CA3AF'} />
            <Text style={styles.emptyTitle}>No quotes yet</Text>
            <Text style={styles.emptyHint}>
              {isPro
                ? 'Pull down to refresh. When another pro sends a quote, it will appear here too.'
                : 'Pull down to refresh. Pros get notified to send short video quotes.'}
            </Text>
            <View style={[styles.stepsBox, isPro && styles.proStepsBox]}>
              <Text style={styles.stepsTitle}>What happens next</Text>
              {isPro ? (
                <>
                  <Text style={styles.stepLine}>
                    1. Customer reviews all video quotes for this post.
                  </Text>
                  <Text style={styles.stepLine}>
                    2. Only the customer can accept, pay, and start the booking.
                  </Text>
                  <Text style={styles.stepLine}>
                    3. You’ll get notified if yours is selected.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.stepLine}>
                    1. Local pros are notified and can review your post.
                  </Text>
                  <Text style={styles.stepLine}>
                    2. They send a video with price and availability.
                  </Text>
                  <Text style={styles.stepLine}>
                    3. You pick one to book and pay—then you can message in-app.
                  </Text>
                </>
              )}
            </View>
          </View>
        ) : (
          quotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              onBook={() => handleAcceptAndPay(quote)}
              onMessage={() => {}}
              onDecline={() => handleDecline(quote)}
              onViewPro={() => goProProfile(quote.pro_id)}
              messagingEnabled={false}
              viewerRole={isPro ? 'pro' : 'customer'}
              isOwnQuote={isPro && !!user?.id && quote.pro_id === user.id}
            />
          ))
        )}
      </ScrollView>

      <Modal
        visible={quoteInfoOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setQuoteInfoOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setQuoteInfoOpen(false)} />
          <View style={[styles.modalCard, isPro && styles.proModalCard]}>
            <Text style={styles.modalTitle}>How quotes work</Text>
            <Text style={styles.modalBody}>
              {isPro
                ? 'This is the same job the customer posted in the marketplace. You can review all video quotes here. Only the customer can accept and pay; this screen is read-only on your side.'
                : quotes.length > 0
                  ? 'Pros have sent at least one quote, so the job text is locked. Cancel this job in Bookings if you need a big change, then post a new one.\n\n'
                  : 'This job can no longer be edited. Start a new job from Bookings if you need changes.\n\n'}
              {!isPro
                ? `Incoming quotes are short videos with a price. Accept one to book and pay—then job chat in Messages
              opens for that booking. You can still open a pro profile to learn more or contact them the same way
              as in Discover.`
                : ''}
            </Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setQuoteInfoOpen(false)}>
              <Text style={[styles.modalCloseText, { color: isPro ? brand : colors.primaryTeal }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  proContainer: {
    backgroundColor: cleanerTheme.colors.primaryLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutralBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backBtn: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: typography.sizes.titleMd,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  headerSpacer: { width: 40 },
  proHeader: {
    backgroundColor: cleanerTheme.colors.cardBg,
    borderBottomColor: cleanerTheme.colors.primaryBorder,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl * 2,
  },
  summaryCard: {
    backgroundColor: colors.neutralBg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.md,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  proSummaryCard: {
    backgroundColor: cleanerTheme.colors.cardBg,
    borderColor: cleanerTheme.colors.primaryBorder,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  summaryTextBlock: { flex: 1, minWidth: 0 },
  summaryKicker: {
    fontSize: typography.sizes.captionSm,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryHeadline: {
    fontSize: typography.sizes.titleMd,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginTop: 4,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  metaText: {
    flex: 1,
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  incomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  incomingHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  infoIconBtn: { padding: 2 },
  incomingTitle: {
    fontSize: typography.sizes.titleSm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  quoteCountPill: {
    backgroundColor: colors.chipBg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  quoteCountPillText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  proQuoteCountPill: {
    backgroundColor: cleanerTheme.colors.primaryLight,
    borderColor: cleanerTheme.colors.primaryBorder,
  },
  proQuoteCountPillText: {
    color: cleanerTheme.colors.primaryDark,
  },
  statusBadge: {
    backgroundColor: colors.primaryTeal,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.xl,
  },
  statusExpired: {
    backgroundColor: colors.textMuted,
  },
  statusText: {
    color: colors.textInverse,
    fontSize: typography.sizes.captionSm,
    fontWeight: typography.weights.semibold,
  },
  description: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  mediaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  thumb: {
    width: THUMB_W,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  proThumb: {
    backgroundColor: cleanerTheme.colors.primaryLight,
  },
  emptyBlock: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 16,
  },
  proEmptyBlock: {
    backgroundColor: cleanerTheme.colors.cardBg,
    borderColor: cleanerTheme.colors.primaryBorder,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
  stepsBox: {
    alignSelf: 'stretch',
    marginTop: 20,
    padding: 12,
    backgroundColor: colors.cardBg,
    borderRadius: 10,
  },
  proStepsBox: {
    backgroundColor: cleanerTheme.colors.primaryLight,
    borderWidth: 1,
    borderColor: cleanerTheme.colors.primaryBorder,
  },
  stepsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  stepLine: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyWrap: {
    padding: 32,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editPostingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: CUSTOMER_ACCENT,
    gap: 6,
  },
  editPostingText: {
    fontSize: 15,
    fontWeight: '700',
    color: CUSTOMER_ACCENT,
  },
  infoHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  infoHintText: {
    flex: 1,
    fontSize: typography.sizes.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.neutralBg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    zIndex: 1,
  },
  proModalCard: {
    borderColor: cleanerTheme.colors.primaryBorder,
  },
  modalTitle: {
    fontSize: typography.sizes.titleSm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalBody: {
    fontSize: typography.sizes.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  modalClose: { marginTop: spacing.lg, alignSelf: 'flex-end', paddingVertical: spacing.xs },
  modalCloseText: {
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    color: colors.primaryTeal,
  },
});

export default QuoteListScreen;
