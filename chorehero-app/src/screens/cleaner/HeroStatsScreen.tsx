import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { contentAnalyticsService, type ContentAnalytics } from '../../services/contentAnalyticsService';
import { cleanerTheme } from '../../utils/theme';

const { colors, spacing, radii } = cleanerTheme;

type HeroStatsProps = {
  navigation: StackNavigationProp<any>;
};

const HeroStatsScreen: React.FC<HeroStatsProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<ContentAnalytics[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      const data = await contentAnalyticsService.getContentAnalytics(user.id);
      setAnalytics(data);
      setLoading(false);
    };
    load();
  }, [user?.id]);

  const summary = useMemo(() => {
    if (analytics.length === 0) {
      return {
        title: 'No video stats yet',
        detail: 'Post your first video to start tracking conversions.',
      };
    }
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const recent = analytics.filter(item => new Date(item.created_at) >= monthAgo);
    const withBookings = (recent.length ? recent : analytics)
      .filter(item => item.bookings_generated > 0);
    const topVideo = withBookings.sort((a, b) => b.bookings_generated - a.bookings_generated)[0];
    if (!topVideo) {
      return {
        title: 'Videos are live',
        detail: 'Keep posting to drive more bookings.',
      };
    }
    return {
      title: `Your '${topVideo.title || 'Hero'}' video led to ${topVideo.bookings_generated} bookings this month`,
      detail: `Conversion rate: ${(topVideo.conversion_rate || 0).toFixed(1)}%`,
    };
  }, [analytics]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerAction}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Performance</Text>
        <View style={styles.headerAction} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="analytics-outline" size={18} color="#26B7C9" />
            <Text style={styles.cardTitle}>Video Conversion</Text>
          </View>
          <Text style={styles.highlightText}>{summary.title}</Text>
          <Text style={styles.detailText}>{summary.detail}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="film-outline" size={18} color="#26B7C9" />
            <Text style={styles.cardTitle}>Recent Video Performance</Text>
          </View>
          {loading && <Text style={styles.detailText}>Loading analytics...</Text>}
          {!loading && analytics.length === 0 && (
            <Text style={styles.detailText}>No published videos yet.</Text>
          )}
          {!loading && analytics.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title || 'Untitled video'}</Text>
                <Text style={styles.rowSubtitle}>{item.bookings_generated} bookings</Text>
              </View>
              <Text style={styles.rowAmount}>{(item.conversion_rate || 0).toFixed(1)}%</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerAction: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  highlightText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  detailText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  rowInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  rowAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#26B7C9',
  },
});

export default HeroStatsScreen;
