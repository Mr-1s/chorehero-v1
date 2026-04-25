import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StackNavigationProp } from '@react-navigation/stack';
import { cleanerTheme } from '../../utils/theme';
import { wp, hp } from '../../utils/responsive';

const { colors, spacing, radii } = cleanerTheme;

type CalendarSettingsProps = {
  navigation: StackNavigationProp<any>;
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STORAGE_KEY = 'cleaner_availability_settings_v1';
const HOUR_OPTIONS = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM',
];

const hourToIndex = (value: string) => HOUR_OPTIONS.findIndex((x) => x === value);

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
  const [dayHours, setDayHours] = useState<Record<string, { start: string; end: string }>>({
    Mon: { start: '8:00 AM', end: '5:00 PM' },
    Tue: { start: '8:00 AM', end: '5:00 PM' },
    Wed: { start: '8:00 AM', end: '5:00 PM' },
    Thu: { start: '8:00 AM', end: '5:00 PM' },
    Fri: { start: '8:00 AM', end: '5:00 PM' },
    Sat: { start: '9:00 AM', end: '3:00 PM' },
    Sun: { start: '9:00 AM', end: '2:00 PM' },
  });
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [draftStart, setDraftStart] = useState('8:00 AM');
  const [draftEnd, setDraftEnd] = useState('5:00 PM');

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as {
          activeDays?: Record<string, boolean>;
          dayHours?: Record<string, { start: string; end: string }>;
          instantAvailability?: boolean;
        };
        if (parsed.activeDays) setActiveDays(parsed.activeDays);
        if (parsed.dayHours) setDayHours(parsed.dayHours);
        if (typeof parsed.instantAvailability === 'boolean') {
          setInstantAvailability(parsed.instantAvailability);
        }
      } catch {
        // non-blocking
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ activeDays, dayHours, instantAvailability })
    ).catch(() => {});
  }, [activeDays, dayHours, instantAvailability]);

  const summary = useMemo(() => {
    const enabled = DAYS.filter(day => activeDays[day]);
    return enabled.length ? enabled.join(', ') : 'No days selected';
  }, [activeDays]);

  const hoursSummary = useMemo(() => {
    const enabled = DAYS.filter((day) => activeDays[day]);
    if (!enabled.length) return 'No available hours yet';
    const first = enabled[0];
    return `${dayHours[first].start} - ${dayHours[first].end}`;
  }, [activeDays, dayHours]);

  const openHoursEditor = (day: string) => {
    if (!activeDays[day]) {
      Alert.alert('Turn day on first', `Enable ${day} before setting hours.`);
      return;
    }
    setDraftStart(dayHours[day].start);
    setDraftEnd(dayHours[day].end);
    setEditingDay(day);
  };

  const saveHours = () => {
    if (!editingDay) return;
    const startIdx = hourToIndex(draftStart);
    const endIdx = hourToIndex(draftEnd);
    if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) {
      Alert.alert('Invalid range', 'End time must be later than start time.');
      return;
    }
    setDayHours((prev) => ({ ...prev, [editingDay]: { start: draftStart, end: draftEnd } }));
    setEditingDay(null);
  };

  const isStartDisabled = (hour: string) => {
    const endIdx = hourToIndex(draftEnd);
    const idx = hourToIndex(hour);
    return endIdx >= 0 && idx >= endIdx;
  };

  const isEndDisabled = (hour: string) => {
    const startIdx = hourToIndex(draftStart);
    const idx = hourToIndex(hour);
    return startIdx >= 0 && idx <= startIdx;
  };

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
            <View key={day} style={styles.dayRow}>
              <TouchableOpacity style={styles.dayMeta} onPress={() => openHoursEditor(day)} activeOpacity={0.75}>
                <Text style={styles.rowTitle}>{day}</Text>
                <Text style={[styles.dayHoursText, !activeDays[day] && styles.dayHoursTextDisabled]}>
                  {activeDays[day] ? `${dayHours[day].start} - ${dayHours[day].end}` : 'Off'}
                </Text>
              </TouchableOpacity>
              <View style={styles.dayControls}>
                <TouchableOpacity
                  style={[styles.editHoursPill, !activeDays[day] && styles.editHoursPillDisabled]}
                  onPress={() => openHoursEditor(day)}
                  disabled={!activeDays[day]}
                >
                  <Ionicons name="time-outline" size={14} color={activeDays[day] ? '#B45309' : '#94A3B8'} />
                </TouchableOpacity>
                <Switch
                  value={activeDays[day]}
                  onValueChange={(value) => setActiveDays(prev => ({ ...prev, [day]: value }))}
                  trackColor={{ false: colors.borderSubtle, true: colors.primaryLight }}
                  thumbColor={activeDays[day] ? colors.primary : colors.textMuted}
                />
              </View>
            </View>
          ))}
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
      <Modal
        visible={!!editingDay}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingDay(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setEditingDay(null)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit hours for {editingDay}</Text>
              <TouchableOpacity onPress={() => setEditingDay(null)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>Start time</Text>
            <View style={styles.timeOptionsRow}>
              {HOUR_OPTIONS.map((hour) => (
                <TouchableOpacity
                  key={`start-${hour}`}
                  style={[
                    styles.timeChip,
                    draftStart === hour && styles.timeChipActive,
                    isStartDisabled(hour) && styles.timeChipDisabled,
                  ]}
                  onPress={() => setDraftStart(hour)}
                  disabled={isStartDisabled(hour)}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      draftStart === hour && styles.timeChipTextActive,
                      isStartDisabled(hour) && styles.timeChipTextDisabled,
                    ]}
                  >
                    {hour}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.modalLabel, { marginTop: spacing.md }]}>End time</Text>
            <View style={styles.timeOptionsRow}>
              {HOUR_OPTIONS.map((hour) => (
                <TouchableOpacity
                  key={`end-${hour}`}
                  style={[
                    styles.timeChip,
                    draftEnd === hour && styles.timeChipActive,
                    isEndDisabled(hour) && styles.timeChipDisabled,
                  ]}
                  onPress={() => setDraftEnd(hour)}
                  disabled={isEndDisabled(hour)}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      draftEnd === hour && styles.timeChipTextActive,
                      isEndDisabled(hour) && styles.timeChipTextDisabled,
                    ]}
                  >
                    {hour}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalHelperText}>Only valid time ranges are selectable.</Text>
            <TouchableOpacity style={styles.saveHoursButton} onPress={saveHours}>
              <Text style={styles.saveHoursButtonText}>Save hours</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    fontSize: wp('4.5%'),
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
    fontSize: wp('3.5%'),
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: hp('0.5%'),
  },
  cardSubtitle: {
    fontSize: wp('3%'),
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dayMeta: { flex: 1, paddingRight: 10 },
  dayHoursText: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  dayHoursTextDisabled: { color: '#94A3B8' },
  dayControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  editHoursPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: 'rgba(255,165,47,0.35)',
  },
  editHoursPillDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  helperText: {
    fontSize: wp('3%'),
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  modalBackdrop: { flex: 1 },
  modalCard: {
    maxHeight: '74%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  modalLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
  timeOptionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  timeChipActive: {
    backgroundColor: '#FFF7ED',
    borderColor: 'rgba(255,165,47,0.55)',
  },
  timeChipDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E5E7EB',
  },
  timeChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  timeChipTextActive: { color: '#B45309' },
  timeChipTextDisabled: { color: '#CBD5E1' },
  modalHelperText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textMuted,
  },
  saveHoursButton: {
    marginTop: spacing.lg,
    borderRadius: 12,
    backgroundColor: '#FFA52F',
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveHoursButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

export default CalendarSettingsScreen;
