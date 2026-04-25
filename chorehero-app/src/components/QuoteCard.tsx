/**
 * Quote card for customer quote feed - pro video quote with price, availability, actions.
 */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import type { Quote } from '../services/jobQuoteService';
import { wp, hp } from '../utils/responsive';
import { colors, typography, radii, spacing, cleanerTheme } from '../utils/theme';

interface QuoteCardProps {
  quote: Quote;
  onBook: () => void;
  onMessage: () => void;
  onDecline: () => void;
  /** Open the pro’s public profile (same as Discover) — preferred over a disabled “Message” before booking. */
  onViewPro?: () => void;
  onView?: () => void;
  isPaying?: boolean;
  /** When true, show Message; before booking, use onViewPro instead of a locked chat icon. */
  messagingEnabled?: boolean;
  /** Cleaner read-only: no payment actions; uses orange accents (customer flow stays teal). */
  viewerRole?: 'customer' | 'pro';
  /** True when the signed-in cleaner is the pro who sent this quote (pro view only). */
  isOwnQuote?: boolean;
}

function quoteStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'viewed':
      return 'Viewed by customer';
    case 'accepted':
      return 'Booked — customer chose your quote';
    case 'declined':
      return 'Not selected';
    case 'expired':
      return 'Expired';
    case 'withdrawn':
      return 'Withdrawn';
    default:
      return status;
  }
}

