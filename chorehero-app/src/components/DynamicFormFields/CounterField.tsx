import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface Props {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}

const CounterField: React.FC<Props> = ({ label, value, min = 0, max = 99, onChange }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={{ fontWeight: '600', marginBottom: 6 }}>{label}</Text>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - 1))} style={{ padding: 10, borderWidth: 1, borderColor: '#d1d5db' }}>
        <Text>-</Text>
      </TouchableOpacity>
      <Text style={{ marginHorizontal: 14 }}>{value}</Text>
      <TouchableOpacity onPress={() => onChange(Math.min(max, value + 1))} style={{ padding: 10, borderWidth: 1, borderColor: '#d1d5db' }}>
        <Text>+</Text>
      </TouchableOpacity>
    </View>
  </View>
);

export default CounterField;
