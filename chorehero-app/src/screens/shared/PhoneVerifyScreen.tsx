/**
 * PhoneVerifyScreen - 6-digit OTP verification for phone sign-in.
 * Phase 2 ready: wired to authService.verifyPhoneCode.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/auth';
import { wp, hp } from '../../utils/responsive';

type StackParamList = {
  PhoneVerify: { phone: string };
  AuthScreen: undefined;
  ProfileType: undefined;
  MainTabs: undefined;
};

type PhoneVerifyNavigationProp = {
  navigate: (name: keyof StackParamList, params?: any) => void;
  goBack: () => void;
};

interface PhoneVerifyScreenProps {
  navigation: PhoneVerifyNavigationProp;
  route: { params: { phone: string } };
}

const RESEND_COOLDOWN_SEC = 60;
const CODE_LENGTH = 6;

const PhoneVerifyScreen: React.FC<PhoneVerifyScreenProps> = ({ navigation, route }) => {
  const phone = route?.params?.phone || '';
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const { refreshSession } = useAuth();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const handleVerify = async () => {
    const trimmed = code.replace(/\D/g, '');
    if (trimmed.length !== CODE_LENGTH) {
      setError('Enter the 6-digit code');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const response = await authService.verifyPhoneCode(phone, trimmed);
      if (response.success) {
        if (response.data) {
          await refreshSession();
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
          });
        } else {
          navigation.navigate('ProfileType');
        }
      } else {
        setError(response.error || 'Invalid code. Please try again.');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    const digits = phone.replace(/\D/g, '').slice(-10);
    const response = await authService.sendVerificationCode(digits);
    if (response.success) {
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } else {
      setError(response.error || 'Could not resend code.');
    }
  };

  const formatDisplayPhone = (p: string) => {
    const d = p.replace(/\D/g, '').slice(-10);
    if (d.length >= 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return p;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>

          <Text style={styles.title}>Enter verification code</Text>
          <Text style={styles.subtitle}>
            We sent a code to {formatDisplayPhone(phone)}
          </Text>

          <TextInput
            ref={inputRef}
            style={styles.codeInput}
            value={code}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, '').slice(0, CODE_LENGTH);
              setCode(digits);
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            placeholder="000000"
            placeholderTextColor="#9CA3AF"
            autoFocus
            editable={!isLoading}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.verifyButton, (code.length !== CODE_LENGTH || isLoading) && styles.verifyButtonDisabled]}
            onPress={handleVerify}
            disabled={code.length !== CODE_LENGTH || isLoading}
          >
            <Text style={styles.verifyButtonText}>
              {isLoading ? 'Verifying...' : 'Verify'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resendCooldown > 0 || isLoading}
          >
            <Text style={[styles.resendText, resendCooldown > 0 && styles.resendDisabled]}>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.emailFallback}
            onPress={() => navigation.navigate('AuthScreen')}
          >
            <Text style={styles.emailFallbackText}>Try email instead</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: wp('6%'),
    paddingTop: hp('2%'),
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginBottom: hp('4%'),
  },
  title: {
    fontSize: wp('6%'),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: wp('4%'),
    color: '#6B7280',
    marginBottom: hp('5%'),
  },
  codeInput: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 8,
    textAlign: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingVertical: 16,
    marginBottom: 16,
    color: '#1F2937',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    marginBottom: 12,
    textAlign: 'center',
  },
  verifyButton: {
    height: 56,
    backgroundColor: '#00BCD4',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  verifyButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  verifyButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resendButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginBottom: 8,
  },
  resendText: {
    fontSize: 15,
    color: '#00BCD4',
    fontWeight: '500',
  },
  resendDisabled: {
    color: '#9CA3AF',
  },
  emailFallback: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  emailFallbackText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
});

export default PhoneVerifyScreen;
