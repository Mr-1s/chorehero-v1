/**
 * Tutorial Overlay Component
 * Interactive guided tour overlays with highlighting and animations
 */

import React, { useState, useEffect, useRef } from 'react';
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

// Safety timeout - if a step is stuck for 15 seconds, auto-advance
const SAFETY_TIMEOUT_MS = 15000;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TutorialOverlayProps {
  tutorial: Tutorial | null;
  currentStepIndex: number;
  onStepComplete: () => void;
  onTutorialComplete: () => void;
  onTutorialSkip: () => void;
  targetElementRef?: React.RefObject<View>;
  userId: string;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  tutorial,
  currentStepIndex,
  onStepComplete,
  onTutorialComplete,
  onTutorialSkip,
  targetElementRef,
  userId
}) => {
  const [visible, setVisible] = useState(false);
  const [elementPosition, setElementPosition] = useState<{x: number, y: number, width: number, height: number} | null>(null);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  // Track active animations for cleanup
  const activeAnimations = useRef<Animated.CompositeAnimation[]>([]);

  const currentStep = tutorial?.steps[currentStepIndex];
  const isLastStep = currentStepIndex === (tutorial?.steps.length || 0) - 1;

  // Cleanup function to stop all animations
  const stopAllAnimations = () => {
    activeAnimations.current.forEach(anim => {
      if (anim) {
        anim.stop();
      }
    });
    activeAnimations.current = [];
    // Reset animation values
    pulseAnim.setValue(1);
    bounceAnim.setValue(0);
    glowAnim.setValue(0);
  };

  useEffect(() => {
    let durationTimer: NodeJS.Timeout | null = null;
    let safetyTimer: NodeJS.Timeout | null = null;
    
    if (tutorial && currentStep) {
      // Stop any existing animations first
      stopAllAnimations();
      
      setVisible(true);
      startEntranceAnimation();
      
      // Measure target element if exists
      if (targetElementRef?.current) {
        measureTargetElement();
      } else {
        // Clear position if no target ref
        setElementPosition(null);
      }
      
      // Start step-specific animations
      startStepAnimation();
      
      // Auto-advance if duration is set
      if (currentStep.duration) {
        durationTimer = setTimeout(() => {
          handleStepComplete();
        }, currentStep.duration);
      }
      
      // Safety timeout - auto-advance if stuck for too long
      safetyTimer = setTimeout(() => {
        console.log('⚠️ Tutorial safety timeout triggered - auto-advancing');
        handleStepComplete();
      }, SAFETY_TIMEOUT_MS);
      
      return () => {
        if (durationTimer) clearTimeout(durationTimer);
        if (safetyTimer) clearTimeout(safetyTimer);
        stopAllAnimations();
      };
    } else {
      stopAllAnimations();
      setVisible(false);
    }
  }, [tutorial, currentStepIndex]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => stopAllAnimations();
  }, []);

  const measureTargetElement = () => {
    if (targetElementRef?.current) {
      targetElementRef.current.measure((x, y, width, height, pageX, pageY) => {
        setElementPosition({ x: pageX, y: pageY, width, height });
      });
    }
  };

  const startEntranceAnimation = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const startStepAnimation = () => {
    if (!currentStep?.animation) return;

    let animation: Animated.CompositeAnimation;
    
    switch (currentStep.animation) {
      case 'pulse':
        animation = Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          ])
        );
        break;
        
      case 'bounce':
        animation = Animated.loop(
          Animated.sequence([
            Animated.timing(bounceAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(bounceAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
          ])
        );
        break;
        
      case 'glow':
        animation = Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
          ])
        );
        break;
        
      default:
        return;
    }
    
    // Track and start the animation
    activeAnimations.current.push(animation);
    animation.start();
  };

  const handleStepComplete = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (isLastStep) {
      await tutorialService.completeTutorial(tutorial!.id, userId);
      handleTutorialComplete();
    } else {
      onStepComplete();
    }
  };

  const handleTutorialComplete = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onTutorialComplete();
    });
  };

  const handleSkip = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await tutorialService.skipTutorial(tutorial!.id, userId);
    
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onTutorialSkip();
    });
  };

  const renderHighlight = () => {
    if (!elementPosition || !currentStep?.showOverlay) return null;

    const highlightStyle = {
      position: 'absolute' as const,
      left: elementPosition.x - 10,
      top: elementPosition.y - 10,
      width: elementPosition.width + 20,
      height: elementPosition.height + 20,
      borderRadius: Math.max(elementPosition.width, elementPosition.height) / 2 + 10,
      borderWidth: 3,
      borderColor: '#3ad3db',
    };

    const animationStyle = currentStep.animation === 'pulse' 
      ? { transform: [{ scale: pulseAnim }] }
      : currentStep.animation === 'glow'
      ? { 
          shadowColor: '#3ad3db',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: glowAnim,
          shadowRadius: 20,
        }
      : {};

    return (
      <Animated.View style={[highlightStyle, animationStyle]} />
    );
  };

  const renderTooltip = () => {
    if (!currentStep) return null;

    const getTooltipPosition = () => {
      if (!elementPosition) {
        // Center position
        return {
          top: SCREEN_HEIGHT / 2 - 100,
          left: 20,
          right: 20,
        };
      }

      switch (currentStep.position) {
        case 'top':
          return {
            top: elementPosition.y - 150,
            left: 20,
            right: 20,
          };
        case 'bottom':
          return {
            top: elementPosition.y + elementPosition.height + 20,
            left: 20,
            right: 20,
          };
        default:
          return {
            top: SCREEN_HEIGHT / 2 - 100,
            left: 20,
            right: 20,
          };
      }
    };

    return (
      <Animated.View 
        style={[
          styles.tooltip, 
          getTooltipPosition(),
          currentStep.animation === 'bounce' && {
            transform: [{ translateY: bounceAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -10]
            })}]
          }
        ]}
      >
        <LinearGradient
          colors={['#0891b2', '#06b6d4']}
          style={styles.tooltipGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${((currentStepIndex + 1) / (tutorial?.steps.length || 1)) * 100}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {currentStepIndex + 1} of {tutorial?.steps.length}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.tooltipTitle}>{currentStep.title}</Text>
          
          {/* Description */}
          <Text style={styles.tooltipDescription}>{currentStep.description}</Text>
          
          {/* Action hint */}
          {currentStep.action && (
            <View style={styles.actionHint}>
              <Ionicons 
                name={
                  currentStep.action === 'tap' ? 'finger-print' :
                  currentStep.action === 'swipe' ? 'swap-vertical' :
                  currentStep.action === 'scroll' ? 'scroll' : 'time'
                } 
                size={16} 
                color="#ffffff" 
              />
              <Text style={styles.actionText}>
                {currentStep.action === 'tap' ? 'Tap to continue' :
                 currentStep.action === 'swipe' ? 'Swipe to explore' :
                 currentStep.action === 'scroll' ? 'Scroll to see more' : 'Wait a moment'}
              </Text>
            </View>
          )}
          
          {/* Controls */}
          <View style={styles.controls}>
            {currentStep.skippable && (
              <TouchableOpacity 
                style={styles.skipButton} 
                onPress={handleSkip}
              >
                <Text style={styles.skipText}>Skip Tour</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={styles.nextButton} 
              onPress={handleStepComplete}
            >
              <Text style={styles.nextText}>
                {isLastStep ? 'Got it!' : 'Next'}
              </Text>
              {!isLastStep && (
                <Ionicons name="chevron-forward" size={16} color="#0891b2" />
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  // Handle tap on background to advance (makes it easier to get through tutorial)
  const handleBackgroundTap = () => {
    handleStepComplete();
  };

  if (!visible || !tutorial || !currentStep) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleSkip} // Android back button skips tutorial
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <TouchableWithoutFeedback onPress={handleBackgroundTap}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          {currentStep.showOverlay && (
            <BlurView intensity={20} style={StyleSheet.absoluteFillObject} />
          )}
          
          {/* Semi-transparent background */}
          <View style={styles.background} />
          
          {/* Element highlight */}
          {renderHighlight()}
          
          {/* Tooltip - wrapped to prevent background tap from triggering */}
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View>
              {renderTooltip()}
            </View>
          </TouchableWithoutFeedback>
          
          {/* Tap anywhere hint */}
          <View style={styles.tapHint}>
            <Text style={styles.tapHintText}>Tap anywhere to continue</Text>
          </View>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    position: 'relative',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  tooltip: {
    position: 'absolute',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  tooltipGradient: {
    padding: 20,
    minHeight: 120,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    lineHeight: 24,
  },
  tooltipDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
    marginBottom: 16,
  },
  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  actionText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
    marginLeft: 8,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  nextText: {
    fontSize: 14,
    color: '#0891b2',
    fontWeight: '600',
    marginRight: 4,
  },
  tapHint: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tapHintText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
  },
});
