import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { wp, hp } from '../../utils/responsive';

type StackParamList = {
  OnboardingComplete: undefined;
  MainTabs: undefined;
};

type OnboardingCompleteNavigationProp = StackNavigationProp<StackParamList, 'OnboardingComplete'>;

interface OnboardingCompleteProps {
  navigation: OnboardingCompleteNavigationProp;
}

const OnboardingCompleteScreen: React.FC<OnboardingCompleteProps> = ({ navigation }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
        tension: 80,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGoToDashboard = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.emojiContainer, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <Text style={styles.emoji}>🎉</Text>
        </Animated.View>

        <Text style={styles.title}>You're a ChoreHero!</Text>

        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={24} color="#96CEB4" />
            <Text style={styles.badgeText}>Verified Hero</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          Your profile is under review. You'll be notified within 24 hours.
        </Text>

        <Text style={styles.hint}>
          💡 Pro tip: Add more service packages to increase your booking chances!
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={handleGoToDashboard}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#96CEB4', '#96CEB4']}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>Go to Dashboard</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#96CEB4',
  },
  content: {
    flex: 1,
    paddingHorizontal: wp('6%'),
    paddingTop: hp('7%'),
    alignItems: 'center',
  },
  emojiContainer: {
    marginBottom: hp('3%'),
  },
  emoji: {
    fontSize: wp('20%'),
  },
  title: {
    fontSize: wp('7%'),
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: hp('3%'),
  },
  badgeContainer: {
    marginBottom: hp('3%'),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2%'),
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.5%'),
    borderRadius: wp('6%'),
  },
  badgeText: {
    fontSize: wp('4%'),
    fontWeight: '700',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: wp('4%'),
    color: '#374151',
    textAlign: 'center',
    lineHeight: hp('3%'),
    marginBottom: hp('3%'),
  },
  hint: {
    fontSize: wp('3.5%'),
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: hp('2.5%'),
    marginBottom: hp('5%'),
    paddingHorizontal: wp('4%'),
  },
  button: {
    width: '100%',
    borderRadius: wp('3%'),
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('6%'),
    gap: wp('2%'),
  },
  buttonText: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#fff',
  },
});

export default OnboardingCompleteScreen;
