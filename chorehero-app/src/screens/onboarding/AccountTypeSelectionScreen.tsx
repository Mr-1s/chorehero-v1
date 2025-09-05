import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
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
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome to ChoreHero</Text>
          <Text style={styles.welcomeSubtitle}>
            Choose how you'd like to get started
          </Text>
        </View>

        {/* Account Type Cards */}
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={styles.optionCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('CustomerOnboarding')}
          >
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={['#3ad3db', '#2BC8D4']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="home" size={32} color="#ffffff" />
                </LinearGradient>
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>I need cleaning services</Text>
                <Text style={styles.cardDescription}>
                  Book trusted cleaners for your home or office
                </Text>
              </View>
              <View style={styles.cardArrow}>
                <Ionicons name="chevron-forward" size={24} color="#6B7280" />
              </View>
            </View>
            <View style={styles.cardFeatures}>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.featureText}>Verified cleaners</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.featureText}>Flexible scheduling</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.featureText}>Secure payments</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('CleanerOnboarding')}
          >
            <View style={styles.cardContent}>
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="briefcase" size={32} color="#ffffff" />
                </LinearGradient>
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>I want to provide cleaning services</Text>
                <Text style={styles.cardDescription}>
                  Join as a cleaner and grow your business
                </Text>
              </View>
              <View style={styles.cardArrow}>
                <Ionicons name="chevron-forward" size={24} color="#6B7280" />
              </View>
            </View>
            <View style={styles.cardFeatures}>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.featureText}>Set your own rates</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.featureText}>Choose your schedule</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.featureText}>Build your reputation</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Bottom Info */}
        <View style={styles.bottomSection}>
          <Text style={styles.bottomText}>
            Don't worry, you can always switch or create additional accounts later
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
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  welcomeSubtitle: {
    fontSize: 19,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '500',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  optionsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 16,
  },
  optionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    marginRight: 16,
  },
  iconGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  cardArrow: {
    marginLeft: 8,
  },
  cardFeatures: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  bottomText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default AccountTypeSelectionScreen; 