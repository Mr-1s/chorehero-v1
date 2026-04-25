import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase';
import { wp, hp } from '../../utils/responsive';
import { useAuth } from '../../hooks/useAuth';
import { updateGuestSession } from '../../utils/guestSession';
import { getResetToMainTabsChoresAction } from '../../navigation/mainTabsContentNavigation';

interface WaitlistProps {
  route: { params: { zip: string; city?: string; state?: string } };
  navigation: any;
}

const SERVICES = [
  'Standard Cleaning',
  'Deep Cleaning',
  'Move In/Out',
  'Laundry Help',
  'Organization',
  'Other',
];

const WaitlistScreen: React.FC<WaitlistProps> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { enterGuestMode, user, refreshUser } = useAuth();
  const { zip, city, state } = route.params || {};
  const [phone, setPhone] = useState('');
  const [serviceNeeded, setServiceNeeded] = useState(SERVICES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isValidPhone = phone.replace(/\D/g, '').length === 10;

  /** Keep customer vs pro stacks from crossing: pin role + storage, then land on customer Chores feed. */
  const pinCustomerIntent = async () => {
    if (user?.id) {
      const { data: row } = await supabase
        .from('users')
        .select('role, customer_onboarding_state, customer_onboarding_step')
        .eq('id', user.id)
        .maybeSingle();
      if (row?.role === 'cleaner') {
        return;
      }
      await supabase.from('users').upsert(
        {
          id: user.id,
          email: user.email ?? null,
          name: user.name ?? null,
          phone: user.phone ?? null,
          role: 'customer',
          customer_onboarding_state: row?.customer_onboarding_state || 'IDENTITY_PENDING',
          customer_onboarding_step: row?.customer_onboarding_step ?? 1,
          is_active: true,
        },
        { onConflict: 'id' }
      );
    }
    await AsyncStorage.multiSet([
      ['guest_user_role', 'customer'],
      ['pending_auth_role', 'customer'],
    ]);
    try {
      await refreshUser();
    } catch {
      /* ignore */
    }
  };

  const goToCustomerChoresFeed = () => {
    navigation.dispatch(getResetToMainTabsChoresAction({ source: 'main' }));
  };

  const handleBrowseFeed = async () => {
    await enterGuestMode();
    await AsyncStorage.multiSet([
      ['guest_zip', zip || ''],
      ['guest_city', city || ''],
      ['guest_state', state || ''],
      ['guest_user_role', 'customer'],
      ['pending_auth_role', 'customer'],
    ]);
    await updateGuestSession({ location: { zip: zip || '', city: city || '', state: state || '' } });
    goToCustomerChoresFeed();
  };

  const handleSubmit = async () => {
    if (!isValidPhone) {
      Alert.alert('Phone Required', 'Enter your phone number.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('waitlist_leads').insert({
        phone: phone.replace(/\D/g, ''),
        zip_code: zip,
        city: city || null,
        state: state || null,
        primary_service_needed: serviceNeeded,
      });
      if (error) throw error;

      await pinCustomerIntent();

      Alert.alert(
        "You're on the list!",
        "We'll text you a $20 credit at launch.",
        [
          {
            text: 'Done',
            onPress: () => goToCustomerChoresFeed(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Waitlist', 'Failed to submit. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#26B7C9" />
      <LinearGradient colors={['#26B7C9', '#047B9B']} style={styles.gradient}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            automaticallyAdjustKeyboardInsets={true}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View>
                <View style={[styles.header, { paddingTop: insets.top + hp('0.5%') }]}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      if (navigation?.canGoBack?.()) {
                        navigation.goBack();
                        return;
                      }
                      navigation.navigate('LocationLock');
                    }}
                  >
                    <Ionicons name="arrow-back" size={22} color="#047B9B" />
                  </TouchableOpacity>
                </View>
                <View style={styles.card}>
                  <Text style={styles.title}>ChoreHero is coming soon!</Text>
                  <Text style={styles.subtitle}>
                    {city ? `ChoreHero is coming to ${city}${state ? `, ${state}` : ''} soon!` : 'Join the waitlist.'}
                  </Text>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="(555) 555-5555"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, '').slice(0, 10);
                setPhone(digits);
              }}
            />

            <Text style={styles.label}>Primary Service Needed</Text>
            <View style={styles.serviceList}>
              {SERVICES.map((service) => (
                <TouchableOpacity
                  key={service}
                  style={[
                    styles.serviceChip,
                    serviceNeeded === service && styles.serviceChipActive,
                  ]}
                  onPress={() => setServiceNeeded(service)}
                >
                  <Text
                    style={[
                      styles.serviceText,
                      serviceNeeded === service && styles.serviceTextActive,
                    ]}
                  >
                    {service}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (!isValidPhone || isSubmitting) && styles.primaryButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!isValidPhone || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Join Waitlist</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.browseFeedLink} onPress={handleBrowseFeed}>
              <Ionicons name="play-circle-outline" size={16} color="#047B9B" />
              <Text style={styles.browseFeedText}>Browse feed</Text>
            </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, padding: wp('5%') },
  keyboardAvoid: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: hp('30%'),
  },
  header: {
    paddingTop: hp('0.7%'),
    paddingBottom: hp('1.5%'),
  },
  backButton: {
    width: wp('10%'),
    height: wp('10%'),
    borderRadius: wp('5%'),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: wp('5%'),
    padding: wp('6%'),
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  title: { fontSize: wp('5.5%'), fontWeight: '800', color: '#1F2937', marginBottom: hp('1%') },
  subtitle: { fontSize: wp('3.5%'), color: '#6B7280', marginBottom: hp('2%') },
  label: { fontSize: wp('3.2%'), fontWeight: '700', color: '#374151', marginTop: hp('1.5%') },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: wp('3%'),
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('3%'),
    marginTop: hp('1%'),
    color: '#111827',
  },
  serviceList: { flexDirection: 'row', flexWrap: 'wrap', gap: wp('2%'), marginTop: hp('1%') },
  serviceChip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: hp('1%'),
    paddingHorizontal: wp('3%'),
    borderRadius: 999,
  },
  serviceChipActive: { backgroundColor: '#26B7C9', borderColor: '#26B7C9' },
  serviceText: { color: '#6B7280', fontWeight: '600', fontSize: wp('3%') },
  serviceTextActive: { color: '#fff' },
  primaryButton: {
    marginTop: hp('2.5%'),
    backgroundColor: '#26B7C9',
    paddingVertical: hp('1.7%'),
    borderRadius: wp('3%'),
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: '#fff', fontSize: wp('4%'), fontWeight: '700' },
  secondaryButton: {
    marginTop: hp('1.5%'),
    borderWidth: 1,
    borderColor: '#26B7C9',
    borderRadius: wp('3%'),
    paddingVertical: hp('1.5%'),
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#26B7C9', fontWeight: '700' },
  browseFeedLink: {
    marginTop: hp('1.5%'),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('1.5%'),
  },
  browseFeedText: { color: '#047B9B', fontWeight: '600', fontSize: wp('3.5%') },
});

export default WaitlistScreen;
