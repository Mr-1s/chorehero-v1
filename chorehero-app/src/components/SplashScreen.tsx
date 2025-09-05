import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(30)).current;
  const brandOpacity = useRef(new Animated.Value(0)).current;
  const brandTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Start animations with improved timing
    Animated.sequence([
      // Logo entrance with elegant scale and fade
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
      // Brand name animation
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      // Tagline animation  
      Animated.parallel([
        Animated.timing(brandOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(brandTranslateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      // Hold the screen a bit longer for better UX
      Animated.delay(1200),
    ]).start(() => {
      // Smooth transition to main app
      setTimeout(() => {
        onFinish();
      }, 300);
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1A2A" />
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155', '#3ad3db', '#1E293B', '#0F172A']}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        locations={[0, 0.2, 0.4, 0.5, 0.8, 1]}
      >
        <View style={styles.content}>
          {/* Logo with improved animation */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logo}
                contentFit="contain"
              />
              <View style={styles.logoGlow} />
            </View>
          </Animated.View>

          {/* Brand Name */}
          <Animated.View
            style={[
              styles.brandContainer,
              {
                opacity: textOpacity,
                transform: [{ translateY: textTranslateY }],
              },
            ]}
          >
            <Text style={styles.brandName}>ChoreHero</Text>
          </Animated.View>

          {/* Tagline */}
          <Animated.View
            style={[
              styles.taglineContainer,
              {
                opacity: brandOpacity,
                transform: [{ translateY: brandTranslateY }],
              },
            ]}
          >
            <Text style={styles.tagline}>Your trusted cleaning companion</Text>
          </Animated.View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 30,
  },
  logoWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#3ad3db',
    opacity: 0.1,
    top: -10,
    left: -10,
  },
  brandContainer: {
    marginBottom: 12,
  },
  brandName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 2,
    textShadowColor: 'rgba(58, 211, 219, 0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 12,
  },
  taglineContainer: {
    paddingHorizontal: 40,
  },
  tagline: {
    fontSize: 17,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    letterSpacing: 0.8,
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

export default SplashScreen; 