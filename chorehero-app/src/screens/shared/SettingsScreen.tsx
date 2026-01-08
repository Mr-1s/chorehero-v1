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
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { accountDeletionService } from '../../services/accountDeletionService';
import { supabase } from '../../services/supabase';

type StackParamList = {
  SettingsScreen: undefined;
  PaymentScreen: { fromBooking?: boolean };
  AuthScreen: undefined;
  HelpScreen: undefined;
  PrivacyScreen: undefined;
  TermsScreen: undefined;
  MainTabs: undefined;
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

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { signOut, user, isAuthenticated, isCleaner, refreshUser } = useAuth();
  
  // Dynamic theme colors based on user role
  const themeColor = isCleaner ? '#FFA52F' : '#3ad3db';
  const themeColorLight = isCleaner ? '#FFF3E0' : '#E0F7FA';
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [guestRole, setGuestRole] = useState<'customer' | 'cleaner' | null>(null);
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
  }, []);

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

  const switchGuestRole = async () => {
    if (isAuthenticated) return; // Only for guest users
    
    const newRole = guestRole === 'customer' ? 'cleaner' : 'customer';
    
    Alert.alert(
      'Switch Experience',
      `Switch to ${newRole} mode? This will change your app experience and you'll need to restart the app.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            try {
              await AsyncStorage.setItem('guest_user_role', newRole);
              setGuestRole(newRole);
              setUserProfile(prev => prev ? { ...prev, role: newRole } : null);
              
              Alert.alert(
                'Experience Switched',
                `You're now in ${newRole} mode. Please restart the app to see the changes.`,
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Error switching guest role:', error);
              Alert.alert('Error', 'Failed to switch experience. Please try again.');
            }
          }
        }
      ]
    );
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

  const handleSwitchAccount = async () => {
    try {
      if (!isAuthenticated) {
        Alert.alert('Error', 'No account to switch from');
        return;
      }

      if (isAuthenticated) {
        // For real authenticated users, we need to implement account type switching in the database
        // This would require updating the user's role in the database
        Alert.alert(
          'Switch Account Type',
          'Account type switching for authenticated users is not yet implemented. Please contact support.',
          [{ text: 'OK' }]
        );
        return;
      }

      // For demo users, switch demo role
      const currentRole = isCleaner ? 'cleaner' : 'customer';
      const newRole = currentRole === 'cleaner' ? 'customer' : 'cleaner';
      
      Alert.alert(
        'Switch Account Type',
        `Switch from ${currentRole} to ${newRole}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Switch',
            onPress: async () => {
              try {
                // Use the proper demo system
                const cleanerType = newRole === 'cleaner' ? 'sarah' : undefined;
                // Demo functionality removed - contact support for account type changes
                
                Alert.alert(
                  'Account Switched',
                  `You are now using the app as a ${newRole}. The interface will update automatically.`,
                  [{ text: 'OK' }]
                );
              } catch (error) {
                console.error('Error switching account:', error);
                Alert.alert('Error', 'Failed to switch account type');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error in handleSwitchAccount:', error);
      Alert.alert('Error', 'Failed to switch account type');
    }
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
        export_data: true,
        soft_delete_active_bookings: true,
        anonymize_reviews: true,
        cancel_subscriptions: true,
        delete_media_files: true
      });

      if (result.success) {
        // If data was exported, we could offer to download it here
        Alert.alert(
          'Account Deleted',
          'Your account has been deleted successfully. Your data has been exported and any active bookings have been handled appropriately.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Clear local storage and navigate to auth
                AsyncStorage.clear();
                navigation.navigate('AuthScreen');
              }
            }
          ]
        );
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

  const handleChangeAvatar = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please sign in to change your profile photo');
      return;
    }

    const persistAvatar = async (uri: string) => {
      try {
        const { error } = await supabase
          .from('users')
          .update({ avatar_url: uri, updated_at: new Date().toISOString() })
          .eq('id', user.id);
        
        if (error) throw error;
        
        setUserProfile(prev => prev ? { ...prev, avatarUrl: uri } : null);
        await refreshUser();
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
    <TouchableOpacity
      style={styles.settingsItem}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingsItemLeft}>
        <View style={[styles.settingsIcon, { backgroundColor: themeColorLight }]}>
          <Ionicons name={icon as any} size={20} color={themeColor} />
        </View>
        <View style={styles.settingsItemContent}>
          <Text style={styles.settingsItemTitle}>{title}</Text>
          {subtitle && (
            <Text style={styles.settingsItemSubtitle}>{subtitle}</Text>
          )}
        </View>
      </View>
      <View style={styles.settingsItemRight}>
        {rightContent}
        {showChevron && (
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        )}
      </View>
    </TouchableOpacity>
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
            'swap-horizontal-outline',
            'Switch Experience',
            `Currently in ${guestRole || 'customer'} mode`,
            undefined,
            switchGuestRole,
            true
          ),
          renderSettingsItem(
            'information-circle-outline',
            'About Guest Mode',
            'You\'re using ChoreHero without an account',
            undefined,
            () => Alert.alert(
              'Guest Mode',
              'You\'re currently using ChoreHero as a guest. You can switch between customer and cleaner experiences, but your data won\'t be saved. Create an account to save your preferences and bookings.',
              [{ text: 'OK' }]
            ),
            true
          ),
        ])}

        {/* Account Settings */}
        {isAuthenticated && renderSettingsSection('Account', [
          renderSettingsItem(
            'person-outline',
            'Profile Information',
            'Update your personal details',
            undefined,
            () => navigation.navigate('EditProfileScreen'),
            true
          ),
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
          renderSettingsItem(
            'language-outline',
            'Language',
            appSettings.language,
            undefined,
            () => Alert.alert('Language', 'Language selection not yet implemented'),
            true
          ),
          renderSettingsItem(
            'cash-outline',
            'Currency',
            appSettings.currency,
            undefined,
            () => Alert.alert('Currency', 'Currency selection not yet implemented'),
            true
          ),
          renderSettingsItem(
            'moon-outline',
            'Theme',
            `${appSettings.theme.charAt(0).toUpperCase()}${appSettings.theme.slice(1)}`,
            undefined,
            () => Alert.alert('Theme', 'Theme selection not yet implemented'),
            true
          ),
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
            'star-outline',
            'Rate ChoreHero',
            'Share your feedback on the App Store',
            undefined,
            () => Alert.alert('Rate App', 'App Store rating not yet implemented'),
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
            'swap-horizontal-outline',
            'Switch Account',
            'Switch between customer and cleaner',
            undefined,
            handleSwitchAccount,
            true
          ),
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
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F3F4F6',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
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
    borderRadius: 32,
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
    borderRadius: 32,
  },
  profileAvatarText: {
    fontSize: 24,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
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
    fontSize: 12,
    color: '#D1D5DB',
    marginHorizontal: 8,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    marginHorizontal: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingsItemContent: {
    flex: 1,
  },
  settingsItemTitle: {
    fontSize: 16,
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
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 66,
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  versionText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
    fontWeight: '500',
  },
  versionSubtext: {
    fontSize: 12,
    color: '#D1D5DB',
  },
});

export default SettingsScreen; 