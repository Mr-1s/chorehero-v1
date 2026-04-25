/**
 * Video Recorder for 60-second quote videos.
 * UI aligned with My Content upload card: vertical primary + outline actions.
 */
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { wp, hp } from '../utils/responsive';
import { cleanerTheme } from '../utils/theme';

const MAX_DURATION_SEC = 60;
const SCRIPT_HINTS = [
  'Introduce yourself',
  'Confirm you understand the job',
  'Give your price estimate',
  'Mention your availability',
];

const { colors, radii, shadows, spacing } = cleanerTheme;

interface VideoRecorderProps {
  onRecorded: (uri: string) => void;
  onCancel?: () => void;
}

export default function VideoRecorder({ onRecorded, onCancel }: VideoRecorderProps) {
  const [mode, setMode] = useState<'picker' | 'preview'>('picker');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const hintInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    hintInterval.current = setInterval(() => {
      setHintIndex((i) => (i + 1) % SCRIPT_HINTS.length);
    }, 5000);
    return () => {
      if (hintInterval.current) clearInterval(hintInterval.current);
    };
  }, []);

  const handlePickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Photo library access is needed to select a video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_DURATION_SEC,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setVideoUri(result.assets[0].uri);
      setMode('preview');
    }
  };

  const handleRecordFromDevice = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Camera access is needed to record.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: MAX_DURATION_SEC,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setVideoUri(result.assets[0].uri);
      setMode('preview');
    }
  };

  if (mode === 'picker') {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Add your clip</Text>
        <Text style={styles.pageSubtitle}>
          Up to {MAX_DURATION_SEC}s · {SCRIPT_HINTS[hintIndex]}
        </Text>

        <View style={styles.uploadCard}>
          <View style={styles.limitRow}>
            <View style={styles.limitPill}>
              <Text style={styles.limitNum}>{MAX_DURATION_SEC}</Text>
              <Text style={styles.limitUnit}>sec max</Text>
            </View>
          </View>
          <Text style={styles.uploadDescription}>
            Use a video you already have, or record a fresh take. Either works for your quote.
          </Text>

          <View style={styles.uploadButtons}>
            {/* Swapped vs. old UI: library first, record second (primary) */}
            <TouchableOpacity
              style={styles.uploadButtonWrapper}
              onPress={handlePickFromLibrary}
              activeOpacity={0.88}
            >
              <View style={[styles.uploadButton, styles.outlineButton]}>
                <Ionicons name="images-outline" size={20} color={colors.primary} />
                <Text style={styles.outlineButtonText}>Choose from library</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadButtonWrapper}
              onPress={handleRecordFromDevice}
              activeOpacity={0.88}
            >
              <View style={[styles.uploadButton, styles.primaryButton]}>
                <Ionicons name="videocam" size={20} color={colors.textInverse} />
                <Text style={styles.primaryButtonText}>Record video</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {onCancel && (
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} hitSlop={{ top: 12, bottom: 12 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  if (mode === 'preview' && videoUri) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Preview</Text>
        <Text style={styles.pageSubtitle}>Happy with this clip?</Text>

        <View style={styles.uploadCard}>
          <View style={styles.previewWrap}>
            <Ionicons name="film-outline" size={40} color={colors.textMuted} />
            <Text style={styles.previewPlaceholder}>Video ready</Text>
            <Text style={styles.previewHint}>We’ll upload it with your price on the next step.</Text>
          </View>

          <View style={styles.uploadButtons}>
            <TouchableOpacity
              style={styles.uploadButtonWrapper}
              onPress={() => {
                setVideoUri(null);
                setMode('picker');
              }}
              activeOpacity={0.88}
            >
              <View style={[styles.uploadButton, styles.outlineButton]}>
                <Ionicons name="refresh" size={20} color={colors.primary} />
                <Text style={styles.outlineButtonText}>Choose different video</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadButtonWrapper} onPress={() => onRecorded(videoUri)} activeOpacity={0.88}>
              <View style={[styles.uploadButton, styles.primaryButton]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.textInverse} />
                <Text style={styles.primaryButtonText}>Use this video</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  scrollContent: {
    paddingHorizontal: wp('5%'),
    paddingBottom: hp('4%'),
    paddingTop: hp('1%'),
  },
  pageTitle: {
    fontSize: wp('5.2%'),
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  uploadCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: spacing.xl,
    ...shadows.card,
  },
  limitRow: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  limitPill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  limitNum: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  limitUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  uploadDescription: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  uploadButtons: {
    gap: spacing.md,
  },
  uploadButtonWrapper: {
    width: '100%',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: radii.pill,
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    ...shadows.orange,
  },
  primaryButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
  outlineButton: {
    backgroundColor: colors.cardBg,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  outlineButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: -0.2,
  },
  cancelBtn: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  previewWrap: {
    minHeight: hp('22%'),
    backgroundColor: colors.metaBg,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  previewPlaceholder: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  previewHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 18,
  },
});
