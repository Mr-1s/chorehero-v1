import React from 'react';
import { Switch, Text, View } from 'react-native';

interface Props {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

const ToggleField: React.FC<Props> = ({ label, value, onChange }) => (
  <View style={{ marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
    <Text style={{ fontWeight: '600' }}>{label}</Text>
    <Switch value={value} onValueChange={onChange} />
  </View>
);

export default ToggleField;
