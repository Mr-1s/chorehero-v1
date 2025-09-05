import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';

type StackParamList = {
  AccountTypeSelection: undefined;
  CustomerOnboarding: undefined;
  CleanerOnboarding: undefined;
  AuthScreen: undefined;
};

type AccountTypeSelectionNavigationProp = StackNavigationProp<StackParamList, 'AccountTypeSelection'>;

interface AccountTypeSelectionProps {
  navigation: AccountTypeSelectionNavigationProp;
}

const AccountTypeSelectionScreen: React.FC<AccountTypeSelectionProps> = ({ navigation }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const card1Scale = useRef(new Animated.Value(0.95)).current;
  const card2Scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(card1Scale, {
        toValue: 1,
        duration: 1000,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(card2Scale, {
        toValue: 1,
        duration: 1000,
        delay: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleCardPress = (type: 'customer' | 'cleaner') => {
    const targetScale = type === 'customer' ? card1Scale : card2Scale;
    
    Animated.sequence([
      Animated.timing(targetScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(targetScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (type === 'customer') {
        navigation.navigate('CustomerOnboarding');
      } else {
        navigation.navigate('CleanerOnboarding');
      }
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3ad3db" />
      
      <LinearGradient
        colors={['#06b6d4', '#0891b2']}
        style={styles.gradient}
      >
        {/* Safe Area Spacer */}
        <SafeAreaView style={styles.safeAreaSpacer} />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.navigate('AuthScreen')}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Image
            source={require('../../../assets/app-icon.png')}
            style={styles.cornerLogo}
            resizeMode="contain"
          />
        </View>

        {/* Welcome Section */}
        <Animated.View 
          style={[
            styles.welcomeSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.welcomeTitle}>Choose your ChoreHero journey</Text>
          <Text style={styles.welcomeSubtitle}>
            Every clean space has a story. What's yours?
          </Text>
        </Animated.View>

        {/* RADICAL MODERN: Floating Cards with Gradients */}
        <View style={styles.radicalContainer}>
          {/* Floating Background Shapes */}
          <View style={styles.floatingShape1} />
          <View style={styles.floatingShape2} />
          
          <Animated.View style={{ 
            transform: [{ scale: card1Scale }, { rotate: '-3deg' }],
            marginRight: 30,
          }}>
            <TouchableOpacity
              style={styles.radicalCard1}
              activeOpacity={1}
              onPress={() => handleCardPress('customer')}
            >
              <LinearGradient
                colors={['#3ad3db', '#06b6d4', '#0891b2']}
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.radicalContent}>
                  <View style={styles.radicalIcon}>
                    <View style={styles.glassIcon}>
                      <Ionicons name="search" size={32} color="#ffffff" />
                    </View>
                    <View style={styles.floatingSparkle}>
                      <Ionicons name="sparkles" size={18} color="#FFD700" />
                    </View>
                  </View>
                  <View style={styles.radicalText}>
                    <Text style={styles.radicalTitle}>Find a{"\n"}ChoreHero</Text>
                    <Text style={styles.radicalSubtitle}>Connect instantly</Text>
                    <View style={styles.radicalBadges}>
                      <Text style={styles.badge}>⚡ Same-day</Text>
                      <Text style={styles.badge}>🏆 Verified</Text>
                      <Text style={styles.badge}>💳 Secure</Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ 
            transform: [{ scale: card2Scale }, { rotate: '3deg' }],
            marginLeft: 30,
            marginTop: -20,
          }}>
            <TouchableOpacity
              style={styles.radicalCard2}
              activeOpacity={1}
              onPress={() => handleCardPress('cleaner')}
            >
              <LinearGradient
                colors={['#8B5CF6', '#7C3AED', '#6366F1']}
                style={styles.cardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.radicalContent}>
                  <View style={styles.radicalIcon}>
                    <View style={styles.glassIcon}>
                      <Ionicons name="flash" size={32} color="#ffffff" />
                    </View>
                    <View style={styles.floatingStar}>
                      <Ionicons name="star" size={18} color="#FFD700" />
                    </View>
                  </View>
                  <View style={styles.radicalText}>
                    <Text style={styles.radicalTitle}>Become a{"\n"}ChoreHero</Text>
                    <Text style={styles.radicalSubtitle}>Earn heroically</Text>
                    <View style={styles.radicalBadges}>
                      <Text style={styles.badge}>💰 Your rates</Text>
                      <Text style={styles.badge}>📅 Your time</Text>
                      <Text style={styles.badge}>⭐ Your rep</Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Bottom Info */}
        <View style={styles.bottomSection}>
          <Text style={styles.bottomText}>
            Every hero's journey is unique. You can always change paths later.
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  safeAreaSpacer: {
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cornerLogo: {
    width: 80,
    height: 80,
  },
  welcomeSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
    lineHeight: 40,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  optionsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 15,
    borderWidth: 0.5,
    borderColor: 'rgba(58, 211, 219, 0.2)',
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    marginRight: 16,
    position: 'relative',
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  iconAccent: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  cardDescription: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    fontWeight: '500',
  },
  cardArrow: {
    marginLeft: 8,
  },
  cardBenefits: {
    backgroundColor: 'rgba(58, 211, 219, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#3ad3db',
  },
  benefitText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  bottomText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
    fontStyle: 'italic',
  },
  // RADICAL MODERN STYLES
  radicalContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
    position: 'relative',
  },
  floatingShape1: {
    position: 'absolute',
    top: 20,
    right: 40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(58, 211, 219, 0.15)',
    transform: [{ rotate: '45deg' }],
    zIndex: 0,
  },
  floatingShape2: {
    position: 'absolute',
    bottom: 80,
    left: 30,
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    transform: [{ rotate: '-30deg' }],
    zIndex: 0,
  },
  radicalCard1: {
    height: 260,
    borderRadius: 32,
    marginBottom: 30,
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 25,
    overflow: 'hidden',
  },
  radicalCard2: {
    height: 260,
    borderRadius: 32,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 25,
    overflow: 'hidden',
  },
  cardGradient: {
    flex: 1,
    borderRadius: 32,
  },
  radicalContent: {
    flex: 1,
    padding: 28,
    justifyContent: 'space-between',
  },
  radicalIcon: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  glassIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    backdropFilter: 'blur(20px)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  floatingSparkle: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
  },
  floatingStar: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 12,
  },
  radicalText: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  radicalTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 30,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  radicalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  radicalBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});

export default AccountTypeSelectionScreen; 