/**
 * Tappable row that expands an inline option list (no Modal — avoids RN Modal issues in ScrollView / some builds).
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { wp, hp } from '../utils/responsive';

export type FormSelectOption = { value: string; label: string };

type FormSelectFieldProps = {
  label: string;
  value: string;
  options: FormSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** Shown under the label — use for field hints (e.g. “Tap to open”) */
  description?: string;
};

const FormSelectField: React.FC<FormSelectFieldProps> = ({
  label,
  value,
  options,
  onValueChange,
  placeholder = 'Select…',
  description,
}) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder;

  return (
    <View style={[styles.wrap, open && styles.wrapOpen]}>
      <Text style={styles.label}>{label}</Text>
      {description ? <Text style={styles.fieldDescription}>{description}</Text> : null}
      <TouchableOpacity
        style={[styles.trigger, open && styles.triggerOpen]}
        onPress={() => setOpen(!open)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        accessibilityHint="Opens a list to choose an option"
      >
        <Text style={[styles.triggerText, !selected && styles.triggerPlaceholder]} numberOfLines={1}>
          {display}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color="#64748B" />
      </TouchableOpacity>

      {open && (
        <View style={styles.dropdown}>
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={styles.dropdownScroll}
            showsVerticalScrollIndicator={options.length > 6}
          >
            {options.map((item) => {
              const active = item.value === value;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => {
                    onValueChange(item.value);
                    setOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{item.label}</Text>
                  {active ? <Ionicons name="checkmark-circle" size={22} color="#26B7C9" /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: hp('1%'), zIndex: 1 },
  wrapOpen: { zIndex: 20, elevation: 20 },
  label: {
    fontSize: wp('3.55%'),
    fontWeight: '700',
    color: '#334155',
    marginTop: hp('1.2%'),
    marginBottom: hp('0.5%'),
  },
  fieldDescription: {
    fontSize: wp('3.1%'),
    color: '#64748B',
    marginBottom: hp('0.6%'),
    lineHeight: 18,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: wp('4%'),
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  triggerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomColor: '#F1F5F9',
  },
  triggerText: { flex: 1, fontSize: wp('4%'), color: '#0F172A', fontWeight: '600', marginRight: 8 },
  triggerPlaceholder: { color: '#94A3B8', fontWeight: '500' },
  dropdown: {
    marginTop: -1,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: '#FFFFFF',
    maxHeight: 280,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  dropdownScroll: {
    maxHeight: 280,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  optionRowActive: { backgroundColor: '#F0FDFF' },
  optionText: { fontSize: 16, color: '#334155', fontWeight: '500', flex: 1 },
  optionTextActive: { color: '#0F172A', fontWeight: '700' },
});

export default FormSelectField;
