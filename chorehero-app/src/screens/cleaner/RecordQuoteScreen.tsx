/**
 * Record Quote - Pro records 60-sec video quote, adds price and availability, submits.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { jobQuoteService } from '../../services/jobQuoteService';
import { uploadService } from '../../services/uploadService';
import VideoRecorder from '../../components/VideoRecorder';
import { wp, hp } from '../../utils/responsive';
import { cleanerTheme } from '../../utils/theme';

/**
 * Preset availability windows surfaced first in the picker. These cover the
 * most common quote responses ("ASAP", "tomorrow morning", "this weekend").
 */
const AVAILABILITY_PRESETS = [
  'ASAP — today',
  'Today after 3pm',
  'Tomorrow morning (8am–12pm)',
  'Tomorrow afternoon (12pm–5pm)',
  'Tomorrow evening (5pm–9pm)',
  'This weekend (Sat or Sun)',
  'Early next week (Mon–Wed)',
  'Late next week (Thu–Sun)',
  'Flexible — let\'s chat',
] as const;

/**
 * Build concrete next-7-day windows so the cleaner can pick a specific day +
 * time-of-day instead of typing one. Generated lazily so the options track
 * the day the picker is opened.
 */
function buildNext7DaySlots(now: Date = new Date()): string[] {
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const slots: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const label = fmt(d);
    slots.push(`${label} · 8–11 AM`);
    slots.push(`${label} · 11 AM–2 PM`);
    slots.push(`${label} · 2–5 PM`);
    slots.push(`${label} · 5–8 PM`);
  }
  return slots;
}

const AVAILABILITY_OPTIONS = [...AVAILABILITY_PRESETS, ...buildNext7DaySlots()];

const quotePrefKeys = (userId: string) => ({
  price: `ch_pro_last_quote_price_${userId}`,
  availability: `ch_pro_last_quote_availability_${userId}`,
});

type StackParamList = {
  RecordQuote: { jobId: string };
  JobDetail: { jobId: string };
  QuoteSent: { jobId: string; customerName?: string };
};

type RecordQuoteNavigationProp = StackNavigationProp<StackParamList, 'RecordQuote'>;

