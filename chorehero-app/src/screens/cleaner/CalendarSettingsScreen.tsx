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
import { cleanerTheme } from '../../utils/theme';

const { colors, spacing, radii } = cleanerTheme;

type CalendarSettingsProps = {
  navigation: StackNavigationProp<any>;
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CalendarSettingsScreen: React.FC<CalendarSettingsProps> = ({ navigation }) => {
  const [activeDays, setActiveDays] = useState<Record<string, boolean>>({
    Mon: true,
    Tue: true,
    Wed: true,
    Thu: true,
    Fri: true,
    Sat: false,
    Sun: false,
  });
  const [instantAvailability, setInstantAvailability] = useState(true);

  const summary = useMemo(() => {
    const enabled = DAYS.filter(day => activeDays[day]);
    return enabled.length ? enabled.join(', ') : 'No days selected';
  }, [activeDays]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerAction}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Availability</Text>
        <View style={styles.headerAction} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Available Days</Text>
          <Text style={styles.cardSubtitle}>{summary}</Text>
          {DAYS.map((day) => (
            <View key={day} style={styles.row}>
              <Text style={styles.rowTitle}>{day}</Text>
              <Switch
                value={activeDays[day]}
                onValueChange={(value) => setActiveDays(prev => ({ ...prev, [day]: value }))}
                trackColor={{ false: colors.borderSubtle, true: colors.primaryLight }}
                thumbColor={activeDays[day] ? colors.primary : colors.textMuted}
              />
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hours</Text>
          <Text style={styles.cardSubtitle}>8:00 AM - 5:00 PM</Text>
          <Text style={styles.helperText}>Tap a day to adjust hours (coming soon).</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Instant Availability</Text>
            <Switch
              value={instantAvailability}
              onValueChange={setInstantAvailability}
              trackColor={{ false: colors.borderSubtle, true: colors.primaryLight }}
              thumbColor={instantAvailability ? colors.primary : colors.textMuted}
            />
          </View>
          <Text style={styles.helperText}>Turn this on to accept last-minute chores.</Text>
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
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
  },
});

export default CalendarSettingsScreen;
