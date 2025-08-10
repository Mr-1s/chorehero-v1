import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  SafeAreaView,
  Dimensions,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../utils/constants';
import { useAuth } from '../hooks/useAuth';

const { width: screenWidth } = Dimensions.get('window');

interface RoleSelectionModalProps {
  visible: boolean;
  onRoleSelected: (role: 'customer' | 'cleaner') => void;
}

const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({
  visible,
  onRoleSelected,
}) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const { forceResetAllSessions } = useAuth();

  const handleRoleSelection = async (role: 'customer' | 'cleaner') => {
    try {
      setIsSelecting(true);
      console.log(`Demo role selected: ${role}`);
      onRoleSelected(role); // Let the parent handle the actual demo user setup
    } catch (error) {
      console.error('Error selecting demo role:', error);
      Alert.alert('Error', 'Failed to set user role. Please try again.');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleResetSessions = async () => {
    try {
      Alert.alert(
        'Reset All Sessions',
        'This will clear all stored demo and user sessions. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reset',
            style: 'destructive',
            onPress: async () => {
              await forceResetAllSessions();
              Alert.alert('Success', 'All sessions have been cleared. Please restart the app.');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error resetting sessions:', error);
      Alert.alert('Error', 'Failed to reset sessions.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {}} // Prevent dismissal
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="sparkles" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Welcome to ChoreHero!</Text>
            <Text style={styles.subtitle}>
              Choose how you want to experience the app
            </Text>
          </View>

          {/* Role Options */}
          <View style={styles.rolesContainer}>
            {/* Customer Option */}
            <TouchableOpacity
              style={styles.roleCard}
              onPress={() => handleRoleSelection('customer')}
              disabled={isSelecting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#3B82F6', '#1D4ED8']}
                style={styles.roleGradient}
              >
                <View style={styles.roleIcon}>
                  <Ionicons name="home" size={40} color={COLORS.text.inverse} />
                </View>
                <Text style={styles.roleTitle}>I'm a Customer</Text>
                <Text style={styles.roleDescription}>
                  Book cleaning services and discover trusted cleaners
                </Text>
                
                <View style={styles.roleFeatures}>
                  <View style={styles.feature}>
                    <Ionicons name="search" size={16} color={COLORS.text.inverse} />
                    <Text style={styles.featureText}>Browse cleaners</Text>
                  </View>
                  <View style={styles.feature}>
                    <Ionicons name="calendar" size={16} color={COLORS.text.inverse} />
                    <Text style={styles.featureText}>Book services</Text>
                  </View>
                  <View style={styles.feature}>
                    <Ionicons name="heart" size={16} color={COLORS.text.inverse} />
                    <Text style={styles.featureText}>Like content</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Cleaner Option */}
            <TouchableOpacity
              style={styles.roleCard}
              onPress={() => handleRoleSelection('cleaner')}
              disabled={isSelecting}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#F59E0B', '#F97316']}
                style={styles.roleGradient}
              >
                <View style={styles.roleIcon}>
                  <Ionicons name="build" size={40} color={COLORS.text.inverse} />
                </View>
                <Text style={styles.roleTitle}>I'm a Cleaner</Text>
                <Text style={styles.roleDescription}>
                  Showcase your work and connect with customers
                </Text>
                
                <View style={styles.roleFeatures}>
                  <View style={styles.feature}>
                    <Ionicons name="videocam" size={16} color={COLORS.text.inverse} />
                    <Text style={styles.featureText}>Upload content</Text>
                  </View>
                  <View style={styles.feature}>
                    <Ionicons name="briefcase" size={16} color={COLORS.text.inverse} />
                    <Text style={styles.featureText}>Manage jobs</Text>
                  </View>
                  <View style={styles.feature}>
                    <Ionicons name="people" size={16} color={COLORS.text.inverse} />
                    <Text style={styles.featureText}>Build following</Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Footer Note */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don't worry! You can switch between roles anytime in Settings
            </Text>
          </View>

          {/* Debug Reset Button */}
          <View style={styles.debugSection}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleResetSessions}
            >
              <Ionicons name="refresh" size={16} color={COLORS.text.muted} />
              <Text style={styles.resetButtonText}>Reset Demo Sessions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
    justifyContent: 'space-between',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Role Cards
  rolesContainer: {
    flex: 1,
    gap: 20,
    maxHeight: 600,
  },
  roleCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  roleGradient: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  roleIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  roleTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text.inverse,
    marginBottom: 8,
    textAlign: 'center',
  },
  roleDescription: {
    fontSize: 14,
    color: COLORS.text.inverse,
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 20,
    lineHeight: 20,
  },
  roleFeatures: {
    gap: 8,
    alignItems: 'center',
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.text.inverse,
    fontWeight: '500',
  },

  // Footer
  footer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Debug Section
  debugSection: {
    marginTop: 15,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.text.muted,
    borderRadius: 8,
  },
  resetButtonText: {
    fontSize: 12,
    color: COLORS.text.muted,
    fontWeight: '500',
  },
});

export default RoleSelectionModal; 