const RecordQuoteScreen: React.FC<{
  navigation: RecordQuoteNavigationProp;
  route: { params: { jobId: string } };
}> = ({ navigation, route }) => {
  const { user } = useAuth();
  const { jobId } = route.params || {};
  const [step, setStep] = useState<'record' | 'details'>('record');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [availability, setAvailability] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState<string>('Customer');
  const [atCapacity, setAtCapacity] = useState(false);
  const [availabilitySheetVisible, setAvailabilitySheetVisible] = useState(false);
  const priceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!jobId) return;
    jobQuoteService.getJob(jobId).then((res) => {
      if (res.success && res.data?.customer) {
        const name = (res.data.customer as { name?: string })?.name;
        if (name) setCustomerName(name.split(' ')[0] || 'Customer');
      }
    });
  }, [jobId]);

  useEffect(() => {
    if (!user?.id || !jobId) return;
    jobQuoteService.canAcceptQuote(user.id, jobId).then((res) => {
      if (res.success && res.data && !res.data.canAccept) {
        setAtCapacity(true);
      }
    });
  }, [user?.id, jobId]);

  useEffect(() => {
    if (!user?.id) return;
    const keys = quotePrefKeys(user.id);
    (async () => {
      try {
        const [storedPrice, storedAvail] = await Promise.all([
          AsyncStorage.getItem(keys.price),
          AsyncStorage.getItem(keys.availability),
        ]);
        if (storedPrice && /^\d+$/.test(storedPrice.trim())) {
          setPrice(storedPrice.trim());
        }
        if (storedAvail && AVAILABILITY_OPTIONS.includes(storedAvail)) {
          setAvailability(storedAvail);
        }
      } catch {
        /* non-blocking */
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if (priceSaveTimerRef.current) {
        clearTimeout(priceSaveTimerRef.current);
        priceSaveTimerRef.current = null;
      }
    };
  }, []);

  const persistPriceNow = useCallback(async (digits: string) => {
    if (!user?.id) return;
    try {
      const t = digits.trim();
      if (!t || !/^\d+$/.test(t)) return;
      const n = parseInt(t, 10);
      if (n < 1) return;
      await AsyncStorage.setItem(quotePrefKeys(user.id).price, t);
    } catch {
      /* non-blocking */
    }
  }, [user?.id]);

  const persistPriceDebounced = useCallback(
    (digits: string) => {
      if (!user?.id) return;
      if (priceSaveTimerRef.current) {
        clearTimeout(priceSaveTimerRef.current);
      }
      priceSaveTimerRef.current = setTimeout(() => {
        priceSaveTimerRef.current = null;
        persistPriceNow(digits);
      }, 450);
    },
    [user?.id, persistPriceNow]
  );

  const onPriceChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    setPrice(digits);
    persistPriceDebounced(digits);
  };

  const onPriceEndEditing = () => {
    if (priceSaveTimerRef.current) {
      clearTimeout(priceSaveTimerRef.current);
      priceSaveTimerRef.current = null;
    }
    persistPriceNow(price);
  };

  const onAvailabilityPress = (opt: string) => {
    const next = availability === opt ? null : opt;
    setAvailability(next);
    if (!user?.id) return;
    const keys = quotePrefKeys(user.id);
    if (next && AVAILABILITY_OPTIONS.includes(next)) {
      AsyncStorage.setItem(keys.availability, next).catch(() => {});
    } else {
      AsyncStorage.removeItem(keys.availability).catch(() => {});
    }
  };

  const handleVideoRecorded = (uri: string) => {
    setVideoUri(uri);
    setStep('details');
  };

  const handleSubmit = async () => {
    if (!user?.id || !jobId || !videoUri) {
      Alert.alert('Error', 'Missing video or session.');
      return;
    }
    const priceNum = parseInt(price, 10);
    if (isNaN(priceNum) || priceNum < 1) {
      Alert.alert('Required', 'Enter your quote price.');
      return;
    }
    if (!availability) {
      Alert.alert('Required', 'Select when you can do this job.');
      return;
    }

    if (atCapacity) {
      Alert.alert('At Capacity', 'Complete current jobs to accept more.');
      return;
    }

    setSubmitting(true);
    try {
      const upload = await uploadService.uploadFile(videoUri, 'video');
      if (!upload.success || !upload.url) {
        throw new Error(upload.error || 'Failed to upload video');
      }

      const res = await jobQuoteService.createQuote(user.id, {
        job_id: jobId,
        video_url: upload.url,
        price_cents: priceNum * 100,
        availability_text: availability,
      });

      if (!res.success) {
        throw new Error(res.error || 'Failed to send quote');
      }

      try {
        const keys = quotePrefKeys(user.id);
        await AsyncStorage.multiSet([
          [keys.price, String(priceNum)],
          [keys.availability, availability],
        ]);
      } catch {
        /* non-blocking */
      }

      navigation.replace('QuoteSent' as any, { jobId, customerName });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to send quote');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'record') {
    return (
      <SafeAreaView style={styles.containerRecord}>
        <StatusBar barStyle="dark-content" backgroundColor={cleanerTheme.colors.bg} />
        <View style={styles.headerLight}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnDark}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitleDark}>Video quote</Text>
            <Text style={styles.headerStep}>Step 1 of 2 · Film or upload</Text>
          </View>
        </View>
        <VideoRecorder
          onRecorded={handleVideoRecorded}
          onCancel={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.containerDetails}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.headerLight}>
          <TouchableOpacity onPress={() => setStep('record')} style={styles.backBtnDark}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitleDark}>Your offer</Text>
            <Text style={styles.headerStep}>Step 2 of 2 · Price & availability</Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {atCapacity && (
            <View style={styles.capacityBanner}>
              <Ionicons name="warning-outline" size={20} color="#D97706" />
              <Text style={styles.capacityText}>Complete current jobs to accept more</Text>
            </View>
          )}
          <View style={styles.offerCard}>
            <Text style={styles.sectionTitle}>Price and timing</Text>
            <Text style={styles.sectionSubtitle}>Give the customer a clear total and when you can show up.</Text>

            <Text style={styles.label}>Your quote ($)</Text>
            <TextInput
              style={styles.input}
              placeholder="125"
              placeholderTextColor="#9CA3AF"
              value={price}
              onChangeText={onPriceChange}
              onEndEditing={onPriceEndEditing}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>I can do this</Text>
            <TouchableOpacity
              style={styles.availabilityDropdown}
              onPress={() => setAvailabilitySheetVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.availabilityDropdownText, !availability && styles.availabilityDropdownPlaceholder]}>
                {availability || 'Select when you are free'}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>
            <Text style={styles.inputHint}>You can update this later before the customer accepts.</Text>
          </View>

          <TouchableOpacity
            style={[styles.cta, (submitting || atCapacity) && styles.ctaDisabled]}
            onPress={handleSubmit}
            disabled={submitting || atCapacity}
          >
            <LinearGradient colors={['#FFA52F', '#E8941A']} style={styles.ctaGradient}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>Send quote</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal
        visible={availabilitySheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvailabilitySheetVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setAvailabilitySheetVisible(false)} />
          <View style={styles.sheetCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Choose availability</Text>
              <TouchableOpacity onPress={() => setAvailabilitySheetVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={20} color="#334155" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={AVAILABILITY_OPTIONS}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const selected = availability === item;
                return (
                  <TouchableOpacity
                    style={[styles.sheetRow, selected && styles.sheetRowSelected]}
                    onPress={() => {
                      onAvailabilityPress(item);
                      setAvailabilitySheetVisible(false);
                    }}
                  >
                    <Text style={[styles.sheetRowText, selected && styles.sheetRowTextSelected]}>{item}</Text>
                    {selected && <Ionicons name="checkmark" size={18} color="#B45309" />}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.sheetDivider} />}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  containerRecord: { flex: 1, backgroundColor: cleanerTheme.colors.bg },
  containerDetails: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboard: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
  },
  headerLight: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitles: {
    flex: 1,
    justifyContent: 'center',
  },
  headerStep: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  backBtn: { padding: 8, marginRight: 8 },
  backBtnDark: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: wp('5%'), fontWeight: '700', color: '#fff' },
  headerTitleDark: { fontSize: wp('5%'), fontWeight: '700', color: '#1F2937' },
  scroll: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: wp('4%'), paddingBottom: hp('10%') },
  offerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    padding: wp('4%'),
  },
  sectionTitle: { fontSize: wp('4.7%'), fontWeight: '800', color: '#0F172A', letterSpacing: -0.2 },
  sectionSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: hp('1.5%') },
  capacityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2%'),
    backgroundColor: '#FEF3C7',
    padding: wp('4%'),
    borderRadius: wp('3%'),
    marginBottom: hp('2%'),
  },
  capacityText: { fontSize: wp('3.5%'), color: '#D97706', fontWeight: '600' },
  label: { fontSize: 14, fontWeight: '700', color: '#334155', marginTop: hp('1.8%'), marginBottom: hp('0.6%') },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.25%'),
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  availabilityDropdown: {
    marginTop: hp('1%'),
    height: 48,
    paddingHorizontal: wp('4%'),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availabilityDropdownText: { fontSize: 15, fontWeight: '600', color: '#334155' },
  availabilityDropdownPlaceholder: { color: '#94A3B8' },
  inputHint: { marginTop: hp('1.1%'), fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.35)',
    justifyContent: 'flex-end',
  },
  sheetBackdrop: { flex: 1 },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: wp('4%'),
    paddingTop: hp('1.5%'),
    paddingBottom: hp('3.5%'),
    maxHeight: hp('50%'),
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('1%'),
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  sheetRow: {
    minHeight: 48,
    borderRadius: 10,
    paddingHorizontal: wp('3%'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetRowSelected: { backgroundColor: '#FFF7ED' },
  sheetRowText: { fontSize: 15, fontWeight: '600', color: '#334155' },
  sheetRowTextSelected: { color: '#B45309' },
  sheetDivider: { height: 1, backgroundColor: '#F1F5F9' },
  cta: {
    marginTop: hp('3%'),
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#FFA52F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaGradient: { paddingVertical: hp('2%'), alignItems: 'center' },
  ctaText: { fontSize: wp('4.5%'), fontWeight: '700', color: '#fff' },
});

export default RecordQuoteScreen;
