import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';

import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { wp, hp } from '../../utils/responsive';

const { width } = Dimensions.get('window');

interface EarningsScreenProps {
  navigation: StackNavigationProp<any>;
}

interface EarningData {
  period: string;
  amount: number;
  jobs: number;
  avgPerJob: number;
}

interface PaymentHistory {
  id: string;
  date: string;
  amount: number;
  type: 'payout' | 'earning';
  status: 'completed' | 'pending' | 'processing';
  description: string;
}

const EarningsScreen: React.FC<EarningsScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  
  // Real earnings data state
  const [earningsData, setEarningsData] = useState({
    currentBalance: 0,
    pendingBalance: 0,
    totalEarnings: 0,
  });
  
  const [earningsHistory, setEarningsHistory] = useState<EarningData[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [pendingPayouts, setPendingPayouts] = useState<{ id: string; amount_cents: number; scheduled_at: string; booking_id: string }[]>([]);
  const [paidPayouts, setPaidPayouts] = useState<{ id: string; amount_cents: number; created_at: string; booking_id: string }[]>([]);

  const { currentBalance, pendingBalance, totalEarnings } = earningsData;

  useEffect(() => {
    loadEarningsData();
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) loadEarningsData();
    }, [user?.id])
  );

  const loadEarningsData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      console.log('💰 Loading earnings for cleaner:', user.id);

      // Get current date for calculations
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      // Fetch completed bookings for this cleaner
      const { data: completedBookings, error: completedError } = await supabase
        .from('bookings')
        .select('id, total_amount, cleaner_earnings, scheduled_time, status, special_instructions, address:addresses!address_id(street, city, state, zip_code)')
        .eq('cleaner_id', user.id)
        .eq('status', 'completed')
        .order('scheduled_time', { ascending: false });

      if (completedError) throw completedError;

      // Fetch pending bookings (confirmed but not completed)
      const { data: pendingBookings, error: pendingError } = await supabase
        .from('bookings')
        .select('id, total_amount, cleaner_earnings')
        .eq('cleaner_id', user.id)
        .in('status', ['confirmed', 'in_progress']);

      if (pendingError) throw pendingError;

      // Fetch payout_queue (pending payouts - 48h after job complete)
      const { data: payoutQueueData } = await supabase
        .from('payout_queue')
        .select('id, amount_cents, scheduled_at, booking_id')
        .eq('cleaner_id', user.id)
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true });

      setPendingPayouts(payoutQueueData || []);

      // Fetch transactions (completed payouts)
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('id, amount_cents, created_at, booking_id')
        .eq('pro_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);

      setPaidPayouts(transactionsData || []);

      // Calculate totals
      const totalEarned = (completedBookings || []).reduce((sum, b) => 
        sum + (b.cleaner_earnings || b.total_amount * 0.81 || 0), 0
      );
      
      const pendingFromBookings = (pendingBookings || []).reduce((sum, b) =>
        sum + (b.cleaner_earnings || b.total_amount * 0.81 || 0), 0
      );
      const pendingFromQueue = (payoutQueueData || []).reduce((sum, p) => sum + p.amount_cents / 100, 0);
      const pendingAmount = pendingFromBookings + pendingFromQueue;

      const availableBalance = totalEarned;

      setEarningsData({
        currentBalance: availableBalance,
        pendingBalance: pendingAmount,
        totalEarnings: totalEarned,
      });

      // Calculate earnings breakdown by period
      const weeklyBookings = (completedBookings || []).filter(b => 
        new Date(b.scheduled_time) >= startOfWeek
      );
      const monthlyBookings = (completedBookings || []).filter(b => 
        new Date(b.scheduled_time) >= startOfMonth
      );
      const lastMonthBookings = (completedBookings || []).filter(b => {
        const date = new Date(b.scheduled_time);
        return date >= startOfLastMonth && date <= endOfLastMonth;
      });
      const yearlyBookings = (completedBookings || []).filter(b => 
        new Date(b.scheduled_time) >= startOfYear
      );

      const calcPeriodData = (bookings: any[], label: string): EarningData => {
        const amount = bookings.reduce((sum, b) => sum + (b.cleaner_earnings || b.total_amount * 0.81 || 0), 0);
        const jobs = bookings.length;
        return {
          period: label,
          amount,
          jobs,
          avgPerJob: jobs > 0 ? amount / jobs : 0,
        };
      };

      setEarningsHistory([
        calcPeriodData(weeklyBookings, 'This Week'),
        calcPeriodData(monthlyBookings, 'This Month'),
        calcPeriodData(lastMonthBookings, 'Last Month'),
        calcPeriodData(yearlyBookings, 'This Year'),
      ]);

      // Build payment history from completed bookings
      const history: PaymentHistory[] = (completedBookings || []).slice(0, 10).map(b => ({
        id: b.id,
        date: new Date(b.scheduled_time).toISOString().split('T')[0],
        amount: b.cleaner_earnings || b.total_amount * 0.81 || 0,
        type: 'earning' as const,
        status: 'completed' as const,
        description: b.special_instructions?.split('.')[0] || (b.address ? [b.address.street, b.address.city, b.address.state].filter(Boolean).join(', ') : null) || 'Cleaning service',
      }));

      setPaymentHistory(history);
      console.log('✅ Earnings loaded:', { totalEarned, pendingAmount, jobCount: completedBookings?.length });

    } catch (error) {
      console.error('❌ Error loading earnings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEarningsData();
  };

  const handleWithdraw = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      // Navigate to withdrawal flow or show success
    }, 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4ECDC4';
      case 'processing': return '#FFD93D';
      case 'pending': return '#F59E0B';
      default: return '#718096';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'processing': return 'Processing';
      case 'pending': return 'Pending';
      default: return 'Unknown';
    }
  };

  const formatPayoutCountdown = (scheduledAt: string): string => {
    const scheduled = new Date(scheduledAt);
    const now = new Date();
    const diffMs = scheduled.getTime() - now.getTime();
    if (diffMs <= 0) return 'Processing...';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `Payout in ${days}d ${hours % 24}h`;
    return `Payout in ${hours}h`;
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ECDC4" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Earnings</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Balance Cards */}
        <View style={styles.balanceContainer}>
          <LinearGradient
            colors={['#4ECDC4', '#44A08D']}
            style={styles.balanceCard}
          >
            <Text style={styles.balanceLabel}>Available Balance</Text>
            <Text style={styles.balanceAmount}>${currentBalance.toFixed(2)}</Text>
            <TouchableOpacity 
              style={styles.withdrawButton}
              onPress={handleWithdraw}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="card" size={16} color="#ffffff" />
                  <Text style={styles.withdrawText}>Withdraw</Text>
                </>
              )}
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>${pendingBalance.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>${totalEarnings.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Total Earned</Text>
            </View>
          </View>
        </View>

        {/* Pending Payouts (payout_queue - 48h after job complete) */}
        {pendingPayouts.length > 0 && (
          <View style={styles.analyticsContainer}>
            <Text style={styles.sectionTitle}>Pending Payouts</Text>
            <Text style={styles.sectionSubtitle}>Payouts are sent 48 hours after job completion</Text>
            {pendingPayouts.map((p) => (
              <View key={p.id} style={styles.analyticsCard}>
                <View style={styles.analyticsHeader}>
                  <Text style={styles.periodText}>${(p.amount_cents / 100).toFixed(2)}</Text>
                  <Text style={[styles.amountText, { fontSize: wp('3.5%') }]}>{formatPayoutCountdown(p.scheduled_at)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Earnings Analytics */}
        <View style={styles.analyticsContainer}>
          <Text style={styles.sectionTitle}>Earnings Breakdown</Text>
          
          {(earningsHistory || []).length > 0 ? (
            (earningsHistory || []).map((data, index) => (
              <View key={index} style={styles.analyticsCard}>
                <View style={styles.analyticsHeader}>
                  <Text style={styles.periodText}>{data.period}</Text>
                  <Text style={styles.amountText}>${data.amount.toFixed(2)}</Text>
                </View>
                <View style={styles.analyticsDetails}>
                  <View style={styles.analyticsItem}>
                    <Ionicons name="briefcase" size={16} color="#718096" />
                    <Text style={styles.analyticsLabel}>{data.jobs} jobs</Text>
                  </View>
                  <View style={styles.analyticsItem}>
                    <Ionicons name="trending-up" size={16} color="#718096" />
                    <Text style={styles.analyticsLabel}>${data.avgPerJob.toFixed(2)} avg</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="analytics-outline" size={48} color="#CBD5E0" />
              </View>
              <Text style={styles.emptyTitle}>No Earnings Yet</Text>
              <Text style={styles.emptySubtitle}>
                Complete your first job to see your earnings breakdown here
              </Text>
            </View>
          )}
        </View>

        {/* Paid Payouts (transactions) */}
        {paidPayouts.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.sectionTitle}>Paid Payouts</Text>
            {paidPayouts.map((t) => (
              <View key={t.id} style={styles.historyItem}>
                <View style={styles.historyIcon}>
                  <Ionicons name="checkmark-circle" size={24} color="#4ECDC4" />
                </View>
                <View style={styles.historyDetails}>
                  <Text style={styles.historyDescription}>Payout to bank</Text>
                  <Text style={styles.historyDate}>{new Date(t.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={styles.historyAmount}>
                  <Text style={[styles.historyAmountText, { color: '#4ECDC4' }]}>+${(t.amount_cents / 100).toFixed(2)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: '#4ECDC4' }]}>
                    <Text style={styles.statusText}>Paid</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Payment History */}
        <View style={styles.historyContainer}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          
          {(paymentHistory || []).length > 0 ? (
            (paymentHistory || []).map((payment) => (
              <View key={payment.id} style={styles.historyItem}>
                <View style={styles.historyIcon}>
                  <Ionicons 
                    name={payment.type === 'earning' ? 'add-circle' : 'card'} 
                    size={24} 
                    color={payment.type === 'earning' ? '#4ECDC4' : '#6B7280'} 
                  />
                </View>
                <View style={styles.historyDetails}>
                  <Text style={styles.historyDescription}>{payment.description}</Text>
                  <Text style={styles.historyDate}>{payment.date}</Text>
                </View>
                <View style={styles.historyAmount}>
                  <Text style={[
                    styles.historyAmountText,
                    { color: payment.type === 'earning' ? '#4ECDC4' : '#2d3748' }
                  ]}>
                    {payment.type === 'earning' ? '+' : ''}${payment.amount.toFixed(2)}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(payment.status) }]}>
                    <Text style={styles.statusText}>{getStatusText(payment.status)}</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="receipt-outline" size={48} color="#CBD5E0" />
              </View>
              <Text style={styles.emptyTitle}>No Payment History</Text>
              <Text style={styles.emptySubtitle}>
                Your payment transactions will appear here once you start earning
              </Text>
            </View>
          )}
        </View>

        {/* Tax Information */}
        <View style={styles.taxContainer}>
          <View style={styles.taxCard}>
            <Ionicons name="document-text" size={24} color="#4ECDC4" />
            <View style={styles.taxInfo}>
              <Text style={styles.taxTitle}>Tax Information</Text>
              <Text style={styles.taxSubtitle}>Download your 1099 forms and earnings summary</Text>
            </View>
            <TouchableOpacity style={styles.taxButton}>
              <Ionicons name="download" size={20} color="#4ECDC4" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.5%'),
    backgroundColor: '#26B7C9',
    paddingTop: hp('6%'),
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: wp('5%'),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: wp('5%'),
    fontWeight: '600',
    color: '#ffffff',
  },
  placeholder: {
    width: 40,
  },
  balanceContainer: {
    paddingHorizontal: wp('5%'),
    marginTop: 0,
    paddingTop: hp('2.5%'),
  },
  balanceCard: {
    borderRadius: 18,
    padding: 20,
    marginBottom: hp('1.8%'),
  },
  balanceLabel: {
    fontSize: wp('4%'),
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: hp('1%'),
  },
  balanceAmount: {
    fontSize: wp('9%'),
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: hp('2%'),
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: wp('3%'),
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('6%'),
  },
  withdrawText: {
    color: '#ffffff',
    fontSize: wp('4%'),
    fontWeight: '600',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginHorizontal: wp('1.5%'),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: hp('0.5%'),
  },
  statLabel: {
    fontSize: wp('3.5%'),
    color: '#718096',
  },
  analyticsContainer: {
    paddingHorizontal: wp('5%'),
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: wp('5%'),
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: hp('2%'),
  },
  sectionSubtitle: {
    fontSize: wp('3.5%'),
    color: '#718096',
    marginBottom: hp('1.5%'),
  },
  analyticsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    marginBottom: hp('1%'),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  analyticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
  },
  periodText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#2d3748',
  },
  amountText: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#26B7C9',
  },
  analyticsDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  analyticsItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  analyticsLabel: {
    fontSize: wp('3.5%'),
    color: '#718096',
    marginLeft: 6,
  },
  historyContainer: {
    paddingHorizontal: wp('5%'),
    marginTop: 30,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: hp('1%'),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyIcon: {
    marginRight: 12,
  },
  historyDetails: {
    flex: 1,
  },
  historyDescription: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: hp('0.5%'),
  },
  historyDate: {
    fontSize: wp('3.5%'),
    color: '#718096',
  },
  historyAmount: {
    alignItems: 'flex-end',
  },
  historyAmountText: {
    fontSize: wp('4%'),
    fontWeight: '700',
    marginBottom: hp('0.5%'),
  },
  statusBadge: {
    paddingHorizontal: wp('2%'),
    paddingVertical: 2,
    borderRadius: wp('2%'),
  },
  statusText: {
    fontSize: wp('2.5%'),
    fontWeight: '600',
    color: '#ffffff',
  },
  taxContainer: {
    paddingHorizontal: wp('5%'),
    marginTop: 30,
  },
  taxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taxInfo: {
    flex: 1,
    marginLeft: 16,
  },
  taxTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: hp('0.5%'),
  },
  taxSubtitle: {
    fontSize: wp('3.5%'),
    color: '#718096',
  },
  taxButton: {
    width: 40,
    height: 40,
    borderRadius: wp('5%'),
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSpacing: {
    height: 100,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: wp('4%'),
    color: '#718096',
  },
  // Empty State Styles
  emptyState: {
    alignItems: 'center',
    paddingVertical: hp('5%'),
    paddingHorizontal: wp('5%'),
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: wp('10%'),
    backgroundColor: '#F7FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('2%'),
  },
  emptyTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: hp('1%'),
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: wp('3.5%'),
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});

export default EarningsScreen; 