/**
 * Tutorial Overlay Component
 * Interactive guided tour overlays with highlighting and animations
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
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

  const currentStep = tutorial?.steps[currentStepIndex];
  const isLastStep = currentStepIndex === (tutorial?.steps.length || 0) - 1;

  useEffect(() => {
    if (tutorial && currentStep) {
      setVisible(true);
      startEntranceAnimation();
      
      // Measure target element if exists
      if (targetElementRef?.current) {
        measureTargetElement();
      }
      
      // Start step-specific animations
      startStepAnimation();
      
      // Auto-advance if duration is set
      if (currentStep.duration) {
        const timer = setTimeout(() => {
          handleStepComplete();
        }, currentStep.duration);
        
        return () => clearTimeout(timer);
      }
    } else {
      setVisible(false);
    }
  }, [tutorial, currentStepIndex]);

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

    switch (currentStep.animation) {
      case 'pulse':
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          ])
        ).start();
        break;
        
      case 'bounce':
        Animated.loop(
          Animated.sequence([
            Animated.timing(bounceAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(bounceAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
          ])
        ).start();
        break;
        
      case 'glow':
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
          ])
        ).start();
        break;
    }
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
          colors={['#1e293b', '#334155']}
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
                color="#3ad3db" 
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
                <Ionicons name="chevron-forward" size={16} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    );
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
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        {currentStep.showOverlay && (
          <BlurView intensity={20} style={StyleSheet.absoluteFillObject} />
        )}
        
        {/* Semi-transparent background */}
        <View style={styles.background} />
        
        {/* Element highlight */}
        {renderHighlight()}
        
        {/* Tooltip */}
        {renderTooltip()}
      </Animated.View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3ad3db',
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
    backgroundColor: 'rgba(58, 211, 219, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  actionText: {
    fontSize: 12,
    color: '#3ad3db',
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
    backgroundColor: '#3ad3db',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  nextText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    marginRight: 4,
  },
});