export default function QuoteCard({
  quote,
  onBook,
  onMessage,
  onDecline,
  onViewPro,
  onView,
  isPaying,
  messagingEnabled = false,
  viewerRole = 'customer',
  isOwnQuote = false,
}: QuoteCardProps) {
  const isPro = viewerRole === 'pro';
  const priceAccent = isPro ? cleanerTheme.colors.primary : colors.primaryTeal;
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    onView?.();
  }, []);
  const player = useVideoPlayer(quote.video_url, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  const proName = (quote.pro as any)?.name || 'Pro';
  const avatarUrl = (quote.pro as any)?.avatar_url;
  const profiles = (quote.pro as any)?.cleaner_profiles;
  const rating =
    Array.isArray(profiles) && profiles[0]?.rating_average != null
      ? Number(profiles[0].rating_average).toFixed(1)
      : '—';

  return (
    <View style={[styles.card, isPro && styles.proCard]}>
      {isPro && isOwnQuote ? (
        <View style={styles.ownQuoteBadge}>
          <Ionicons name="send" size={14} color={cleanerTheme.colors.primaryDark} />
          <Text style={styles.ownQuoteBadgeText}>Your video quote</Text>
        </View>
      ) : null}
      {isPro && isOwnQuote ? (
        <Text style={[styles.statusLine, { color: cleanerTheme.colors.primaryDark }]}>
          {quoteStatusLabel(quote.status)}
        </Text>
      ) : null}
      <View style={styles.header}>
        <Image source={{ uri: avatarUrl || 'https://via.placeholder.com/48' }} style={styles.avatar} />
        <View style={styles.headerText}>
          <Text style={styles.name}>{proName}</Text>
          {rating !== '—' ? (
            <Text style={styles.rating}>
              <Text style={styles.ratingValue}>{rating}</Text>
              {'  '}
              <Text style={styles.ratingStar}>★</Text>
            </Text>
          ) : (
            <Text style={styles.ratingPending}>No reviews yet</Text>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.videoWrap} onPress={() => setMuted(!muted)} activeOpacity={1}>
        <VideoView player={player} style={styles.video} nativeControls={false} />
        {muted && (
          <View style={styles.muteBadge}>
            <Ionicons name="volume-mute" size={24} color="#fff" />
          </View>
        )}
      </TouchableOpacity>

      <Text style={[styles.price, { color: priceAccent }]}>${(quote.price_cents / 100).toFixed(0)}</Text>
      {quote.availability_text && (
        <Text style={styles.availability}>Available: {quote.availability_text}</Text>
      )}

      {isPro ? (
        <View style={styles.proNote}>
          <Ionicons name="lock-closed-outline" size={16} color={cleanerTheme.colors.primary} />
          <Text style={styles.proNoteText}>
            {isOwnQuote
              ? 'This is the video and price you sent. Only the customer can book or decline from their account.'
              : 'Read-only: only the customer can accept, pay, or decline a quote.'}
          </Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, isPaying && styles.primaryBtnDisabled]}
            onPress={onBook}
            disabled={isPaying}
          >
            {isPaying ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Text style={styles.primaryBtnText}>Accept & Pay</Text>
            )}
          </TouchableOpacity>

          <View style={styles.secondRow}>
            {messagingEnabled ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={onMessage} disabled={isPaying}>
                <Ionicons name="chatbubble-outline" size={18} color={colors.primaryTeal} />
                <Text style={styles.secondaryBtnText}>Message</Text>
              </TouchableOpacity>
            ) : onViewPro ? (
              <TouchableOpacity style={styles.secondaryBtn} onPress={onViewPro} disabled={isPaying}>
                <Ionicons name="person-circle-outline" size={20} color={colors.primaryTeal} />
                <Text style={styles.secondaryBtnText}>View profile</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.tertiaryBtn} onPress={onDecline} disabled={isPaying}>
              <Text style={styles.tertiaryBtnText}>Decline</Text>
            </TouchableOpacity>
          </View>
          {!messagingEnabled && onViewPro ? (
            <Text style={styles.hintText}>
              Message the same pro from their profile. In-app chat for this job opens after you book.
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutralBg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.borderSubtle },
  headerText: { marginLeft: spacing.md, flex: 1 },
  name: {
    fontSize: typography.sizes.titleSm,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  rating: { marginTop: 2, fontSize: typography.sizes.caption },
  ratingValue: { fontWeight: typography.weights.semibold, color: colors.textPrimary },
  ratingStar: { color: colors.star },
  ratingPending: {
    marginTop: 2,
    fontSize: typography.sizes.captionSm,
    color: colors.textMuted,
  },
  videoWrap: { width: '100%', aspectRatio: 9 / 16, maxHeight: hp('35%'), borderRadius: radii.md, overflow: 'hidden', backgroundColor: '#0f172a' },
  video: { width: '100%', height: '100%' },
  muteBadge: { position: 'absolute', bottom: 10, right: 10, padding: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: radii.sm },
  price: {
    fontSize: typography.sizes.titleLg + 2,
    fontWeight: typography.weights.extrabold,
    marginTop: spacing.md,
    letterSpacing: -0.5,
  },
  proNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: cleanerTheme.colors.primaryLight,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: cleanerTheme.colors.primaryBorder,
  },
  proNoteText: {
    flex: 1,
    fontSize: typography.sizes.caption,
    lineHeight: 18,
    color: cleanerTheme.colors.primaryDark,
    fontWeight: typography.weights.semibold,
  },
  proCard: {
    backgroundColor: cleanerTheme.colors.cardBg,
    borderColor: cleanerTheme.colors.primaryBorder,
  },
  ownQuoteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.sm,
    backgroundColor: cleanerTheme.colors.primaryLight,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: cleanerTheme.colors.primaryBorder,
  },
  ownQuoteBadgeText: {
    fontSize: typography.sizes.captionSm,
    fontWeight: typography.weights.bold,
    color: cleanerTheme.colors.primaryDark,
  },
  statusLine: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  availability: { fontSize: typography.sizes.body, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 20 },
  actions: { marginTop: spacing.lg },
  primaryBtn: {
    width: '100%',
    backgroundColor: colors.primaryTeal,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { fontSize: typography.sizes.bodyLg, fontWeight: typography.weights.bold, color: colors.textInverse },
  secondRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm, paddingRight: spacing.sm },
  secondaryBtnText: { fontSize: typography.sizes.body, fontWeight: typography.weights.semibold, color: colors.primaryTeal },
  tertiaryBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  tertiaryBtnText: { fontSize: typography.sizes.body, color: colors.textMuted, fontWeight: typography.weights.medium },
  hintText: {
    marginTop: spacing.sm,
    fontSize: typography.sizes.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
