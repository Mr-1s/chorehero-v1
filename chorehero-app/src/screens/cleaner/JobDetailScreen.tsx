/**
 * Job Detail - Pro views full job with photo/video gallery, description, Send Video Quote CTA.
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
import { jobQuoteService, Job } from '../../services/jobQuoteService';
import { wp, hp } from '../../utils/responsive';

const { width } = Dimensions.get('window');

type StackParamList = {
  QuoteJobDetail: { jobId: string };
  RecordQuote: { jobId: string };
};

type JobDetailNavigationProp = StackNavigationProp<StackParamList, 'JobDetail'>;

const JobDetailScreen: React.FC<{
  navigation: JobDetailNavigationProp;
  route: { params: { jobId: string } };
}> = ({ navigation, route }) => {
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
        <ActivityIndicator size="large" color="#F59E0B" />
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
      ? `$${job.budget_min_cents ? job.budget_min_cents / 100 : '?'} - $${job.budget_max_cents ? job.budget_max_cents / 100 : '?'}`
      : null;
  const locationParts = [job.street, job.city, job.state, job.zip_code].filter(Boolean);
  const locationText = locationParts.length ? locationParts.join(', ') : 'Location not specified';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job Details</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {job.media && job.media.length > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.gallery}
            contentContainerStyle={styles.galleryContent}
          >
            {job.media.map((m, i) =>
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
        )}

        <View style={styles.body}>
          <Text style={styles.headline}>{job.headline}</Text>
          <View style={styles.badges}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{jobQuoteService.getCategoryLabel(job.category)}</Text>
            </View>
            <View style={[styles.badge, styles.urgencyBadge]}>
              <Text style={styles.badgeText}>{jobQuoteService.getUrgencyLabel(job.urgency)}</Text>
            </View>
          </View>

          {job.description && (
            <Text style={styles.description}>{job.description}</Text>
          )}

          <View style={styles.row}>
            <Ionicons name="location-outline" size={18} color="#6B7280" />
            <Text style={styles.location}>{locationText}</Text>
          </View>

          {budgetText && (
            <View style={styles.row}>
              <Ionicons name="cash-outline" size={18} color="#6B7280" />
              <Text style={styles.budget}>{budgetText}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate('RecordQuote', { jobId: job.id })}
          activeOpacity={0.9}
        >
          <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.ctaGradient}>
            <Ionicons name="videocam" size={24} color="#fff" />
            <Text style={styles.ctaText}>Send Video Quote</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: wp('4%'), color: '#6B7280' },
  link: { marginTop: hp('1%'), fontSize: wp('4%'), color: '#26B7C9', fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: wp('5%'), fontWeight: '700', color: '#1F2937' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: hp('20%') },
  gallery: { maxHeight: hp('35%') },
  galleryContent: { paddingHorizontal: wp('2%') },
  mediaItem: { width: width - wp('4%'), height: hp('35%'), borderRadius: wp('3%'), marginHorizontal: wp('1%') },
  body: { padding: wp('4%') },
  headline: { fontSize: wp('5%'), fontWeight: '800', color: '#1F2937', marginBottom: hp('1%') },
  badges: { flexDirection: 'row', gap: wp('2%'), marginBottom: hp('2%') },
  badge: {
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.5%'),
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  urgencyBadge: { backgroundColor: '#FEF3C7' },
  badgeText: { fontSize: wp('3%'), fontWeight: '600', color: '#374151' },
  description: { fontSize: wp('4%'), color: '#4B5563', lineHeight: 22, marginBottom: hp('2%') },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: hp('1%') },
  location: { fontSize: wp('3.5%'), color: '#6B7280', flex: 1 },
  budget: { fontSize: wp('3.5%'), color: '#0F766E', fontWeight: '700' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: wp('4%'),
    paddingBottom: hp('4%'),
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cta: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#26B7C9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: hp('2%'),
  },
  ctaText: { fontSize: wp('4.5%'), fontWeight: '700', color: '#fff' },
});

export default JobDetailScreen;
