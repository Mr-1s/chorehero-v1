import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Switch,
  Alert,
  ActivityIndicator,
  Share,
  Linking,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AppState } from 'react-native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { CommonActions } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { accountDeletionService } from '../../services/accountDeletionService';
import { supabase } from '../../services/supabase';
import { ADMIN_EMAILS } from '../../config';
import { uploadService } from '../../services/uploadService';
import { useCleanerStore } from '../../store/cleanerStore';
import { navigationRef } from '../../navigation/navigationRef';
import { wp, hp } from '../../utils/responsive';
import { Row } from '../../components/ui';

type StackParamList = {
  SettingsScreen: undefined;
  PaymentScreen: { fromBooking?: boolean };
  AuthScreen: undefined;
  Welcome: undefined;
  HelpScreen: undefined;
  PrivacyScreen: undefined;
  TermsScreen: undefined;
  MainTabs: undefined;
  CleanerOnboarding: undefined;
};

type SettingsScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'SettingsScreen'>;
};

interface NotificationSettings {
  bookingUpdates: boolean;
  jobMatches: boolean;
  promotions: boolean;
  chatMessages: boolean;
  paymentUpdates: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

interface AppSettings {
  language: string;
  currency: string;
  theme: 'light' | 'dark' | 'system';
  units: 'imperial' | 'metric';
  autoLocationUpdate: boolean;
  biometricAuth: boolean;
}

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'cleaner';
  joinDate: string;
  totalBookings: number;
  rating: number;
  avatarUrl?: string | null;
}

interface VerificationSafetyStatus {
  verification_status: string | null;
  background_check_status: string | null;
  background_check_date: string | null;
  stripe_onboarding_complete: boolean | null;
  stripe_account_id: string | null;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { signOut, user, isAuthenticated, isCleaner, refreshUser } = useAuth();

  /** Same intent as ProfileType “Become a ChoreHero”, but skips the account-type picker when you’re already signed in. */
  const navigateToCleanerSignup = async () => {
    if (!user?.id) {
      if (navigationRef.isReady()) navigationRef.navigate('AuthScreen' as never);
      return;
    }
    try {
      await AsyncStorage.setItem('pending_auth_role', 'cleaner');
    } catch {
      // no-op
    }
    const profilePayload = {
      id: user.id,
      email: user.email || null,
      name: user.name || null,
      phone: user.phone || null,
      username: (user as { username?: string | null }).username || null,
      role: 'cleaner' as const,
      cleaner_onboarding_state: 'APPLICANT',
      cleaner_onboarding_step: 1,
    };
    const { error } = await supabase.from('users').upsert(profilePayload, { onConflict: 'id' });
    if (error) console.warn('Failed to persist cleaner intent:', error);
    await refreshUser().catch(() => {});
    if (navigationRef.isReady()) {
      navigationRef.navigate('CleanerOnboarding' as never);
    }
  };
  
  // Dynamic theme colors based on user role
  const themeColor = isCleaner ? '#FFA52F' : '#26B7C9';
  const themeColorLight = isCleaner ? '#FFF3E0' : '#E0F7FA';
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [guestRole, setGuestRole] = useState<'customer' | 'cleaner' | null>(null);
  const [verificationSafety, setVerificationSafety] = useState<VerificationSafetyStatus>({
    verification_status: null,
    background_check_status: null,
    background_check_date: null,
    stripe_onboarding_complete: null,
    stripe_account_id: null,
  });
  const [notifications, setNotifications] = useState<NotificationSettings>({
    bookingUpdates: true,
    jobMatches: true,
    promotions: false,
    chatMessages: true,
    paymentUpdates: true,
    pushEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
  });
  const [appSettings, setAppSettings] = useState<AppSettings>({
    language: 'English',
    currency: 'USD',
    theme: 'system',
    units: 'imperial',
    autoLocationUpdate: true,
    biometricAuth: false,
  });

  useEffect(() => {
    loadSettings();
  }, [user?.id, isCleaner]);

