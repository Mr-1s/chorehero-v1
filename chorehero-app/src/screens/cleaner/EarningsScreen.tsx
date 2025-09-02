import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';

import { earningsService } from '../../services/earningsService';
import { errorHandlingService } from '../../services/errorHandlingService';

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
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  
  // EARNINGS DATA SOURCES - In production, this data will come from:
  // 1. Supabase 'bookings' table - completed jobs with cleaner_earnings
  // 2. Stripe Connect - actual payment transfers and balances
  // 3. Real-time calculations based on job completion dates
  
  const mockEarningsData = {
    currentBalance: 1247.50,    // Available for withdrawal (from Stripe)
    pendingBalance: 890.25,     // Jobs completed but not yet transferred
    totalEarnings: 15430.75,    // Lifetime earnings across all jobs
  };
  
  const emptyEarningsData = {
    currentBalance: 0,
    pendingBalance: 0,
    totalEarnings: 0,
  };
  
  const earningsData = emptyEarningsData; // TODO: Load real earnings data from database
  const { currentBalance, pendingBalance, totalEarnings } = earningsData;
  
  // EARNINGS BREAKDOWN - Will be calculated from:
  // - SELECT SUM(cleaner_earnings) FROM bookings WHERE cleaner_id = ? AND status = 'completed' GROUP BY date periods
  // - Real-time aggregation of job completions by week/month/year
  const mockEarningsHistory: EarningData[] = [
    { period: 'This Week', amount: 420.50, jobs: 6, avgPerJob: 70.08 },
    { period: 'This Month', amount: 2450.75, jobs: 23, avgPerJob: 106.55 },
    { period: 'Last Month', amount: 3120.25, jobs: 31, avgPerJob: 100.65 },
    { period: 'This Year', amount: 15430.75, jobs: 142, avgPerJob: 108.66 },
  ];
  
  const earningsHistory: EarningData[] = []; // TODO: Load real earnings history from database

  // PAYMENT HISTORY - Will come from:
  // - Stripe Connect transfer history (payouts to cleaner bank account)
  // - Supabase 'bookings' table (individual job earnings)
  // - Combined timeline of earnings and withdrawals
  const mockPaymentHistory: PaymentHistory[] = [
    {
      id: '1',
      date: '2024-01-15',
      amount: 890.25,
      type: 'payout',
      status: 'processing',
      description: 'Weekly payout to bank ****4532',
    },
    {
      id: '2',
      date: '2024-01-14',
      amount: 85.00,
      type: 'earning',
      status: 'completed',
      description: 'Deep clean at Marina Bay Residences',
    },
    {
      id: '3',
      date: '2024-01-13',
      amount: 65.00,
      type: 'earning',
      status: 'completed',
      description: 'Standard clean at Orchard Towers',
    },
    {
      id: '4',
      date: '2024-01-08',
      amount: 750.00,
      type: 'payout',
      status: 'completed',
      description: 'Weekly payout to bank ****4532',
    },
  ];
  
  const paymentHistory: PaymentHistory[] = MockDataToggle.getFeatureData('CLEANER', 'EARNINGS', mockPaymentHistory, []) || [];

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#4ECDC4',
    paddingTop: 60,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
  },
  placeholder: {
    width: 40,
  },
  balanceContainer: {
    paddingHorizontal: 20,
    marginTop: 0,
    paddingTop: 20,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  withdrawText: {
    color: '#ffffff',
    fontSize: 16,
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
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#718096',
  },
  analyticsContainer: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 16,
  },
  analyticsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  analyticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  periodText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  amountText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4ECDC4',
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
    fontSize: 14,
    color: '#718096',
    marginLeft: 6,
  },
  historyContainer: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  historyIcon: {
    marginRight: 12,
  },
  historyDetails: {
    flex: 1,
  },
  historyDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 14,
    color: '#718096',
  },
  historyAmount: {
    alignItems: 'flex-end',
  },
  historyAmountText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  taxContainer: {
    paddingHorizontal: 20,
    marginTop: 30,
  },
  taxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  taxInfo: {
    flex: 1,
    marginLeft: 16,
  },
  taxTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
  },
  taxSubtitle: {
    fontSize: 14,
    color: '#718096',
  },
  taxButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSpacing: {
    height: 100,
  },
  // Empty State Styles
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F7FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});

export default EarningsScreen; 