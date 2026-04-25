import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useServiceConfig } from '../hooks/useServiceConfig';
import { DynamicQuestion } from '../types/serviceTemplate';
import TextInputField from './DynamicFormFields/TextInputField';
import SelectField from './DynamicFormFields/SelectField';
import ToggleField from './DynamicFormFields/ToggleField';
import PhotoUploadField from './DynamicFormFields/PhotoUploadField';
import CounterField from './DynamicFormFields/CounterField';

type Answers = Record<string, unknown>;

export interface DynamicBookingAnswer {
  question_id: string;
  question_label: string;
  answer: unknown;
}

interface Props {
  serviceId?: string;
  proId?: string;
  onSubmit: (
    answers: Answers,
    meta?: {
      proServiceId?: string;
      pricingType?: 'fixed' | 'hourly' | 'quote';
      answersWithLabels?: DynamicBookingAnswer[];
    }
  ) => void;
}

class DynamicFormErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Form unavailable</Text>
          <Text style={styles.errorBody}>
            This service template couldn&apos;t be loaded. You can still continue with your booking, but please contact support if this persists.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const SkeletonLine: React.FC<{ width?: number | string; height?: number }> = ({
  width = '100%',
  height = 16,
}) => <View style={[styles.skeletonLine, { width: width as any, height }]} />;

const Skeleton: React.FC = () => (
  <View style={{ paddingVertical: 10 }}>
    <SkeletonLine width={'60%'} height={22} />
    <View style={{ height: 12 }} />
    <SkeletonLine />
    <View style={{ height: 8 }} />
    <SkeletonLine />
    <View style={{ height: 8 }} />
    <SkeletonLine width={'80%'} />
    <View style={{ height: 14 }} />
    <SkeletonLine width={'40%'} height={44} />
  </View>
);

const DynamicBookingFormInner: React.FC<Props> = ({ serviceId, proId, onSubmit }) => {
  const { loading, error, config } = useServiceConfig(serviceId, proId);
  const [answers, setAnswers] = useState<Answers>({});

  const updateAnswer = (id: string, value: unknown) => setAnswers((prev) => ({ ...prev, [id]: value }));

  const validate = useMemo(
    () => (questions: DynamicQuestion[]) => {
      for (const q of questions) {
        const value = answers[q.id];
        if (
          q.required &&
          (value === undefined ||
            value === null ||
            value === '' ||
            (Array.isArray(value) && value.length === 0))
        ) {
          return `${q.label} is required`;
        }
        if (typeof value === 'string' && q.minLength && value.length < q.minLength) {
          return `${q.label} must be at least ${q.minLength} characters`;
        }
        if (typeof value === 'number') {
          if (q.min != null && value < q.min) return `${q.label} must be >= ${q.min}`;
          if (q.max != null && value > q.max) return `${q.label} must be <= ${q.max}`;
        }
      }
      return null;
    },
    [answers]
  );

  if (loading) return <Skeleton />;
  if (error)
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorTitle}>Couldn&apos;t load service</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  if (!config) return <Text>Service config unavailable.</Text>;

  const renderField = (q: DynamicQuestion) => {
    const v = answers[q.id];
    switch (q.type) {
      case 'text':
        return (
          <TextInputField
            label={q.label}
            value={(v as string) || ''}
            placeholder={q.placeholder}
            onChange={(x) => updateAnswer(q.id, x)}
          />
        );
      case 'number':
        return (
          <TextInputField
            label={q.label}
            value={String(v ?? '')}
            placeholder={q.placeholder}
            onChange={(x) => updateAnswer(q.id, Number(x || 0))}
          />
        );
      case 'textarea':
        return (
          <TextInputField
            label={q.label}
            value={(v as string) || ''}
            placeholder={q.placeholder}
            multiline
            onChange={(x) => updateAnswer(q.id, x)}
          />
        );
      case 'select':
        return (
          <SelectField
            label={q.label}
            options={q.options || []}
            value={v as string}
            onChange={(x) => updateAnswer(q.id, x)}
          />
        );
      case 'multiselect':
        return (
          <SelectField
            label={q.label}
            options={q.options || []}
            multiple
            values={(v as string[]) || []}
            onChange={(x) => {
              const curr = ((answers[q.id] as string[]) || []).slice();
              const next = curr.includes(x) ? curr.filter((it) => it !== x) : [...curr, x];
              updateAnswer(q.id, next);
            }}
          />
        );
      case 'boolean':
        return <ToggleField label={q.label} value={Boolean(v)} onChange={(x) => updateAnswer(q.id, x)} />;
      case 'photo':
        return (
          <PhotoUploadField
            label={q.label}
            value={(v as string[]) || []}
            max={q.max || 5}
            onChange={(x) => updateAnswer(q.id, x)}
          />
        );
      case 'counter':
        return (
          <CounterField
            label={q.label}
            value={typeof v === 'number' ? v : Number(q.default || 0)}
            min={q.min}
            max={q.max}
            onChange={(x) => updateAnswer(q.id, x)}
          />
        );
      case 'date':
      case 'time':
        return (
          <TextInputField
            label={q.label}
            value={(v as string) || ''}
            placeholder={q.placeholder || q.type.toUpperCase()}
            onChange={(x) => updateAnswer(q.id, x)}
          />
        );
      default:
        return <Text key={q.id}>Unsupported field type: {q.type}</Text>;
    }
  };

  const submit = () => {
    const validationError = validate(config.questions);
    if (validationError) {
      Alert.alert('Validation', validationError);
      return;
    }
    const answersWithLabels: DynamicBookingAnswer[] = config.questions.map((q) => ({
      question_id: q.id,
      question_label: q.label,
      answer: answers[q.id] ?? null,
    }));
    onSubmit(answers, {
      proServiceId: config.proServiceId,
      pricingType: config.pricingType,
      answersWithLabels,
    });
  };

  return (
    <ScrollView>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 12 }}>{config.serviceName}</Text>
      {config.questions.map((q) => (
        <View key={q.id}>{renderField(q)}</View>
      ))}
      <TouchableOpacity
        onPress={submit}
        style={{ marginTop: 10, backgroundColor: '#26B7C9', padding: 14, borderRadius: 10 }}
      >
        <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const DynamicBookingForm: React.FC<Props> = (props) => (
  <DynamicFormErrorBoundary>
    <DynamicBookingFormInner {...props} />
  </DynamicFormErrorBoundary>
);

const styles = StyleSheet.create({
  errorBox: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#fee2e2',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
  },
  errorTitle: { fontWeight: '700', color: '#b91c1c', marginBottom: 4 },
  errorBody: { color: '#7f1d1d' },
  skeletonLine: {
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    marginBottom: 6,
  },
});

export default DynamicBookingForm;
