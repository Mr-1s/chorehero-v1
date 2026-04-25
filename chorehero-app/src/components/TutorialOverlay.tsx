/**
 * Tutorial Overlay (v2)
 *
 * Replaces the flat teal LinearGradient tooltip with a frosted-glass card
 * driven by a per-step `tone` (`customer` => teal, `cleaner` => orange) so
 * cleaners get the orange brand instead of the customer-side teal.
 *
 * Also supports CYCLING through screens: each step can declare a
 * `targetScreen` and we navigate there before painting the next tooltip.
 * That makes "tour through the app" feel real instead of stacking modals on
 * a single screen.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  Animated,
  Modal,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Tutorial, TutorialStep, tutorialService } from '../services/tutorialService';
import { navigationRef } from '../navigation/navigationRef';
import { wp, hp } from '../utils/responsive';

const SAFETY_TIMEOUT_MS = 30000;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TutorialOverlayProps {
  tutorial: Tutorial | null;
  currentStepIndex: number;
  onStepComplete: () => void;
  onTutorialComplete: () => void;
  onTutorialSkip: () => void;
  targetElementRef?: React.RefObject<View>;
  userId: string;
}

type Tone = 'customer' | 'cleaner';

interface ThemedColors {
  primary: string;
  primaryDark: string;
  primaryGlow: string;
  textOnPrimary: string;
  iconBubbleBg: string;
}

const TONE_THEMES: Record<Tone, ThemedColors> = {
  customer: {
    primary: '#26B7C9',
    primaryDark: '#047B9B',
    primaryGlow: 'rgba(38, 183, 201, 0.45)',
    textOnPrimary: '#FFFFFF',
    iconBubbleBg: 'rgba(38, 183, 201, 0.18)',
  },
  cleaner: {
    primary: '#FFA52F',
    primaryDark: '#B45309',
    primaryGlow: 'rgba(255, 165, 47, 0.5)',
    textOnPrimary: '#FFFFFF',
    iconBubbleBg: 'rgba(255, 165, 47, 0.18)',
  },
};

function pickTone(tutorial: Tutorial | null, step: TutorialStep | undefined): Tone {
  // Per-step tone takes precedence so a "both" tutorial can mix theming.
  const stepTone = (step as TutorialStep & { tone?: Tone })?.tone;
  if (stepTone === 'cleaner' || stepTone === 'customer') return stepTone;
  if (tutorial?.userType === 'cleaner') return 'cleaner';
  return 'customer';
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  tutorial,
  currentStepIndex,
  onStepComplete,
  onTutorialComplete,
  onTutorialSkip,
  userId,
}) => {
  const [visible, setVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(20)).current;

  const currentStep = tutorial?.steps[currentStepIndex];
  const isLastStep = currentStepIndex === (tutorial?.steps.length || 0) - 1;
  const tone: Tone = pickTone(tutorial, currentStep);
  const theme = TONE_THEMES[tone];

  /**
   * Optional cycling: if a step declares `targetScreen`, route there before
   * painting. We use `navigationRef` so the tour can drive screens it doesn't
   * own.
   */
  useEffect(() => {
    if (!tutorial || !currentStep) return;
    const targetScreen = (currentStep as TutorialStep & { targetScreen?: string })?.targetScreen;
    if (targetScreen && navigationRef.isReady()) {
      try {
        navigationRef.navigate(targetScreen as never);
      } catch {
        // Screen may not be in the current stack; tour can still continue.
      }
    }
  }, [tutorial, currentStep, currentStepIndex]);

  useEffect(() => {
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    if (tutorial && currentStep) {
      setVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(cardSlide, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 4 }),
      ]).start();

      safetyTimer = setTimeout(() => {
        // Stuck-step backstop so a misconfigured step can't trap the user.
        handleStepComplete();
      }, SAFETY_TIMEOUT_MS);

      return () => {
        if (safetyTimer) clearTimeout(safetyTimer);
      };
    } else {
      setVisible(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial, currentStepIndex]);

  const handleStepComplete = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // haptics optional
    }
    if (isLastStep) {
      if (tutorial) {
        await tutorialService.completeTutorial(tutorial.id, userId);
      }
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        onTutorialComplete();
      });
    } else {
      // Slide-out reset; the next step's mount triggers slide-in.
      cardSlide.setValue(20);
      onStepComplete();
    }
  };

  const handleSkip = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // haptics optional
    }
    if (tutorial) {
      await tutorialService.skipTutorial(tutorial.id, userId);
    }
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      onTutorialSkip();
    });
  };

  if (!visible || !tutorial || !currentStep) {
    return null;
  }

  const totalSteps = tutorial.steps.length;
  const progress = ((currentStepIndex + 1) / totalSteps) * 100;
  const stepIcon =
    (currentStep as TutorialStep & { icon?: keyof typeof Ionicons.glyphMap })?.icon ||
    inferIcon(currentStep);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <TouchableWithoutFeedback onPress={handleStepComplete}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={styles.dimBackground} />

          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Animated.View
              style={[
                styles.tooltipShell,
                {
                  transform: [{ translateY: cardSlide }],
                  shadowColor: theme.primaryGlow,
                  borderColor: theme.primary + '55',
                },
              ]}
            >
              <BlurView intensity={48} tint="light" style={styles.tooltipBlur}>
                {/* Soft tinted gradient on top of the blur for a frosted-glass feel */}
                <LinearGradient
                  colors={[theme.primary + '14', theme.primary + '03']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.tooltipGradient}
                >
                  {/* Header: icon bubble + progress + step counter */}
                  <View style={styles.headerRow}>
                    <View style={[styles.iconBubble, { backgroundColor: theme.iconBubbleBg }]}>
                      <Ionicons name={stepIcon} size={18} color={theme.primaryDark} />
                    </View>
                    <View style={styles.progressColumn}>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${progress}%`, backgroundColor: theme.primary },
                          ]}
                        />
                      </View>
                      <Text style={[styles.progressText, { color: theme.primaryDark }]}>
                        Step {currentStepIndex + 1} of {totalSteps}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.tooltipTitle}>{currentStep.title}</Text>
                  <Text style={styles.tooltipDescription}>{currentStep.description}</Text>

                  <View style={styles.controls}>
                    {currentStep.skippable && (
                      <TouchableOpacity onPress={handleSkip} style={styles.skipButton} hitSlop={8}>
                        <Text style={styles.skipText}>Skip Tour</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.nextButton, { backgroundColor: theme.primary }]}
                      onPress={handleStepComplete}
                    >
                      <Text style={[styles.nextText, { color: theme.textOnPrimary }]}>
                        {isLastStep ? "I'm ready" : 'Next'}
                      </Text>
                      {!isLastStep && (
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color={theme.textOnPrimary}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </BlurView>
            </Animated.View>
          </TouchableWithoutFeedback>

          {/* Tap-anywhere hint */}
          <View style={styles.tapHint}>
            <Text style={styles.tapHintText}>Tap anywhere to continue</Text>
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

function inferIcon(step: TutorialStep | undefined): keyof typeof Ionicons.glyphMap {
  if (!step) return 'sparkles';
  const t = (step.title || '').toLowerCase();
  if (t.includes('feed') || t.includes('video')) return 'play-circle';
  if (t.includes('discover') || t.includes('search')) return 'compass';
  if (t.includes('booking') || t.includes('book')) return 'calendar';
  if (t.includes('profile') || t.includes('photo')) return 'person-circle';
  if (t.includes('earn') || t.includes('rate') || t.includes('payout')) return 'cash';
  if (t.includes('schedule') || t.includes('availab')) return 'time';
  if (t.includes('upload') || t.includes('record')) return 'videocam';
  if (t.includes('welcome')) return 'sparkles';
  return 'compass';
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  dimBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  tooltipShell: {
    marginHorizontal: wp('5%'),
    marginBottom: hp('14%'),
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 28,
    elevation: 12,
  },
  tooltipBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
  },
  tooltipGradient: {
    padding: wp('5%'),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressColumn: {
    flex: 1,
    gap: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tooltipTitle: {
    fontSize: wp('5%'),
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  tooltipDescription: {
    fontSize: wp('3.6%'),
    color: '#334155',
    lineHeight: wp('5.2%'),
    marginBottom: 18,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
  },
  nextText: {
    fontSize: 14,
    fontWeight: '700',
  },
  tapHint: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tapHintText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});

export default TutorialOverlay;
