import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
WebBrowser.maybeCompleteAuthSession();
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/user';

import { supabase } from '../../services/supabase';
import type { StackNavigationProp } from '@react-navigation/stack';

type StackParamList = {
  AuthScreen: undefined;
  AccountTypeSelection: undefined;
  MainTabs: undefined;
};

type AuthScreenNavigationProp = StackNavigationProp<StackParamList, 'AuthScreen'>;

interface AuthScreenProps {
  navigation: AuthScreenNavigationProp;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ navigation }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { refreshSession } = useAuth();

  // Load remember me preference on mount
  useEffect(() => {
    loadRememberMePreference();
  }, []);

  const loadRememberMePreference = async () => {
    try {
      const stored = await AsyncStorage.getItem('rememberMe');
      if (stored !== null) {
        setRememberMe(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading remember me preference:', error);
    }
  };

  const saveRememberMePreference = async (value: boolean) => {
    try {
      await AsyncStorage.setItem('rememberMe', JSON.stringify(value));
    } catch (error) {
      console.error('Error saving remember me preference:', error);
    }
  };

  const handleRememberMeToggle = () => {
    const newValue = !rememberMe;
    setRememberMe(newValue);
    saveRememberMePreference(newValue);
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please enter both email and password');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        // Handle sign in
        const response = await userService.signIn(email, password);
        
        if (response.success) {
          await refreshSession();
          navigation.navigate('AccountTypeSelection');
        } else {
          Alert.alert('Sign In Failed', response.error || 'Invalid credentials');
        }
      } else {
        // Handle sign up with duplicate detection
        const response = await userService.signUp(email, password);
        
        if (response.success) {
          // New account created successfully
          navigation.navigate('AccountTypeSelection');
        } else if (response.requiresSignIn) {
          // Created, but session not present – prompt sign-in path
          Alert.alert(
            'Verify & Sign In',
            response.error || 'Please sign in to continue.',
            [
              { text: 'OK', onPress: async () => setIsLogin(true) }
            ]
          );
        } else if (response.error && response.error.includes('email')) {
          // Email confirmation required
          Alert.alert(
            'Check Your Email',
            response.error + '\n\nIf the confirmation link doesn\'t work, please contact support.',
            [
              { text: 'OK', style: 'default' }
            ]
          );
        } else if (response.requiresSignIn) {
          // User already exists, prompt to sign in
          Alert.alert(
            'Account Already Exists',
            response.error || 'An account with this email already exists.',
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Sign In Instead', 
                onPress: () => {
                  setIsLogin(true);
                  setConfirmPassword('');
                }
              }
            ]
          );
        } else {
          Alert.alert('Sign Up Failed', response.error || 'Failed to create account');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };



  const handleGoogleSignIn = async () => {
    try {
      const redirectUri = makeRedirectUri({
        native: 'chorehero://auth',
        scheme: 'chorehero',
        preferLocalhost: false,
      });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        Alert.alert('Google Sign-in Failed', error.message);
        return;
      }

      if (data?.url) {
        await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        await refreshSession();
        navigation.navigate('AccountTypeSelection');
      } else {
        Alert.alert('Google Sign-in', 'Unable to start Google authentication.');
      }
    } catch (e) {
      Alert.alert('Google Sign-in Error', e instanceof Error ? e.message : 'Unexpected error');
    }
  };

  const handleGuestAccess = () => {
    // Navigate directly to the main app as a guest
    // Users can explore the app with limited functionality (read-only mode)
    navigation.navigate('MainTabs');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3ad3db" />
      
      <LinearGradient
        colors={['#06b6d4', '#0891b2']}
        style={styles.gradient}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../../assets/app-icon.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.logoTextContainer}>
            <Text style={styles.choreText}>Chore</Text>
            <Text style={styles.heroText}>Hero</Text>
          </View>
        </View>

        {/* Auth Form */}
        <View style={styles.formContainer}>
          <View style={styles.formCard}>
            {/* Tab Switcher */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, isLogin && styles.activeTab]}
                onPress={() => setIsLogin(true)}
              >
                <Text style={[styles.tabText, isLogin && styles.activeTabText]}>
                  Sign In
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, !isLogin && styles.activeTab]}
                onPress={() => setIsLogin(false)}
              >
                <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.formFields}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Email address"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color="#6B7280" 
                  />
                </TouchableOpacity>
              </View>

              {!isLogin && (
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Confirm password"
                    placeholderTextColor="#9CA3AF"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons 
                      name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color="#6B7280" 
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Remember Me */}
            {isLogin && (
              <TouchableOpacity 
                style={styles.rememberMeContainer}
                onPress={handleRememberMeToggle}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.rememberMeText}>Keep me signed in</Text>
              </TouchableOpacity>
            )}

            {/* Auth Button */}
            <TouchableOpacity
              style={[styles.authButton, isLoading && styles.authButtonDisabled]}
              onPress={handleAuth}
              disabled={isLoading}
            >
              <LinearGradient
                colors={isLoading ? ['#9CA3AF', '#6B7280'] : ['#3ad3db', '#2BC8D4']}
                style={styles.authButtonGradient}
              >
                <Text style={styles.authButtonText}>
                  {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Forgot Password */}
            {isLogin && (
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Continue as Guest */}
          <TouchableOpacity style={styles.guestButton} onPress={handleGuestAccess}>
            <Text style={styles.guestButtonText}>Continue as Guest</Text>
          </TouchableOpacity>

          {/* Social Login Placeholder */}
          <View style={styles.socialContainer}>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialButtons}>
              <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignIn}>
                <Ionicons name="logo-google" size={20} color="#DB4437" />
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.socialButton}>
                <Ionicons name="logo-apple" size={20} color="#000000" />
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

          {/* Terms */}
          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By continuing, you agree to our{' '}
              <Text style={styles.linkText}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.linkText}>Privacy Policy</Text>
            </Text>
          </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 9,
    paddingBottom: 0,
  },
  logoContainer: {
    marginBottom: 0,
    alignItems: 'center',
  },
  logoImage: {
    width: 240,
    height: 240,
    marginBottom: -54,
  },
  logoTextContainer: {
    flexDirection: 'row',
    marginBottom: 19,
    marginTop: 0,
  },

  choreText: {
    fontSize: 45,
    fontWeight: '800',
    color: '#e6b200',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    fontFamily: 'System',
  },
  heroText: {
    fontSize: 45,
    fontWeight: '800',
    color: '#047b9b',
    letterSpacing: 1,
    textShadowColor: '#2cedef',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    fontFamily: 'System',
  },
  taglineText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 12,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#1F2937',
    fontWeight: '600',
  },
  formFields: {
    gap: 16,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#ffffff',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    paddingVertical: 12,
  },
  eyeIcon: {
    padding: 8,
    marginLeft: 8,
  },
  authButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  authButtonDisabled: {
    opacity: 0.7,
  },
  authButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  forgotPassword: {
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#3ad3db',
    fontWeight: '500',
  },
  guestButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  guestButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
  },

  socialContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  termsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  termsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 18,
  },
  linkText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#3ad3db',
    borderColor: '#3ad3db',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  rememberMeText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});

export default AuthScreen; 