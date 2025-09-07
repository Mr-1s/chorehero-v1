/**
 * Tutorial Demo Screen
 * Quick way to test and showcase the tutorial system
 */

import React, { useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTutorial } from '../../hooks/useTutorial';
import { TutorialOverlay } from '../../components/TutorialOverlay';
import { useAuth } from '../../hooks/useAuth';

export const TutorialDemoScreen: React.FC = () => {
  const { user } = useAuth();
  const {
    currentTutorial,
    currentStepIndex,
    isActive: isTutorialActive,
    nextStep,
    completeTutorial,
    skipTutorial,
    startTutorialById,
    resetAllTutorials,
  } = useTutorial();

  const sortButtonRef = useRef<View>(null);
  const discoverRef = useRef<View>(null);
  const profileRef = useRef<View>(null);

  const handleStartCustomerTutorial = () => {
    startTutorialById('customer_welcome');
  };

  const handleStartCleanerTutorial = () => {
    startTutorialById('cleaner_welcome');
  };

  const handleStartBookingTutorial = () => {
    startTutorialById('first_booking');
  };

  const handleResetTutorials = () => {
    resetAllTutorials();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e293b" />
      
      <LinearGradient
        colors={['#1e293b', '#334155', '#475569']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Ionicons name="school" size={32} color="#3ad3db" />
          <Text style={styles.title}>Tutorial System Demo</Text>
          <Text style={styles.subtitle}>Test the guided tour system</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>🎯 Start Tutorial Tours</Text>
          
          <TouchableOpacity
            style={styles.tutorialButton}
            onPress={handleStartCustomerTutorial}
          >
            <Ionicons name="home" size={24} color="#6366F1" />
            <Text style={styles.buttonText}>Customer Welcome Tour</Text>
            <Text style={styles.buttonSubtext}>6 steps • Smart feed & booking</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tutorialButton}
            onPress={handleStartCleanerTutorial}
          >
            <Ionicons name="briefcase" size={24} color="#F59E0B" />
            <Text style={styles.buttonText}>Cleaner Hero Tour</Text>
            <Text style={styles.buttonSubtext}>6 steps • Content & earnings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tutorialButton}
            onPress={handleStartBookingTutorial}
          >
            <Ionicons name="flash" size={24} color="#10B981" />
            <Text style={styles.buttonText}>First Booking Tutorial</Text>
            <Text style={styles.buttonSubtext}>2 steps • Auto-fill magic</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>🎬 Demo Elements</Text>
          
          <View style={styles.demoElements}>
            <TouchableOpacity
              ref={sortButtonRef}
              style={styles.demoSortButton}
            >
              <Ionicons name="options" size={20} color="#ffffff" />
              <Text style={styles.demoButtonText}>Smart Sort</Text>
            </TouchableOpacity>

            <TouchableOpacity
              ref={discoverRef}
              style={styles.demoDiscoverButton}
            >
              <Ionicons name="search" size={20} color="#ffffff" />
              <Text style={styles.demoButtonText}>Discover</Text>
            </TouchableOpacity>

            <TouchableOpacity
              ref={profileRef}
              style={styles.demoProfileButton}
            >
              <Ionicons name="person" size={20} color="#ffffff" />
              <Text style={styles.demoButtonText}>Profile</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>🔧 Tutorial Controls</Text>
          
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleResetTutorials}
          >
            <Ionicons name="refresh" size={20} color="#EF4444" />
            <Text style={styles.resetButtonText}>Reset All Tutorial Progress</Text>
          </TouchableOpacity>

          {isTutorialActive && (
            <View style={styles.activeStatus}>
              <Text style={styles.activeText}>
                📚 Tutorial Active: {currentTutorial?.name}
              </Text>
              <Text style={styles.activeSubtext}>
                Step {currentStepIndex + 1} of {currentTutorial?.steps.length}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Tutorial Overlay */}
      {isTutorialActive && currentTutorial && user?.id && (
        <TutorialOverlay
          tutorial={currentTutorial}
          currentStepIndex={currentStepIndex}
          onStepComplete={nextStep}
          onTutorialComplete={completeTutorial}
          onTutorialSkip={skipTutorial}
          targetElementRef={
            currentTutorial.steps[currentStepIndex]?.targetElement === 'sort_button' ? sortButtonRef :
            currentTutorial.steps[currentStepIndex]?.targetElement === 'discover_tab' ? discoverRef :
            currentTutorial.steps[currentStepIndex]?.targetElement === 'profile_tab' ? profileRef :
            undefined
          }
          userId={user.id}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
    marginTop: 24,
  },
  tutorialButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginTop: 8,
  },
  buttonSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  demoElements: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  demoSortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  demoDiscoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  demoProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  demoButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  resetButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  activeStatus: {
    backgroundColor: 'rgba(58, 211, 219, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(58, 211, 219, 0.3)',
  },
  activeText: {
    color: '#3ad3db',
    fontSize: 16,
    fontWeight: '600',
  },
  activeSubtext: {
    color: 'rgba(58, 211, 219, 0.8)',
    fontSize: 14,
    marginTop: 4,
  },
});
