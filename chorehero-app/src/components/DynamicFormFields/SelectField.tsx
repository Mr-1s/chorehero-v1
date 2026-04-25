import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface Props {
  label: string;
  options: string[];
  value?: string;
  onChange: (v: string) => void;
  multiple?: boolean;
  values?: string[];
}

const chip = (active: boolean) => ({
  paddingHorizontal: 10,
  paddingVertical: 8,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: active ? '#26B7C9' : '#d1d5db',
  backgroundColor: active ? '#e6f9fb' : '#fff',
  marginRight: 8,
  marginBottom: 8,
});

const SelectField: React.FC<Props> = ({ label, options, value, values, onChange, multiple }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={{ fontWeight: '600', marginBottom: 6 }}>{label}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const active = multiple ? !!values?.includes(opt) : value === opt;
        return (
          <TouchableOpacity key={opt} style={chip(active)} onPress={() => onChange(opt)}>
            <Text>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

export default SelectField;
