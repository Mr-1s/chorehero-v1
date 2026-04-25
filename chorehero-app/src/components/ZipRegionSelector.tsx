import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ZIP_REGION_MAP } from '../utils/zipRegionMap';

type Props = {
  zip: string;
  region: string;
  onChangeZip: (zip: string) => void;
  onChangeRegion: (region: string) => void;
  accentColor?: string;
  unsupportedMessage?: string;
};

const ZipRegionSelector: React.FC<Props> = ({
  zip,
  region,
  onChangeZip,
  onChangeRegion,
  accentColor = '#FFA52F',
  unsupportedMessage = 'Service area not yet supported for this ZIP.',
}) => {
  const [zipModalOpen, setZipModalOpen] = useState(false);
  const [regionModalOpen, setRegionModalOpen] = useState(false);

  const selectedZip = useMemo(() => ZIP_REGION_MAP.find((x) => x.zip === zip), [zip]);
  const regionOptions = selectedZip?.regions || [];

  const zipLabel = selectedZip ? `${selectedZip.zip} - ${selectedZip.city}, ${selectedZip.state}` : 'Select ZIP code';
  const regionLabel = region || 'Select region';

  return (
    <View>
      <Text style={styles.label}>ZIP code *</Text>
      <TouchableOpacity style={[styles.selector, { borderColor: `${accentColor}55` }]} onPress={() => setZipModalOpen(true)}>
        <Text style={styles.selectorText}>{zipLabel}</Text>
        <Ionicons name="chevron-down" size={18} color="#6B7280" />
      </TouchableOpacity>

      <Text style={[styles.label, styles.spacingTop]}>Region *</Text>
      <TouchableOpacity
        style={[styles.selector, { borderColor: `${accentColor}55`, opacity: zip ? 1 : 0.6 }]}
        onPress={() => zip && setRegionModalOpen(true)}
        disabled={!zip}
      >
        <Text style={styles.selectorText}>{regionLabel}</Text>
        <Ionicons name="chevron-down" size={18} color="#6B7280" />
      </TouchableOpacity>
      {!!zip && regionOptions.length === 0 && <Text style={styles.unsupported}>{unsupportedMessage}</Text>}

      <Modal visible={zipModalOpen} transparent animationType="slide" onRequestClose={() => setZipModalOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Choose ZIP code</Text>
            <FlatList
              data={ZIP_REGION_MAP}
              keyExtractor={(item) => item.zip}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => {
                    onChangeZip(item.zip);
                    onChangeRegion('');
                    setZipModalOpen(false);
                  }}
                >
                  <Text style={styles.itemText}>{`${item.zip} - ${item.city}, ${item.state}`}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closeBtn} onPress={() => setZipModalOpen(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={regionModalOpen} transparent animationType="slide" onRequestClose={() => setRegionModalOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Choose region</Text>
            <FlatList
              data={regionOptions}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => {
                    onChangeRegion(item);
                    setRegionModalOpen(false);
                  }}
                >
                  <Text style={styles.itemText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closeBtn} onPress={() => setRegionModalOpen(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  spacingTop: { marginTop: 14 },
  selector: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  selectorText: { fontSize: 15, color: '#1F2937', flex: 1, marginRight: 8 },
  unsupported: { marginTop: 8, fontSize: 12, color: '#9CA3AF' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%' },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#111827', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  item: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  itemText: { fontSize: 15, color: '#1F2937' },
  closeBtn: { padding: 16, alignItems: 'center' },
  closeText: { color: '#6B7280', fontWeight: '600' },
});

export default ZipRegionSelector;
