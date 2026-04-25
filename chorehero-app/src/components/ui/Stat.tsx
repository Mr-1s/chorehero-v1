import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Txt } from './Typography';
import { COLORS } from '../../utils/constants';

interface Props {
  value: string | number;
  label: string;
}

export const Stat: React.FC<Props> = ({ value, label }) => (
  <View style={styles.wrap}>
    <Txt variant="h2" weight="700">{value}</Txt>
    <Txt variant="bodySm" tone="secondary">{label}</Txt>
  </View>
);

interface StatRowProps {
  items: { value: string | number; label: string }[];
}

export const StatRow: React.FC<StatRowProps> = ({ items }) => (
  <View style={styles.row}>
    {items.map((s, i) => (
      <React.Fragment key={s.label}>
        <Stat value={s.value} label={s.label} />
        {i < items.length - 1 ? <View style={styles.divider} /> : null}
      </React.Fragment>
    ))}
  </View>
);

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  divider: { width: 1, height: 28, backgroundColor: COLORS.borderSoft, marginHorizontal: 12 },
});
