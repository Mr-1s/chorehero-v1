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
  Alert,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';

type StackParamList = {
  AccountTypeSelection: undefined;
  CustomerOnboarding: undefined;
  CleanerOnboarding: undefined;
  LocationLock: undefined;
  AuthScreen: undefined;
};

type AccountTypeSelectionNavigationProp = StackNavigationProp<StackParamList, 'AccountTypeSelection'>;

interface AccountTypeSelectionProps {
  navigation: AccountTypeSelectionNavigationProp;
}

const AccountTypeSelectionScreen: React.FC<AccountTypeSelectionProps> = ({ navigation }) => {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isCompact = screenHeight < 700;
  const cardPadding = isCompact ? 18 : 28;
  const titleSize = isCompact ? 22 : 26;
  const subtitleSize = isCompact ? 14 : 16;
  const badgeSize = isCompact ? 11 : 12;
  const iconSize = isCompact ? 28 : 32;
  const { signOut, authUser } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const card1Scale = useRef(new Animated.Value(0.95)).current;
  const card2Scale = useRef(new Animated.Value(0.95)).current;
  
  // Breathing animations
  const breathe1 = useRef(new Animated.Value(1)).current;
  const breathe2 = useRef(new Animated.Value(1)).current;
  
  // Background logo animation
  const logoFloat = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;

  // Get the current email for display
  const currentEmail = (authUser?.user as any)?.email;

  // Handle sign out / use different account
  const handleUseDifferentAccount = () => {
    Alert.alert(
      'Use Different Account?',
      currentEmail 
        ? `You're signed in as ${currentEmail}. Sign out to use a different account?`
        : 'Sign out of the current session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            navigation.navigate('AuthScreen');
          }
        }
      ]
    );
  };

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

    // Start breathing animations
    const startBreathing = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(breathe1, {
            toValue: 1.02,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(breathe1, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(breathe2, {
            toValue: 1.02,
            duration: 2200,
            useNativeDriver: true,
          }),
          Animated.timing(breathe2, {
            toValue: 1,
            duration: 2200,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    // Start logo animations
    const startLogoAnimation = () => {
      // Floating animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(logoFloat, { 
            toValue: 1, 
            duration: 3000, 
            useNativeDriver: true 
          }),
          Animated.timing(logoFloat, { 
            toValue: 0, 
            duration: 3000, 
            useNativeDriver: true 
          }),
        ])
      ).start();

      // Continuous rotation
      const rotateAnimation = () => {
        logoRotate.setValue(0);
        Animated.timing(logoRotate, { 
          toValue: 1, 
          duration: 15000, 
          useNativeDriver: true 
        }).start(() => rotateAnimation());
      };
      rotateAnimation();
    };

    const timer = setTimeout(() => {
      startBreathing();
      startLogoAnimation();
    }, 1000);
    return () => clearTimeout(timer);
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
      const currentRole = authUser?.user?.role;
      if (currentRole && currentRole !== type) {
        Alert.alert(
          'Role Locked',
          'Your account role is locked once onboarding begins. Please use a new account to switch roles.'
        );
        return;
      }

      const userId = authUser?.user?.id;
      AsyncStorage.setItem('pending_auth_role', type).catch(() => {});
      if (userId) {
        const updates =
          type === 'customer'
            ? { role: 'customer', customer_onboarding_state: 'IDENTITY_PENDING', customer_onboarding_step: 1 }
            : { role: 'cleaner', cleaner_onboarding_state: 'APPLICANT', cleaner_onboarding_step: 1 };
        const profilePayload = {
          id: userId,
          email: authUser?.user?.email || null,
          name: authUser?.user?.name || null,
          phone: authUser?.user?.phone || null,
          ...updates,
        };
        supabase
          .from('users')
          .upsert(profilePayload, { onConflict: 'id' })
          .select()
          .single()
          .then(({ error }) => {
            if (error) {
              console.warn('Failed to persist onboarding state:', error);
            }
          });
      }

      if (type === 'customer') {
        navigation.navigate('LocationLock');
        return;
      }

      if (!authUser?.user?.id) {
        Alert.alert('Sign In Required', 'Create or sign in to start a cleaner profile.', [
          { text: 'Sign In', onPress: () => navigation.navigate('AuthScreen') },
          { text: 'Cancel', style: 'cancel' },
        ]);
        return;
      }

      navigation.navigate('CleanerOnboarding');
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#26B7C9" />
      
      <LinearGradient colors={['#06b6d4', '#0891b2']} style={styles.gradient}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Safe Area Spacer */}
          <SafeAreaView style={styles.safeAreaSpacer} />
          
          {/* Consolidated Header */}
          <Animated.View 
            style={[
              styles.consolidatedHeader,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.navigate('AuthScreen')}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          
          <View style={styles.centerHeaderContent}>
            <View style={styles.titleContainer}>
              <Text style={styles.headerTitle}>
                <Text style={styles.titleEmoji}>✨ </Text>
                Choose your <Text style={styles.profileText}>Profile</Text>
                <Text style={styles.titleEmoji}> ✨</Text>
              </Text>
            </View>
          </View>
          
          <View style={styles.headerSpacer} />
          </Animated.View>

          {/* RADICAL MODERN: Floating Cards with Gradients */}
          <View style={[styles.radicalContainer, { marginTop: isCompact ? 12 : 25 }]}>
          {/* Floating Background Shapes */}
          <View style={styles.floatingShape1} />
          <View style={styles.floatingShape2} />
          
          <Animated.View style={{ 
            transform: [{ scale: Animated.multiply(card1Scale, breathe1) }, { rotate: '-3deg' }],
            marginRight: isCompact ? 12 : 30,
            marginBottom: 24,
          }}>
            <TouchableOpacity
              style={styles.radicalCard1}
              activeOpacity={1}
              onPress={() => handleCardPress('customer')}
            >
              <View style={styles.cardImageContainer}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop&crop=center' }}
                  style={styles.cardBackgroundImage}
                />
                <LinearGradient
                  colors={['rgba(58, 211, 219, 0.65)', 'rgba(6, 182, 212, 0.75)', 'rgba(8, 145, 178, 0.8)']}
                  style={styles.cardGradientOverlay}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <View style={[styles.radicalContentRow, { padding: cardPadding }]}>
                  <View style={styles.radicalText}>
                    <Text style={[styles.radicalTitle, { fontSize: titleSize, lineHeight: titleSize + 4 }]}>
                      Find a{"\n"}ChoreHero
                    </Text>
                    <Text style={[styles.radicalSubtitle, { fontSize: subtitleSize, marginBottom: isCompact ? 12 : 20 }]}>
                      Connect instantly
                    </Text>
                    <View style={styles.radicalBadges}>
                      <Text style={[styles.badge, { fontSize: badgeSize }]}>⚡ Same-day</Text>
                      <Text style={[styles.badge, { fontSize: badgeSize }]}>🏆 Verified</Text>
                      <Text style={[styles.badge, { fontSize: badgeSize }]}>💳 Secure</Text>
                    </View>
                  </View>
                  <View style={styles.radicalIcon}>
                    <View style={[styles.glassIcon, isCompact && { width: 58, height: 58, borderRadius: 18 }]}>
                      <Ionicons name="home" size={iconSize} color="#ffffff" />
                    </View>
                    <View style={styles.floatingSparkle}>
                      <Ionicons name="sparkles" size={18} color="#FFD700" />
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ 
            transform: [{ scale: Animated.multiply(card2Scale, breathe2) }, { rotate: '3deg' }],
            marginLeft: isCompact ? 12 : 30,
            marginTop: 0,
          }}>
            <TouchableOpacity
              style={styles.radicalCard2}
              activeOpacity={1}
              onPress={() => handleCardPress('cleaner')}
            >
              <View style={styles.cardImageContainer}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop&crop=center' }}
                  style={styles.cardBackgroundImage}
                />
                <LinearGradient
                  colors={['rgba(245, 158, 11, 0.65)', 'rgba(217, 119, 6, 0.75)', 'rgba(180, 83, 9, 0.8)']}
                  style={styles.cardGradientOverlay}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <View style={[styles.radicalContentRow, { padding: cardPadding }]}>
                  <View style={styles.radicalText}>
                    <Text style={[styles.radicalTitle, { fontSize: titleSize, lineHeight: titleSize + 4 }]}>
                      Become a{"\n"}ChoreHero
                    </Text>
                    <Text style={[styles.radicalSubtitle, { fontSize: subtitleSize, marginBottom: isCompact ? 12 : 20 }]}>
                      Earn heroically
                    </Text>
                    <View style={styles.radicalBadges}>
                      <Text style={[styles.badge, { fontSize: badgeSize }]}>💰 Your rates</Text>
                      <Text style={[styles.badge, { fontSize: badgeSize }]}>📅 Your time</Text>
                      <Text style={[styles.badge, { fontSize: badgeSize }]}>⭐ Your rep</Text>
                    </View>
                  </View>
                  <View style={styles.radicalIcon}>
                    <View style={[styles.glassIcon, isCompact && { width: 58, height: 58, borderRadius: 18 }]}>
                      <Ionicons name="briefcase" size={iconSize} color="#ffffff" />
                    </View>
                    <View style={styles.floatingStar}>
                      <Ionicons name="star" size={18} color="#FFD700" />
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Animated Background Logo */}
        <Animated.View
          style={[
            styles.backgroundLogo,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: logoFloat.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -20],
                  }),
                },
                {
                  rotate: logoRotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <Image
            source={require('../../../assets/app-logo.png')}
            style={styles.backgroundLogoImage}
            resizeMode="contain"
          />
        </Animated.View>

          {/* Bottom Section */}
          <Animated.View
            style={[
              styles.bottomSection,
              { opacity: fadeAnim, paddingBottom: insets.bottom + 24 }
            ]}
          >
          <Text style={styles.taglineText}>Ready to get started? ✨</Text>
          
          {/* Use Different Account link */}
          <TouchableOpacity 
            style={styles.differentAccountButton}
            onPress={handleUseDifferentAccount}
          >
            <Ionicons name="swap-horizontal" size={16} color="rgba(255, 255, 255, 0.7)" />
            <Text style={styles.differentAccountText}>Use Different Account</Text>
          </TouchableOpacity>
          </Animated.View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
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
  consolidatedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    paddingTop: 10,
  },
  centerHeaderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 70,
  },
  headerLogo: {
    width: 50,
    height: 50,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 29,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -1.2,
    fontFamily: 'System',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSpacer: {
    width: 40,
  },
  welcomeSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },
  welcomeTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 36,
    fontFamily: 'System',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0.2,
    marginTop: 8,
  },
  titleContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  profileText: {
    textDecorationLine: 'underline',
    textDecorationColor: '#FFD700',
    textDecorationStyle: 'solid',
    textShadowColor: 'rgba(255, 215, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  titleEmoji: {
    fontSize: 18,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  backgroundLogo: {
    position: 'absolute',
    bottom: 60,
    left: 30,
    zIndex: 1,
  },
  backgroundLogoImage: {
    width: 80,
    height: 80,
    opacity: 0.85,
    shadowColor: '#26B7C9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  bottomSection: {
    position: 'relative',
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: 16,
  },
  taglineText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 12,
  },
  differentAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    gap: 6,
  },
  differentAccountText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
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
    borderLeftColor: '#26B7C9',
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
    borderRadius: 32,
    marginBottom: 30,
    shadowColor: '#26B7C9',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  radicalCard2: {
    borderRadius: 32,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  cardGradient: {
    flex: 1,
    borderRadius: 32,
  },
  cardImageContainer: {
    flex: 1,
    borderRadius: 32,
    overflow: 'hidden',
  },
  cardBackgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardGradientOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  radicalContent: {
    flex: 1,
    padding: 28,
    justifyContent: 'space-between',
  },
  radicalContentRow: {
    flex: 1,
    padding: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radicalIcon: {
    position: 'relative',
    alignSelf: 'flex-start',
    zIndex: 10,
  },
  glassIcon: {
    width: 70,
    height: 70,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 15,
    elevation: 15,
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
    elevation: 20,
    zIndex: 20,
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
    elevation: 20,
    zIndex: 20,
  },
  radicalText: {
    flex: 1,
    justifyContent: 'center',
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