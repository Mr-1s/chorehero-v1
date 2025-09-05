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
          <Text style={styles.welcomeTitle}>Choose your ChoreHero journey</Text>
          <Text style={styles.welcomeSubtitle}>
            Every clean space has a story. What's yours?
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
                <Text style={styles.cardTitle}>Find a ChoreHero</Text>
                <Text style={styles.cardDescription}>
                  Connect with cleaning heroes in your area
                </Text>
              </View>
              <View style={styles.cardArrow}>
                <Ionicons name="chevron-forward" size={24} color="#6B7280" />
              </View>
            </View>
            <View style={styles.cardBenefits}>
              <Text style={styles.benefitText}>🏆 Verified heroes • ⚡ Same-day booking • 💳 Safe payments</Text>
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
                <Text style={styles.cardTitle}>Become a ChoreHero</Text>
                <Text style={styles.cardDescription}>
                  Turn your cleaning skills into heroic income
                </Text>
              </View>
              <View style={styles.cardArrow}>
                <Ionicons name="chevron-forward" size={24} color="#6B7280" />
              </View>
            </View>
            <View style={styles.cardBenefits}>
              <Text style={styles.benefitText}>💰 Your rates • 📅 Your schedule • ⭐ Your reputation</Text>
            </View>
          </TouchableOpacity>
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
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(58, 211, 219, 0.1)',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
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
});

export default AccountTypeSelectionScreen; 