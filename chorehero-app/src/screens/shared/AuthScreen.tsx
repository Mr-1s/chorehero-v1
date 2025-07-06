import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { authService, PhoneVerificationResponse } from '../../services/auth';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS } from '../../utils/constants';
import { AuthUser } from '../../types/user';
import { ApiResponse } from '../../types/api';

interface AuthScreenProps {
  onAuthSuccess: (authUser: AuthUser) => void;
  onAuthNeedsOnboarding: (userId: string, phone: string) => void;
}

type AuthStep = 'phone' | 'verification' | 'role_selection' | 'profile_setup';

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthSuccess,
  onAuthNeedsOnboarding,
}) => {
  // State management
  const [currentStep, setCurrentStep] = useState<AuthStep>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [selectedRole, setSelectedRole] = useState<'customer' | 'cleaner' | null>(null);
  const [userDetails, setUserDetails] = useState({
    name: '',
    email: '',
  });
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerificationSent, setIsVerificationSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [resendCooldown]);

  // Format phone number for display
  const formatPhoneDisplay = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // Handle phone number submission
  const handlePhoneSubmit = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter your phone number');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response: ApiResponse<PhoneVerificationResponse> = await authService.sendVerificationCode(phoneNumber);
      
      if (response.success && response.data.success) {
        setIsVerificationSent(true);
        setCurrentStep('verification');
        setResendCooldown(60); // 60 second cooldown
      } else {
        setError(response.error || response.data.message);
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Phone verification error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle verification code submission
  const handleVerificationSubmit = async () => {
    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.verifyPhoneCode(phoneNumber, verificationCode);
      
      if (response.success) {
        if (response.data) {
          // User exists - sign them in
          onAuthSuccess(response.data);
        } else {
          // New user - proceed to onboarding
          setCurrentStep('role_selection');
        }
      } else {
        setError(response.error || 'Invalid verification code');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
      console.error('Verification error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle role selection
  const handleRoleSelection = (role: 'customer' | 'cleaner') => {
    setSelectedRole(role);
    setCurrentStep('profile_setup');
  };

  // Handle profile setup completion
  const handleProfileSetup = async () => {
    if (!userDetails.name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!selectedRole) {
      setError('Please select your role');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current user ID from auth session
      const currentUserResponse = await authService.getCurrentUser();
      
      if (!currentUserResponse.success || !currentUserResponse.data?.session) {
        throw new Error('Authentication session not found');
      }

      const session = currentUserResponse.data.session;
      const userId = currentUserResponse.data.user.id;

      const response = await authService.completeRegistration(
        userId, // User ID from the auth response
        {
          name: userDetails.name,
          role: selectedRole,
          email: userDetails.email || undefined,
          phone: phoneNumber,
        }
      );

      if (response.success) {
        // Create auth user object for callback
        const authUser: AuthUser = {
          user: response.data,
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
          },
        };
        onAuthSuccess(authUser);
      } else {
        setError(response.error || 'Registration failed');
      }
    } catch (err) {
      setError('Registration failed. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend verification code
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    try {
      await authService.sendVerificationCode(phoneNumber);
      setResendCooldown(60);
    } catch (err) {
      setError('Failed to resend code');
    } finally {
      setIsLoading(false);
    }
  };

  // Render phone input step
  const renderPhoneStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Welcome to ChoreHero</Text>
      <Text style={styles.subtitle}>Enter your phone number to get started</Text>
      
      <TextInput
        style={styles.input}
        placeholder="(555) 123-4567"
        value={formatPhoneDisplay(phoneNumber)}
        onChangeText={(text) => setPhoneNumber(text.replace(/\D/g, ''))}
        keyboardType="phone-pad"
        maxLength={14}
        autoFocus
      />
      
      <TouchableOpacity
        style={[styles.button, !phoneNumber.trim() && styles.buttonDisabled]}
        onPress={handlePhoneSubmit}
        disabled={!phoneNumber.trim() || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={COLORS.text.inverse} />
        ) : (
          <Text style={styles.buttonText}>Send Code</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  // Render verification step
  const renderVerificationStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Verify Your Phone</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code sent to {formatPhoneDisplay(phoneNumber)}
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="123456"
        value={verificationCode}
        onChangeText={setVerificationCode}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />
      
      <TouchableOpacity
        style={[styles.button, verificationCode.length !== 6 && styles.buttonDisabled]}
        onPress={handleVerificationSubmit}
        disabled={verificationCode.length !== 6 || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={COLORS.text.inverse} />
        ) : (
          <Text style={styles.buttonText}>Verify</Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.linkButton}
        onPress={handleResendCode}
        disabled={resendCooldown > 0 || isLoading}
      >
        <Text style={[styles.linkText, resendCooldown > 0 && styles.linkTextDisabled]}>
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => setCurrentStep('phone')}
      >
        <Text style={styles.linkText}>Change Phone Number</Text>
      </TouchableOpacity>
    </View>
  );

  // Render role selection step
  const renderRoleSelectionStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>I am a...</Text>
      <Text style={styles.subtitle}>Choose how you'll use ChoreHero</Text>
      
      <TouchableOpacity
        style={styles.roleButton}
        onPress={() => handleRoleSelection('customer')}
      >
        <Text style={styles.roleButtonTitle}>Customer</Text>
        <Text style={styles.roleButtonSubtitle}>
          I need cleaning services for my home
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.roleButton}
        onPress={() => handleRoleSelection('cleaner')}
      >
        <Text style={styles.roleButtonTitle}>Cleaner</Text>
        <Text style={styles.roleButtonSubtitle}>
          I want to provide cleaning services
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Render profile setup step
  const renderProfileSetupStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Complete Your Profile</Text>
      <Text style={styles.subtitle}>
        {selectedRole === 'customer' 
          ? 'Tell us a bit about yourself' 
          : 'Set up your cleaner profile'}
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={userDetails.name}
        onChangeText={(text) => setUserDetails({...userDetails, name: text})}
        autoCapitalize="words"
        autoFocus
      />
      
      <TextInput
        style={styles.input}
        placeholder="Email (optional)"
        value={userDetails.email}
        onChangeText={(text) => setUserDetails({...userDetails, email: text})}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <TouchableOpacity
        style={[styles.button, !userDetails.name.trim() && styles.buttonDisabled]}
        onPress={handleProfileSetup}
        disabled={!userDetails.name.trim() || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={COLORS.text.inverse} />
        ) : (
          <Text style={styles.buttonText}>
            {selectedRole === 'customer' ? 'Get Started' : 'Continue Setup'}
          </Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => setCurrentStep('role_selection')}
      >
        <Text style={styles.linkText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        {currentStep === 'phone' && renderPhoneStep()}
        {currentStep === 'verification' && renderVerificationStep()}
        {currentStep === 'role_selection' && renderRoleSelectionStep()}
        {currentStep === 'profile_setup' && renderProfileSetupStep()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  stepContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.xxxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.text.primary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.text.secondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: TYPOGRAPHY.lineHeights.relaxed * TYPOGRAPHY.sizes.lg,
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.sizes.lg,
    color: COLORS.text.primary,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.text.disabled,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  buttonDisabled: {
    backgroundColor: COLORS.text.disabled,
  },
  buttonText: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.inverse,
  },
  roleButton: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.text.disabled,
  },
  roleButtonTitle: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: TYPOGRAPHY.weights.semibold,
    color: COLORS.text.primary,
    marginBottom: SPACING.xs,
  },
  roleButtonSubtitle: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.text.secondary,
    lineHeight: TYPOGRAPHY.lineHeights.normal * TYPOGRAPHY.sizes.base,
  },
  linkButton: {
    marginTop: SPACING.md,
  },
  linkText: {
    fontSize: TYPOGRAPHY.sizes.base,
    color: COLORS.primary,
    textAlign: 'center',
  },
  linkTextDisabled: {
    color: COLORS.text.disabled,
  },
  errorContainer: {
    backgroundColor: COLORS.error,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  errorText: {
    color: COLORS.text.inverse,
    fontSize: TYPOGRAPHY.sizes.base,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.weights.medium,
  },
});