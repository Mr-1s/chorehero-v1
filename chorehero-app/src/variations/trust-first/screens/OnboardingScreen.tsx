import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../shared/theme';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const onboardingSteps = [
    {
      title: 'Trust & Safety First',
      subtitle: 'Your security is our priority',
      description: 'Every cleaner is thoroughly vetted with background checks, insurance verification, and identity confirmation.',
      image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop',
      features: [
        { icon: 'shield-checkmark', text: 'Background checks on all cleaners' },
        { icon: 'document-text', text: 'Identity verification required' },
        { icon: 'umbrella', text: 'Fully insured and bonded' }
      ]
    },
    {
      title: 'Video Profiles',
      subtitle: 'See who you\'re hiring',
      description: 'Watch video introductions from cleaners to get a feel for their personality and professionalism.',
      image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&h=300&fit=crop',
      features: [
        { icon: 'videocam', text: 'Personal video introductions' },
        { icon: 'chatbubble', text: 'Verified customer testimonials' },
        { icon: 'star', text: 'Detailed ratings and reviews' }
      ]
    },
    {
      title: 'Professional Standards',
      subtitle: 'Quality you can trust',
      description: 'Our cleaners maintain the highest standards of professionalism and service quality.',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
      features: [
        { icon: 'ribbon', text: 'Certified cleaning professionals' },
        { icon: 'time', text: 'Punctual and reliable service' },
        { icon: 'thumbs-up', text: 'Satisfaction guaranteed' }
      ]
    }
  ];

  const currentStepData = onboardingSteps[currentStep];

  const nextStep = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const skipOnboarding = () => {
    onComplete();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          {onboardingSteps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                index === currentStep ? styles.progressDotActive : styles.progressDotInactive
              ]}
            />
          ))}
        </View>

        {/* Skip Button */}
        <TouchableOpacity style={styles.skipButton} onPress={skipOnboarding}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Main Content */}
        <View style={styles.mainContent}>
          <Image source={{ uri: currentStepData.image }} style={styles.heroImage} />
          
          <View style={styles.textContent}>
            <Text style={styles.title}>{currentStepData.title}</Text>
            <Text style={styles.subtitle}>{currentStepData.subtitle}</Text>
            <Text style={styles.description}>{currentStepData.description}</Text>
            
            <View style={styles.featuresList}>
              {currentStepData.features.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <View style={styles.featureIcon}>
                    <Ionicons 
                      name={feature.icon as any} 
                      size={20} 
                      color={theme.colors.primary} 
                    />
                  </View>
                  <Text style={styles.featureText}>{feature.text}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Security Badge */}
        <View style={styles.securityBadge}>
          <Ionicons name="shield-checkmark" size={24} color={theme.colors.success} />
          <Text style={styles.securityText}>Your safety and security are guaranteed</Text>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.nextButton} onPress={nextStep}>
          <Text style={styles.nextButtonText}>
            {currentStep === onboardingSteps.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color={theme.colors.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  progressDotActive: {
    backgroundColor: theme.colors.primary
  },
  progressDotInactive: {
    backgroundColor: theme.colors.gray[300]
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: theme.spacing.md
  },
  skipText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.gray[600]
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroImage: {
    width: 300,
    height: 200,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.xl
  },
  textContent: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md
  },
  title: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: '700',
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginBottom: theme.spacing.sm
  },
  subtitle: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.md
  },
  description: {
    fontSize: theme.fontSize.md,
    color: theme.colors.gray[700],
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.xl
  },
  featuresList: {
    alignSelf: 'stretch',
    gap: theme.spacing.md
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center'
  },
  featureText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.gray[700]
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.gray[50],
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.xl,
    gap: theme.spacing.sm
  },
  securityText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.gray[700],
    fontWeight: '500'
  },
  bottomNav: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm
  },
  nextButtonText: {
    fontSize: theme.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.white
  }
});