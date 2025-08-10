import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showTagline?: boolean;
  style?: any;
}

const Logo: React.FC<LogoProps> = ({ size = 'medium', showTagline = false, style }) => {
  const getSize = () => {
    switch (size) {
      case 'small':
        return { width: 120, height: 80, textSize: 18, iconSize: 24 };
      case 'large':
        return { width: 200, height: 140, textSize: 32, iconSize: 48 };
      default:
        return { width: 160, height: 100, textSize: 24, iconSize: 36 };
    }
  };

  const dimensions = getSize();

  return (
    <View style={[styles.container, style]}>
      {/* Shield Background with Gradient */}
      <View style={[styles.logoContainer, { width: dimensions.width, height: dimensions.height }]}>
        <LinearGradient
          colors={['#0ea5e9', '#0891b2', '#0f766e']}
          style={styles.shieldBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Hand Character */}
          <View style={styles.characterContainer}>
            <LinearGradient
              colors={['#fbbf24', '#f59e0b', '#d97706']}
              style={[styles.handCharacter, { width: dimensions.iconSize, height: dimensions.iconSize }]}
            >
              <Text style={[styles.handEmoji, { fontSize: dimensions.iconSize * 0.7 }]}>✋</Text>
            </LinearGradient>
            
            {/* Cleaning Tool */}
            <View style={styles.toolContainer}>
              <LinearGradient
                colors={['#06b6d4', '#0891b2']}
                style={styles.tool}
              >
                <Ionicons name="brush" size={dimensions.iconSize * 0.4} color="#ffffff" />
              </LinearGradient>
            </View>
            
            {/* Sparkle Effect */}
            <View style={[styles.sparkle, styles.sparkle1]}>
              <Ionicons name="star" size={dimensions.iconSize * 0.3} color="#fbbf24" />
            </View>
            <View style={[styles.sparkle, styles.sparkle2]}>
              <Ionicons name="diamond" size={dimensions.iconSize * 0.2} color="#ffffff" />
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ChoreHero Text */}
      <View style={styles.textContainer}>
        <View style={styles.brandContainer}>
          <LinearGradient
            colors={['#f59e0b', '#d97706', '#92400e']}
            style={styles.choreTextGradient}
          >
            <Text style={[styles.choreText, { fontSize: dimensions.textSize }]}>Chore</Text>
          </LinearGradient>
          <LinearGradient
            colors={['#06b6d4', '#0891b2', '#0f766e']}
            style={styles.heroTextGradient}
          >
            <Text style={[styles.heroText, { fontSize: dimensions.textSize }]}>Hero</Text>
          </LinearGradient>
        </View>
        
        {showTagline && (
          <View style={styles.taglineContainer}>
            <Text style={[styles.tagline, { fontSize: dimensions.textSize * 0.4 }]}>
              ON-DEMAND CLEANING
            </Text>
            <View style={styles.divider} />
            <Text style={[styles.established, { fontSize: dimensions.textSize * 0.35 }]}>
              EST. 2025
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  shieldBackground: {
    flex: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  characterContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handCharacter: {
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  handEmoji: {
    textAlign: 'center',
  },
  toolContainer: {
    position: 'absolute',
    right: -8,
    top: -4,
    transform: [{ rotate: '15deg' }],
  },
  tool: {
    width: 16,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sparkle: {
    position: 'absolute',
  },
  sparkle1: {
    top: -10,
    right: 10,
    transform: [{ rotate: '15deg' }],
  },
  sparkle2: {
    bottom: -8,
    left: 8,
    transform: [{ rotate: '-15deg' }],
  },
  textContainer: {
    alignItems: 'center',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  choreTextGradient: {
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  heroTextGradient: {
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  choreText: {
    fontWeight: '800',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    letterSpacing: -0.5,
  },
  heroText: {
    fontWeight: '800',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    letterSpacing: -0.5,
  },
  taglineContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  tagline: {
    color: '#ffffff',
    fontWeight: '600',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  divider: {
    width: 40,
    height: 1,
    backgroundColor: '#ffffff',
    marginVertical: 4,
    opacity: 0.7,
  },
  established: {
    color: '#ffffff',
    fontWeight: '400',
    letterSpacing: 1.5,
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default Logo; 