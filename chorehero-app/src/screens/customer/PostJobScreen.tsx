/**
 * Post a Job - Customer flow for video quote system.
 * "What do you need done?" with media, description, category, urgency, location, budget.
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
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { supabase } from '../../services/supabase';
import { jobQuoteService, JobCategory, JobUrgency, Job } from '../../services/jobQuoteService';
import { uploadService } from '../../services/uploadService';
import { wp, hp } from '../../utils/responsive';
import { AddressAutocomplete } from '../../components/AddressAutocomplete';
import { useRoute } from '@react-navigation/native';
const DEV_MODE = process.env.EXPO_PUBLIC_DEV_MODE === 'true';
const placesApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
import { useToast } from '../../components/Toast';

type StackParamList = {
  PostJob: { editJob?: Job } | undefined;
  QuoteList: { jobId: string };
  MyJobs: undefined;
  MainTabs: undefined;
  Bookings: { activeTab?: string };
};

type PostJobNavigationProp = StackNavigationProp<StackParamList, 'PostJob'>;

const MAX_PHOTOS = 5;
const MAX_VIDEO_SEC = 30;

const PostJobScreen: React.FC<{ navigation: PostJobNavigationProp }> = ({ navigation }) => {
  const route = useRoute<any>();
  const editJob = route.params?.editJob as Job | undefined;
  const isEditMode = !!editJob?.id;
  const { user } = useAuth();
  const { showToast } = useToast();
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<JobCategory>('cleaning');
  const [urgency, setUrgency] = useState<JobUrgency>('this_week');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [addressSelected, setAddressSelected] = useState(false);
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [media, setMedia] = useState<{ uri: string; type: 'photo' | 'video' }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isEditMode || !editJob) return;
    setDescription(editJob.description || editJob.headline || '');
    setCategory(editJob.category);
    setUrgency(editJob.urgency);
    setBudgetMin(editJob.budget_min_cents ? String(Math.round(editJob.budget_min_cents / 100)) : '');
    setBudgetMax(editJob.budget_max_cents ? String(Math.round(editJob.budget_max_cents / 100)) : '');
    setStreet(editJob.street || '');
    setCity(editJob.city || '');
    setState(editJob.state || '');
    setZipCode(editJob.zip_code || '');
    setLatitude(editJob.latitude || undefined);
    setLongitude(editJob.longitude || undefined);
    setAddressSelected(Boolean(editJob.street || editJob.zip_code || editJob.city));
    if (editJob.media?.length) {
      setMedia(
        editJob.media.map((m) => ({
          uri: m.media_url,
          type: m.media_type,
        }))
      );
    }
  }, [isEditMode, editJob]);

  useEffect(() => {
    if (!user?.id) return;
    const timeoutMs = 8000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Load timeout')), timeoutMs)
    );
    const fetchAddr = supabase
      .from('addresses')
      .select('street, city, state, zip_code, latitude, longitude')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .maybeSingle();
    Promise.race([fetchAddr.then((r) => r.data), timeoutPromise])
      .then((data: any) => {
        if (data && (data.street != null || data.city != null || data.zip_code != null)) {
          setStreet(data.street || '');
          setCity(data.city || '');
          setState(data.state || '');
          setZipCode(data.zip_code || '');
          setLatitude(data.latitude);
          setLongitude(data.longitude);
          setAddressSelected(true);
        }
      })
      .catch(() => {});
  }, [user?.id]);

  /** Geocode address to lat/lng for distance matching. Uses stored coords or geocodes from address parts. */
  const geocodeForJob = async (): Promise<{ latitude?: number; longitude?: number }> => {
    if (latitude != null && longitude != null) {
      return { latitude, longitude };
    }
    const parts = [street, city, state, zipCode].filter(Boolean);
    if (parts.length === 0) return {};
    const query = parts.join(', ');
    try {
      const results = await Location.geocodeAsync(query);
      if (results?.length > 0) {
        return { latitude: results[0].latitude, longitude: results[0].longitude };
      }
    } catch {
      // Non-blocking: job still posts without coords
    }
    return {};
  };

  const pickMedia = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Please allow camera access.');
        return;
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Please allow photo library access.');
        return;
      }
    }

    const launcher = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const result = await launcher({
      mediaTypes: source === 'camera' ? ['images'] : ['images', 'videos'],
      allowsEditing: false,
      videoMaxDuration: MAX_VIDEO_SEC,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mediaType = asset.duration != null ? 'video' : 'photo';
    if (media.length >= MAX_PHOTOS) {
      Alert.alert('Limit reached', `Max ${MAX_PHOTOS} photos or 1 video.`);
      return;
    }
    setMedia((prev) => [...prev, { uri: asset.uri, type: mediaType }]);
  };

  const removeMedia = (index: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const desc = description.trim();
    if (!desc) {
      Alert.alert('Required', 'Describe what you need done.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Sign in required', 'Please sign in to post a job.');
      return;
    }
    const hasAddress = (street?.trim() && (city?.trim() || zipCode?.trim())) || addressSelected;
    if (!hasAddress) {
      Alert.alert('Address required', 'Please enter your street address and city or ZIP code.');
      return;
    }
    setIsSubmitting(true);
    const SUBMIT_TIMEOUT_MS = 45000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Please try again.')), SUBMIT_TIMEOUT_MS)
    );
    try {
      const runSubmit = async () => {
        const ensureRes = await authService.ensureUserExists(user.id, {
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          phone: (user as any).phone ?? undefined,
          role: 'customer',
        });
        if (!ensureRes.success) {
          throw new Error(ensureRes.error || 'Please complete your profile first.');
        }

        const mediaUrls: { url: string; type: 'photo' | 'video' }[] = [];
        for (const m of media) {
          if (m.uri.startsWith('http')) {
            mediaUrls.push({ url: m.uri, type: m.type });
          } else {
            const upload = await uploadService.uploadFile(m.uri, m.type === 'video' ? 'video' : 'image');
            if (upload.success && upload.url) mediaUrls.push({ url: upload.url, type: m.type });
          }
        }

        const coords = await geocodeForJob();

        const headline = desc.length > 80 ? desc.slice(0, 80) : desc;
        const minBudget = budgetMin ? parseInt(budgetMin, 10) * 100 : undefined;
        const maxBudget = budgetMax ? parseInt(budgetMax, 10) * 100 : undefined;
        const basePayload = {
          headline,
          description: desc || undefined,
          urgency,
          budget_min_cents: minBudget,
          budget_max_cents: maxBudget,
          media_urls: mediaUrls,
        };

        const res = isEditMode && editJob?.id
          ? await jobQuoteService.updateJob(editJob.id, basePayload)
          : await jobQuoteService.createJob(user.id, {
              ...basePayload,
              category,
              street: street || undefined,
              city: city || undefined,
              state: state || undefined,
              zip_code: zipCode || undefined,
              latitude: coords.latitude,
              longitude: coords.longitude,
            });

        if (!res.success || !res.data) {
          throw new Error(res.error || `Failed to ${isEditMode ? 'update' : 'post'} job`);
        }
        return res;
      };

      const res = await Promise.race([runSubmit(), timeoutPromise]);

      if (!DEV_MODE) {
        supabase.functions.invoke('notify-founder-sms', {
          body: { type: 'new_job', job_id: res.data.id },
        }).catch(() => {});
      }
      showToast({
        type: 'success',
        message: isEditMode ? 'Job updated successfully.' : 'Job posted! Pros will send video quotes soon.',
      });
      navigation.navigate('Bookings' as any, { activeTab: 'my-jobs' });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : `Failed to ${isEditMode ? 'update' : 'post'} job`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = jobQuoteService.getCategories();
  const urgencies = jobQuoteService.getUrgencies();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Job' : 'Post a Job'}</Text>
      </View>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>{isEditMode ? 'Update your job details' : 'What do you need done?'}</Text>
          <Text style={styles.subtitle}>
            {isEditMode
              ? 'Make changes before a pro sends a quote.'
              : 'Add photos or a quick video so pros can send you accurate quotes.'}
          </Text>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <View style={styles.sectionIcon}>
                  <Ionicons name="camera" size={16} color="#0F766E" />
                </View>
                <Text style={styles.sectionHeaderText}>Photos or video</Text>
              </View>
              <Text style={styles.sectionHeaderHint}>{media.length}/{MAX_PHOTOS}</Text>
            </View>
            <View style={styles.mediaPickerRow}>
              <TouchableOpacity style={styles.mediaPickerBtn} onPress={() => pickMedia('camera')} activeOpacity={0.85}>
                <View style={styles.mediaPickerIcon}>
                  <Ionicons name="camera-outline" size={22} color="#26B7C9" />
                </View>
                <Text style={styles.mediaPickerBtnText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mediaPickerBtn} onPress={() => pickMedia('library')} activeOpacity={0.85}>
                <View style={styles.mediaPickerIcon}>
                  <Ionicons name="images-outline" size={22} color="#26B7C9" />
                </View>
                <Text style={styles.mediaPickerBtnText}>From Library</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.mediaHint}>Max {MAX_PHOTOS} photos or 30-sec video</Text>
          </View>
          {media.length > 0 && (
            <View style={styles.mediaRow}>
              {media.map((m, i) => (
                <View key={i} style={styles.mediaThumb}>
                  <Image source={{ uri: m.uri }} style={styles.mediaThumbImg} resizeMode="cover" />
                  <TouchableOpacity style={styles.mediaRemove} onPress={() => removeMedia(i)}>
                    <Ionicons name="close-circle" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.label}>Describe what you need</Text>
          <TextInput
            style={styles.input}
            placeholder={'e.g., Mount 65" TV on brick wall'}
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[styles.chip, category === c.value && styles.chipActive]}
                onPress={() => setCategory(c.value)}
              >
                <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>When do you need this?</Text>
          <View style={styles.chipRow}>
            {urgencies.map((u) => (
              <TouchableOpacity
                key={u.value}
                style={[styles.chip, urgency === u.value && styles.chipActive]}
                onPress={() => setUrgency(u.value)}
              >
                <Text style={[styles.chipText, urgency === u.value && styles.chipTextActive]}>{u.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Location</Text>
          <AddressAutocomplete
            value={street}
            onChangeText={(t) => {
              setStreet(t);
              setAddressSelected(false);
            }}
            onPlaceSelected={(result) => {
              const fullAddr = result.street
                ? [result.street, result.city, result.state, result.zip].filter(Boolean).join(', ')
                : [result.city, result.state, result.zip].filter(Boolean).join(', ');
              setStreet(fullAddr || result.street || '');
              setCity(result.city);
              setState(result.state);
              setZipCode(result.zip);
              setLatitude(result.latitude);
              setLongitude(result.longitude);
              setAddressSelected(true);
            }}
            placeholder="Start typing your address..."
            style={styles.input}
          />
          <Text style={styles.addressHint}>Or enter manually below</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.half]}
              placeholder="City"
              value={city}
              onChangeText={(t) => {
                setCity(t);
                if (t.trim() && street.trim()) setAddressSelected(true);
              }}
            />
            <TextInput
              style={[styles.input, styles.half]}
              placeholder="State"
              value={state}
              onChangeText={setState}
            />
            <TextInput
              style={[styles.input, styles.third]}
              placeholder="ZIP"
              value={zipCode}
              onChangeText={(t) => {
                setZipCode(t.replace(/\D/g, '').slice(0, 5));
                if (t.trim().length >= 5 && street.trim()) setAddressSelected(true);
              }}
              keyboardType="number-pad"
            />
          </View>

          <Text style={styles.label}>Budget (optional)</Text>
          <View style={styles.budgetRow}>
            <TextInput
              style={[styles.input, styles.budgetInput]}
              placeholder="$ min"
              value={budgetMin}
              onChangeText={setBudgetMin}
              keyboardType="number-pad"
            />
            <Text style={styles.budgetDash}>–</Text>
            <TextInput
              style={[styles.input, styles.budgetInput]}
              placeholder="$ max"
              value={budgetMax}
              onChangeText={setBudgetMax}
              keyboardType="number-pad"
            />
          </View>

          <TouchableOpacity
            style={[styles.cta, isSubmitting && styles.ctaDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <LinearGradient colors={['#26B7C9', '#047B9B']} style={styles.ctaGradient}>
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaText}>{isEditMode ? 'Save Changes' : 'Post Job & Get Quotes'}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.5%'),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerTitle: { fontSize: wp('5%'), fontWeight: '700', color: '#1F2937' },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: wp('5%'), paddingBottom: hp('10%') },
  title: { fontSize: 26, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 6, marginBottom: 18, lineHeight: 20 },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#E6FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  sectionHeaderHint: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  mediaPickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  mediaPickerBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    gap: 6,
  },
  mediaPickerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPickerBtnText: { fontSize: 13, color: '#334155', fontWeight: '600' },
  mediaHint: { fontSize: 12, color: '#94A3B8', marginTop: 10, textAlign: 'center' },
  mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: wp('2%'), marginBottom: hp('2%') },
  mediaThumb: { width: wp('28%'), height: wp('28%'), borderRadius: wp('2%'), overflow: 'hidden', position: 'relative' },
  mediaThumbImg: { width: '100%', height: '100%' },
  mediaRemove: { position: 'absolute', top: 4, right: 4 },
  label: { fontSize: wp('3.55%'), fontWeight: '700', color: '#334155', marginTop: hp('1.45%'), marginBottom: hp('0.5%') },
  addressHint: { fontSize: wp('3%'), color: '#9CA3AF', marginBottom: hp('0.5%') },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.35%'),
    fontSize: wp('4%'),
    color: '#111827',
    marginBottom: hp('1%'),
    backgroundColor: '#FFFFFF',
  },
  row: { flexDirection: 'row', gap: wp('2%') },
  half: { flex: 1 },
  third: { width: wp('22%') },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: wp('2%'), marginBottom: hp('1%') },
  chip: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.95%'),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: '#26B7C9', borderColor: '#26B7C9' },
  chipText: { fontSize: wp('3.5%'), fontWeight: '600', color: '#6B7280' },
  chipTextActive: { color: '#fff' },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: wp('2%'), marginBottom: hp('2%') },
  budgetInput: { flex: 1 },
  budgetDash: { fontSize: wp('4%'), color: '#9CA3AF' },
  cta: {
    marginTop: hp('2.5%'),
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#26B7C9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  ctaDisabled: { opacity: 0.7 },
  ctaGradient: { paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: -0.2 },
});

export default PostJobScreen;
