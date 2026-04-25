/**
 * Booking Confirmed — DoorDash-style status + Airbnb-style layout.
 * Hybrid: strong confirmation banner, card-based detail timeline, soft neutrals.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Share,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { COLORS, SHADOWS } from '../../utils/constants';

export default function BookingConfirmedScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { bookingId } = route.params || {};
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: bookingData, error } = await supabase
        .from('bookings')
        .select(`
          id,
          total_amount,
          service_base_price,
          platform_fee,
          status,
          scheduled_time,
          quote_id,
          job_id,
          cleaner_id,
          address_id,
          job:jobs(id, headline, street, city, state, zip_code)
        `)
        .eq('id', bookingId)
        .single();

      if (error || !bookingData) {
        setLoading(false);
        return;
      }

      const result: any = { ...bookingData };
      if (bookingData.cleaner_id) {
        const { data: userData } = await supabase
          .from('users')
          .select('name, avatar_url')
          .eq('id', bookingData.cleaner_id)
          .single();
        result.cleaner = userData;
      }
      if (bookingData.address_id) {
        const { data: addrData } = await supabase
          .from('addresses')
          .select('street, city, state, zip_code')
          .eq('id', bookingData.address_id)
          .single();
        result.address = addrData;
      }
      setBooking(result);
      setLoading(false);
    })();
  }, [bookingId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyWrap}>
          <Ionicons name="alert-circle-outline" size={40} color={COLORS.text.muted} />
          <Text style={styles.emptyTitle}>Booking not found</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Bookings', { activeTab: 'upcoming' })}
          >
            <Text style={styles.primaryBtnText}>View My Bookings</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const amount = Number(booking.total_amount ?? 0);
  const jobHeadline = booking.job?.headline || 'Cleaning Service';
  const proName = booking.cleaner?.name || 'Your Pro';
  const address = booking.address
    ? [booking.address.street, booking.address.city, booking.address.state, booking.address.zip_code]
        .filter(Boolean)
        .join(', ')
    : booking.job
      ? [booking.job.street, booking.job.city, booking.job.state, booking.job.zip_code]
          .filter(Boolean)
          .join(', ')
      : 'Address pending';
  const dateLong = booking.scheduled_time
    ? new Date(booking.scheduled_time).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    : 'Date pending';
  const timeStr = booking.scheduled_time
    ? new Date(booking.scheduled_time).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';
  const shortId = booking.id?.slice(0, 8)?.toUpperCase() || '';

  const handleShare = () =>
    Share.share({
      message: `My ${jobHeadline} with ${proName} is booked on ChoreHero for ${dateLong}${timeStr ? ` at ${timeStr}` : ''}.`,
    }).catch(() => {});

  const handleTrack = () => navigation.navigate('LiveTracking', { bookingId: booking.id });
  const handleMessage = () =>
    navigation.navigate('IndividualChat', {
      cleanerId: booking.cleaner_id,
      bookingId: booking.id,
    });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      {/* Status banner (DoorDash-inspired) */}
      <View style={styles.statusBanner}>
        <View style={styles.statusIconWrap}>
          <Ionicons name="checkmark" size={22} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>You're booked</Text>
          <Text style={styles.statusSubtitle}>{dateLong}{timeStr ? ` · ${timeStr}` : ''}</Text>
        </View>
        <TouchableOpacity onPress={handleShare} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="share-outline" size={22} color={COLORS.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Service hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>SERVICE</Text>
          <Text style={styles.heroTitle}>{jobHeadline}</Text>
          <Text style={styles.heroMeta}>Confirmation #{shortId}</Text>
        </View>

        {/* Pro card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your Pro</Text>
          <View style={styles.proRow}>
            <View style={styles.proAvatar}>
              <Text style={styles.proAvatarText}>
                {proName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.proName}>{proName}</Text>
              <Text style={styles.proSub}>ChoreHero Pro</Text>
            </View>
            <TouchableOpacity style={styles.ghostBtn} onPress={handleMessage}>
              <Ionicons name="chatbubble-outline" size={16} color={COLORS.primary} />
              <Text style={styles.ghostBtnText}>Message</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* When & Where */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>When</Text>
          <View style={styles.iconRow}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.text.secondary} />
            <Text style={styles.iconRowText}>{dateLong}{timeStr ? `, ${timeStr}` : ''}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.cardLabel}>Where</Text>
          <View style={styles.iconRow}>
            <Ionicons name="location-outline" size={18} color={COLORS.text.secondary} />
            <Text style={styles.iconRowText} numberOfLines={2}>{address}</Text>
          </View>
        </View>

        {/* Payment */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Payment</Text>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>Total paid</Text>
            <Text style={styles.payValue}>${amount.toFixed(2)}</Text>
          </View>
          <View style={styles.payNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.success} />
            <Text style={styles.payNoteText}>Secured by ChoreHero. Refundable per policy.</Text>
          </View>
        </View>

        {/* What happens next */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>What happens next</Text>
          {[
            { icon: 'checkmark-circle', title: 'Booking confirmed', sub: 'Your pro has been notified' },
            { icon: 'chatbubbles-outline', title: 'Chat unlocks', sub: 'Coordinate access & details' },
            { icon: 'navigate-outline', title: 'Live tracking', sub: 'See your pro on the way' },
            { icon: 'sparkles-outline', title: 'Service day', sub: 'Sit back. Rate after.' },
          ].map((s, i, arr) => (
            <View key={s.title} style={styles.stepRow}>
              <View style={styles.stepIconWrap}>
                <Ionicons name={s.icon as any} size={16} color={COLORS.primary} />
                {i < arr.length - 1 ? <View style={styles.stepLine} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: 14 }}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepSub}>{s.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleTrack}>
          <Ionicons name="locate-outline" size={18} color={COLORS.primary} />
          <Text style={styles.secondaryBtnText}>Track</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Bookings', { activeTab: 'upcoming' })}
        >
          <Text style={styles.primaryBtnText}>View My Bookings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loader: { marginTop: 48 },
  scrollContent: { paddingBottom: 120 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  statusIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text.primary, letterSpacing: -0.2 },
  statusSubtitle: { fontSize: 13, color: COLORS.text.secondary, marginTop: 2 },

  heroCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    ...SHADOWS.e2,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: COLORS.text.muted,
    marginBottom: 4,
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text.primary, letterSpacing: -0.3 },
  heroMeta: { marginTop: 6, fontSize: 12, color: COLORS.text.muted },

  card: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 20,
    borderRadius: 16,
    ...SHADOWS.e1,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: COLORS.text.muted,
    marginBottom: 10,
    textTransform: 'uppercase',
  },

  proRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  proAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proAvatarText: { color: COLORS.primaryDark, fontWeight: '700' },
  proName: { fontSize: 16, fontWeight: '600', color: COLORS.text.primary },
  proSub: { fontSize: 13, color: COLORS.text.secondary, marginTop: 2 },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  ghostBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },

  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconRowText: { fontSize: 15, color: COLORS.text.primary, flex: 1 },
  divider: { height: 1, backgroundColor: COLORS.borderSoft, marginVertical: 16 },

  payRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payLabel: { color: COLORS.text.secondary, fontSize: 15 },
  payValue: { color: COLORS.text.primary, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  payNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  payNoteText: { color: COLORS.text.secondary, fontSize: 12 },

  stepRow: { flexDirection: 'row', gap: 12 },
  stepIconWrap: { alignItems: 'center', width: 24, paddingTop: 2 },
  stepLine: { flex: 1, width: 2, backgroundColor: COLORS.primarySoft, marginTop: 4 },
  stepTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text.primary },
  stepSub: { fontSize: 12, color: COLORS.text.secondary, marginTop: 2 },

  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyTitle: { fontSize: 16, color: COLORS.text.primary },
});
