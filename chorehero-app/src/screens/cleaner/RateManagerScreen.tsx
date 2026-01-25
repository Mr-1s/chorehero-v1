import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { cleanerTheme } from '../../utils/theme';

const { colors, spacing, radii } = cleanerTheme;

type RateManagerProps = {
  navigation: StackNavigationProp<any>;
};

const RateManagerScreen: React.FC<RateManagerProps> = ({ navigation }) => {
  const [baseRate, setBaseRate] = useState('35');
  const [emergencyRate, setEmergencyRate] = useState('55');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerAction}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Rates</Text>
        <View style={styles.headerAction} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Base Hourly Rate</Text>
          <Text style={styles.cardSubtitle}>Standard cleaning jobs</Text>
          <View style={styles.inputRow}>
            <Text style={styles.currency}>$</Text>
            <TextInput
              value={baseRate}
              onChangeText={setBaseRate}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.unit}>/hr</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emergency Fee</Text>
          <Text style={styles.cardSubtitle}>Applied to urgent requests</Text>
          <View style={styles.inputRow}>
            <Text style={styles.currency}>$</Text>
            <TextInput
              value={emergencyRate}
              onChangeText={setEmergencyRate}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.unit}>/hr</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save Rates</Text>
        </TouchableOpacity>
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
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  currency: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: 6,
  },
  unit: {
    fontSize: 14,
    color: colors.textMuted,
    marginLeft: 6,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#26B7C9',
    borderRadius: 14,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default RateManagerScreen;
