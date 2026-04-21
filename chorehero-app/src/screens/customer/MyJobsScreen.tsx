/**
 * My Jobs - Customer sees their posted video quote jobs, tap to view QuoteList.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { jobQuoteService, Job } from '../../services/jobQuoteService';
import { wp, hp } from '../../utils/responsive';

type StackParamList = {
  MyJobs: { justPosted?: boolean; newJobId?: string; newJobHeadline?: string; newJobCategory?: string } | undefined;
  QuoteList: { jobId: string };
};

type MyJobsNavigationProp = StackNavigationProp<StackParamList, 'MyJobs'>;

const MyJobsScreen: React.FC<{ navigation: MyJobsNavigationProp }> = ({ navigation }) => {
  const route = useRoute<any>();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [menuJob, setMenuJob] = useState<Job | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successJobPreview, setSuccessJobPreview] = useState<{ headline: string; category: string } | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      const justPosted = route.params?.justPosted;
      const newJobId = route.params?.newJobId;
      const newJobHeadline = route.params?.newJobHeadline;
      const newJobCategory = route.params?.newJobCategory;
      if (justPosted && newJobId) {
        setShowSuccessModal(true);
        setSuccessJobPreview(
          newJobHeadline && newJobCategory
            ? { headline: newJobHeadline, category: newJobCategory }
            : null
        );
        navigation.setParams({
          justPosted: undefined,
          newJobId: undefined,
          newJobHeadline: undefined,
          newJobCategory: undefined,
        });
      }
    }, [route.params?.justPosted, route.params?.newJobId])
  );

  const loadJobs = useCallback(async () => {
    if (!user?.id) return;
    const res = showArchived
      ? await jobQuoteService.getCustomerJobsArchived(user.id)
      : await jobQuoteService.getCustomerJobs(user.id);
    if (res.success && res.data) {
      setJobs(res.data);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user?.id, showArchived]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const onRefresh = () => {
    setRefreshing(true);
    loadJobs();
  };

  const handlePermanentDelete = (job: Job) => {
    setMenuJob(null);
    const canDelete = ['booked', 'expired', 'cancelled'].includes(job.status);
    if (!canDelete) {
      Alert.alert('Cannot Delete', 'Only completed, expired, or cancelled jobs can be permanently deleted.');
      return;
    }
    Alert.alert(
      'Delete Forever?',
      'This cannot be undone. All job photos and videos will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await jobQuoteService.permanentlyDeleteJob(job.id);
            if (res.success) {
              setJobs((prev) => prev.filter((j) => j.id !== job.id));
            } else {
              Alert.alert('Error', res.error || 'Failed to delete job');
            }
          },
        },
      ]
    );
  };

  const renderJobCard = ({ item }: { item: Job }) => {
    const isExpired = new Date(item.expires_at) < new Date();
    const statusLabel =
      item.status === 'booked'
        ? 'Booked'
        : item.status === 'expired'
          ? 'Expired'
          : isExpired
            ? 'Expired'
            : 'Open';

    return (
      <View style={styles.cardWrapper}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('QuoteList', { jobId: item.id })}
          activeOpacity={0.8}
        >
          <Text style={styles.headline} numberOfLines={2}>
            {item.headline}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.category}>{jobQuoteService.getCategoryLabel(item.category)}</Text>
            <View style={[styles.statusBadge, isExpired && styles.statusExpired]}>
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
          </View>
          <Text style={styles.quoteHint}>View quotes</Text>
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={(e) => {
              e.stopPropagation();
              setMenuJob(item);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color="#6B7280" />
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" style={styles.chevron} />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#26B7C9" />
        <Text style={styles.loadingText}>Loading your jobs...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Jobs</Text>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJobCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#26B7C9" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="briefcase-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {showArchived ? 'No archived jobs' : 'No jobs yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {showArchived ? 'Archived jobs will appear here' : 'Post a job to get video quotes from pros'}
            </Text>
            {!showArchived && (
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={() => navigation.navigate('PostJob' as any)}
              >
                <Text style={styles.emptyCtaText}>Post a Job</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        ListFooterComponent={
          !showArchived && jobs.length >= 20 ? (
            <TouchableOpacity
              style={styles.showArchivedBtn}
              onPress={() => setShowArchived(true)}
            >
              <Text style={styles.showArchivedText}>Show Archived</Text>
            </TouchableOpacity>
          ) : showArchived ? (
            <TouchableOpacity
              style={styles.showArchivedBtn}
              onPress={() => setShowArchived(false)}
            >
              <Text style={styles.showArchivedText}>Back to Recent Jobs</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successCheckCircle}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Job Posted Successfully!</Text>
            <Text style={styles.successSubtext}>
              Your job is live. Pros will send video quotes shortly.
            </Text>
            {successJobPreview && (
              <View style={styles.successJobPreview}>
                <Text style={styles.successJobHeadline} numberOfLines={2}>
                  {successJobPreview.headline}
                </Text>
                <Text style={styles.successJobCategory}>
                  {jobQuoteService.getCategoryLabel(successJobPreview.category as any)}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.successCta}
              onPress={() => {
                setShowSuccessModal(false);
                setSuccessJobPreview(null);
                loadJobs();
              }}
            >
              <Text style={styles.successCtaText}>View My Jobs</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!menuJob} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuJob(null)}
        >
          <View style={styles.menuCard}>
            {menuJob && (
              <>
                {['booked', 'expired', 'cancelled'].includes(menuJob.status) && (
                  <TouchableOpacity
                    style={[styles.menuItem, styles.menuItemDanger]}
                    onPress={() => handlePermanentDelete(menuJob)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                    <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>
                      Delete permanently
                    </Text>
                  </TouchableOpacity>
                )}
                {menuJob.status === 'open' && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      const toEdit = menuJob;
                      setMenuJob(null);
                      navigation.navigate('PostJob' as any, { editJob: toEdit });
                    }}
                  >
                    <Ionicons name="create-outline" size={20} color="#0F172A" />
                    <Text style={styles.menuItemText}>Edit job</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => setMenuJob(null)}
                >
                  <Text style={styles.menuItemText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: hp('1%'), fontSize: wp('4%'), color: '#6B7280' },
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
  listContent: { padding: wp('4%'), paddingBottom: hp('15%') },
  cardWrapper: { marginBottom: hp('2%') },
  card: {
    backgroundColor: '#fff',
    borderRadius: wp('4%'),
    padding: wp('4%'),
    marginBottom: hp('2%'),
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  headline: { flex: 1, fontSize: wp('4%'), fontWeight: '700', color: '#1F2937' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: wp('2%'), marginTop: 4 },
  category: { fontSize: wp('3%'), color: '#6B7280' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#26B7C9',
  },
  statusExpired: { backgroundColor: '#9CA3AF' },
  statusText: { fontSize: wp('2.5%'), fontWeight: '600', color: '#fff' },
  quoteHint: { fontSize: wp('3%'), color: '#26B7C9', marginTop: 4 },
  menuBtn: { padding: 4, marginLeft: wp('1%') },
  chevron: { marginLeft: wp('1%') },
  showArchivedBtn: {
    marginTop: hp('2%'),
    paddingVertical: hp('1.5%'),
    alignItems: 'center',
  },
  showArchivedText: { fontSize: wp('4%'), color: '#26B7C9', fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: wp('4%'),
    padding: wp('2%'),
    minWidth: wp('60%'),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    gap: wp('3%'),
  },
  menuItemDanger: {},
  menuItemText: { fontSize: wp('4%'), color: '#1F2937' },
  menuItemTextDanger: { color: '#DC2626' },
  empty: {
    alignItems: 'center',
    paddingVertical: hp('15%'),
  },
  emptyTitle: { fontSize: wp('5%'), fontWeight: '700', color: '#6B7280', marginTop: hp('2%') },
  emptySubtitle: { fontSize: wp('4%'), color: '#9CA3AF', marginTop: 4 },
  emptyCta: {
    marginTop: hp('4%'),
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('1.5%'),
    backgroundColor: '#26B7C9',
    borderRadius: wp('3%'),
  },
  emptyCtaText: { fontSize: wp('4%'), fontWeight: '700', color: '#fff' },
  successModalCard: {
    backgroundColor: '#fff',
    borderRadius: wp('5%'),
    padding: wp('6%'),
    alignItems: 'center',
    minWidth: wp('80%'),
    marginHorizontal: wp('5%'),
  },
  successCheckCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  successTitle: { fontSize: wp('5%'), fontWeight: '800', color: '#1F2937', marginBottom: hp('1%') },
  successSubtext: { fontSize: wp('4%'), color: '#6B7280', textAlign: 'center', marginBottom: hp('3%') },
  successJobPreview: {
    backgroundColor: '#F3F4F6',
    borderRadius: wp('3%'),
    padding: wp('4%'),
    alignSelf: 'stretch',
    marginBottom: hp('3%'),
  },
  successJobHeadline: { fontSize: wp('4%'), fontWeight: '700', color: '#1F2937' },
  successJobCategory: { fontSize: wp('3%'), color: '#6B7280', marginTop: 4 },
  successCta: {
    backgroundColor: '#26B7C9',
    paddingVertical: hp('1.7%'),
    paddingHorizontal: wp('8%'),
    borderRadius: wp('3%'),
  },
  successCtaText: { fontSize: wp('4%'), fontWeight: '700', color: '#fff' },
});

export default MyJobsScreen;
