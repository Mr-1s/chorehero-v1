import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import availabilityService from '../../services/availabilityService';
import { bookingStateManager } from '../../services/bookingStateManager';

type DynamicBookingProps = {
  navigation: any;
  route: { params: { cleanerId: string } };
};

type Template = {
  steps: string[];
  fields: Record<string, any[]>;
  pricing_rules?: any;
};

const DynamicBookingScreen: React.FC<DynamicBookingProps> = ({ navigation, route }) => {
  const cleanerId = route?.params?.cleanerId;
  const [template, setTemplate] = useState<Template | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [form, setForm] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        // Try reading cleaner template
        const { data, error } = await supabase
          .from('cleaner_booking_templates')
          .select('steps, fields, pricing_rules')
          .eq('user_id', cleanerId)
          .single();
        if (!error && data) {
          setTemplate({ steps: data.steps || [], fields: data.fields || {}, pricing_rules: data.pricing_rules });
        } else {
          // no template, fallback
          navigation.replace('BookingFlow', { cleanerId });
          return;
        }

        // hydrate saved progress
        const saved = await bookingStateManager.getBookingProgress(cleanerId);
        if (saved?.bookingData) {
          setForm(saved.bookingData);
          if (typeof saved.currentStep === 'number') setCurrentStepIndex(Math.min(saved.currentStep, (data.steps || []).length - 1));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [cleanerId]);

  useEffect(() => {
    if (!template) return;
    bookingStateManager.saveBookingProgress(cleanerId, currentStepIndex, form);
  }, [form, currentStepIndex, template]);

  const stepKey = template?.steps?.[currentStepIndex];
  const stepFields = useMemo(() => (stepKey && template ? template.fields?.[stepKey] || [] : []), [template, stepKey]);

  const setField = (id: string, value: any) => setForm(prev => ({ ...prev, [id]: value }));

  const goNext = () => {
    if (!template) return;
    if (currentStepIndex < template.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      // done → navigate to confirmation
      navigation.navigate('BookingConfirmationScreen', { cleanerId, bookingData: form });
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) setCurrentStepIndex(currentStepIndex - 1);
    else navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.loading}><Text style={styles.loadingText}>Loading booking…</Text></View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={goBack}>
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Book Service</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.stepPills}>
          {template?.steps?.map((s, i) => (
            <View key={s + i} style={[styles.pill, i === currentStepIndex ? styles.pillActive : undefined]} />
          ))}
        </View>

        <Text style={styles.stepTitle}>{stepKey?.replace(/_/g, ' ')}</Text>

        <View style={{ gap: 12 }}>
          {stepFields.map((field) => (
            <DynamicField key={field.id} field={field} value={form[field.id]} onChange={(v: any) => setField(field.id, v)} />
          ))}
        </View>

        <TouchableOpacity onPress={goNext} activeOpacity={0.9} style={styles.ctaWrap}>
          <LinearGradient colors={["#3ad3db", "#2BC8D4"]} style={styles.cta}>
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={styles.ctaText}>{currentStepIndex < (template?.steps?.length || 1) - 1 ? 'Continue' : 'Review & Confirm'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const DynamicField = ({ field, value, onChange }: { field: any; value: any; onChange: (v: any) => void }) => {
  // Minimal renderer: choice, toggle, number, stepper, textarea, date, time
  switch (field.type) {
    case 'choice':
      return (
        <View style={styles.card}>
          <Text style={styles.label}>{field.label}</Text>
          <View style={styles.optionGrid}>
            {(field.options || []).map((opt: string) => (
              <TouchableOpacity key={opt} style={[styles.option, value === opt && styles.optionActive]} onPress={() => onChange(opt)}>
                <Text style={[styles.optionText, value === opt && styles.optionTextActive]} numberOfLines={1} ellipsizeMode="tail">{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    case 'toggle':
      return (
        <TouchableOpacity style={styles.card} onPress={() => onChange(!value)}>
          <Text style={styles.label}>{field.label}</Text>
          <Text style={styles.toggle}>{value ? 'On' : 'Off'}</Text>
        </TouchableOpacity>
      );
    case 'number':
      return (
        <View style={styles.card}>
          <Text style={styles.label}>{field.label}</Text>
          <Stepper value={Number(value) || 0} onChange={onChange} min={0} max={9999} />
        </View>
      );
    case 'stepper':
      return (
        <View style={styles.card}>
          <Text style={styles.label}>{field.label}</Text>
          <Stepper value={Number(value) || (field.min ?? 0)} onChange={onChange} min={field.min ?? 0} max={field.max ?? 10} />
        </View>
      );
    case 'textarea':
      return (
        <View style={styles.card}><Text style={styles.label}>{field.label}</Text><View style={styles.textArea}><Text style={styles.textAreaPlaceholder}>{value || 'Tap continue to skip'}</Text></View></View>
      );
    case 'date':
    case 'time':
      return (
        <View style={styles.card}>
          <Text style={styles.label}>{field.label || (field.type === 'date' ? 'Date' : 'Time')}</Text>
          <Text style={styles.subtle}>We’ll show the native picker in a follow-up edit.</Text>
        </View>
      );
    default:
      return null;
  }
};

const Stepper = ({ value, onChange, min = 0, max = 10 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) => (
  <View style={styles.stepper}>
    <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.max(min, value - 1))}><Ionicons name="remove" size={18} color="#14B8A6" /></TouchableOpacity>
    <Text style={styles.stepVal}>{value}</Text>
    <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.min(max, value + 1))}><Ionicons name="add" size={18} color="#14B8A6" /></TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: { paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#6B7280' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  stepPills: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginBottom: 8 },
  pill: { width: 22, height: 6, borderRadius: 4, backgroundColor: '#E5E7EB' },
  pillActive: { backgroundColor: '#3ad3db' },
  stepTitle: { fontSize: 16, fontWeight: '700', color: '#111827', paddingHorizontal: 20, marginBottom: 10, textTransform: 'capitalize' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginHorizontal: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  label: { fontSize: 14, fontWeight: '600', color: '#1F2937', marginBottom: 12 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#CCFBF1', maxWidth: '48%' },
  optionActive: { backgroundColor: '#3ad3db', borderColor: '#3ad3db' },
  optionText: { color: '#0F766E', fontWeight: '600' },
  optionTextActive: { color: '#FFFFFF' },
  ctaWrap: { paddingHorizontal: 20, marginTop: 20 },
  cta: { borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, flexDirection: 'row', gap: 8 },
  ctaText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#ECFEFF', borderWidth: 1, borderColor: '#A7F3D0', alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  textArea: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, minHeight: 80, justifyContent: 'center' },
  textAreaPlaceholder: { color: '#9CA3AF' },
  subtle: { color: '#6B7280', fontSize: 12 },
});

export default DynamicBookingScreen;


