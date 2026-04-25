import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { cleanerTheme } from '../../utils/theme';
import { wp } from '../../utils/responsive';

const { colors, radii } = cleanerTheme;
const THUMB = 48;
const TRACK_PAD = 4;
const COMPLETE_AT = 0.78;

type Props = {
  onConfirm: () => void | Promise<void>;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const SlideToStartHeading: React.FC<Props> = ({
  onConfirm,
  label = 'Slide to start heading',
  disabled = false,
  style,
}) => {
  const panX = useRef(new Animated.Value(0)).current;
  const [maxDragPx, setMaxDragPx] = useState(0);
  const [busy, setBusy] = useState(false);

  const runConfirm = useCallback(async () => {
    await onConfirm();
  }, [onConfirm]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    const m = Math.max(0, w - THUMB - TRACK_PAD * 2);
    setMaxDragPx(m);
  };

  const canDrag = !disabled && !busy && maxDragPx > 0;
  const maxRef = useRef(0);
  maxRef.current = maxDragPx;
  const canDragRef = useRef(false);
  canDragRef.current = canDrag;
  const runRef = useRef(runConfirm);
  runRef.current = runConfirm;

  const labelOpacity = useMemo(() => {
    const m = Math.max(1, maxDragPx);
    return panX.interpolate({
      inputRange: [0, m],
      outputRange: [0.45, 0.1],
      extrapolate: 'clamp',
    });
  }, [maxDragPx, panX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canDragRef.current,
        onMoveShouldSetPanResponder: () => canDragRef.current,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, g) => {
          const m = maxRef.current;
          if (m <= 0) return;
          const x = Math.min(Math.max(0, g.dx), m);
          panX.setValue(x);
        },
        onPanResponderRelease: (_, g) => {
          const m = maxRef.current;
          if (m <= 0) return;
          const x = Math.min(Math.max(0, g.dx), m);
          if (x / m >= COMPLETE_AT) {
            setBusy(true);
            Animated.timing(panX, {
              toValue: m,
              duration: 100,
              useNativeDriver: true,
            }).start(() => {
              (async () => {
                try {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  await runRef.current();
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                } finally {
                  panX.setValue(0);
                  setBusy(false);
                }
              })();
            });
          } else {
            Animated.spring(panX, {
              toValue: 0,
              useNativeDriver: true,
              friction: 6,
              tension: 80,
            }).start();
          }
        },
      }),
    [panX]
  );

  return (
    <View
      style={[styles.track, (disabled || busy) && styles.trackDimmed, style]}
      onLayout={onTrackLayout}
      {...(canDrag ? panResponder.panHandlers : {})}
    >
      <Animated.Text style={[styles.hint, { opacity: labelOpacity }]} numberOfLines={1}>
        {busy ? 'Starting…' : label}
      </Animated.Text>
      <Animated.View style={[styles.thumb, { transform: [{ translateX: panX }] }]} pointerEvents="none">
        {busy ? (
          <View style={styles.busyIcon}>
            <Ionicons name="car" size={20} color={colors.textInverse} />
          </View>
        ) : (
          <Ionicons name="car" size={22} color={disabled ? colors.textMuted : colors.textInverse} />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: THUMB + TRACK_PAD * 2,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    paddingHorizontal: TRACK_PAD,
    overflow: 'hidden',
  },
  trackDimmed: {
    opacity: 0.55,
  },
  hint: {
    position: 'absolute',
    left: THUMB + TRACK_PAD + 8,
    right: TRACK_PAD,
    textAlign: 'center',
    fontSize: wp('3.5%'),
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
  thumb: {
    zIndex: 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  busyIcon: { opacity: 0.9 },
});

export default SlideToStartHeading;
