import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Animated,
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
import { useFocusEffect } from '@react-navigation/native';
import { consumePostAuthRoute } from '../../utils/authPendingAction';
import { getResetToMainTabsChoresAction } from '../../navigation/mainTabsContentNavigation';
import { wp, hp } from '../../utils/responsive';

type StackParamList = {
  AuthScreen: undefined;
  ProfileType: undefined;
  MainTabs: undefined;
};

type AuthScreenNavigationProp = StackNavigationProp<StackParamList, 'AuthScreen'>;

interface AuthScreenProps {
  navigation: AuthScreenNavigationProp;
}

const PRIMARY_ACTION = '#26B7C9';
const PRIMARY_ACTION_DESAT = '#9CCED6';

const AuthScreen: React.FC<AuthScreenProps> = ({ navigation }) => {
  const [isLogin, setIsLogin] = useState(false); // Default to Sign Up so new users see account type choice
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { refreshSession } = useAuth();
  const logoPulse = useRef(new Animated.Value(0)).current;

  const handlePostAuthRedirect = async () => {
    const route = await consumePostAuthRoute();
    if (!route?.name) return false;
    const p = route.params as { screen?: string; params?: Record<string, unknown> } | undefined;
    if (route.name === 'MainTabs' && p?.screen === 'Content') {
      navigation.dispatch(getResetToMainTabsChoresAction(p.params as any));
      return true;
    }
    if (route.name === 'VideoFeed') {
      navigation.dispatch(getResetToMainTabsChoresAction(route.params as any));
      return true;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: route.name as any, params: route.params }],
    });
    return true;
  };

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoPulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(logoPulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      // @ts-ignore - stop exists at runtime
      loop.stop && loop.stop();
    };
  }, [logoPulse]);

  // Load remember me preference on mount
  useEffect(() => {
    loadRememberMePreference();
  }, []);

  /** Unstick “Please wait…” if the user left mid-auth (e.g. back from role picker) and returned. */
  useFocusEffect(
    useCallback(() => {
      setIsLoading(false);
    }, [])
  );

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

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      ),
    ]);
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please enter both email and password');
      return;
    }


    setIsLoading(true);
    try {
      if (isLogin) {
        // Handle sign in (bounded waits so the UI never hangs on “Please wait…”)
        const response = await withTimeout(
          userService.signIn(email, password),
          30000,
          'Sign in'
        );

        if (response.success) {
          let redirected = false;
          try {
            redirected = await withTimeout(handlePostAuthRedirect(), 12000, 'Post-auth redirect');
          } catch {
            redirected = false;
          }
          if (!redirected) {
            try {
              await withTimeout(refreshSession(), 20000, 'Session refresh');
            } catch {
              // Session may still apply via onAuthStateChange; don’t block the button forever
            }
          }
        } else {
          Alert.alert('Sign In Failed', response.error || 'Invalid credentials');
        }
      } else {
        // Handle sign up with duplicate detection
        const response = await userService.signUp(email, password);
        
        if (response.success) {
          // New account created successfully. If a role was pre-stamped on the
          // way in (Welcome → "Sign in with email" sets `pending_auth_role` to
          // `customer`; Settings → "Become a ChoreHero" sets it to `cleaner`),
          // skip the redundant ProfileType picker and trust AppNavigator to
          // route the user into the right onboarding from `getInitialRoute()`.
          // Otherwise fall back to ProfileType so the user can pick.
          let presetRole: string | null = null;
          try {
            presetRole = await AsyncStorage.getItem('pending_auth_role');
          } catch {
            presetRole = null;
          }
          if (presetRole === 'customer' || presetRole === 'cleaner') {
            // AppNavigator will pick up the pendingRole and route to the
            // appropriate onboarding screen on the next render.
            try {
              await refreshSession();
            } catch {
              // session may apply via onAuthStateChange anyway
            }
          } else {
            navigation.navigate('ProfileType');
          }
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
              { text: 'Sign In Instead', onPress: () => setIsLogin(true) }
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
        await withTimeout(refreshSession(), 8000, 'Session refresh').catch(error => {
          console.warn('Session refresh skipped:', error);
        });
        const redirected = await handlePostAuthRedirect();
          if (!redirected) {
            return;
          }
      } else {
        Alert.alert('Google Sign-in', 'Unable to start Google authentication.');
      }
    } catch (e) {
      Alert.alert('Google Sign-in Error', e instanceof Error ? e.message : 'Unexpected error');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      const redirectUri = makeRedirectUri({
        native: 'chorehero://auth',
        scheme: 'chorehero',
        preferLocalhost: false,
      });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectUri,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        Alert.alert('Apple Sign-in Failed', error.message);
        return;
      }

      if (data?.url) {
        await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        await withTimeout(refreshSession(), 8000, 'Session refresh').catch(error => {
          console.warn('Session refresh skipped:', error);
        });
        const redirected = await handlePostAuthRedirect();
          if (!redirected) {
            return;
          }
      } else {
        Alert.alert('Apple Sign-in', 'Unable to start Apple authentication.');
      }
    } catch (e) {
      Alert.alert('Apple Sign-in Error', e instanceof Error ? e.message : 'Unexpected error');
    }
  };

  const handleGuestAccess = async () => {
    // Role-locked guest entry defaults to customer browse mode.
    try {
      await AsyncStorage.setItem('guest_user_role', 'customer');
      navigation.navigate('MainTabs');
    } catch (error) {
      navigation.navigate('MainTabs');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/*
        Chrome was a heavy teal LinearGradient + 240px logo + chunky text. The
        new ProfileType + Welcome screens use a light neutral surface with a
        compact logo header. Match that here so the auth flow feels like one
        product instead of three different ones glued together.
      */}
      <View style={styles.gradient}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* Compact logo header — matches ProfileType chrome */}
          <View style={styles.logoSection}>
            <Animated.View
              style={[
                styles.logoContainer,
                {
                  transform: [
                    {
                      scale: logoPulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.04],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Image
                source={require('../../../assets/app-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>
            <Text style={styles.brandTitle}>ChoreHero</Text>
            <Text style={styles.brandSubtitle}>
              {isLogin ? 'Welcome back' : 'Create your account'}
            </Text>
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
                  textContentType="emailAddress"
                  autoComplete="email"
                  autoCorrect={false}
                  spellCheck={false}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, styles.passwordInput]}
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textContentType={isLogin ? "password" : "newPassword"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  autoCorrect={false}
                  spellCheck={false}
                  importantForAutofill="yes"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color="#6B7280" 
                  />
                </TouchableOpacity>
              </View>

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
                colors={isLoading ? ['#9CA3AF', '#6B7280'] : [PRIMARY_ACTION, PRIMARY_ACTION]}
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
              
              <TouchableOpacity style={styles.socialButton} onPress={handleAppleSignIn}>
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
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  gradient: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingTop: hp('4%'),
    paddingBottom: hp('5%'),
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: hp('1%'),
    paddingBottom: hp('2.5%'),
  },
  logoContainer: {
    marginBottom: hp('1.2%'),
    alignItems: 'center',
  },
  logoImage: {
    width: 64,
    height: 64,
  },
  brandTitle: {
    fontSize: wp('7%'),
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    marginTop: 4,
    fontSize: wp('3.6%'),
    color: '#475569',
  },
  // Legacy text styles kept so any inline reference doesn't break — no longer
  // rendered after the chrome rewrite.
  logoTextContainer: { display: 'none' },
  choreText: { display: 'none' },
  heroText: { display: 'none' },
  taglineText: {
    fontSize: wp('4%'),
    color: 'rgba(255, 255, 255, 0.9)',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: wp('5%'),
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: wp('5%'),
    padding: wp('6%'),
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
    borderRadius: wp('3%'),
    padding: 4,
    marginBottom: hp('3%'),
  },
  tab: {
    flex: 1,
    paddingVertical: hp('1.5%'),
    alignItems: 'center',
    borderRadius: wp('2%'),
    backgroundColor: 'transparent',
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
    fontSize: wp('4%'),
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#1F2937',
    fontWeight: '600',
  },
  formFields: {
    gap: hp('2%'),
    marginBottom: hp('3%'),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: wp('3%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('0.5%'),
    backgroundColor: '#ffffff',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: wp('4%'),
    color: '#1F2937',
    paddingVertical: hp('1.5%'),
  },
  passwordInput: {
    // Give more height for iOS password suggestion dropdown
    minHeight: 44,
  },
  eyeIcon: {
    padding: 8,
    marginLeft: 8,
  },
  authButton: {
    borderRadius: wp('3%'),
    overflow: 'hidden',
    marginBottom: hp('2%'),
  },
  authButtonDisabled: {
    opacity: 0.7,
  },
  authButtonGradient: {
    paddingVertical: hp('2%'),
    alignItems: 'center',
  },
  authButtonText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#ffffff',
  },
  forgotPassword: {
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: wp('3.5%'),
    color: PRIMARY_ACTION,
    fontWeight: '500',
  },
  guestButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: wp('3%'),
    paddingVertical: hp('2%'),
    alignItems: 'center',
    marginTop: hp('2%'),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  guestButtonText: {
    fontSize: wp('4%'),
    fontWeight: '500',
    color: '#ffffff',
  },

  socialContainer: {
    marginTop: hp('3%'),
    paddingHorizontal: wp('5%'),
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('2.5%'),
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dividerText: {
    paddingHorizontal: wp('4%'),
    fontSize: wp('3.5%'),
    color: 'rgba(255, 255, 255, 0.8)',
  },
  socialButtons: {
    flexDirection: 'row',
    gap: wp('3%'),
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: wp('3%'),
    paddingVertical: hp('1.7%'),
    gap: wp('2%'),
  },
  socialButtonText: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: '#374151',
  },
  termsContainer: {
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2.5%'),
    alignItems: 'center',
  },
  termsText: {
    fontSize: wp('3%'),
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
    marginBottom: hp('2.5%'),
    paddingHorizontal: wp('1%'),
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: wp('1.5%'),
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: PRIMARY_ACTION,
    borderColor: PRIMARY_ACTION,
    shadowColor: PRIMARY_ACTION,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  rememberMeText: {
    fontSize: wp('3.5%'),
    color: '#9CA3AF',
    fontWeight: '500',
  },
});

export default AuthScreen; 