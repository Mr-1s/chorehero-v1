import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Text, useWindowDimensions, AccessibilityInfo, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
  cancelAnimation,
  useDerivedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { easeOutCubic, easeOutBack } from '../lib/easing';

const TAGLINE = "Every chore needs a hero.";

type SplashHeroProps = {
  onDone?: () => void;
};

// Typewriter text component
type TypewriterTextProps = {
  text: string;
  visibleChars: Animated.SharedValue<number>;
  style: any;
};

const TypewriterText: React.FC<TypewriterTextProps> = ({ text, visibleChars, style }) => {
  const [displayText, setDisplayText] = useState('');
  
  // Update display text when visibleChars changes
  useDerivedValue(() => {
    const chars = visibleChars.value;
    runOnJS(setDisplayText)(text.slice(0, chars));
    return chars;
  });

  return (
    <Text style={style}>
      {displayText}
      <Text style={{ opacity: 0 }}>{text.slice(displayText.length)}</Text>
    </Text>
  );
};

const LOGO_SOURCE = require('../../assets/app-logo.png');

const SplashHero: React.FC<SplashHeroProps> = ({ onDone }) => {
  const { width, height } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const time = useSharedValue(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const checkMotionAndStart = async () => {
      const isReduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      setReduceMotion(isReduceMotion);

      if (isReduceMotion) {
        // Static display, wait and finish
        timeout = setTimeout(() => {
          onDone?.();
        }, 1200);
        // Set time to end state immediately for static render
        time.value = 3500;
      } else {
        // Start animation
        time.value = withTiming(3500, {
          duration: 3500,
          easing: Easing.linear,
        }, (finished) => {
          if (finished && onDone) {
            runOnJS(onDone)();
          }
        });
      }
    };

    checkMotionAndStart();

    return () => {
      cancelAnimation(time);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  // --- Animations ---

  // 1. Diagonal Spotlight (0 - 2000ms)
  const spotlightStyle = useAnimatedStyle(() => {
    const progress = interpolate(time.value, [0, 2000], [0, 1], Extrapolation.CLAMP);
    const eased = easeOutCubic(progress);
    const translateX = interpolate(eased, [0, 1], [-width * 1.5, width * 1.5]);

    return {
      transform: [
        { rotate: '-20deg' },
        { translateX },
      ],
      opacity: 1, // Visible
    };
  });

  // 2. Logo Animation (200 - 1100ms entry, 1400ms+ breathing)
  const logoStyle = useAnimatedStyle(() => {
    // Slide & Scale In
    const slideProgress = interpolate(time.value, [200, 1100], [0, 1], Extrapolation.CLAMP);
    const easedSlide = easeOutBack(slideProgress);

    const startY = -0.2 * height;
    const endY = 0.32 * height;
    const translateY = interpolate(easedSlide, [0, 1], [startY, endY]);

    const baseScale = 0.85 + 0.25 * easedSlide;

    // Breathing (starts approx 1400ms)
    // Frequency ~ 2.2 * PI per second (time is in ms, so / 1000)
    // t in seconds
    const tSec = time.value / 1000;
    // Only breathe after it settles
    let breathing = 0;
    if (time.value > 1400) {
       // Smooth start for breathing? Or just start.
       // sin(t * freq)
       breathing = 0.015 * Math.sin(tSec * 2.2 * Math.PI);
    }
    
    const finalScale = baseScale * (1 + breathing);

    return {
      transform: [
        { translateY },
        { scale: finalScale },
      ],
    };
  });

  // 3. Title Animation (1000 - 1600ms)
  const titleStyle = useAnimatedStyle(() => {
    const progress = interpolate(time.value, [1000, 1600], [0, 1], Extrapolation.CLAMP);
    
    return {
      opacity: progress,
      transform: [
        { translateY: interpolate(progress, [0, 1], [12, 0]) },
      ],
    };
  });

  // 4. Tagline Typewriter Animation (1300 - 2800ms)
  // Calculate visible characters based on time
  const visibleChars = useDerivedValue(() => {
    // Start typing at 1300ms, finish by 2800ms (1500ms for full text)
    const typeProgress = interpolate(time.value, [1300, 2800], [0, 1], Extrapolation.CLAMP);
    return Math.floor(typeProgress * TAGLINE.length);
  });

  const taglineContainerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(time.value, [1300, 1400], [0, 1], Extrapolation.CLAMP);
    return {
      opacity,
      transform: [
        { translateY: interpolate(time.value, [1300, 1500], [8, 0], Extrapolation.CLAMP) },
      ],
    };
  });

  // Cursor blink animation
  const cursorStyle = useAnimatedStyle(() => {
    const showCursor = time.value >= 1300 && time.value < 3000;
    // Blink every 500ms
    const blinkPhase = Math.floor(time.value / 500) % 2;
    const isTyping = time.value < 2800;
    
    return {
      opacity: showCursor ? (isTyping ? 1 : blinkPhase) : 0,
    };
  });

  // 5. Exit Fade (3000 - 3500ms)
  const exitOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(time.value, [3000, 3500], [0, 0.18], Extrapolation.CLAMP);
    return {
      opacity,
    };
  });

  // Responsive dimensions
  const logoHeight = width * 0.42; // ~40-45% width
  
  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={['#081220', '#127896', '#06121E']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Spotlight Sweep */}
      <Animated.View
        style={[
          styles.spotlight,
          { width: width * 2, height: height * 1.5, left: -width * 0.5, top: -height * 0.2 },
          spotlightStyle,
        ]}
      />

      {/* Logo */}
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Image
          source={LOGO_SOURCE}
          style={{ width: logoHeight, height: logoHeight, resizeMode: 'contain' }}
        />
      </Animated.View>

      {/* Text Container (Positioned absolutely or relatively below logo target) */}
      <View style={[styles.textContainer, { top: height * 0.32 + logoHeight * 0.6 + 30 }]}>
        <Animated.View style={[styles.titleContainer, titleStyle]}>
          <Text style={styles.choreText}>Chore</Text>
          <Text style={styles.heroText}>Hero</Text>
        </Animated.View>
        <Animated.View style={[styles.taglineContainer, taglineContainerStyle]}>
          <TypewriterText 
            text={TAGLINE} 
            visibleChars={visibleChars} 
            style={styles.tagline}
          />
          <Animated.View style={[styles.cursor, cursorStyle]} />
        </Animated.View>
      </View>

      {/* Exit Overlay */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }, exitOverlayStyle]}
        pointerEvents="none"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#081220', // Fallback
    overflow: 'hidden',
  },
  spotlight: {
    position: 'absolute',
    backgroundColor: 'rgba(110,210,220,0.25)',
    zIndex: 0,
  },
  logoContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  textContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
    paddingHorizontal: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  choreText: {
    fontSize: 45,
    fontWeight: '800',
    color: '#e6b200',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    fontFamily: 'System',
  },
  heroText: {
    fontSize: 45,
    fontWeight: '800',
    color: '#06b6d4',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    fontFamily: 'System',
  },
  tagline: {
    fontSize: 16,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  taglineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cursor: {
    width: 2,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    marginLeft: 2,
    borderRadius: 1,
  },
});

export default SplashHero;

