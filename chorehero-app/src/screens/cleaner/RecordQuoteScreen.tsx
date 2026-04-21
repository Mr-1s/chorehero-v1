/**
 * Record Quote - Pro records 60-sec video quote, adds price and availability, submits.
 */
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { jobQuoteService } from '../../services/jobQuoteService';
import { uploadService } from '../../services/uploadService';
import VideoRecorder from '../../components/VideoRecorder';
import { wp, hp } from '../../utils/responsive';

const AVAILABILITY_OPTIONS = [
  'Today after 3pm',
  'Tomorrow 10am',
  'This weekend',
  'Next week',
];

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

      navigation.replace('QuoteSent' as any, { jobId, customerName });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to send quote');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'record') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1F2937" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Record Quote</Text>
        </View>
        <VideoRecorder
          onRecorded={handleVideoRecorded}
          onCancel={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.headerLight}>
          <TouchableOpacity onPress={() => setStep('record')} style={styles.backBtnDark}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitleDark}>Quote Details</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {atCapacity && (
            <View style={styles.capacityBanner}>
              <Ionicons name="warning-outline" size={20} color="#D97706" />
              <Text style={styles.capacityText}>Complete current jobs to accept more</Text>
            </View>
          )}
          <Text style={styles.label}>Your quote ($)</Text>
          <TextInput
            style={styles.input}
            placeholder="125"
            placeholderTextColor="#9CA3AF"
            value={price}
            onChangeText={setPrice}
            keyboardType="number-pad"
          />

          <Text style={styles.label}>I can do this:</Text>
          <View style={styles.availabilityRow}>
            {AVAILABILITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.availabilityChip, availability === opt && styles.availabilityChipActive]}
                onPress={() => setAvailability(availability === opt ? null : opt)}
              >
                <Text style={[styles.availabilityText, availability === opt && styles.availabilityTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.cta, (submitting || atCapacity) && styles.ctaDisabled]}
            onPress={handleSubmit}
            disabled={submitting || atCapacity}
          >
            <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.ctaGradient}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>Send Quote</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1F2937' },
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
  backBtn: { padding: 8, marginRight: 8 },
  backBtnDark: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: wp('5%'), fontWeight: '700', color: '#fff' },
  headerTitleDark: { fontSize: wp('5%'), fontWeight: '700', color: '#1F2937' },
  scroll: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: wp('4%'), paddingBottom: hp('10%') },
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
  label: { fontSize: wp('3.5%'), fontWeight: '700', color: '#374151', marginTop: hp('2%'), marginBottom: hp('0.5%') },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.35%'),
    fontSize: wp('4%'),
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  availabilityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: wp('2%'), marginTop: hp('1%') },
  availabilityChip: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.95%'),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  availabilityChipActive: { backgroundColor: '#26B7C9', borderColor: '#26B7C9' },
  availabilityText: { fontSize: wp('3.5%'), fontWeight: '600', color: '#64748B' },
  availabilityTextActive: { color: '#fff' },
  cta: {
    marginTop: hp('3%'),
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#26B7C9',
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
