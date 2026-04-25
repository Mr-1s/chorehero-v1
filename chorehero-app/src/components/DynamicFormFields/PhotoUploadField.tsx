import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

interface Props {
  label: string;
  value: string[];
  max?: number;
  onChange: (v: string[]) => void;
}

const PhotoUploadField: React.FC<Props> = ({ label, value, max = 5, onChange }) => {
  const addPhoto = async () => {
    if (value.length >= max) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]?.uri) {
      onChange([...value, result.assets[0].uri]);
    }
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <TouchableOpacity onPress={addPhoto} style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, padding: 10 }}>
        <Text>Add Photo ({value.length}/{max})</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {value.map((uri) => (
          <Image key={uri} source={{ uri }} style={{ width: 52, height: 52, borderRadius: 8, marginRight: 8 }} />
        ))}
      </View>
    </View>
  );
};

export default PhotoUploadField;