  // Keep profile preview in sync with auth user updates (e.g., avatar change)
  useEffect(() => {
    if (!user) return;
    setUserProfile(prev => ({
      name: (user as any).name || prev?.name || 'Customer',
      email: (user as any).email || prev?.email || '',
      phone: (user as any).phone || prev?.phone || '',
      role: ((user as any).role || prev?.role || 'customer') as 'customer' | 'cleaner',
      joinDate: (user as any).created_at || prev?.joinDate || new Date().toISOString(),
      totalBookings: prev?.totalBookings ?? 0,
      rating: prev?.rating ?? 5.0,
      avatarUrl: (user as any).avatar_url || null,
    }));
  }, [user?.avatar_url, (user as any)?.name, (user as any)?.email]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (user) {
        if (isCleaner && user.id) {
          const { data: cleanerProfile } = await supabase
            .from('cleaner_profiles')
            .select(
              'verification_status, background_check_status, background_check_date, stripe_onboarding_complete, stripe_account_id'
            )
            .eq('user_id', user.id)
            .maybeSingle();
          setVerificationSafety({
            verification_status: cleanerProfile?.verification_status ?? null,
            background_check_status: cleanerProfile?.background_check_status ?? null,
            background_check_date: cleanerProfile?.background_check_date ?? null,
            stripe_onboarding_complete: cleanerProfile?.stripe_onboarding_complete ?? null,
            stripe_account_id: cleanerProfile?.stripe_account_id ?? null,
          });
        } else {
          setVerificationSafety({
            verification_status: null,
            background_check_status: null,
            background_check_date: null,
            stripe_onboarding_complete: null,
            stripe_account_id: null,
          });
        }
        setUserProfile({
          name: (user as any).name || 'Customer',
          email: (user as any).email || '',
          phone: (user as any).phone || '',
          role: ((user as any).role || 'customer') as 'customer' | 'cleaner',
          joinDate: (user as any).created_at || new Date().toISOString(),
          totalBookings: 0,
          rating: 5.0,
          avatarUrl: (user as any).avatar_url || null,
        });
      } else {
        // Load guest role preference
        const storedGuestRole = await AsyncStorage.getItem('guest_user_role');
        const role = (storedGuestRole === 'cleaner' ? 'cleaner' : 'customer') as 'customer' | 'cleaner';
        setGuestRole(storedGuestRole as 'customer' | 'cleaner' | null);
        
        setUserProfile({
          name: 'Guest',
          email: '',
          phone: '',
          role: role,
          joinDate: new Date().toISOString(),
          totalBookings: 0,
          rating: 5.0,
          avatarUrl: null,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const updateNotificationSetting = (key: keyof NotificationSettings, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const updateAppSetting = (key: keyof AppSettings, value: any) => {
    setAppSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            // Use proper signOut from useAuth
            await signOut();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Unable to identify user account');
      return;
    }

    try {
      // First, show deletion impact to user
      const impactResult = await accountDeletionService.getAccountDeletionImpact(user.id);
      
      if (impactResult.success) {
        const { active_bookings, content_posts, reviews_given, reviews_received } = impactResult.data;
        
        let impactMessage = 'This action cannot be undone. Your account and personal data will be permanently deleted.\n\n';
        
        if (active_bookings > 0) {
          impactMessage += `⚠️ You have ${active_bookings} active booking(s) that will be cancelled.\n`;
        }
        if (content_posts > 0) {
          impactMessage += `📱 ${content_posts} content post(s) will be deleted.\n`;
        }
        if (reviews_given > 0) {
          impactMessage += `⭐ ${reviews_given} review(s) you wrote will be anonymized.\n`;
        }
        if (reviews_received > 0) {
          impactMessage += `💬 ${reviews_received} review(s) about you will remain for other users.\n`;
        }

        Alert.alert(
          'Delete Account',
          impactMessage,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete Account',
              style: 'destructive',
              onPress: async () => {
                setIsLoading(true);
                await performAccountDeletion();
              },
            },
          ]
        );
      } else {
        // Fallback if impact check fails
        Alert.alert(
          'Delete Account',
          'This action cannot be undone. Your account and all data will be permanently deleted.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete Account',
              style: 'destructive',
              onPress: async () => {
                setIsLoading(true);
                await performAccountDeletion();
              },
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to process account deletion request');
    }
  };

  const performAccountDeletion = async () => {
    if (!user?.id) return;

    try {
      const result = await accountDeletionService.deleteAccount(user.id, {
        export_data: false,
        cancel_subscriptions: true,
      });

      if (result.success) {
        try {
          await AsyncStorage.clear();
        } catch {
          // ignore
        }
        await signOut();
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Welcome' }],
          })
        );
        Alert.alert('Account deleted', 'Your account and associated data have been removed.');
      } else {
        throw new Error(result.error || 'Deletion failed');
      }
    } catch (error) {
      Alert.alert(
        'Deletion Failed',
        `Unable to delete account: ${error instanceof Error ? error.message : 'Unknown error'}. Please contact support.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Check out ChoreHero - the best cleaning service app! Download it now.',
        url: 'https://chorehero.app',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'Choose how you\'d like to contact our support team:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Email',
          onPress: () => Linking.openURL('mailto:support@chorehero.app'),
        },
        {
          text: 'Phone',
          onPress: () => Linking.openURL('tel:+1-555-HERO-123'),
        },
      ]
    );
  };

  const handleIdentityVerification = () => {
    Alert.alert(
      'Identity verification',
      'Identity verification link will be added here. This section is ready for provider integration.',
      [{ text: 'OK' }]
    );
  };

  const handleBackgroundCheck = () => {
    Alert.alert(
      'Background check',
      'Background check link will be added here. This section is ready for provider integration.',
      [{ text: 'OK' }]
    );
  };

  const handlePayoutSetup = () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('PayoutSetup' as never);
    } else {
      navigation.navigate('PayoutSetup' as any);
    }
  };

  const payoutsReady = verificationSafety.stripe_onboarding_complete === true;
  const payoutsStarted = !payoutsReady && !!verificationSafety.stripe_account_id;

  const identityVerified = verificationSafety.verification_status === 'verified';
  const backgroundCleared =
    verificationSafety.background_check_status === 'cleared' ||
    verificationSafety.background_check_status === 'verified' ||
    !!verificationSafety.background_check_date;

  const handleChangeAvatar = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please sign in to change your profile photo');
      return;
    }

    const persistAvatar = async (uri: string) => {
      try {
        // Wait for app to be active after ImagePicker (avoids session loss on resume)
        if (AppState.currentState !== 'active') {
          await new Promise<void>((resolve) => {
            const sub = AppState.addEventListener('change', (s) => {
              if (s === 'active') {
                sub.remove();
                setTimeout(resolve, 400);
              }
            });
            if (AppState.currentState === 'active') {
              sub.remove();
              setTimeout(resolve, 400);
            }
          });
        } else {
          await new Promise((r) => setTimeout(r, 400));
        }
        let urlToSave = uri;
        if (uri.startsWith('file://')) {
          const upload = await uploadService.uploadFile(uri, 'image');
          if (!upload.success || !upload.url) {
            Alert.alert('Upload failed', 'Could not upload photo. Please try again.');
            return;
          }
          urlToSave = upload.url;
        }
        const { error } = await supabase
          .from('users')
          .update({ avatar_url: urlToSave, updated_at: new Date().toISOString() })
          .eq('id', user.id);
        if (error) throw error;
        setUserProfile(prev => prev ? { ...prev, avatarUrl: urlToSave } : null);
        await refreshUser();
        // Reflect the new avatar in the cleaner dashboard's profile-completion
        // checklist on next focus (no-op for customer accounts).
        if (isCleaner) {
          try {
            void useCleanerStore.getState().refreshData();
          } catch {
            // no-op
          }
        }
        Alert.alert('Success', 'Profile photo updated');
      } catch (error) {
        console.error('Error updating avatar:', error);
        Alert.alert('Error', 'Failed to update profile photo');
      }
    };

    Alert.alert('Profile Photo', 'Choose a source', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow camera access to take a photo');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled && result.assets?.[0]?.uri) {
            await persistAvatar(result.assets[0].uri);
          }
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow photo library access');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled && result.assets?.[0]?.uri) {
            await persistAvatar(result.assets[0].uri);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderSettingsSection = (title: string, items: React.ReactNode[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {items.map((item, index) => (
          <View key={index}>
            {item}
            {index < items.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </View>
    </View>
  );

  const renderSettingsItem = (
    icon: string,
    title: string,
    subtitle?: string,
    rightContent?: React.ReactNode,
    onPress?: () => void,
    showChevron = false
  ) => (
    <View style={styles.settingsItem}>
      <Row
        leadingIcon={icon as any}
        leadingIconColor={isCleaner ? themeColor : undefined}
        iconLeadBackgroundColor={isCleaner ? themeColorLight : undefined}
        title={title}
        subtitle={subtitle}
        trailing={rightContent as any}
        chevron={showChevron}
        onPress={onPress}
      />
    </View>
  );

  const renderSwitchItem = (
    icon: string,
    title: string,
    subtitle: string,
    value: boolean,
    onValueChange: (value: boolean) => void
  ) => renderSettingsItem(
    icon,
    title,
    subtitle,
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#E5E7EB', true: themeColor }}
      thumbColor="#FFFFFF"
      ios_backgroundColor="#E5E7EB"
    />
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColor} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        {userProfile && (
          <View style={styles.profileSection}>
            <View style={styles.profileInfo}>
              <TouchableOpacity 
                style={[styles.profileAvatar, { backgroundColor: themeColor, shadowColor: themeColor }]}
                onPress={isAuthenticated ? handleChangeAvatar : undefined}
                disabled={!isAuthenticated}
                activeOpacity={0.8}
              >
                {userProfile.avatarUrl ? (
                  <Image source={{ uri: userProfile.avatarUrl }} style={styles.profileAvatarImage} />
                ) : (
                  <Text style={styles.profileAvatarText}>
                    {userProfile.name.split(' ').map(n => n[0]).join('')}
                  </Text>
                )}
                {isAuthenticated && (
                  <View style={[styles.cameraOverlay, { backgroundColor: themeColor }]}>
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.profileDetails}>
                <Text style={styles.profileName}>{userProfile.name}</Text>
                <Text style={styles.profileEmail}>{userProfile.email}</Text>
                <View style={styles.profileStats}>
                  <Text style={[styles.profileStat, { color: themeColor }]}>
                    {userProfile.totalBookings} bookings
                  </Text>
                  <Text style={styles.profileStatDot}>•</Text>
                  <Text style={[styles.profileStat, { color: themeColor }]}>
                    {userProfile.rating}★ rating
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Guest Mode Settings */}
        {!isAuthenticated && renderSettingsSection('Guest Mode', [
          renderSettingsItem(
            'information-circle-outline',
            'About Guest Mode',
            `You're using ChoreHero in ${guestRole || 'customer'} mode`,
            undefined,
            () => Alert.alert(
              'Guest Mode',
              'You are browsing without an account. Create an account to save your preferences and bookings.',
              [{ text: 'OK' }]
            ),
            true
          ),
        ])}

