/**
 * Founder Admin Dashboard - jobs, bookings, manual actions.
 * Access: role === 'admin' or email in ADMIN_EMAILS allowlist.
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { wp, hp } from '../../utils/responsive';

type StackParamList = {
  AdminDashboard: undefined;
  Settings: undefined;
};

type AdminDashboardNavigationProp = StackNavigationProp<StackParamList, 'AdminDashboard'>;

interface JobRow {
  id: string;
  headline: string;
  category: string;
  status: string;
  created_at: string;
}

interface BookingRow {
  id: string;
  status: string;
  total_amount?: number;
  cleaner_earnings?: number;
  created_at: string;
}

interface ServiceRequestRow {
  id: string;
  service_name: string;
  category: string;
  description: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const AdminDashboard: React.FC<{ navigation: AdminDashboardNavigationProp }> = ({ navigation }) => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [jobsRes, bookingsRes, requestsRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, headline, category, status, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('bookings')
          .select('id, status, total_amount, cleaner_earnings, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('service_requests')
          .select('id, service_name, category, description, status, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      setJobs((jobsRes.data || []) as JobRow[]);
      setBookings((bookingsRes.data || []) as BookingRow[]);
      setServiceRequests((requestsRes.data || []) as ServiceRequestRow[]);
    } catch (e) {
      console.error('AdminDashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleApproveServiceRequest = async (req: ServiceRequestRow) => {
    const slug = req.service_name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `svc-${req.id.slice(0, 8)}`;
    const { error: insertError } = await supabase.from('services').insert({
      name: req.service_name,
      slug,
      category: req.category,
      is_active: true,
      base_questions: [],
    });
    if (insertError) {
      Alert.alert('Approve failed', insertError.message);
      return;
    }
    await supabase.from('service_requests').update({ status: 'approved' }).eq('id', req.id);
    load();
  };

  const handleRejectServiceRequest = async (req: ServiceRequestRow) => {
    const { error } = await supabase
      .from('service_requests')
      .update({ status: 'rejected' })
      .eq('id', req.id);
    if (error) Alert.alert('Reject failed', error.message);
    else load();
  };

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleRefund = (bookingId: string) => {
    Alert.alert(
      'Refund',
      'Refund requires an Edge Function. Not implemented yet.',
      [{ text: 'OK' }]
    );
  };

  const handleReleasePayout = (bookingId: string) => {
    Alert.alert(
      'Release Payout Early',
      'Requires admin Edge Function. Not implemented yet.',
      [{ text: 'OK' }]
    );
  };

  const handleCancelJob = (jobId: string) => {
    Alert.alert(
      'Cancel Job',
      'Are you sure? This will update job status to cancelled.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            const { error } = await supabase
              .from('jobs')
              .update({ status: 'cancelled' })
              .eq('id', jobId);
            if (error) Alert.alert('Error', error.message);
            else load();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#26B7C9" />
        <Text style={styles.loadingText}>Loading...</Text>
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
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#26B7C9" />
        }
      >
        <Text style={styles.sectionTitle}>Service Requests ({serviceRequests.length})</Text>
        {serviceRequests.map((r) => (
          <View key={r.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle} numberOfLines={1}>{r.service_name}</Text>
              <Text style={styles.rowMeta}>{r.category} • {r.status}</Text>
              {r.description ? (
                <Text style={styles.rowMeta} numberOfLines={2}>{r.description}</Text>
              ) : null}
            </View>
            {r.status === 'pending' ? (
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleApproveServiceRequest(r)}>
                  <Text style={styles.actionBtnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleRejectServiceRequest(r)}>
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: hp('3%') }]}>Jobs ({jobs.length})</Text>
        {jobs.map((j) => (
          <View key={j.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle} numberOfLines={1}>{j.headline}</Text>
              <Text style={styles.rowMeta}>{j.category} • {j.status}</Text>
            </View>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleCancelJob(j.id)}
            >
              <Text style={styles.actionBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: hp('3%') }]}>Bookings ({bookings.length})</Text>
        {bookings.map((b) => (
          <View key={b.id} style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>${((b.total_amount ?? 0) / 100).toFixed(0)}</Text>
              <Text style={styles.rowMeta}>{b.status}</Text>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleReleasePayout(b.id)}
              >
                <Text style={styles.actionBtnText}>Release</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDanger]}
                onPress={() => handleRefund(b.id)}
              >
                <Text style={styles.actionBtnText}>Refund</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
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
  scroll: { flex: 1 },
  scrollContent: { padding: wp('4%'), paddingBottom: hp('15%') },
  sectionTitle: { fontSize: wp('4.5%'), fontWeight: '700', color: '#1F2937', marginBottom: hp('1%') },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: wp('4%'),
    borderRadius: wp('2%'),
    marginBottom: hp('1%'),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: wp('4%'), fontWeight: '600', color: '#1F2937' },
  rowMeta: { fontSize: wp('3%'), color: '#6B7280', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: wp('2%') },
  actionBtn: {
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.8%'),
    backgroundColor: '#26B7C9',
    borderRadius: wp('2%'),
  },
  actionBtnDanger: { backgroundColor: '#EF4444' },
  actionBtnText: { fontSize: wp('3%'), fontWeight: '600', color: '#fff' },
});

export default AdminDashboard;
