/**
 * Post a Job - Customer flow for video quote system.
 * Media → description → category & timing (pickers) → budget card → location → submit.
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { supabase } from '../../services/supabase';
import { jobQuoteService, JobCategory, JobUrgency, Job } from '../../services/jobQuoteService';
import { uploadService } from '../../services/uploadService';
import { wp, hp } from '../../utils/responsive';
import { AddressAutocomplete, type AddressResult } from '../../components/AddressAutocomplete';
import FormSelectField from '../../components/FormSelectField';
import { useRoute } from '@react-navigation/native';
const DEV_MODE = process.env.EXPO_PUBLIC_DEV_MODE === 'true';
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
const POST_JOB_DRAFT_VERSION = 1;

type PostJobDraft = {
  v: number;
  description: string;
  category: JobCategory;
  urgency: JobUrgency;
  budgetMin: string;
  budgetMax: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  addressSelected: boolean;
  media: { uri: string; type: 'photo' | 'video' }[];
};

const PostJobScreen: React.FC<{ navigation: PostJobNavigationProp }> = ({ navigation }) => {
  const route = useRoute<any>();
  const editJob = route.params?.editJob as Job | undefined;
  const isEditMode = !!editJob?.id;
  const { user } = useAuth();
  const { showToast } = useToast();
  const draftKey = user?.id ? `post_job_draft:${user.id}` : null;
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
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

  const hasMeaningfulDraftContent = () =>
    !!(
      description.trim() ||
      budgetMin.trim() ||
      budgetMax.trim() ||
      street.trim() ||
      city.trim() ||
      state.trim() ||
      zipCode.trim() ||
      media.length > 0 ||
      category !== 'cleaning' ||
      urgency !== 'this_week'
    );

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
    let cancelled = false;
    const loadDraft = async () => {
      if (isEditMode || !draftKey) {
        setHasLoadedDraft(true);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem(draftKey);
        if (!raw) return;
        const draft = JSON.parse(raw) as PostJobDraft;
        if (draft?.v !== POST_JOB_DRAFT_VERSION) return;
        if (cancelled) return;
        setDescription(draft.description || '');
        setCategory(draft.category || 'cleaning');
        setUrgency(draft.urgency || 'this_week');
        setBudgetMin(draft.budgetMin || '');
        setBudgetMax(draft.budgetMax || '');
        setStreet(draft.street || '');
        setCity(draft.city || '');
        setState(draft.state || '');
        setZipCode(draft.zipCode || '');
        setLatitude(draft.latitude);
        setLongitude(draft.longitude);
        setAddressSelected(!!draft.addressSelected);
        setMedia(Array.isArray(draft.media) ? draft.media.slice(0, MAX_PHOTOS) : []);
      } catch {
        // no-op
      } finally {
        if (!cancelled) setHasLoadedDraft(true);
      }
    };
    loadDraft();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, draftKey]);

  useEffect(() => {
    if (!user?.id || isEditMode || !hasLoadedDraft) return;
    if (hasMeaningfulDraftContent()) return;
    let cancelled = false;
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
        // Bail if the user started editing while we were waiting — otherwise
        // a slow address response would clobber their typed address.
        if (cancelled) return;
        if (hasMeaningfulDraftContent()) return;
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
    return () => {
      cancelled = true;
    };
  }, [user?.id, isEditMode, hasLoadedDraft]);

  useEffect(() => {
    if (isEditMode || !draftKey || !hasLoadedDraft) return;
    const timer = setTimeout(() => {
      const draft: PostJobDraft = {
        v: POST_JOB_DRAFT_VERSION,
        description,
        category,
        urgency,
        budgetMin,
        budgetMax,
        street,
        city,
        state,
        zipCode,
        latitude,
        longitude,
        addressSelected,
        media: media.slice(0, MAX_PHOTOS),
      };
      AsyncStorage.setItem(draftKey, JSON.stringify(draft)).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [
    isEditMode,
    draftKey,
    hasLoadedDraft,
    description,
    category,
    urgency,
    budgetMin,
    budgetMax,
    street,
    city,
    state,
    zipCode,
    latitude,
    longitude,
    addressSelected,
    media,
  ]);

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
    try {
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
      const uploadFailures: string[] = [];
      for (const m of media) {
        if (m.uri.startsWith('http')) {
          mediaUrls.push({ url: m.uri, type: m.type });
          continue;
        }
        const upload = await uploadService.uploadFile(m.uri, m.type === 'video' ? 'video' : 'image');
        if (upload.success && upload.url) {
          mediaUrls.push({ url: upload.url, type: m.type });
        } else {
          uploadFailures.push(upload.error || `${m.type} upload failed`);
        }
      }
      // If the user attached media but every single upload failed, treat it as
      // a hard failure rather than silently posting a job with no attachments.
      if (media.length > 0 && mediaUrls.length === 0) {
        throw new Error(
          uploadFailures[0] ||
            'Could not upload any of your photos or videos. Check your connection and try again.'
        );
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

      if (!DEV_MODE) {
        supabase.functions.invoke('notify-founder-sms', {
          body: { type: 'new_job', job_id: res.data.id },
        }).catch(() => {});
      }
      // jobQuoteService.createJob can return success with a non-fatal error
      // when the job row was created but child rows (e.g. job_media) failed.
      // Surface that to the user without rolling back the post.
      const partialError = res.success && res.data ? res.error : undefined;
      const partialUploadNote =
        uploadFailures.length > 0 && mediaUrls.length > 0
          ? `${uploadFailures.length} of ${media.length} attachments could not be uploaded.`
          : undefined;
      const successCopy = isEditMode
        ? 'Job updated successfully.'
        : 'Job posted! Pros will send video quotes soon.';
      const messageParts = [successCopy, partialError, partialUploadNote].filter(Boolean) as string[];
      showToast({
        type: partialError || partialUploadNote ? 'warning' : 'success',
        message: messageParts.join(' '),
      });
      if (!isEditMode && draftKey) {
        await AsyncStorage.removeItem(draftKey);
      }
      navigation.navigate('Bookings' as any, { activeTab: 'my-jobs' });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : `Failed to ${isEditMode ? 'update' : 'post'} job`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (!isEditMode && hasMeaningfulDraftContent()) {
      Alert.alert(
        'Discard draft?',
        'You have an in-progress job post. Keep it as a draft or discard it?',
        [
          { text: 'Keep draft', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: async () => {
              if (draftKey) await AsyncStorage.removeItem(draftKey);
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('Bookings' as any, { activeTab: 'my-jobs' });
            },
          },
        ]
      );
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Bookings' as any, { activeTab: 'my-jobs' });
  };

  const categories = jobQuoteService.getCategories();
  const urgencies = jobQuoteService.getUrgencies();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Job' : 'Post a Job'}</Text>
      </View>
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
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

          <FormSelectField
            label="When do you need this done?"
            description="Tap the row below to open choices — this helps pros prioritize your request."
            value={urgency}
            options={urgencies.map((u) => ({ value: u.value, label: u.label }))}
            onValueChange={(v) => setUrgency(v as JobUrgency)}
            placeholder="Select timing"
          />

          <FormSelectField
            label="Category"
            value={category}
            options={categories.map((c) => ({ value: c.value, label: c.label }))}
            onValueChange={(v) => setCategory(v as JobCategory)}
            placeholder="Choose a category"
          />

          <View style={styles.budgetCard}>
            <View style={styles.budgetCardAccent} />
            <View style={styles.budgetCardInner}>
              <View style={styles.budgetCardTitleRow}>
                <View style={styles.budgetIconWrap}>
                  <Ionicons name="cash-outline" size={22} color="#0D9488" />
                </View>
                <View style={styles.budgetTitleTexts}>
                  <Text style={styles.budgetCardTitle}>Your budget range</Text>
                  <Text style={styles.budgetCardSubtitle}>
                    Optional — a min and max helps pros send fairer video quotes faster.
                  </Text>
                </View>
              </View>
              <View style={styles.budgetInputsRow}>
                <View style={styles.budgetField}>
                  <Text style={styles.budgetFieldLabel}>Minimum</Text>
                  <View style={styles.budgetInputShell}>
                    <Text style={styles.budgetDollar}>$</Text>
                    <TextInput
                      style={styles.budgetInputInner}
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      value={budgetMin}
                      onChangeText={(t) => setBudgetMin(t.replace(/\D/g, ''))}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
                <View style={styles.budgetField}>
                  <Text style={styles.budgetFieldLabel}>Maximum</Text>
                  <View style={styles.budgetInputShell}>
                    <Text style={styles.budgetDollar}>$</Text>
                    <TextInput
                      style={styles.budgetInputInner}
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      value={budgetMax}
                      onChangeText={(t) => setBudgetMax(t.replace(/\D/g, ''))}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.label}>Location</Text>
          <Text style={styles.locationHelper}>
            Start typing your street address — suggestions appear as you type. Pick one to auto-fill the fields below.
          </Text>
          <AddressAutocomplete
            value={street}
            onChangeText={(t) => {
              setStreet(t);
              setAddressSelected(false);
            }}
            onPlaceSelected={(result: AddressResult) => {
              const line1 = result.street?.trim() ?? '';
              setStreet(line1);
              setCity(result.city?.trim() ?? '');
              setState(result.state?.trim() ?? '');
              setZipCode(result.zip?.trim() ?? '');
              setLatitude(result.latitude);
              setLongitude(result.longitude);
              setAddressSelected(true);
            }}
            placeholder="Search address…"
            style={styles.input}
          />
          <Text style={styles.addressHint}>Or edit city, state, and ZIP manually</Text>
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
  locationHelper: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: hp('1%'),
    marginTop: -4,
  },
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
  budgetCard: {
    marginTop: hp('0.5%'),
    marginBottom: hp('2%'),
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  budgetCardAccent: {
    height: 4,
    backgroundColor: '#26B7C9',
    opacity: 0.9,
  },
  budgetCardInner: { padding: 16 },
  budgetCardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  budgetIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E6FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetTitleTexts: { flex: 1 },
  budgetCardTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  budgetCardSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 },
  budgetInputsRow: { flexDirection: 'row', gap: 12 },
  budgetField: { flex: 1 },
  budgetFieldLabel: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  budgetInputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingLeft: 12,
    minHeight: 52,
  },
  budgetDollar: { fontSize: 18, fontWeight: '700', color: '#0F766E', marginRight: 4 },
  budgetInputInner: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    paddingRight: 12,
  },
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
