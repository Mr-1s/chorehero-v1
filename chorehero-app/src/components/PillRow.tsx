import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type PillRowProps = {
  leftItems: Array<{ icon: keyof typeof Ionicons.glyphMap; text: string }>;
  style?: ViewStyle;
  textStyle?: TextStyle;
  iconColor?: string;
};

const PillRow: React.FC<PillRowProps> = ({ leftItems, style, textStyle, iconColor = '#6B7280' }) => {
  return (
    <View style={[styles.container, style]}>
      {leftItems.map((item, idx) => (
        <View key={idx} style={styles.item}>
          <Ionicons name={item.icon as any} size={16} color={iconColor} />
          <Text style={[styles.text, textStyle]} numberOfLines={1} ellipsizeMode="tail">{item.text}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
    minHeight: 44,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minHeight: 44,
    gap: 6,
  },
  text: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 20,
    flexShrink: 1,
  },
});

export default PillRow;




