import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { dummyWalletService, DummyWalletBalance, DummyTransaction } from '../../services/dummyWalletService';
import { COLORS } from '../../utils/constants';

interface DummyWalletScreenProps {
  navigation: any;
}

const DummyWalletScreen: React.FC<DummyWalletScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<DummyWalletBalance | null>(null);
  const [transactions, setTransactions] = useState<DummyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWalletData();
  }, [user]);

  const loadWalletData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Load wallet balance
      const walletResponse = await dummyWalletService.getWalletBalance(user.id);
      if (walletResponse.success) {
        setWallet(walletResponse.data);
      }

      // Load transaction history
      const transactionsResponse = await dummyWalletService.getTransactionHistory(user.id, 10);
      if (transactionsResponse.success) {
        setTransactions(transactionsResponse.data);
      }
    } catch (error) {
      console.error('Error loading wallet data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadWalletData();
  };

  const handleAddFunds = () => {
    Alert.alert(
      'Add Test Funds',
      'Choose amount to add to your wallet:',
      [
        { text: '$25', onPress: () => addFunds(2500) },
        { text: '$50', onPress: () => addFunds(5000) },
        { text: '$100', onPress: () => addFunds(10000) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const addFunds = async (amount: number) => {
    if (!user?.id) return;

    const response = await dummyWalletService.addFunds(user.id, amount);
    if (response.success) {
      setWallet(response.data);
      Alert.alert('Success', `Added $${(amount / 100).toFixed(2)} to your wallet!`);
      loadWalletData(); // Refresh to get updated transactions
    } else {
      Alert.alert('Error', response.error || 'Failed to add funds');
    }
  };

  const handlePayout = () => {
    if (!wallet || wallet.cleaner_balance <= 0) {
      Alert.alert('No Balance', 'You have no earnings to cash out.');
      return;
    }

    Alert.alert(
      'Cash Out Earnings',
      `Cash out $${(wallet.cleaner_balance / 100).toFixed(2)} to your bank account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Cash Out', 
          onPress: () => processPayout(wallet.cleaner_balance),
          style: 'default'
        },
      ]
    );
  };

  const processPayout = async (amount: number) => {
    if (!user?.id) return;

    const response = await dummyWalletService.processCleanerPayout(user.id, amount);
    if (response.success) {
      Alert.alert('Success', `$${(amount / 100).toFixed(2)} has been sent to your bank account!`);
      loadWalletData(); // Refresh wallet data
    } else {
      Alert.alert('Error', response.error || 'Failed to process payout');
    }
  };

  const handleResetWallet = () => {
    Alert.alert(
      'Reset Wallet',
      'This will reset your wallet balance and clear transaction history. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          onPress: resetWallet,
          style: 'destructive'
        },
      ]
    );
  };

  const resetWallet = async () => {
    if (!user?.id || !user?.role) return;

    const response = await dummyWalletService.resetWallet(user.id, user.role as 'customer' | 'cleaner');
    if (response.success) {
      setWallet(response.data);
      setTransactions([]);
      Alert.alert('Success', 'Wallet has been reset!');
    } else {
      Alert.alert('Error', response.error || 'Failed to reset wallet');
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'payment': return 'card-outline';
      case 'payout': return 'cash-outline';
      case 'refund': return 'return-up-back-outline';
      case 'tip': return 'heart-outline';
      default: return 'swap-horizontal-outline';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'payment': return user?.role === 'customer' ? '#EF4444' : '#10B981';
      case 'payout': return '#3B82F6';
      case 'refund': return '#10B981';
      case 'tip': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading wallet...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dummy Wallet</Text>
          <TouchableOpacity onPress={handleResetWallet} style={styles.resetButton}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Wallet Balance Card */}
        <View style={styles.balanceCard}>
          <LinearGradient
            colors={['#3ad3db', '#2BC8D4']}
            style={styles.balanceGradient}
          >
            <Text style={styles.balanceLabel}>
              {user?.role === 'customer' ? 'Available Balance' : 'Earnings Balance'}
            </Text>
            <Text style={styles.balanceAmount}>
              {wallet ? formatCurrency(
                user?.role === 'customer' ? wallet.customer_balance : wallet.cleaner_balance
              ) : '$0.00'}
            </Text>
            
            {wallet && (
              <View style={styles.balanceStats}>
                <View style={styles.balanceStat}>
                  <Text style={styles.balanceStatLabel}>Total Spent</Text>
                  <Text style={styles.balanceStatValue}>{formatCurrency(wallet.total_spent)}</Text>
                </View>
                <View style={styles.balanceStat}>
                  <Text style={styles.balanceStatLabel}>Total Earned</Text>
                  <Text style={styles.balanceStatValue}>{formatCurrency(wallet.total_earned)}</Text>
                </View>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {user?.role === 'customer' && (
            <TouchableOpacity style={styles.actionButton} onPress={handleAddFunds}>
              <Ionicons name="add-circle" size={24} color="#3ad3db" />
              <Text style={styles.actionButtonText}>Add Funds</Text>
            </TouchableOpacity>
          )}
          
          {user?.role === 'cleaner' && (
            <TouchableOpacity 
              style={[
                styles.actionButton,
                (!wallet || wallet.cleaner_balance <= 0) && styles.actionButtonDisabled
              ]} 
              onPress={handlePayout}
              disabled={!wallet || wallet.cleaner_balance <= 0}
            >
              <Ionicons name="cash" size={24} color={
                (!wallet || wallet.cleaner_balance <= 0) ? '#9CA3AF' : '#3ad3db'
              } />
              <Text style={[
                styles.actionButtonText,
                (!wallet || wallet.cleaner_balance <= 0) && styles.actionButtonTextDisabled
              ]}>Cash Out</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Transaction History */}
        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyStateText}>No transactions yet</Text>
              <Text style={styles.emptyStateSubtext}>
                {user?.role === 'customer' 
                  ? 'Book a service to see transactions here' 
                  : 'Complete jobs to see earnings here'}
              </Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map((transaction) => (
                <View key={transaction.id} style={styles.transactionItem}>
                  <View style={styles.transactionIcon}>
                    <Ionicons 
                      name={getTransactionIcon(transaction.type)} 
                      size={20} 
                      color={getTransactionColor(transaction.type)} 
                    />
                  </View>
                  
                  <View style={styles.transactionDetails}>
                    <Text style={styles.transactionDescription}>
                      {transaction.description}
                    </Text>
                    <Text style={styles.transactionDate}>
                      {formatDate(transaction.created_at)}
                    </Text>
                  </View>
                  
                  <View style={styles.transactionAmount}>
                    <Text style={[
                      styles.transactionAmountText,
                      { color: getTransactionColor(transaction.type) }
                    ]}>
                      {transaction.type === 'payout' ? '-' : '+'}
                      {formatCurrency(transaction.amount)}
                    </Text>
                    <View style={[
                      styles.transactionStatus,
                      { backgroundColor: transaction.status === 'completed' ? '#10B981' : '#F59E0B' }
                    ]}>
                      <Text style={styles.transactionStatusText}>
                        {transaction.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Testing Instructions */}
        <View style={styles.instructionsSection}>
          <Text style={styles.instructionsTitle}>🧪 Testing Instructions</Text>
          <Text style={styles.instructionsText}>
            This is a dummy wallet for testing payments. Use the buttons above to simulate:
          </Text>
          <Text style={styles.instructionsBullet}>• Adding funds (customers)</Text>
          <Text style={styles.instructionsBullet}>• Processing payments (automatic)</Text>
          <Text style={styles.instructionsBullet}>• Receiving earnings (cleaners)</Text>
          <Text style={styles.instructionsBullet}>• Cashing out earnings (cleaners)</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.primary,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resetButton: {
    padding: 8,
  },
  balanceCard: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  balanceGradient: {
    padding: 24,
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  balanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceStat: {
    flex: 1,
  },
  balanceStatLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
  },
  balanceStatValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  actionButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  actionButtonTextDisabled: {
    color: '#9CA3AF',
  },
  transactionsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  transactionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  transactionAmountText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  transactionStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  transactionStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  instructionsSection: {
    margin: 20,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#92400E',
    marginBottom: 8,
    lineHeight: 20,
  },
  instructionsBullet: {
    fontSize: 14,
    color: '#92400E',
    marginLeft: 8,
    lineHeight: 20,
  },
});

export default DummyWalletScreen;