        {/* Account Settings */}
        {isAuthenticated && renderSettingsSection('Account', [
          renderSettingsItem(
            'git-compare-outline',
            'Customer or pro',
            'One login — switch by choosing account type',
            undefined,
            () =>
              Alert.alert(
                'Customer or pro account',
                'You have one login. To offer services, continue into cleaner signup — you can finish onboarding there. To only book services, stay on the customer experience.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Continue as a ChoreHero (cleaner)',
                    onPress: () => {
                      void navigateToCleanerSignup();
                    },
                  },
                ]
              ),
            true
          ),
          // "Profile Information" row removed — both Customer and Cleaner now
          // surface "Edit profile" directly from their Profile screen quick
          // actions, so this Settings entry was redundant.
          renderSettingsItem(
            'card-outline',
            'Payment Methods',
            'Manage your payment options',
            undefined,
            () => navigation.navigate('PaymentScreen', { fromBooking: false }),
            true
          ),
          renderSettingsItem(
            'location-outline',
            'Addresses',
            'Manage saved addresses',
            undefined,
            () => navigation.navigate('AddressManagementScreen'),
            true
          ),
          renderSettingsItem(
            'shield-checkmark-outline',
            'Privacy & Security',
            'Control your privacy settings',
            undefined,
            () => navigation.navigate('PrivacyScreen'),
            true
          ),
        ])}

        {isAuthenticated && isCleaner && renderSettingsSection('Verification & Safety', [
          renderSettingsItem(
            'id-card-outline',
            'Identity verification',
            identityVerified ? 'Verified' : 'Complete identity check to build trust',
            <View style={[styles.statusPill, identityVerified ? styles.statusPillDone : styles.statusPillPending]}>
              <Text style={[styles.statusPillText, identityVerified ? styles.statusPillTextDone : styles.statusPillTextPending]}>
                {identityVerified ? 'Verified' : 'Pending'}
              </Text>
            </View>,
            handleIdentityVerification,
            true
          ),
          renderSettingsItem(
            'shield-checkmark-outline',
            'Background check',
            backgroundCleared
              ? 'Cleared and on file'
              : 'Submit and track your background check status',
            <View style={[styles.statusPill, backgroundCleared ? styles.statusPillDone : styles.statusPillPending]}>
              <Text style={[styles.statusPillText, backgroundCleared ? styles.statusPillTextDone : styles.statusPillTextPending]}>
                {backgroundCleared ? 'Cleared' : 'Pending'}
              </Text>
            </View>,
            handleBackgroundCheck,
            true
          ),
          renderSettingsItem(
            'card-outline',
            'Payouts',
            payoutsReady
              ? 'Connected — earnings go straight to your bank'
              : payoutsStarted
                ? 'Verification in progress with Stripe'
                : 'Set up Stripe to receive payouts',
            <View style={[styles.statusPill, payoutsReady ? styles.statusPillDone : styles.statusPillPending]}>
              <Text style={[styles.statusPillText, payoutsReady ? styles.statusPillTextDone : styles.statusPillTextPending]}>
                {payoutsReady ? 'Ready' : payoutsStarted ? 'In review' : 'Not set up'}
              </Text>
            </View>,
            handlePayoutSetup,
            true
          ),
        ])}

        {/* Notifications */}
        {renderSettingsSection('Notifications', [
          renderSwitchItem(
            'notifications-outline',
            'Push Notifications',
            'Receive notifications on your device',
            notifications.pushEnabled,
            (value) => updateNotificationSetting('pushEnabled', value)
          ),
          renderSwitchItem(
            'mail-outline',
            'Email Notifications',
            'Receive updates via email',
            notifications.emailEnabled,
            (value) => updateNotificationSetting('emailEnabled', value)
          ),
          renderSwitchItem(
            'chatbubble-outline',
            'SMS Notifications',
            'Receive text messages for important updates',
            notifications.smsEnabled,
            (value) => updateNotificationSetting('smsEnabled', value)
          ),
          renderSwitchItem(
            'calendar-outline',
            'Booking Updates',
            'Get notified about booking changes',
            notifications.bookingUpdates,
            (value) => updateNotificationSetting('bookingUpdates', value)
          ),
          renderSwitchItem(
            'briefcase-outline',
            'Job Matches',
            'New job opportunities for cleaners',
            notifications.jobMatches,
            (value) => updateNotificationSetting('jobMatches', value)
          ),
          renderSwitchItem(
            'pricetag-outline',
            'Promotions',
            'Special offers and discounts',
            notifications.promotions,
            (value) => updateNotificationSetting('promotions', value)
          ),
          renderSettingsItem(
            'notifications-outline',
            'Notification Center',
            'View all notifications',
            undefined,
            () => navigation.navigate('NotificationsScreen'),
            true
          ),
        ])}

        {/* App Preferences */}
        {renderSettingsSection('App Preferences', [
          renderSwitchItem(
            'location-outline',
            'Auto Location Updates',
            'Automatically update your location',
            appSettings.autoLocationUpdate,
            (value) => updateAppSetting('autoLocationUpdate', value)
          ),
          renderSwitchItem(
            'finger-print-outline',
            'Biometric Authentication',
            'Use Face ID or Touch ID to unlock',
            appSettings.biometricAuth,
            (value) => updateAppSetting('biometricAuth', value)
          ),
        ])}

        {/* Admin (founder only) */}
        {(ADMIN_EMAILS.includes((user?.email || '').toLowerCase()) ||
          (user as any)?.role === 'admin') &&
          renderSettingsSection('Admin', [
            renderSettingsItem(
              'construct-outline',
              'Admin Dashboard',
              'Jobs, bookings, manual actions',
              undefined,
              () => navigation.navigate('AdminDashboard' as any),
              true
            ),
          ])}

        {/* Support & About */}
        {renderSettingsSection('Support & About', [
          renderSettingsItem(
            'help-circle-outline',
            'Help Center',
            'Get help and find answers',
            undefined,
            () => navigation.navigate('HelpScreen'),
            true
          ),
          renderSettingsItem(
            'chatbubble-ellipses-outline',
            'Contact Support',
            'Reach out to our support team',
            undefined,
            handleContactSupport,
            true
          ),
          renderSettingsItem(
            'share-outline',
            'Share ChoreHero',
            'Tell your friends about us',
            undefined,
            handleShare,
            true
          ),
          renderSettingsItem(
            'information-circle-outline',
            'About',
            'App version and legal information',
            undefined,
            () => navigation.navigate('AboutScreen'),
            true
          ),
        ])}

        {/* Legal */}
        {renderSettingsSection('Legal', [
          renderSettingsItem(
            'document-text-outline',
            'Terms of Service',
            'Read our terms and conditions',
            undefined,
            () => navigation.navigate('TermsScreen'),
            true
          ),
          renderSettingsItem(
            'shield-outline',
            'Privacy Policy',
            'How we handle your data',
            undefined,
            () => navigation.navigate('PrivacyScreen'),
            true
          ),
        ])}

        {/* Account Actions */}
        {renderSettingsSection('Account Actions', [
          renderSettingsItem(
            'log-out-outline',
            'Sign Out',
            'Sign out of your account',
            undefined,
            handleLogout,
            false
          ),
          renderSettingsItem(
            'trash-outline',
            'Delete Account',
            'Permanently delete your account',
            undefined,
            handleDeleteAccount,
            false
          ),
        ])}

        {/* Version Info */}
        <View style={styles.versionSection}>
          <Text style={styles.versionText}>ChoreHero v1.0.0</Text>
          <Text style={styles.versionSubtext}>Made with ✨ in Georgia</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: wp('4%'),
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    backgroundColor: '#F3F4F6',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: wp('5.5%'),
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: wp('4%'),
    marginTop: hp('1%'),
    marginBottom: hp('1%'),
    borderRadius: wp('4%'),
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2.5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: wp('8%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  profileAvatarImage: {
    width: 64,
    height: 64,
    borderRadius: wp('8%'),
  },
  profileAvatarText: {
    fontSize: wp('6%'),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp('0.5%'),
  },
  profileEmail: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginBottom: hp('1%'),
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileStat: {
    fontSize: 13,
    fontWeight: '500',
  },
  profileStatDot: {
    fontSize: wp('3%'),
    color: '#D1D5DB',
    marginHorizontal: wp('2%'),
  },
  section: {
    marginTop: hp('2%'),
  },
  sectionTitle: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: hp('1.5%'),
    marginHorizontal: wp('5%'),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: wp('4%'),
    borderRadius: wp('4%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  settingsItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: wp('2.5%'),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  settingsItemSubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  settingsItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusPillDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusPillPending: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPillTextDone: {
    color: '#047857',
  },
  statusPillTextPending: {
    color: '#B45309',
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 66,
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: hp('4%'),
    paddingHorizontal: wp('5%'),
  },
  versionText: {
    fontSize: wp('3.5%'),
    color: '#9CA3AF',
    marginBottom: hp('0.5%'),
    fontWeight: '500',
  },
  versionSubtext: {
    fontSize: wp('3%'),
    color: '#D1D5DB',
  },
});

export default SettingsScreen; 