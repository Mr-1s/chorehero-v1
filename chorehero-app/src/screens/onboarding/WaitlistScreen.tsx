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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../services/supabase';

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
  const { zip, city, state } = route.params || {};
  const [phone, setPhone] = useState('');
  const [serviceNeeded, setServiceNeeded] = useState(SERVICES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isValidPhone = phone.replace(/\D/g, '').length === 10;

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

      Alert.alert(
        "You're on the list!",
        "We'll text you a $20 credit at launch.",
        [
          {
            text: 'Done',
            onPress: () =>
              navigation.reset({
                index: 0,
                routes: [
                  {
                    name: 'MainTabs',
                    params: { screen: 'Content', params: { source: 'global' } },
                  },
                ],
              }),
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
      <StatusBar barStyle="light-content" backgroundColor="#06b6d4" />
      <LinearGradient colors={['#06b6d4', '#0891b2']} style={styles.gradient}>
        <View style={styles.card}>
          <Text style={styles.title}>ChoreHero is coming soon!</Text>
          <Text style={styles.subtitle}>
            {city ? `ChoreHero is coming to ${city}${state ? `, ${state}` : ''} soon!` : 'Join the waitlist.'}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
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

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={async () => {
                await AsyncStorage.setItem('guest_user_role', 'customer');
                await AsyncStorage.setItem('guest_zip', 'global');
                navigation.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'MainTabs',
                      params: { screen: 'Content', params: { source: 'global' } },
                    },
                  ],
                });
              }}
            >
              <Text style={styles.secondaryButtonText}>See all heroes</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  title: { fontSize: 22, fontWeight: '800', color: '#1F2937', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6B7280', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 8,
    color: '#111827',
  },
  serviceList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  serviceChip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  serviceChipActive: { backgroundColor: '#26B7C9', borderColor: '#26B7C9' },
  serviceText: { color: '#6B7280', fontWeight: '600', fontSize: 12 },
  serviceTextActive: { color: '#fff' },
  primaryButton: {
    marginTop: 20,
    backgroundColor: '#26B7C9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#26B7C9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#26B7C9', fontWeight: '700' },
});

export default WaitlistScreen;
