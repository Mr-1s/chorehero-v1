import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, StatusBar, View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

const { width, height } = Dimensions.get('window');

type Props = { onFinish: () => void };

const AnimatedSplash: React.FC<Props> = ({ onFinish }) => {
  // Scene fade
  const sceneOpacity = useRef(new Animated.Value(1)).current;
  // Rising radial glow
  const glowScale = useRef(new Animated.Value(0.6)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowTranslateY = useRef(new Animated.Value(20)).current;
  // Logo
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  // Title
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(24)).current;
  // Tagline (typewriter)
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(12)).current;
  const fullTagline = 'Where clean meets hero';
  const [typed, setTyped] = useState('');

  // Bubbles config
  const bubbles = useMemo(
    () =>
      Array.from({ length: 9 }).map((_, i) => ({
        key: `b-${i}`,
        left: Math.max(12, Math.min(width - 12, (i * (width / 9)) + (Math.random() * 12 - 6))),
        size: 6 + Math.round(Math.random() * 10),
        ty: new Animated.Value(0),
        op: new Animated.Value(0),
        delay: 1700 + Math.round(Math.random() * 400),
        duration: 2200 + Math.round(Math.random() * 900),
      })),
    []
  );

  useEffect(() => {
    // 0.0–2.0s rising glow
    Animated.parallel([
      Animated.timing(glowOpacity, { toValue: 0.28, duration: 1200, useNativeDriver: true }),
      Animated.timing(glowScale, { toValue: 1.25, duration: 2000, useNativeDriver: true }),
      Animated.timing(glowTranslateY, { toValue: -12, duration: 2000, useNativeDriver: true }),
    ]).start();

    // 0.4–1.3s logo bounce-in
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 500, delay: 400, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(logoScale, { toValue: 1.1, duration: 500, delay: 400, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();

    // 1.0–1.7s title slide-up + fade
    Animated.parallel([
      Animated.timing(titleOpacity, { toValue: 1, duration: 700, delay: 1000, useNativeDriver: true }),
      Animated.timing(titleTranslateY, { toValue: 0, duration: 700, delay: 1000, useNativeDriver: true }),
    ]).start();

    // 1.4–2.8s typewriter tagline ~24 cps
    const startType = setTimeout(() => {
      const cps = 24;
      const interval = 1000 / cps;
      let i = 0;
      const id = setInterval(() => {
        i += 1;
        setTyped(fullTagline.slice(0, i));
        if (i >= fullTagline.length) clearInterval(id);
      }, interval);
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(taglineTranslateY, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 1400);

    // 1.7s+ bubbles float upward
    bubbles.forEach((b) => {
      Animated.parallel([
        Animated.timing(b.op, { toValue: 0.35, duration: 600, delay: b.delay, useNativeDriver: true }),
        Animated.timing(b.ty, { toValue: -height * 0.35, duration: b.duration, delay: b.delay, useNativeDriver: true }),
      ]).start();
    });

    // 3.3–4.0s exit fade → navigate Home
    const exit = setTimeout(() => {
      Animated.timing(sceneOpacity, { toValue: 0, duration: 700, useNativeDriver: true }).start(() => onFinish());
    }, 3300);

    return () => {
      clearTimeout(startType);
      clearTimeout(exit);
    };
  }, [bubbles, glowOpacity, glowScale, glowTranslateY, logoOpacity, logoScale, titleOpacity, titleTranslateY, taglineOpacity, taglineTranslateY, onFinish]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1A2A" />
      <LinearGradient colors={[ '#0F172A', '#0B1220' ]} style={styles.background}>
        <Animated.View style={[styles.content, { opacity: sceneOpacity }] }>
          {/* Logo */}
          <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
            <View style={styles.logoWrapper}>
              <Image source={require('../../assets/icon.png')} style={styles.logo} contentFit="contain" />
              <Animated.View style={[styles.logoGlow, { opacity: glowOpacity, transform: [{ translateY: glowTranslateY }, { scale: glowScale }] }]} />
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.View style={[styles.brandContainer, { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }]}>
            <Text style={styles.brandName}>ChoreHero</Text>
          </Animated.View>

          {/* Tagline */}
          <Animated.View style={[styles.taglineContainer, { opacity: taglineOpacity, transform: [{ translateY: taglineTranslateY }] }]}>
            <Text style={styles.tagline}>{typed}</Text>
          </Animated.View>

          {/* Bubbles */}
          <View pointerEvents="none" style={styles.bubbleLayer}>
            {bubbles.map((b) => (
              <Animated.View
                key={b.key}
                style={{
                  position: 'absolute',
                  left: b.left,
                  bottom: height * 0.35,
                  width: b.size,
                  height: b.size,
                  borderRadius: b.size / 2,
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  opacity: b.op,
                  transform: [{ translateY: b.ty }],
                }}
              />
            ))}
          </View>
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  background: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', justifyContent: 'center' },
  bubbleLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  logoContainer: { marginBottom: 36 },
  logoWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 100, height: 100, borderRadius: 50 },
  logoGlow: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: '#3ad3db', opacity: 0.15 },
  brandContainer: { marginBottom: 10 },
  brandName: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', letterSpacing: 1 },
  taglineContainer: { paddingHorizontal: 40 },
  tagline: { fontSize: 16, fontWeight: '400', color: 'rgba(255, 255, 255, 0.9)', textAlign: 'center', letterSpacing: 0.5, lineHeight: 24 },
});

export default AnimatedSplash;


