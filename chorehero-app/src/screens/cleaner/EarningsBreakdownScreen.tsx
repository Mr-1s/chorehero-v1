import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useCleanerStore } from '../../store/cleanerStore';
import { cleanerTheme } from '../../utils/theme';

const { colors, spacing, radii } = cleanerTheme;

type EarningsBreakdownProps = {
  navigation: StackNavigationProp<any>;
};

const EarningsBreakdownScreen: React.FC<EarningsBreakdownProps> = ({ navigation }) => {
  const { currentCleaner, activeBookings, pastBookings } = useCleanerStore();
  const [instantPayEnabled, setInstantPayEnabled] = useState(false);

  const totals = useMemo(() => {
    const pendingAmount = activeBookings.reduce((sum, b) => sum + (b.payoutToCleaner || 0), 0);
    const recentTransactions = pastBookings.slice(0, 5);
    const completedJobs = currentCleaner?.totalJobs || 0;
    const instantPayEligible = completedJobs >= 10;
    return { pendingAmount, recentTransactions, completedJobs, instantPayEligible };
  }, [activeBookings, pastBookings, currentCleaner?.totalJobs]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerAction}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
        <View style={styles.headerAction} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="wallet-outline" size={18} color="#26B7C9" />
            <Text style={styles.cardTitle}>Pending Payouts</Text>
          </View>
          <Text style={styles.amountText}>${totals.pendingAmount.toFixed(2)}</Text>
          <Text style={styles.cardCaption}>
            {activeBookings.length} jobs awaiting completion
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="swap-horizontal-outline" size={18} color="#26B7C9" />
            <Text style={styles.cardTitle}>Transaction History</Text>
          </View>
          {totals.recentTransactions.length === 0 ? (
            <Text style={styles.emptyText}>No completed payouts yet.</Text>
          ) : (
            totals.recentTransactions.map((booking) => (
              <View key={booking.id} style={styles.row}>
                <View>
                  <Text style={styles.rowTitle}>{booking.serviceType}</Text>
                  <Text style={styles.rowSubtitle}>{new Date(booking.scheduledAt).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.rowAmount}>${booking.payoutToCleaner.toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="flash-outline" size={18} color="#26B7C9" />
            <Text style={styles.cardTitle}>Instant Pay</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowSubtitle}>Get paid instantly after each job</Text>
            <Switch
              value={instantPayEnabled}
              onValueChange={(value) => {
                if (!totals.instantPayEligible) return;
                setInstantPayEnabled(value);
              }}
              disabled={!totals.instantPayEligible}
              trackColor={{ false: colors.borderSubtle, true: colors.primaryLight }}
              thumbColor={instantPayEnabled ? colors.primary : colors.textMuted}
            />
          </View>
          {!totals.instantPayEligible && (
            <Text style={styles.helperText}>
              Complete 10+ chores to unlock Instant Pay.
            </Text>
          )}
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
  amountText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  cardCaption: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
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
    color: colors.textPrimary,
  },
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});

export default EarningsBreakdownScreen;
