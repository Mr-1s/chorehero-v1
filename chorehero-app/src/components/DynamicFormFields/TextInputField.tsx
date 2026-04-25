import React from 'react';
import { Text, TextInput, View } from 'react-native';

interface Props {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}

const TextInputField: React.FC<Props> = ({ label, value, placeholder, onChange, multiline }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={{ fontWeight: '600', marginBottom: 6 }}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      multiline={multiline}
      style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 10, minHeight: multiline ? 90 : 44 }}
    />
  </View>
);

export default TextInputField;
