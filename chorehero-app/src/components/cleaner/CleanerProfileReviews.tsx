import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  rater: {
    name: string;
    avatar_url: string | null;
  };
  communication_rating?: number;
  timeliness_rating?: number;
  quality_rating?: number;
  professionalism_rating?: number;
}

interface RatingSummaryProps {
  average: number;
  count: number;
}

const StarRow: React.FC<{ rating: number; size?: number; color?: string }> = ({
  rating,
  size = 14,
  color = '#F59E0B',
}) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Ionicons
        key={i}
        name={i <= Math.round(rating) ? 'star' : 'star-outline'}
        size={size}
        color={color}
      />
    ))}
  </View>
);

const RatingSummary: React.FC<RatingSummaryProps> = ({ average, count }) => (
  <View style={styles.summaryContainer}>
    <Text style={styles.averageScore}>{average.toFixed(1)}</Text>
    <View style={styles.summaryRight}>
      <StarRow rating={average} size={18} />
      <Text style={styles.reviewCount}>{count} review{count !== 1 ? 's' : ''}</Text>
    </View>
  </View>
);

const ReviewCard: React.FC<{ review: Review }> = ({ review }) => {
  const initials = review.rater.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const date = new Date(review.created_at).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        {review.rater.avatar_url ? (
          <Image source={{ uri: review.rater.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewerName}>{review.rater.name}</Text>
          <View style={styles.reviewStarRow}>
            <StarRow rating={review.rating} />
            <Text style={styles.reviewDate}>{date}</Text>
          </View>
        </View>
      </View>
      {review.comment ? (
        <Text style={styles.reviewComment}>{review.comment}</Text>
      ) : null}
      {/* Category sub-ratings */}
      {(review.quality_rating || review.timeliness_rating || review.professionalism_rating) ? (
        <View style={styles.categoryRatings}>
          {review.quality_rating != null && (
            <View style={styles.categoryRow}>
              <Text style={styles.categoryLabel}>Quality</Text>
              <StarRow rating={review.quality_rating} size={11} />
            </View>
          )}
          {review.timeliness_rating != null && (
            <View style={styles.categoryRow}>
              <Text style={styles.categoryLabel}>Timeliness</Text>
              <StarRow rating={review.timeliness_rating} size={11} />
            </View>
          )}
          {review.professionalism_rating != null && (
            <View style={styles.categoryRow}>
              <Text style={styles.categoryLabel}>Professionalism</Text>
              <StarRow rating={review.professionalism_rating} size={11} />
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
};

interface CleanerProfileReviewsProps {
  cleanerId: string;
  /** Optional pre-fetched average — avoids a second query if already known */
  cachedAverage?: number;
}

const CleanerProfileReviews: React.FC<CleanerProfileReviewsProps> = ({
  cleanerId,
  cachedAverage,
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cleanerId) return;
    loadReviews();
  }, [cleanerId]);

  const loadReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from('ratings')
        .select(`
          id,
          rating,
          comment,
          created_at,
          communication_rating,
          timeliness_rating,
          quality_rating,
          professionalism_rating,
          rater:users!rater_id(name, avatar_url)
        `)
        .eq('rated_id', cleanerId)
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (dbError) throw dbError;
      setReviews((data as unknown as Review[]) || []);
    } catch (err) {
      console.error('Error loading reviews:', err);
      setError('Could not load reviews');
    } finally {
      setLoading(false);
    }
  };

  const average =
    cachedAverage ??
    (reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color="#26B7C9" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (reviews.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="star-outline" size={36} color="#D1D5DB" />
        <Text style={styles.emptyText}>No reviews yet</Text>
        <Text style={styles.emptySubtext}>Be the first to leave a review!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RatingSummary average={average} count={reviews.length} />
      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ReviewCard review={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        scrollEnabled={false}
      />
    </View>
  );
};

export default CleanerProfileReviews;

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 24 },
  centered: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  summaryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 20,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 16,
  },
  averageScore: { fontSize: 48, fontWeight: '700', color: '#111827' },
  summaryRight: { gap: 4 },
  reviewCount: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  reviewCard: {
    paddingVertical: 14,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#26B7C9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  reviewMeta: { flex: 1 },
  reviewerName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  reviewStarRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  reviewDate: { fontSize: 12, color: '#9CA3AF' },
  reviewComment: { fontSize: 14, color: '#374151', lineHeight: 20, marginTop: 10 },
  categoryRatings: { marginTop: 10, gap: 4 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryLabel: { fontSize: 12, color: '#6B7280', width: 110 },
  separator: { height: 1, backgroundColor: '#F3F4F6' },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  emptySubtext: { fontSize: 13, color: '#9CA3AF' },
  errorText: { fontSize: 14, color: '#EF4444' },
});
