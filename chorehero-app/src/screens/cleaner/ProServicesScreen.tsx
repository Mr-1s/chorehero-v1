import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { proService } from '../../services/proService';
import { DynamicQuestion, DynamicFieldType } from '../../types/serviceTemplate';
import { cleanerTheme } from '../../utils/theme';

const { colors, radii, spacing } = cleanerTheme;

interface ServiceRow {
  id: string;
  name: string;
  category: string;
}

type QuestionsByService = Record<string, DynamicQuestion[]>;

const QUESTION_TYPES: DynamicFieldType[] = ['text', 'textarea', 'number', 'select', 'multiselect', 'boolean'];

/** Human-friendly labels (avoid dev jargon like "textarea" in the main UI) */
const QUESTION_TYPE_LABELS: Record<DynamicFieldType, string> = {
  text: 'Short answer',
  textarea: 'Long answer',
  number: 'Number only',
  select: 'Pick one (list)',
  multiselect: 'Pick many (list)',
  boolean: 'Yes / No',
};

const PRICING_LABELS: Record<'fixed' | 'hourly' | 'quote', string> = {
  fixed: 'Fixed price',
  hourly: 'Per hour',
  quote: 'Quote only',
};

const makeId = (): string =>
  typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const ProServicesScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [pricingType, setPricingType] = useState<Record<string, 'fixed' | 'hourly' | 'quote'>>({});
  const [price, setPrice] = useState<Record<string, string>>({});
  const [questions, setQuestions] = useState<QuestionsByService>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('services').select('id,name,category').eq('is_active', true);
      setServices((data || []) as ServiceRow[]);
      if (user?.id) {
        const { data: proRows } = await supabase
          .from('pro_services')
          .select('service_id,is_active,pricing_type,base_price,hourly_rate,custom_questions')
          .eq('pro_id', user.id);
        (proRows || []).forEach((row: any) => {
          setActive((prev) => ({ ...prev, [row.service_id]: !!row.is_active }));
          setPricingType((prev) => ({ ...prev, [row.service_id]: row.pricing_type || 'hourly' }));
          setPrice((prev) => ({
            ...prev,
            [row.service_id]: String((row.base_price || row.hourly_rate || 0) / 100 || ''),
          }));
          setQuestions((prev) => ({
            ...prev,
            [row.service_id]: Array.isArray(row.custom_questions) ? row.custom_questions : [],
          }));
        });
      }
    };
    load();
  }, [user?.id]);

  const saveService = async (serviceId: string) => {
    if (!user?.id) return;
    const pt = pricingType[serviceId] || 'hourly';
    const cents = Math.round((parseFloat(price[serviceId] || '0') || 0) * 100);
    const customQuestions = questions[serviceId] || [];
    const payload = {
      pro_id: user.id,
      service_id: serviceId,
      is_active: !!active[serviceId],
      pricing_type: pt,
      base_price: pt === 'fixed' ? cents : null,
      hourly_rate: pt === 'hourly' ? cents : null,
      custom_questions: customQuestions,
    };
    const { error } = await proService.upsertService(payload as any);
    if (error) {
      Alert.alert('Save failed', error.message);
    } else {
      Alert.alert('Saved', 'Service settings updated.');
    }
  };

  const addQuestion = (serviceId: string) => {
    setQuestions((prev) => ({
      ...prev,
      [serviceId]: [
        ...(prev[serviceId] || []),
        { id: makeId(), type: 'text', label: 'What should we know?', required: false },
      ],
    }));
  };

  const updateQuestion = (serviceId: string, index: number, patch: Partial<DynamicQuestion>) => {
    setQuestions((prev) => {
      const current = (prev[serviceId] || []).slice();
      current[index] = { ...current[index], ...patch };
      return { ...prev, [serviceId]: current };
    });
  };

  const removeQuestion = (serviceId: string, index: number) => {
    setQuestions((prev) => {
      const current = (prev[serviceId] || []).slice();
      current.splice(index, 1);
      return { ...prev, [serviceId]: current };
    });
  };

  return (
    <View style={styles.safe}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, Platform.OS === 'ios' ? 8 : 12) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.topBarTitleBlock}>
          <Text style={styles.topBarTitle}>Services you offer</Text>
          <Text style={styles.topBarSub}>Turn services on, set price, and add pre-job questions for customers</Text>
        </View>
        <View style={styles.topBarRight} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {services.map((svc) => (
          <View key={svc.id} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.serviceName}>{svc.name}</Text>
                <Text style={styles.serviceCat}>{svc.category}</Text>
              </View>
              <Switch
                value={!!active[svc.id]}
                onValueChange={(v) => setActive((prev) => ({ ...prev, [svc.id]: v }))}
                trackColor={{ false: '#E5E7EB', true: 'rgba(255,165,47,0.45)' }}
                thumbColor={active[svc.id] ? colors.primary : '#f4f3f4'}
              />
            </View>
            {active[svc.id] ? (
              <View style={styles.expanded}>
                <Text style={styles.subsectionLabel}>Pricing</Text>
                <View style={styles.pillRow}>
                  {(['fixed', 'hourly', 'quote'] as const).map((pt) => (
                    <TouchableOpacity
                      key={pt}
                      style={[
                        styles.pill,
                        pricingType[svc.id] === pt && styles.pillActive,
                      ]}
                      onPress={() => setPricingType((prev) => ({ ...prev, [svc.id]: pt }))}
                    >
                      <Text style={[styles.pillText, pricingType[svc.id] === pt && styles.pillTextActive]}>
                        {PRICING_LABELS[pt]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {pricingType[svc.id] !== 'quote' ? (
                  <TextInput
                    style={styles.input}
                    placeholder={pricingType[svc.id] === 'hourly' ? 'Amount in $ / hour' : 'Total job price in $'}
                    keyboardType="decimal-pad"
                    value={price[svc.id] || ''}
                    onChangeText={(v) => setPrice((prev) => ({ ...prev, [svc.id]: v }))}
                  />
                ) : null}

                <View style={styles.questionsBlock}>
                  <Text style={styles.questionsTitle}>Pre-job questions (optional)</Text>
                  <Text style={styles.questionsHelper}>
                    Ask things you need to know before you accept. Choose how the customer should answer, then
                    write the exact question. If you turn on “Required answer”, they must fill it in with their
                    request.
                  </Text>
                  {(questions[svc.id] || []).map((q, idx) => (
                    <View key={q.id} style={styles.questionCard}>
                      <Text style={styles.qMiniLabel}>Question for the customer</Text>
                      <TextInput
                        style={styles.qLabelInput}
                        placeholder="e.g. How many windows need cleaning?"
                        value={q.label}
                        onChangeText={(v) => updateQuestion(svc.id, idx, { label: v })}
                      />
                      <Text style={styles.qMiniLabel}>How they should answer</Text>
                      <View style={styles.typeRow}>
                        {QUESTION_TYPES.map((t) => (
                          <TouchableOpacity
                            key={t}
                            onPress={() => updateQuestion(svc.id, idx, { type: t })}
                            style={[styles.typePill, q.type === t && styles.typePillOn]}
                          >
                            <Text style={[styles.typePillText, q.type === t && styles.typePillTextOn]} numberOfLines={2}>
                              {QUESTION_TYPE_LABELS[t]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {(q.type === 'select' || q.type === 'multiselect') && (
                        <TextInput
                          style={styles.input}
                          placeholder="List choices, separated by commas (e.g. Weekday, Weekend, Flexible)"
                          value={(q.options || []).join(', ')}
                          onChangeText={(v) =>
                            updateQuestion(svc.id, idx, {
                              options: v
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      )}
                      <View style={styles.requiredRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.requiredLabel}>Required before they can book</Text>
                          <Text style={styles.requiredHint}>
                            If off, the customer can send the job without answering (you can follow up in chat).
                          </Text>
                        </View>
                        <Switch
                          value={!!q.required}
                          onValueChange={(v) => updateQuestion(svc.id, idx, { required: v })}
                          trackColor={{ false: '#E5E7EB', true: 'rgba(255,165,47,0.45)' }}
                          thumbColor={q.required ? colors.primary : '#f4f3f4'}
                        />
                      </View>
                      <TouchableOpacity
                        onPress={() => removeQuestion(svc.id, idx)}
                        style={styles.removeLink}
                        hitSlop={8}
                      >
                        <Text style={styles.removeLinkText}>Remove this question</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity onPress={() => addQuestion(svc.id)} style={styles.addQBtn}>
                    <Ionicons name="add-circle-outline" size={20} color={colors.textPrimary} />
                    <Text style={styles.addQBtnText}>Add a question</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={() => saveService(svc.id)}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingBottom: 10,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  backBtn: { padding: 4, marginRight: 4, marginTop: 2 },
  topBarTitleBlock: { flex: 1 },
  topBarTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  topBarSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  topBarRight: { width: 28 },
  scrollContent: { padding: 16, paddingTop: 8 },
  card: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    backgroundColor: colors.cardBg,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  serviceName: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  serviceCat: { fontSize: 13, color: colors.textSecondary, textTransform: 'capitalize', marginTop: 2 },
  expanded: { paddingHorizontal: 14, paddingBottom: 16 },
  subsectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  pillActive: { borderColor: colors.primary, backgroundColor: 'rgba(255, 165, 47, 0.12)' },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  pillTextActive: { color: '#9A3412' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  questionsBlock: { marginTop: 8 },
  questionsTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  questionsHelper: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 12 },
  questionCard: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 10,
    backgroundColor: colors.metaBg,
  },
  qMiniLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  qLabelInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
    fontSize: 15,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  typePill: {
    minWidth: '45%',
    flexGrow: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  typePillOn: { borderColor: colors.primary, backgroundColor: 'rgba(255, 165, 47, 0.1)' },
  typePillText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  typePillTextOn: { color: '#9A3412' },
  requiredRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  requiredLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  requiredHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 16, marginTop: 2 },
  removeLink: { alignSelf: 'flex-start', marginTop: 8 },
  removeLinkText: { color: '#dc2626', fontWeight: '600', fontSize: 14 },
  addQBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  addQBtnText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  saveBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});

export default ProServicesScreen;
